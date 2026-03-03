"""
Stripe Integration Service for Sentinel Authority Billing.
Creates invoices with hosted payment links. Handles webhooks for auto-payment recording.
"""

import os
import logging
import stripe

logger = logging.getLogger("sentinel.stripe")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

# ACH preferred at these amounts — 0.8% capped at $5 vs 2.9% on card
PAYMENT_METHODS = ["us_bank_account", "card", "customer_balance"]


async def get_or_create_customer(company_name: str, contact_email: str, contact_name: str = None) -> str:
    """Find existing Stripe customer by email, or create one."""
    if not stripe.api_key:
        logger.warning("STRIPE_SECRET_KEY not set")
        return ""
    
    # Search for existing customer
    if not contact_email:
        return ""
    existing = stripe.Customer.search(query=f'email:"{contact_email}"', limit=1)
    if existing.data:
        return existing.data[0].id
    
    # Create new customer
    customer = stripe.Customer.create(
        name=company_name,
        email=contact_email,
        metadata={"company": company_name, "contact_name": contact_name or ""},
    )
    logger.info(f"Stripe customer created: {customer.id} for {company_name}")
    return customer.id


async def create_stripe_invoice(
    company_name: str,
    contact_email: str,
    contact_name: str,
    description: str,
    unit_amount_dollars: int,
    system_count: int,
    invoice_number: str,
    invoice_type: str,
    due_days: int = 30,
) -> dict:
    """
    Create a Stripe invoice with line items and hosted payment page.
    Returns {invoice_id, hosted_url, status} or {error}.
    """
    if not stripe.api_key:
        logger.warning("STRIPE_SECRET_KEY not set — invoice created locally only")
        return {"error": "Stripe not configured", "invoice_id": None, "hosted_url": None}

    try:
        # Get or create customer
        customer_id = await get_or_create_customer(company_name, contact_email, contact_name)
        if not customer_id:
            return {"error": "Failed to create Stripe customer"}

        # Create invoice
        inv = stripe.Invoice.create(
            customer=customer_id,
            collection_method="send_invoice",
            days_until_due=due_days,
            payment_settings={"payment_method_types": PAYMENT_METHODS},
            metadata={
                "sa_invoice_number": invoice_number,
                "invoice_type": invoice_type,
                "company": company_name,
            },
            custom_fields=[
                {"name": "SA Invoice", "value": invoice_number},
            ],
        )

        # Add line item
        stripe.InvoiceItem.create(
            customer=customer_id,
            invoice=inv.id,
            price_data={
                "currency": "usd",
                "unit_amount": unit_amount_dollars * 100,
                "product_data": {"name": description},
            },
            quantity=system_count,
        )

        # Finalize and send
        finalized = stripe.Invoice.finalize_invoice(inv.id)
        stripe.Invoice.send_invoice(inv.id)

        logger.info(f"Stripe invoice {inv.id} created for {invoice_number} — ${unit_amount_dollars * system_count:,}")

        return {
            "invoice_id": finalized.id,
            "hosted_url": finalized.hosted_invoice_url,
            "pdf_url": finalized.invoice_pdf,
            "status": finalized.status,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error for {invoice_number}: {e}")
        return {"error": str(e), "invoice_id": None, "hosted_url": None}


async def create_stripe_subscription(
    company_name: str,
    contact_email: str,
    contact_name: str,
    system_count: int,
    invoice_number: str,
) -> dict:
    """Create a recurring annual subscription for maintenance fees."""
    if not stripe.api_key:
        return {"error": "Stripe not configured"}

    try:
        customer_id = await get_or_create_customer(company_name, contact_email, contact_name)
        if not customer_id:
            return {"error": "Failed to create customer"}

        # Create a price for annual maintenance
        price = stripe.Price.create(
            unit_amount=12000 * 100,  # $12,000 in cents
            currency="usd",
            recurring={"interval": "year"},
            product_data={
                "name": "ODDC Annual Maintenance - Per System",
                "metadata": {"type": "annual_maintenance"},
            },
        )

        sub = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price.id, "quantity": system_count}],
            payment_settings={"payment_method_types": PAYMENT_METHODS},
            collection_method="send_invoice",
            days_until_due=30,
            metadata={"sa_invoice_number": invoice_number, "company": company_name},
        )

        logger.info(f"Stripe subscription {sub.id} created for {company_name} — {system_count} systems")
        return {"subscription_id": sub.id, "status": sub.status}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe subscription error: {e}")
        return {"error": str(e)}
