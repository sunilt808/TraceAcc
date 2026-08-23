"""
registry.py — minimal model artifact registry over models_artifacts/*.pt.
"""
from __future__ import annotations

import glob
import os
from typing import List, Optional

from .inference import load_artifact, _artifact_path
from .train import ARTIFACT_DIR


def list_models() -> List[dict]:
    """All registered DC-LCG artifacts with their metadata."""
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    out: List[dict] = []
    for path in sorted(
        glob.glob(os.path.join(ARTIFACT_DIR, "dclcg_*.pt")),
        key=os.path.getmtime,
        reverse=True,
    ):
        try:
            bundle = load_artifact(path)
            config = bundle.get("config", {})
            out.append(
                {
                    "name": os.path.basename(path)[len("dclcg_"):-3],
                    "file": path,
                    "n_accounts": config.get("n_accounts"),
                    "n_transactions": config.get("n_transactions"),
                    "epochs": config.get("epochs"),
                    "supervised": config.get("supervised"),
                    "metrics": config.get("metrics", {}),
                    "trained_at": config.get("trained_at"),
                }
            )
        except Exception:
            continue
    return out


def get_latest_artifact() -> Optional[str]:
    """Path of the most recently trained artifact, or None."""
    models = list_models()
    return models[0]["file"] if models else None


def get_artifact_by_name(name: str) -> Optional[str]:
    path = _artifact_path(name)
    return path if os.path.exists(path) else None
