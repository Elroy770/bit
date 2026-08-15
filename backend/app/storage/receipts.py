from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile, HTTPException
from ..core.config import settings

ALLOWED={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}
async def save_receipt(upload: UploadFile | None) -> str | None:
    if upload is None: return None
    if upload.content_type not in ALLOWED: raise HTTPException(400,"receipt must be JPEG, PNG or WebP")
    data=await upload.read(settings.max_receipt_bytes+1)
    if len(data)>settings.max_receipt_bytes: raise HTTPException(413,"receipt is too large")
    directory=Path(settings.receipts_dir); directory.mkdir(parents=True,exist_ok=True)
    name=f"{uuid4().hex}{ALLOWED[upload.content_type]}"
    (directory/name).write_bytes(data)
    return name
