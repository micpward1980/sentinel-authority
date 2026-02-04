"""Document download routes for portal resources."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from app.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["documents"])

_relative = Path(__file__).resolve().parent.parent.parent.parent / "static" / "documents"
_absolute = Path("/app/static/documents")

if _absolute.exists():
    DOCS_DIR = _absolute
else:
    DOCS_DIR = _relative

logger.info(f"Documents directory: {DOCS_DIR} (exists: {DOCS_DIR.exists()})")

AVAILABLE_DOCS = {
    "oddc-certification-guide": {
        "filename": "ODDC_Certification_Guide.pdf",
        "title": "ODDC Certification Guide",
        "description": "Complete applicant roadmap - 7 phases from inquiry to ongoing monitoring",
        "version": "1.0",
        "roles": ["admin", "applicant"],
    },
}


@router.get("/")
async def list_documents(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "applicant")
    docs = [
        {"id": doc_id, **{k: v for k, v in doc.items() if k != "filename"}}
        for doc_id, doc in AVAILABLE_DOCS.items()
        if role in doc["roles"]
    ]
    logger.info(f"List docs for role={role}: {len(docs)} found, dir={DOCS_DIR}, exists={DOCS_DIR.exists()}")
    return docs


@router.get("/debug")
async def debug_documents():
    files = list(DOCS_DIR.glob("*")) if DOCS_DIR.exists() else []
    return {
        "docs_dir": str(DOCS_DIR),
        "exists": DOCS_DIR.exists(),
        "files": [f.name for f in files],
        "cwd": str(Path.cwd()),
    }


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = AVAILABLE_DOCS.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    role = current_user.get("role", "applicant")
    if role not in doc["roles"]:
        raise HTTPException(status_code=403, detail="Access denied")
    file_path = DOCS_DIR / doc["filename"]
    logger.info(f"Download: {doc_id}, path={file_path}, exists={file_path.exists()}")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not at {file_path}")
    return FileResponse(path=str(file_path), filename=doc["filename"], media_type="application/pdf")
