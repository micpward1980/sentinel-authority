

# Certificate and evaluation endpoints

@router.post("/{app_id}/tests/{test_id}/evaluate")
async def evaluate_cat72_test(
    app_id: int,
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Evaluate a CAT-72 test (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from app.services.cat72_evaluator import evaluate_test
    result = await evaluate_test(db, test_id)
    return result


@router.post("/{app_id}/tests/{test_id}/complete")
async def complete_cat72_test(
    app_id: int,
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Complete a CAT-72 test and issue certificate if passed (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from app.services.cat72_evaluator import complete_test_and_issue_certificate
    result = await complete_test_and_issue_certificate(db, test_id)
    return result


@router.get("/{app_id}/certificate/download")
async def download_certificate(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Download certificate PDF"""
    from fastapi.responses import Response
    
    result = await db.execute(
        select(Certificate).where(Certificate.application_id == app_id)
    )
    certificate = result.scalar_one_or_none()
    
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    if not certificate.certificate_pdf:
        raise HTTPException(status_code=404, detail="Certificate PDF not generated")
    
    return Response(
        content=certificate.certificate_pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={certificate.certificate_number}.pdf"
        }
    )

@router.post("/document-download")
async def document_download_lead(request: Request):
    """Capture lead info when someone downloads a document"""
    from app.services.email_service import send_email
    
    data = await request.json()
    email = data.get("email", "Unknown")
    org = data.get("organization", "Not provided")
    role = data.get("role", "Not provided")
    document = data.get("document", "Unknown")
    
    html = f"""
    <h2>Document Download Lead</h2>
    <p><strong>Document:</strong> {document}</p>
    <p><strong>Email:</strong> {email}</p>
    <p><strong>Organization:</strong> {org}</p>
    <p><strong>Role:</strong> {role}</p>
    """
    
    await send_email("info@sentinelauthority.org", f"Document Download: {document}", html)
    
    return {"status": "ok"}
