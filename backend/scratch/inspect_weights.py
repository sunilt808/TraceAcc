import sys
from pathlib import Path
backend_path = Path(r"c:\traceacc\TraceAcc1\backend")
sys.path.insert(0, str(backend_path))

import torch
import numpy as np
import os
from detectors.dclcg.inference import load_artifact
from detectors.dclcg.train import ARTIFACT_DIR

bundle = load_artifact(os.path.join(ARTIFACT_DIR, "dclcg_prod_e2e.pt"))
state_dict = bundle["state_dict"]

print("State Dict Keys and Shapes:")
for k, v in state_dict.items():
    print(f"  {k}: {v.shape}, min={v.min().item():.4f}, max={v.max().item():.4f}, mean={v.mean().item():.4f}")

# Look at classifier bias and weights
print("\nClassifier.3.bias:", state_dict["classifier.3.bias"])
print("Classifier.3.weight:", state_dict["classifier.3.weight"])
print("Classifier.0.bias:", state_dict["classifier.0.bias"])
