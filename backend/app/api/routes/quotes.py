"""Quote Engine routes."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import QuoteRequest, Quote
from app.services.ai_analysis import analyze_prospect, generate_executive_summary

router = APIRouter()

# ─── Pricing (single source of truth) ───
INITIAL_ASSESSMENT = 15_000
ANNUAL_MAINTENANCE = 12_000
EXPEDITED_REVIEW = 22_500
ENTERPRISE_THRESHOLD = 6

def calc_pricing(system_count, expedited=False):
    per = EXPEDITED_REVIEW if expedited else INITIAL_ASSESSMENT
    init = system_count * per
    annual = system_count * ANNUAL_MAINTENANCE
    return {
        "price_per_system": per, "annual_per_system": ANNUAL_MAINTENANCE,
        "initial_total": init, "annual_total": annual,
        "year_one_total": init + annual,
        "pricing_tier": "enterprise" if system_count >= ENTERPRISE_THRESHOLD else "standard",
        "mca_eligible": system_count >= ENTERPRISE_THRESHOLD,
    }

async def generate_quote_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(select(func.count(Quote.id)).where(Quote.quote_number.like(f"SA-QT-{year}-%")))
    count = (result.scalar() or 0) + 1
    return f"SA-QT-{year}-{count:05d}"


# ─── Request models ───

class QuoteIntake(BaseModel):
    company_name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    sector: str
    system_description: str
    odd_description: Optional[str] = ""
    estimated_systems: int = 1
    expedited: bool = False
    source: str = "manual"
    internal_notes: Optional[str] = None

class QuoteApprovalBody(BaseModel):
    system_count: Optional[int] = None
    executive_summary: Optional[str] = None
    approved_by: str = "admin"

class QuoteUpdateBody(BaseModel):
    system_count: Optional[int] = None
    executive_summary: Optional[str] = None
    expedited: Optional[bool] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


# ─── Routes ───

@router.post("/intake", summary="Create quote from intake (auto-analyzes)")
async def create_quote(req: QuoteIntake, db: AsyncSession = Depends(get_db), user: dict = Depends(require_role(["admin", "operator"]))):
    # Store raw request
    qr = QuoteRequest(
        company_name=req.company_name, contact_name=req.contact_name,
        contact_email=req.contact_email, sector=req.sector,
        system_description=req.system_description, odd_description=req.odd_description,
        estimated_systems=req.estimated_systems, expedited=req.expedited,
        source=req.source, internal_notes=req.internal_notes, status="analyzing",
    )
    db.add(qr)
    await db.flush()

    # AI analysis
    try:
        analysis = await analyze_prospect(
            req.company_name, req.sector, req.system_description,
            req.odd_description, req.estimated_systems, req.expedited,
            req.internal_notes or "")
    except Exception as e:
        analysis = {"recommendedSystems": req.estimated_systems, "recommendedSector": req.sector,
                     "oddBreakdown": [], "summary": f"Analysis error: {e}", "flags": ["AI error"]}

    sc = analysis.get("recommendedSystems", req.estimated_systems)
    p = calc_pricing(sc, req.expedited)

    # Executive summary
    try:
        summary = await generate_executive_summary(
            req.company_name, req.sector, sc, req.system_description,
            analysis.get("oddBreakdown"), req.odd_description,
            p["mca_eligible"], p["year_one_total"], p["annual_total"], req.expedited)
    except Exception:
        summary = ""

    # Create quote
    quote_num = await generate_quote_number(db)
    quote = Quote(
        request_id=qr.id, quote_number=quote_num,
        company_name=req.company_name, contact_name=req.contact_name,
        contact_email=req.contact_email, sector=req.sector,
        system_count=sc, system_description=req.system_description,
        odd_breakdown=analysis.get("oddBreakdown", []),
        expedited=req.expedited, price_per_system=p["price_per_system"],
        annual_per_system=p["annual_per_system"], initial_total=p["initial_total"],
        annual_total=p["annual_total"], year_one_total=p["year_one_total"],
        pricing_tier=p["pricing_tier"], ai_analysis=analysis,
        executive_summary=summary, status="pending_review",
    )
    db.add(quote)
    qr.status = "quoted"
    await db.flush()

    return {
        "quote_id": quote.id, "quote_number": quote.quote_number,
        "analysis": analysis, "pricing": p,
        "executive_summary": summary, "status": "pending_review",
    }


@router.get("/", summary="List quotes")
async def list_quotes(status: Optional[str] = None, limit: int = 50,
                      db: AsyncSession = Depends(get_db),
                      user: dict = Depends(require_role(["admin", "operator"]))):
    query = select(Quote).order_by(Quote.created_at.desc()).limit(limit)
    if status:
        query = query.where(Quote.status == status)
    result = await db.execute(query)
    quotes = result.scalars().all()
    return {"quotes": [_quote_dict(q) for q in quotes]}


@router.get("/pricing/calculate", summary="Quick pricing preview")
async def preview_pricing(system_count: int = 1, expedited: bool = False):
    return calc_pricing(system_count, expedited)


@router.get("/pipeline", summary="Pipeline summary")
async def pipeline_summary(db: AsyncSession = Depends(get_db),
                           user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(Quote))
    quotes = result.scalars().all()
    pipeline = {}
    for q in quotes:
        s = q.status
        if s not in pipeline:
            pipeline[s] = {"count": 0, "total_value": 0}
        pipeline[s]["count"] += 1
        pipeline[s]["total_value"] += q.year_one_total or 0
    return {"pipeline": pipeline}


@router.get("/{quote_id}", summary="Get quote detail")
async def get_quote(quote_id: str, db: AsyncSession = Depends(get_db),
                    user: dict = Depends(require_role(["admin", "operator"]))):
    # Try by ID, then by quote_number
    try:
        qid = int(quote_id)
        result = await db.execute(select(Quote).where(Quote.id == qid))
    except ValueError:
        result = await db.execute(select(Quote).where(Quote.quote_number == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_dict(quote)


@router.patch("/{quote_id}", summary="Update quote")
async def update_quote(quote_id: int, body: QuoteUpdateBody,
                       db: AsyncSession = Depends(get_db),
                       user: dict = Depends(require_role(["admin", "operator"]))):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if body.contact_name is not None: quote.contact_name = body.contact_name
    if body.contact_email is not None: quote.contact_email = body.contact_email
    if body.executive_summary is not None: quote.executive_summary = body.executive_summary

    if body.system_count is not None or body.expedited is not None:
        sc = body.system_count if body.system_count is not None else quote.system_count
        exp = body.expedited if body.expedited is not None else quote.expedited
        p = calc_pricing(sc, exp)
        quote.system_count = sc
        quote.expedited = exp
        quote.price_per_system = p["price_per_system"]
        quote.annual_per_system = p["annual_per_system"]
        quote.initial_total = p["initial_total"]
        quote.annual_total = p["annual_total"]
        quote.year_one_total = p["year_one_total"]
        quote.pricing_tier = p["pricing_tier"]

    return _quote_dict(quote)


@router.post("/{quote_id}/approve", summary="Approve quote")
async def approve_quote(quote_id: int, body: QuoteApprovalBody,
                        db: AsyncSession = Depends(get_db),
                        user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if body.system_count:
        p = calc_pricing(body.system_count, quote.expedited)
        quote.system_count = body.system_count
        quote.initial_total = p["initial_total"]
        quote.annual_total = p["annual_total"]
        quote.year_one_total = p["year_one_total"]
        quote.pricing_tier = p["pricing_tier"]
    if body.executive_summary:
        quote.executive_summary = body.executive_summary

    quote.status = "approved"
    quote.approved_by = body.approved_by or user.get("email", "admin")
    quote.approved_at = datetime.utcnow()
    return _quote_dict(quote)


@router.post("/{quote_id}/send", summary="Mark quote as sent")
async def send_quote(quote_id: int, db: AsyncSession = Depends(get_db),
                     user: dict = Depends(require_role(["admin"]))):
    result = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    now = datetime.utcnow()
    quote.status = "sent"
    quote.sent_at = now
    quote.expires_at = now + timedelta(days=30)
    return _quote_dict(quote)


# ─── Helper ───

def _quote_dict(q: Quote) -> dict:
    return {
        "id": q.id, "request_id": q.request_id, "quote_number": q.quote_number,
        "company_name": q.company_name, "contact_name": q.contact_name,
        "contact_email": q.contact_email, "sector": q.sector,
        "system_count": q.system_count, "system_description": q.system_description,
        "odd_breakdown": q.odd_breakdown, "expedited": q.expedited,
        "price_per_system": q.price_per_system, "annual_per_system": q.annual_per_system,
        "initial_total": q.initial_total, "annual_total": q.annual_total,
        "year_one_total": q.year_one_total, "pricing_tier": q.pricing_tier,
        "ai_analysis": q.ai_analysis, "executive_summary": q.executive_summary,
        "status": q.status, "approved_by": q.approved_by,
        "approved_at": q.approved_at.isoformat() if q.approved_at else None,
        "sent_at": q.sent_at.isoformat() if q.sent_at else None,
        "expires_at": q.expires_at.isoformat() if q.expires_at else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


# ─── Public Inquiry (no auth — website form) ───

class PublicInquiry(BaseModel):
    company_name: str
    contact_name: Optional[str] = None
    contact_email: str
    sector: str = "Other"
    system_description: str
    odd_description: Optional[str] = ""
    estimated_systems: int = 1

@router.post("/public/inquire", summary="Public inquiry — no auth", dependencies=[])
async def public_inquiry(req: PublicInquiry, db: AsyncSession = Depends(get_db)):
    """Website inquiry form. No login required. Auto-analyzes and queues for admin review."""
    from app.models.models import QuoteRequest, Quote
    qr = QuoteRequest(
        company_name=req.company_name, contact_name=req.contact_name,
        contact_email=req.contact_email, sector=req.sector,
        system_description=req.system_description, odd_description=req.odd_description,
        estimated_systems=req.estimated_systems, source="website", status="analyzing",
    )
    db.add(qr)
    await db.flush()

    try:
        analysis = await analyze_prospect(
            req.company_name, req.sector, req.system_description,
            req.odd_description, req.estimated_systems, False, "")
    except Exception as e:
        analysis = {"recommendedSystems": req.estimated_systems, "recommendedSector": req.sector,
                     "oddBreakdown": [], "summary": f"Analysis error: {e}", "flags": ["AI error"]}

    sc = analysis.get("recommendedSystems", req.estimated_systems)
    p = calc_pricing(sc, False)

    try:
        summary = await generate_executive_summary(
            req.company_name, req.sector, sc, req.system_description,
            analysis.get("oddBreakdown"), req.odd_description,
            p["mca_eligible"], p["year_one_total"], p["annual_total"], False)
    except Exception:
        summary = ""

    q_num = await generate_quote_number(db)
    quote = Quote(
        request_id=qr.id, quote_number=q_num,
        company_name=req.company_name, contact_name=req.contact_name,
        contact_email=req.contact_email, sector=req.sector,
        system_count=sc, system_description=req.system_description,
        odd_breakdown=analysis.get("oddBreakdown", []),
        expedited=False, price_per_system=p["price_per_system"],
        annual_per_system=p["annual_per_system"], initial_total=p["initial_total"],
        annual_total=p["annual_total"], year_one_total=p["year_one_total"],
        pricing_tier=p["pricing_tier"], ai_analysis=analysis,
        executive_summary=summary, status="pending_review",
    )
    db.add(quote)
    qr.status = "quoted"

    return {
        "message": "Thank you. Your inquiry has been received and a certification specialist will follow up within 2 business days.",
        "reference": q_num,
    }
