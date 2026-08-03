"""
storage_service.py - Abstraction layer for file storage.
Initially implemented using local disk storage. 
Can be swapped for an S3-backed implementation later.
"""
import os
import uuid
import shutil
from fastapi import UploadFile

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "evidence_storage")

if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)

class StorageService:
    @staticmethod
    def save_evidence(file: UploadFile, org_id: int, case_id: int) -> str:
        """
        Saves a file and returns its storage path.
        In the local implementation, this isolates files by org_id/case_id.
        """
        # Create directory structure: evidence_storage/org_<org_id>/case_<case_id>/
        org_dir = os.path.join(STORAGE_DIR, f"org_{org_id}", f"case_{case_id}")
        os.makedirs(org_dir, exist_ok=True)
        
        # Prevent collisions by generating a unique filename
        safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        storage_path = os.path.join(org_dir, safe_filename)
        
        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return storage_path

    @staticmethod
    def get_evidence_path(storage_path: str) -> str:
        """
        Returns the absolute path to the file for download.
        (For S3, this might generate a presigned URL instead).
        """
        if not os.path.exists(storage_path):
            raise FileNotFoundError("Evidence file not found.")
        return storage_path
