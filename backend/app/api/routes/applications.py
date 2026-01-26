

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
    
    if not certificate.pdf_data:
        raise HTTPException(status_code=404, detail="Certificate PDF not generated")
    
    return Response(
        content=certificate.pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={certificate.certificate_number}.pdf"
        }
    )
