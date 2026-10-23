import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import torch
import numpy as np
from utils.graph import TransactionGraph
from detectors.dclcg.inference import load_artifact, predict_graph
from detectors.dclcg.train import ARTIFACT_DIR
import os

# Check available models
import glob
models = glob.glob(os.path.join(ARTIFACT_DIR, "*.pt"))
print("Available model artifacts:", models)

# Let's inspect dclcg_prod_e2e.pt
for m in models:
    bundle = load_artifact(m)
    print(f"\nModel: {m}")
    print("Keys in bundle:", bundle.keys())
    print("Number of accounts in bundle:", len(bundle.get("accounts", [])))
    if "scaler" in bundle:
        print("Scaler mean shape:", len(bundle["scaler"]["mean"]))
        print("Scaler mean:", bundle["scaler"]["mean"])
        print("Scaler std:", bundle["scaler"]["std"])
