from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path
from app.core.security import get_current_user

router = APIRouter(tags=["documents"])

DOCS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "static" / "documents"

AVAILABLE_DOCS = {
    "oddc-certification-guide": {
        "filename": "ODDC_Certification_Guide_v5.pdf",
        "title": "ODDC Certification Guide",
        "description": "Complete applicant roadmap for ODDC certification — Phase 1 through Continued Monitoring, post-certification compliance policy, ENVELO CLI reference, three-tier enforcement model",
        "version": "5.0",
        "roles": ["admin", "applicant"],
    },
    "oddc-certification-guide-v3": {
        "filename": "ODDC_Certification_Guide_v3.pdf",
        "title": "ODDC Certification Guide (v3)",
        "description": "Version 3.0 — superseded by v5.0",
        "version": "3.0",
        "roles": ["admin"],
    },
    "oddc-certification-guide-v1": {
        "filename": "ODDC_Certification_Guide.pdf",
        "title": "ODDC Certification Guide (Legacy)",
        "description": "Version 1.0 — superseded by v5.0",
        "version": "1.0",
        "roles": ["admin"],
    },
}


@router.get("/", summary="List documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "applicant")
    return [
        {"id": doc_id, "title": doc["title"], "description": doc["description"], "version": doc["version"]}
        for doc_id, doc in AVAILABLE_DOCS.items()
        if role in doc["roles"]
    ]


@router.get("/{doc_id}/download", summary="Download document")
async def download_document(doc_id: str):
    if doc_id == "oddc-certification-guide":
    doc = AVAILABLE_DOCS.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = DOCS_DIR / doc["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(path=str(file_path), filename=doc["filename"], media_type="application/pdf")
