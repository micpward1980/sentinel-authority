"""Document download routes for portal resources."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from app.core.security import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

DOCS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "static" / "documents"

AVAILABLE_DOCS = {
    "oddc-certification-guide": {
        "filename": "ODDC_Certification_Guide.pdf",
        "title": "ODDC Certification Guide",
        "description": "Complete applicant roadmap — 7 phases from inquiry to ongoing monitoring",
        "version": "1.0",
        "roles": ["admin", "applicant"],
    },
}


@router.get("/")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """List available documents for current user's role."""
    role = current_user.get("role", "applicant")
    return [
        {"id": doc_id, **{k: v for k, v in doc.items() if k != "filename"}}
        for doc_id, doc in AVAILABLE_DOCS.items()
        if role in doc["roles"]
    ]


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Download a document by ID."""
    doc = AVAILABLE_DOCS.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    role = current_user.get("role", "applicant")
    if role not in doc["roles"]:
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = DOCS_DIR / doc["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not available")

    return FileResponse(
        path=str(file_path),
        filename=doc["filename"],
        media_type="application/pdf",
    )
