"""Billing & Renewal routes."""
import os
import json
import logging
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user, require_role
from app.models.models import BillingInvoice, Certificate

logger = logging.getLogger("sentinel.billing")

router = APIRouter()

# ─── Pricing constants ───
INITIAL_ASSESSMENT = 15_000
ANNUAL_MAINTENANCE = 12_000
EXPEDITED_REVIEW = 22_500
REASSESSMENT = 10_000
RATES = {"initial_assessment": INITIAL_ASSESSMENT, "annual_maintenance": ANNUAL_MAINTENANCE,
         "expedited": EXPEDITED_REVIEW, "reassessment": REASSESSMENT}
DESC_MAP = {"initial_assessment": "Initial Conformance Assessment",
            "annual_maintenance": "Annual Maintenance",
            "expedited": "Expedited Review (< 30 days)",
            "reassessment": "Re-Assessment (post non-conformance)"}


async def generate_invoice_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(select(func.count(BillingInvoice.id)).where(
        BillingInvoice.invoice_number.like(f"SA-INV-{year}-%")))
    count = (result.scalar() or 0) + 1
    return f"SA-INV-{year}-{count:05d}"


# ─── Request models ───

class InvoiceCreate(BaseModel):
    certificate_id: Optional[int] = None
    company_name: str
    contact_name: Optional[str] = None
    contact_email: str
    invoice_type: str
    system_name: Optional[str] = None
    system_count: int = 1

class PaymentRecord(BaseModel):
    paid_amount: int
    payment_method: str = "wire"
    payment_reference: Optional[str] = None


# ─── Email templates ───

SA_FROM = "licensing@sentinelauthority.org"
SA_ADMIN = os.getenv("SA_ADMIN_EMAIL", "admin@sentinelauthority.org")

def _header(inv_num):
    return f"SENTINEL AUTHORITY\n{inv_num}\n{'=' * 50}"

def _email_90(company, system, due, amount, inv_num):
    return {"subject": f"ODDC Certification Renewal Notice - {inv_num}",
            "body": f"""{_header(inv_num)}

{company},

Your ODDC certification for {system} is due for annual renewal on {due.strftime('%B %d, %Y')}.

  Annual Maintenance Fee:  ${amount:,}
  Due Date:                {due.strftime('%B %d, %Y')}
  Terms:                   Net 30

Payment may be remitted via wire transfer or ACH. Remittance details available from {SA_FROM}.

Sentinel Authority
sentinelauthority.org"""}

def _email_60(company, system, due, amount, inv_num):
    return {"subject": f"Renewal Reminder - {inv_num} - Due {due.strftime('%b %d')}",
            "body": f"""{_header(inv_num)}

{company},

Follow-up regarding annual maintenance renewal for {system}.

  Amount Due:   ${amount:,}
  Due Date:     {due.strftime('%B %d, %Y')}

If payment has been submitted, please forward confirmation to {SA_FROM}.

Sentinel Authority
sentinelauthority.org"""}

def _email_30(company, system, due, amount, inv_num):
    return {"subject": f"Final Notice - {inv_num} - Certification Renewal Required",
            "body": f"""{_header(inv_num)}

{company},

Final notice regarding ODDC certification maintenance for {system}.

  Amount Due:   ${amount:,}
  Due Date:     {due.strftime('%B %d, %Y')}

Failure to remit annual maintenance fees by the due date will result in your certification status being updated to non-active on the Sentinel Authority public registry.

Contact {SA_FROM} to arrange payment.

Sentinel Authority
sentinelauthority.org"""}

def _email_lapsed(company, system, inv_num):
    return {"subject": f"Certification Status Update - {system} - Non-Active",
            "body": f"""{_header(inv_num)}

{company},

Annual maintenance for your ODDC certification of {system} has not been received. Your certification status has been updated to non-active on the Sentinel Authority registry.

To reinstate, submit the outstanding maintenance fee. Contact {SA_FROM}.

Sentinel Authority
sentinelauthority.org"""}


async def _send_email(to, subject, body):
    """Send via Resend. Dry-runs if no API key."""
    import httpx
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        logger.info(f"[EMAIL-DRY] To: {to} | Subject: {subject}")
        return {"status": "dry_run"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post("https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": f"Sentinel Authority <{SA_FROM}>", "to": [to], "subject": subject, "text": body})
        resp.raise_for_status()
        return resp.json()


# ─── Invoice CRUD ───

@router.post("/invoices", summary="Create invoice")
async def create_invoice(req: InvoiceCreate, db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_role(["admin", "operator"]))):
    unit = RATES.get(req.invoice_type, INITIAL_ASSESSMENT)
    total = unit * req.system_count
    inv_num = await generate_invoice_number(db)
    due = datetime.utcnow() + timedelta(days=30)

    inv = BillingInvoice(
        invoice_number=inv_num, certificate_id=req.certificate_id,
        company_name=req.company_name, contact_name=req.contact_name,
        contact_email=req.contact_email, invoice_type=req.invoice_type,
        description=DESC_MAP.get(req.invoice_type, req.invoice_type),
        system_name=req.system_name, system_count=req.system_count,
        unit_amount=unit, total_amount=total, due_date=due, status="sent",
    )
    if req.invoice_type == "annual_maintenance":
        inv.period_start = datetime.utcnow()
        inv.period_end = datetime.utcnow() + timedelta(days=365)

    db.add(inv)
    # Auto-create Stripe invoice
    try:
        from app.services.stripe_service import create_stripe_invoice
        stripe_result = await create_stripe_invoice(
            req.company_name, req.contact_email, req.contact_name or "",
            inv.description, unit, req.system_count, inv.invoice_number, req.invoice_type)
        if stripe_result.get("invoice_id"):
            inv.stripe_invoice_id = stripe_result["invoice_id"]
            inv.stripe_hosted_url = stripe_result["hosted_url"]
            inv.stripe_pdf_url = stripe_result.get("pdf_url")
    except Exception as e:
        import logging; logging.getLogger("sentinel").warning(f"Stripe invoice creation failed: {e}")
    return _inv_dict(inv)


@router.get("/invoices", summary="List invoices")
async def list_invoices(status: Optional[str] = None, limit: int = 100,
                        db: AsyncSession = Depends(get_db),
                        user: dict = Depends(require_role(["admin", "operator"]))):
    query = select(BillingInvoice).order_by(BillingInvoice.created_at.desc()).limit(limit)
    if status:
        query = query.where(BillingInvoice.status == status)
    result = await db.execute(query)
    return {"invoices": [_inv_dict(i) for i in result.scalars().all()]}


@router.get("/invoices/{inv_id}", summary="Get invoice detail")
async def get_invoice(inv_id: str, db: AsyncSession = Depends(get_db),
                      user: dict = Depends(require_role(["admin", "operator"]))):
    try:
        iid = int(inv_id)
        result = await db.execute(select(BillingInvoice).where(BillingInvoice.id == iid))
    except ValueError:
        result = await db.execute(select(BillingInvoice).where(BillingInvoice.invoice_number == inv_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _inv_dict(inv)


@router.post("/invoices/{inv_id}/pay", summary="Record payment")
async def record_payment(inv_id: int, body: PaymentRecord,
                         db: AsyncSession = Depends(get_db),
                         user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(BillingInvoice).where(BillingInvoice.id == inv_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv.status = "paid"
    inv.paid_at = datetime.utcnow()
    inv.paid_amount = body.paid_amount
    inv.payment_method = body.payment_method
    inv.payment_reference = body.payment_reference
    return _inv_dict(inv)


# ─── Renewals ───

@router.get("/renewals/upcoming", summary="Certificates due in next 90 days")
async def upcoming_renewals(db: AsyncSession = Depends(get_db),
                            user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(Certificate).where(Certificate.state == "conformant"))
    certs = result.scalars().all()
    upcoming = []
    today = date.today()
    for cert in certs:
        issued = cert.issued_at
        if not issued:
            continue
        if isinstance(issued, datetime):
            issued = issued.date()
        anniversary = issued.replace(year=today.year)
        if anniversary < today:
            anniversary = anniversary.replace(year=today.year + 1)
        days_until = (anniversary - today).days
        if 0 <= days_until <= 90:
            upcoming.append({
                "id": cert.id, "certificate_number": cert.certificate_number,
                "company_name": cert.organization_name, "system_name": cert.system_name,
                "anniversary": anniversary.isoformat(), "days_until": days_until,
            })
    return {"renewals": sorted(upcoming, key=lambda x: x["days_until"])}


@router.get("/dashboard/summary", summary="Revenue and billing stats")
async def billing_summary(db: AsyncSession = Depends(get_db),
                          user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(BillingInvoice))
    invoices = result.scalars().all()
    paid = [i for i in invoices if i.status == "paid"]
    outstanding = [i for i in invoices if i.status in ("sent", "overdue")]
    overdue = [i for i in invoices if i.status == "overdue"]
    return {
        "total_invoiced": sum(i.total_amount for i in invoices),
        "total_collected": sum(i.paid_amount or 0 for i in paid),
        "outstanding": sum(i.total_amount for i in outstanding),
        "overdue_count": len(overdue),
        "overdue_amount": sum(i.total_amount for i in overdue),
        "invoice_count": len(invoices),
        "paid_count": len(paid),
    }


# ─── Daily Cron Job ───

@router.post("/cron/renewals", summary="Daily renewal processor")
async def process_renewals(db: AsyncSession = Depends(get_db)):
    """
    Daily cron. Call via Railway cron at 6am UTC:
    curl -X POST https://api.sentinelauthority.org/api/billing/cron/renewals
    """
    today = date.today()
    results = {"invoices_created": 0, "reminders_sent": 0, "lapsed": 0, "errors": []}

    result = await db.execute(select(Certificate).where(Certificate.state == "conformant"))
    certs = result.scalars().all()

    for cert in certs:
        try:
            issued = cert.issued_at
            if not issued:
                continue
            if isinstance(issued, datetime):
                issued = issued.date()

            anniversary = issued.replace(year=today.year)
            if anniversary < today:
                anniversary = anniversary.replace(year=today.year + 1)
            days_until = (anniversary - today).days

            if days_until > 90:
                continue

            # Check for existing renewal invoice for this period
            ann_dt = datetime(anniversary.year, anniversary.month, anniversary.day)
            existing = await db.execute(
                select(BillingInvoice).where(
                    BillingInvoice.certificate_id == cert.id,
                    BillingInvoice.invoice_type == "annual_maintenance",
                    BillingInvoice.period_start == ann_dt,
                ))
            inv = existing.scalar_one_or_none()

            if not inv and days_until <= 90:
                # Create invoice
                inv_num = await generate_invoice_number(db)
                company = cert.organization_name or "Unknown"
                system = cert.system_name or "Certified System"
                # Try to find contact email from the application
                from app.models.models import Application, User
                email = ""
                if cert.application_id:
                    app_r = await db.execute(select(Application).where(Application.id == cert.application_id))
                    app_obj = app_r.scalar_one_or_none()
                    if app_obj and app_obj.applicant_id:
                        user_r = await db.execute(select(User).where(User.id == app_obj.applicant_id))
                        user_obj = user_r.scalar_one_or_none()
                        if user_obj:
                            email = user_obj.email

                if not email:
                    results["errors"].append({"cert": cert.certificate_number, "error": "No contact email found"})
                    continue

                inv = BillingInvoice(
                    invoice_number=inv_num, certificate_id=cert.id,
                    company_name=company, contact_email=email,
                    invoice_type="annual_maintenance",
                    description=f"Annual Maintenance - {system}",
                    system_name=system, system_count=1,
                    unit_amount=ANNUAL_MAINTENANCE, total_amount=ANNUAL_MAINTENANCE,
                    due_date=ann_dt, period_start=ann_dt,
                    period_end=ann_dt + timedelta(days=365),
                    status="sent", auto_generated=True,
                    reminders_sent=[],
                )
                db.add(inv)
                await db.flush()
                results["invoices_created"] += 1

                # Send 90-day reminder
                tmpl = _email_90(company, system, anniversary, ANNUAL_MAINTENANCE, inv.invoice_number)
                await _send_email(email, tmpl["subject"], tmpl["body"])
                inv.reminders_sent = [{"type": "90_day", "sent_at": datetime.utcnow().isoformat()}]
                results["reminders_sent"] += 1

            elif inv and inv.status != "paid":
                sent = inv.reminders_sent or []
                sent_types = [r["type"] for r in sent]
                email = inv.contact_email
                company = inv.company_name
                system = inv.system_name or "Certified System"

                if days_until <= 60 and "60_day" not in sent_types and email:
                    tmpl = _email_60(company, system, anniversary, inv.total_amount, inv.invoice_number)
                    await _send_email(email, tmpl["subject"], tmpl["body"])
                    sent.append({"type": "60_day", "sent_at": datetime.utcnow().isoformat()})
                    inv.reminders_sent = sent
                    results["reminders_sent"] += 1

                elif days_until <= 30 and "30_day" not in sent_types and email:
                    tmpl = _email_30(company, system, anniversary, inv.total_amount, inv.invoice_number)
                    await _send_email(email, tmpl["subject"], tmpl["body"])
                    sent.append({"type": "30_day", "sent_at": datetime.utcnow().isoformat()})
                    inv.reminders_sent = sent
                    results["reminders_sent"] += 1

                elif days_until < 0 and inv.status != "overdue":
                    inv.status = "overdue"
                    cert.state = "suspended"
                    cert.suspended_at = datetime.utcnow()
                    cert.suspension_reason = "Annual maintenance payment overdue"
                    if email and "lapsed" not in sent_types:
                        tmpl = _email_lapsed(company, system, inv.invoice_number)
                        await _send_email(email, tmpl["subject"], tmpl["body"])
                        sent.append({"type": "lapsed", "sent_at": datetime.utcnow().isoformat()})
                        inv.reminders_sent = sent
                    results["lapsed"] += 1

        except Exception as e:
            results["errors"].append({"cert": getattr(cert, 'certificate_number', '?'), "error": str(e)})

    # Admin summary email
    if results["invoices_created"] or results["reminders_sent"] or results["lapsed"]:
        body = f"Daily Renewal Report - {today.isoformat()}\n\nInvoices: {results['invoices_created']}\nReminders: {results['reminders_sent']}\nLapsed: {results['lapsed']}\nErrors: {len(results['errors'])}"
        await _send_email(SA_ADMIN, f"SA Renewal Report - {today.isoformat()}", body)

    return results


# ─── Helper ───

def _inv_dict(i: BillingInvoice) -> dict:
    return {
        "id": i.id, "invoice_number": i.invoice_number,
        "certificate_id": i.certificate_id, "quote_id": i.quote_id,
        "company_name": i.company_name, "contact_name": i.contact_name,
        "contact_email": i.contact_email, "invoice_type": i.invoice_type,
        "description": i.description, "system_name": i.system_name,
        "system_count": i.system_count, "unit_amount": i.unit_amount,
        "total_amount": i.total_amount,
        "issue_date": i.issue_date.isoformat() if i.issue_date else None,
        "due_date": i.due_date.isoformat() if i.due_date else None,
        "period_start": i.period_start.isoformat() if i.period_start else None,
        "period_end": i.period_end.isoformat() if i.period_end else None,
        "status": i.status, "paid_at": i.paid_at.isoformat() if i.paid_at else None,
        "paid_amount": i.paid_amount, "payment_method": i.payment_method,
        "payment_reference": i.payment_reference, "reminders_sent": i.reminders_sent,
        "auto_generated": i.auto_generated, "stripe_invoice_id": getattr(i, "stripe_invoice_id", None), "stripe_hosted_url": getattr(i, "stripe_hosted_url", None), "stripe_pdf_url": getattr(i, "stripe_pdf_url", None),
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }
