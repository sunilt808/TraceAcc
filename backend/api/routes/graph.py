"""
graph.py — Graph data retrieval API.

Provides endpoints to retrieve graph structure, community data,
centrality scores, and suspicious paths for the frontend
Graph Viewer and Communities pages.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from api.deps import get_current_user
from db.database import get_db
from models.user import User

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/health")
def graph_health():
    """Simple health check for graph module."""
    return {"status": "graph module active"}
