"""Applicant Portal routes."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.api.routes.webhooks import fire_webhook
from app.core.security import get_current_user, require_role
from app.models.models import Application, AuditLog, ApplicationComment, CertificationState, User
from app.services.audit_service import write_audit_log
from app.services.email_service import (
    notify_admin_new_application, send_application_received,
    send_application_approved, send_application_rejected, send_application_under_review,
    send_test_scheduled, send_email, ADMIN_EMAIL
)

router = APIRouter()


class ApplicationCreate(BaseModel):
    organization_name: str
    contact_name: Optional[str] = None
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    system_name: str
    system_description: str
    system_version: Optional[str] = None
    manufacturer: Optional[str] = None
    odd_specification: Optional[Any] = None
    envelope_definition: Optional[Dict[str, Any]] = None
    preferred_test_date: Optional[datetime] = None
    facility_location: Optional[str] = None
    notes: Optional[str] = None


async def generate_application_number(db: AsyncSession) -> str:
    year = datetime.utcnow().year
    result = await db.execute(
        select(Application.application_number).where(
            Application.application_number.like(f"APP-{year}-%")
        ).order_by(Application.application_number.desc())
    )
    all_nums = [r[0] for r in result.fetchall()]
    seq = 1
    for num in all_nums:
        suffix = num.split("-")[-1]
        if suffix.isdigit():
            seq = int(suffix) + 1
            break
    return f"APP-{year}-{seq:05d}"


@router.post("/", summary="Submit new application")
async def create_application(
    app_data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    app_number = await generate_application_number(db)
    
    # Handle odd_specification - convert string to dict if needed
    odd_spec = app_data.odd_specification
    if isinstance(odd_spec, str):
        odd_spec = {"description": odd_spec}
    elif odd_spec is None:
        odd_spec = {}
    
    application = Application(
        application_number=app_number,
        applicant_id=int(user["sub"]),
        organization_name=app_data.organization_name,
        contact_name=app_data.contact_name or user.get("full_name", ""),
        contact_email=app_data.contact_email,
        contact_phone=app_data.contact_phone,
        system_name=app_data.system_name,
        system_description=app_data.system_description,
        system_version=app_data.system_version or "1.0",
        manufacturer=app_data.manufacturer or app_data.organization_name,
        odd_specification=odd_spec,
        envelope_definition=app_data.envelope_definition or {},
        preferred_test_date=app_data.preferred_test_date,
        facility_location=app_data.facility_location,
        notes=app_data.notes,
        state="pending",
        submitted_at=datetime.utcnow(),
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    await write_audit_log(db, action="application_submitted", resource_type="application", resource_id=application.id,
        user_id=int(user["sub"]), user_email=user.get("email"), details={"system_name": application.system_name, "application_number": application.application_number})
    
    # Notify the applicant
    try:
        await send_application_received(app_data.contact_email, app_data.system_name, application.id)
    except Exception as e:
        print(f"Email error (app received): {e}")
    
    await notify_admin_new_application(
        app_data.organization_name,
        app_data.system_name,
        app_data.contact_email
    )
    
    return {
        "id": application.id,
        "application_number": application.application_number,
        "state": application.state,
        "submitted_at": application.submitted_at.isoformat() + "Z",
        "message": "Application submitted successfully"
    }


@router.get("/", summary="List all applications")
async def list_applications(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    from sqlalchemy import or_
    query = select(Application)
    if user.get("role") not in ["admin", "operator"]:
        query = query.where((Application.organization_id == user.get("organization_id")) if user.get("organization_id") else (Application.applicant_id == int(user["sub"])))
    if state and state != "all":
        if state == "revoked":
            query = query.where(Application.state.in_(["suspended", "revoked"]))
        else:
            query = query.where(Application.state == state)
    else:
        # Default: only show intake pipeline — exclude graduated apps
        query = query.where(Application.state.in_(["pending", "under_review", "approved", "failed", "rejected"]))
    if search:
        like = f"%{search}%"
        query = query.where(or_(
            Application.system_name.ilike(like),
            Application.organization_name.ilike(like),
            Application.application_number.ilike(like),
            Application.contact_email.ilike(like),
        ))
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    # State counts (unfiltered by search/state for tab badges)
    count_q = select(Application.state, func.count(Application.id)).group_by(Application.state)
    if user.get("role") not in ["admin", "operator"]:
        count_q = count_q.where((Application.organization_id == user.get("organization_id")) if user.get("organization_id") else (Application.applicant_id == int(user["sub"])))
    try:
        count_result = await db.execute(count_q)
    except Exception:
        await db.rollback()
        count_result = await db.execute(count_q)
    state_counts = {"all": 0}
    for row in count_result.fetchall():
        key = row[0].value if hasattr(row[0], "value") else row[0]
        state_counts[key] = row[1]
        state_counts["all"] += row[1]
    result = await db.execute(query.order_by(Application.created_at.desc()).limit(limit).offset(offset))
    apps = result.scalars().all()
    return {
        "applications": [
            {
                "id": a.id,
                "application_number": a.application_number,
                "organization_name": a.organization_name,
                "system_name": a.system_name,
                "system_version": a.system_version,
                "state": a.state,
                "contact_email": a.contact_email,
                "submitted_at": a.submitted_at.isoformat() + "Z" if a.submitted_at else None,
            }
            for a in apps
        ],
        "total": total, "state_counts": state_counts,
    }


@router.get("/{application_id}", summary="Get application details")
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if user.get("role") not in ["admin", "operator"] and app.applicant_id != int(user["sub"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": app.id,
        "application_number": app.application_number,
        "organization_name": app.organization_name,
        "contact_name": app.contact_name,
        "contact_email": app.contact_email,
        "contact_phone": app.contact_phone,
        "system_name": app.system_name,
        "system_description": app.system_description,
        "system_version": app.system_version,
        "manufacturer": app.manufacturer,
        "odd_specification": app.odd_specification,
        "envelope_definition": app.envelope_definition,
        "state": app.state,
        "submitted_at": app.submitted_at.isoformat() + "Z" if app.submitted_at else None,
        "preferred_test_date": app.preferred_test_date.isoformat() + "Z" if app.preferred_test_date else None,
        "facility_location": app.facility_location,
        "notes": app.notes,
    }




@router.patch("/{application_id}", summary="Update application fields")
async def update_application_fields(
    application_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin", "operator"]))
):
    """Update application fields (admin only)."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    data = await request.json()
    allowed = ["review_checklist", "envelope_definition", "odd_specification", "notes", "facility_location"]
    for key in allowed:
        if key in data:
            setattr(app, key, data[key])
    
    await db.commit()
    return {"message": "Updated", "id": application_id}

@router.patch("/{application_id}/state", summary="Update application state")
async def update_application_state(
    application_id: int,
    new_state: str,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    if user.get("role") not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Only operators can update state")
    
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Valid state transitions
    VALID_TRANSITIONS = {
        "pending": ["approved", "rejected", "suspended"],
        "under_review": ["approved", "testing", "suspended"],
        "approved": ["testing", "suspended"],
        "failed": ["testing", "under_review", "suspended"],
        "test_failed": ["testing", "under_review", "suspended"],
        "testing": ["conformant", "suspended"],
        "conformant": ["suspended", "expired"],
        "suspended": ["pending", "approved"],
        "expired": ["pending"],
        "rejected": ["pending"],
        "failed": ["approved"],
    }
    
    current = app.state
    allowed = VALID_TRANSITIONS.get(current, [])
    
    # Admin override: allow any transition
    if new_state not in allowed and user.get("role") != "admin":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new_state}'. Allowed: {allowed}"
        )
    
    previous_state = current
    
    try:
        app.state = CertificationState(new_state)
        app.reviewed_at = datetime.utcnow()
        
        # Auto-generate API key on approval
        api_key_raw = None
        if new_state == "approved" and app.applicant_id:
            import secrets, hashlib
            from app.models.models import APIKey
            
            # Check if key already exists for this user
            existing = await db.execute(
                select(APIKey).where(
                    APIKey.user_id == app.applicant_id,
                    APIKey.is_active == True
                )
            )
            if not existing.scalar_one_or_none():
                random_part = secrets.token_hex(20)
                api_key_raw = f"sa_live_{random_part}"
                key_hash = hashlib.sha256(api_key_raw.encode()).hexdigest()
                key_prefix = api_key_raw[:12]
                
                new_key = APIKey(
                    key_hash=key_hash,
                    key_prefix=key_prefix,
                    user_id=app.applicant_id,
                    name=f"Auto: {app.system_name or 'ENVELO Deploy'}",
                    is_active=True
                )
                db.add(new_key)
        

        # Auto-create Certificate on approval
        if new_state == "approved":
            try:
                from app.models.models import Certificate
                from datetime import timedelta
                # Get next certificate number
                last_cert = await db.execute(
                    select(Certificate).order_by(Certificate.id.desc()).limit(1)
                )
                last = last_cert.scalar_one_or_none()
                if last and last.certificate_number:
                    seq = int(last.certificate_number.split("-")[-1]) + 1
                else:
                    seq = 1
                cert_number = f"ODDC-{datetime.utcnow().year}-{seq:05d}"
                
                new_cert = Certificate(
                    certificate_number=cert_number,
                    application_id=app.id,
                    organization_name=app.organization_name,
                    system_name=app.system_name,
                    system_version=app.system_version,
                    odd_specification=app.odd_specification,
                    envelope_definition=app.envelope_definition,
                    state="pending",
                    issued_by=int(user["sub"]) if user.get("sub") else None,
                    expires_at=datetime.utcnow() + timedelta(days=365),
                )
                db.add(new_cert)
                await db.flush()  # get the ID
                print(f"Auto-created certificate {cert_number} for {app.application_number}")
            except Exception as e:
                print(f"Auto-create certificate failed: {e}")

        # Auto-create CAT-72 test on approval
        if new_state == "approved":
            try:
                from app.models.models import CAT72Test
                import secrets as _secrets
                test_id = f"CAT-{datetime.utcnow().year}-{_secrets.token_hex(4).upper()}"
                cat_test = CAT72Test(
                    test_id=test_id,
                    application_id=app.id,
                    duration_hours=72,
                    envelope_definition=app.envelope_definition,
                    state="scheduled",
                    operator_id=int(user["sub"]) if user.get("sub") else None,
                )
                db.add(cat_test)
                print(f"Auto-created CAT-72 test {test_id} for {app.application_number}")
            except Exception as e:
                print(f"Auto-create CAT-72 failed: {e}")

        # Write audit log
        # Auto-post rejection reason as comment
        if new_state == "rejected" and reason:
            comment = ApplicationComment(
                application_id=app.id,
                user_id=user.get("sub"),
                user_email=user.get("email", "admin"),
                user_role=user.get("role", "admin"),
                content=f"REJECTED: {reason}",
                is_internal=False,
            )
            db.add(comment)

        await write_audit_log(
            db=db,
            action="state_changed",
            resource_type="application",
            resource_id=application_id,
            user_id=user.get("id"),
            user_email=user.get("email"),
            details={"old_state": previous_state, "new_state": new_state, "system_name": app.system_name or ""}
        )
        await db.commit()
        
        # Fire webhook
        try:
            if app.applicant_id:
                await fire_webhook(app.applicant_id, f"application.{new_state}", {
                    "application_id": app.id,
                    "application_number": app.application_number,
                    "system_name": app.system_name,
                    "state": new_state,
                })
        except Exception:
            pass

        result = {"message": f"State updated to {new_state}", "state": new_state}
        if api_key_raw:
            result["api_key_generated"] = True
            result["api_key"] = api_key_raw
            result["note"] = "API key auto-generated for customer deploy"
        
        # ── Email notifications on state transitions ──
        try:
            # Get applicant email
            applicant_email = app.contact_email
            if not applicant_email and app.applicant_id:
                from app.models.models import User
                user_result = await db.execute(select(User).where(User.id == app.applicant_id))
                owner = user_result.scalar_one_or_none()
                if owner:
                    applicant_email = owner.email
            
            app_number = app.application_number or f"SA-{app.id:04d}"
            system_name = app.system_name or "Unnamed System"
            
            if applicant_email:
                if new_state == "approved":
                    await send_application_approved(applicant_email, system_name, app_number)
                    # If API key was generated, send setup instructions too
                    if api_key_raw:
                        from app.services.email_service import send_test_setup_instructions
                        await send_test_setup_instructions(
                            applicant_email, system_name,
                            app_number, api_key_raw, "Pending"
                        )
                elif new_state == "rejected":
                    await send_application_rejected(applicant_email, system_name, app_number, reason)
                elif new_state == "suspended":
                    await send_email(
                        applicant_email,
                        f"Application Suspended - {system_name}",
                        f'<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">'
                        f'<div style="background: #5B4B8A; padding: 20px; text-align: center;"><h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1></div>'
                        f'<div style="padding: 30px; background: #f9f9f9;">'
                        f'<h2 style="color: #D6A05C;">Application Suspended</h2>'
                        f'<p>Your application for <strong>{system_name}</strong> ({app_number}) has been suspended.</p>'
                        f'<p>Please contact us at info@sentinelauthority.org for more information.</p>'
                        f'</div></div>'
                    )
            
            # Notify admin of all state changes
            await send_email(
                ADMIN_EMAIL,
                f"Application State Change: {app_number} → {new_state.upper()}",
                f'<div style="font-family: Arial; max-width: 600px; margin: 0 auto;">'
                f'<div style="background: #5B4B8A; padding: 20px; text-align: center;"><h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1></div>'
                f'<div style="padding: 30px; background: #f9f9f9;">'
                f'<h2>State Change: {new_state.upper()}</h2>'
                f'<p><strong>System:</strong> {system_name}<br>'
                f'<strong>Application:</strong> {app_number}<br>'
                f'<strong>New State:</strong> {new_state}<br>'
                f'<strong>Changed by:</strong> User #{user.get("sub", "unknown")}</p>'
                f'</div></div>'
            )
        except Exception as e:
            print(f"Email error (state change): {e}")
        
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid state: {new_state}")


@router.post("/document-download", summary="Request document download")
async def document_download(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Track document downloads and notify admin"""
    from app.services.email_service import send_email
    import os
    
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid request body"}
    email = data.get("email", "")
    organization = data.get("organization", "")
    role = data.get("role", "")
    document = data.get("document", "")
    
    # Send notification email to admin
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "info@sentinelauthority.org")
    
    subject = f"Document Download: {document}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #5B4B8A; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Document Download</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
            <h2 style="color: #5B4B8A;">Someone downloaded a document</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Document:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">{document}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">{email}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Organization:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">{organization or 'Not provided'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Role:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">{role or 'Not provided'}</td></tr>
            </table>
        </div>
        <div style="padding: 15px; background: #5B4B8A; text-align: center;">
            <span style="color: rgba(255,255,255,0.7); font-size: 12px;">Sentinel Authority</span>
        </div>
    </div>
    """
    
    try:
        await send_email(ADMIN_EMAIL, subject, html)
        return {"success": True, "message": "Download tracked"}
    except Exception as e:
        print(f"Email error: {e}")
        return {"success": True, "message": "Download tracked (email failed)"}


@router.delete("/{app_id}", summary="Delete application")
async def delete_application(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an application (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(Application).where(Application.id == app_id))
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    await write_audit_log(db, action="application_deleted", resource_type="application", resource_id=application.id,
        user_id=int(current_user["sub"]), user_email=current_user.get("email"), details={"application_number": application.application_number})
    await db.delete(application)
    await db.commit()
    
    return {"message": "Application deleted"}



# ═══ Application History ═══

@router.get("/{application_id}/history", summary="Get application state change history")
async def get_application_history(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Returns chronological state change history for an application."""
    # Verify application exists
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check access: admin sees all, applicant sees own org
    if user.get("role") == "applicant" and app.organization_name != user.get("organization"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Query audit log for this application
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.resource_type == "application",
            AuditLog.resource_id == application_id
        ).order_by(AuditLog.timestamp.asc())
    )
    logs = result.scalars().all()
    
    # Also include creation event from submitted_at
    history = []
    if app.submitted_at:
        history.append({
            "timestamp": app.submitted_at.isoformat(),
            "action": "submitted",
            "user_email": app.contact_email or "applicant",
            "details": {"new_state": "pending", "system_name": app.system_name}
        })
    
    for log in logs:
        history.append({
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "user_email": log.user_email,
            "details": log.details or {}
        })
    
    return history




# ═══ Application Comments ═══

@router.get("/{application_id}/comments", summary="Get comments for an application")
async def get_application_comments(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Returns all comments for an application, newest first."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    query = select(ApplicationComment).where(
        ApplicationComment.application_id == application_id
    ).order_by(ApplicationComment.created_at.desc())
    
    # Non-admin users don't see internal notes
    if user.get("role") != "admin":
        query = query.where(ApplicationComment.is_internal == False)
    
    result = await db.execute(query)
    comments = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "user_email": c.user_email,
            "user_role": c.user_role,
            "content": c.content,
            "is_internal": c.is_internal,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in comments
    ]


@router.post("/{application_id}/comments", summary="Add comment to an application")
async def add_application_comment(
    application_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Add a comment or internal note to an application."""
    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")
    if len(content) > 5000:
        raise HTTPException(status_code=400, detail="Comment too long (max 5000 chars)")
    
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    is_internal = body.get("is_internal", False)
    # Only admins can post internal notes
    if is_internal and user.get("role") != "admin":
        is_internal = False
    
    comment = ApplicationComment(
        application_id=application_id,
        user_id=user.get("id"),
        user_email=user.get("email"),
        user_role=user.get("role", "applicant"),
        content=content,
        is_internal=is_internal,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    
    return {
        "id": comment.id,
        "user_email": comment.user_email,
        "user_role": comment.user_role,
        "content": comment.content,
        "is_internal": comment.is_internal,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


@router.delete("/{application_id}/comments/{comment_id}", summary="Delete a comment")
async def delete_application_comment(
    application_id: int,
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Delete a comment. Admins can delete any, users can delete their own."""
    result = await db.execute(
        select(ApplicationComment).where(
            ApplicationComment.id == comment_id,
            ApplicationComment.application_id == application_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if user.get("role") != "admin" and comment.user_id != user.get("id"):
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")
    
    await db.delete(comment)
    await db.commit()
    return {"message": "Comment deleted"}


# ═══ Bulk State Operations ═══

@router.post("/bulk-state", summary="Bulk update application states")
async def bulk_update_state(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Bulk update application states. Admin only."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    ids = body.get("ids", [])
    new_state = body.get("new_state")
    
    if not ids or not new_state:
        raise HTTPException(status_code=400, detail="ids and new_state required")
    
    if len(ids) > 50:
        raise HTTPException(status_code=400, detail="Max 50 at a time")
    
    results = {"success": [], "failed": []}
    
    for app_id in ids:
        try:
            result = await db.execute(select(Application).where(Application.id == app_id))
            app = result.scalar_one_or_none()
            if not app:
                results["failed"].append({"id": app_id, "error": "Not found"})
                continue
            
            old_state = app.state
            app.state = CertificationState(new_state)
            app.reviewed_at = datetime.utcnow()
            results["success"].append({"id": app_id, "old_state": old_state, "new_state": new_state})
        except Exception as e:
            results["failed"].append({"id": app_id, "error": str(e)})
    
    await db.commit()
    
    return {
        "message": f"{len(results['success'])} updated, {len(results['failed'])} failed",
        "results": results
    }


@router.post("/bulk-delete", summary="Bulk delete applications")
async def bulk_delete_applications(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Bulk delete applications. Admin only."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    ids = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="ids required")
    if len(ids) > 50:
        raise HTTPException(status_code=400, detail="Max 50 at a time")
    
    deleted = 0
    for app_id in ids:
        result = await db.execute(select(Application).where(Application.id == app_id))
        app = result.scalar_one_or_none()
        if app:
            await db.delete(app)
            deleted += 1
    
    await db.commit()
    return {"message": f"{deleted} applications deleted", "deleted": deleted}

@router.get("/{application_id}/email-preview", summary="Preview notification email for state change")
async def preview_state_change_email(
    application_id: int,
    new_state: str,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["admin"])),
):
    """Return HTML preview of the email that would be sent on state change"""
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get applicant email
    user_result = await db.execute(select(User).where(User.id == app.applicant_id))
    applicant = user_result.scalar_one_or_none()
    to_email = applicant.email if applicant else "applicant@example.com"
    app_number = app.application_number or f"SA-{app.id:04d}"
    
    email_html = ""
    email_subject = ""
    
    if new_state == "under_review":
        email_subject = f"Application Under Review - {app.system_name}"
        email_html = f"""<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #5B4B8A; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #5B4B8A;">Application Under Review</h2>
                <p>Your ODDC certification application is now being reviewed by our team.</p>
                <p><strong>System:</strong> {app.system_name}<br>
                <strong>Application:</strong> {app_number}</p>
                <p>We typically complete reviews within 2-3 business days.</p>
            </div>
        </div>"""
    elif new_state == "approved":
        email_subject = f"Application Approved - {app.system_name}"
        email_html = f"""<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #5B4B8A; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #2e7d32;">&#10003; Application Approved</h2>
                <p>Your ODDC certification application has been approved.</p>
                <p><strong>System:</strong> {app.system_name}<br>
                <strong>Application:</strong> {app_number}</p>
                <h3 style="color: #5B4B8A;">Next Steps</h3>
                <ol>
                    <li>Deploy the ENVELO Agent from your dashboard</li>
                    <li>Your CAT-72 conformance test will be scheduled</li>
                    <li>The test runs for 72 continuous hours</li>
                </ol>
            </div>
        </div>"""
    elif new_state == "suspended":
        email_subject = f"Application Suspended - {app.system_name}"
        email_html = f"""<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #5B4B8A; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #D65C5C;">Application Suspended</h2>
                <p>Your ODDC certification application has been suspended.</p>
                <p><strong>System:</strong> {app.system_name}<br>
                <strong>Application:</strong> {app_number}</p>
                <p>Please contact info@sentinelauthority.org for more information.</p>
            </div>
        </div>"""
    else:
        email_subject = f"Application Update - {app.system_name}"
        email_html = f"""<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #5B4B8A; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">SENTINEL AUTHORITY</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2>Application Status Update</h2>
                <p>Your application status has been updated to: <strong>{new_state}</strong></p>
                <p><strong>System:</strong> {app.system_name}<br>
                <strong>Application:</strong> {app_number}</p>
            </div>
        </div>"""
    
    return {
        "to": to_email,
        "subject": email_subject,
        "html": email_html,
        "new_state": new_state,
        "system_name": app.system_name,
    }



# ── Pre-CAT-72 Review endpoint ────────────────────────────────────────────────
@router.post("/{application_id}/pre-review")
async def save_pre_review(
    application_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Save Pre-CAT-72 audit findings and optionally notify applicant."""
    result = await db.execute(select(Application).where(Application.id == application_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Store findings on application
    app.pre_review_results = body.get("pre_review_results")
    app.notes = (app.notes or "") + f"\n\n[Pre-CAT-72 Review — {body.get('decision','').upper()}]\n{body.get('override_note') or ''}"

    await db.commit()

    # Send email if returning to applicant
    if body.get("decision") == "reject":
        applicant_email = app.contact_email
        if not applicant_email and app.applicant_id:
            from app.models.models import User
            ur = await db.execute(select(User).where(User.id == app.applicant_id))
            owner = ur.scalar_one_or_none()
            if owner:
                applicant_email = owner.email

        if applicant_email:
            return_note = body.get("override_note") or "Your application requires revisions before CAT-72 testing can be authorized."
            await send_application_rejected(
                applicant_email,
                app.system_name or "Unnamed System",
                app.application_number or f"SA-{app.id:04d}",
                return_note,
            )

    return {"message": "Pre-review saved", "decision": body.get("decision")}
