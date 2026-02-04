from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from app.core.security import get_current_user

router = APIRouter(tags=["documents"])

DOCS_DIR = Path("/app/static/documents")

AVAILABLE_DOCS = {
    "oddc-certification-guide": {
        "filename": "ODDC_Certification_Guide.pdf",
        "title": "ODDC Certification Guide",
        "description": "Complete applicant roadmap for ODDC certification",
        "version": "1.0",
        "roles": ["admin", "applicant"],
    },
}


@router.get("/")
async def list_documents(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "applicant")
    return [
        {"id": doc_id, "title": doc["title"], "description": doc["description"], "version": doc["version"]}
        for doc_id, doc in AVAILABLE_DOCS.items()
        if role in doc["roles"]
    ]


@router.get("/debug")
async def debug_documents():
    files = list(DOCS_DIR.glob("*")) if DOCS_DIR.exists() else []
    return {"docs_dir": str(DOCS_DIR), "exists": DOCS_DIR.exists(), "files": [f.name for f in files]}


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = AVAILABLE_DOCS.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    role = current_user.get("role", "applicant")
    if role not in doc["roles"]:
        raise HTTPException(status_code=403, detail="Access denied")
    file_path = DOCS_DIR / doc["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(path=str(file_path), filename=doc["filename"], media_type="application/pdf")
