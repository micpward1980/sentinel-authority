"""
Stripe Webhook Handler.
Listens for invoice.paid events and auto-records payment in SA billing system.
"""

import os
import logging
import stripe
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import BillingInvoice

logger = logging.getLogger("sentinel.stripe_webhook")

router = APIRouter()

WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


@router.post("/stripe", summary="Stripe webhook receiver")
async def stripe_webhook(request: Request):
    """Receives Stripe events. Auto-records payments when invoices are paid."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    # Verify webhook signature
    if WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        import json
        event = json.loads(payload)
        logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping signature verification")

    event_type = event.get("type", "")
    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "invoice.paid":
        await _handle_invoice_paid(event["data"]["object"])
    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(event["data"]["object"])
    elif event_type == "invoice.overdue":
        await _handle_overdue(event["data"]["object"])

    return {"received": True}


async def _handle_invoice_paid(stripe_invoice: dict):
    """Auto-record payment when Stripe confirms payment received."""
    sa_number = stripe_invoice.get("metadata", {}).get("sa_invoice_number", "")
    if not sa_number:
        logger.warning(f"Stripe invoice {stripe_invoice['id']} has no SA invoice number in metadata")
        return

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(BillingInvoice).where(BillingInvoice.invoice_number == sa_number)
            )
            inv = result.scalar_one_or_none()
            if not inv:
                logger.warning(f"SA invoice {sa_number} not found for Stripe payment")
                return

            if inv.status == "paid":
                logger.info(f"SA invoice {sa_number} already marked paid — skipping")
                return

            # Record payment
            amount_paid = stripe_invoice.get("amount_paid", 0) // 100  # cents to dollars
            inv.status = "paid"
            inv.paid_at = datetime.utcnow()
            inv.paid_amount = amount_paid
            inv.payment_method = _detect_method(stripe_invoice)
            inv.payment_reference = f"stripe:{stripe_invoice['id']}"

            # Update reminders
            reminders = inv.reminders_sent or []
            reminders.append({"type": "payment_received", "sent_at": datetime.utcnow().isoformat(),
                              "stripe_invoice_id": stripe_invoice["id"]})
            inv.reminders_sent = reminders

            await db.commit()
            logger.info(f"Payment recorded: {sa_number} — ${amount_paid:,} via {inv.payment_method}")

            # If certificate was suspended for non-payment, reinstate it
            if inv.certificate_id:
                from app.models.models import Certificate
                cert_result = await db.execute(
                    select(Certificate).where(Certificate.id == inv.certificate_id)
                )
                cert = cert_result.scalar_one_or_none()
                if cert and cert.state == "suspended" and cert.suspension_reason and "overdue" in cert.suspension_reason.lower():
                    cert.state = "conformant"
                    cert.reinstated_at = datetime.utcnow()
                    cert.reinstatement_reason = f"Annual maintenance paid — {inv.invoice_number}"
                    await db.commit()
                    logger.info(f"Certificate {cert.certificate_number} reinstated after payment")

        except Exception as e:
            await db.rollback()
            logger.error(f"Webhook payment processing failed for {sa_number}: {e}")


async def _handle_payment_failed(stripe_invoice: dict):
    """Log payment failure."""
    sa_number = stripe_invoice.get("metadata", {}).get("sa_invoice_number", "")
    logger.warning(f"Payment failed for {sa_number} — Stripe invoice {stripe_invoice['id']}")


async def _handle_overdue(stripe_invoice: dict):
    """Mark SA invoice as overdue when Stripe reports it."""
    sa_number = stripe_invoice.get("metadata", {}).get("sa_invoice_number", "")
    if not sa_number:
        return
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(BillingInvoice).where(BillingInvoice.invoice_number == sa_number)
            )
            inv = result.scalar_one_or_none()
            if inv and inv.status not in ("paid", "cancelled"):
                inv.status = "overdue"
                await db.commit()
                logger.info(f"SA invoice {sa_number} marked overdue via Stripe webhook")
        except Exception as e:
            await db.rollback()
            logger.error(f"Overdue update failed for {sa_number}: {e}")


def _detect_method(stripe_invoice: dict) -> str:
    """Detect payment method from Stripe invoice."""
    charge = stripe_invoice.get("charge", "")
    if isinstance(charge, dict):
        pm = charge.get("payment_method_details", {})
        if "us_bank_account" in pm:
            return "ach"
        if "card" in pm:
            return "card"
    return "stripe"
