"""
dclcg — Dual-View Graph Representation Learning for money-laundering
detection (basepaper: Li et al., IEEE TCSS 2026, "DC-LCG").

Modules:
    value_encoder — Dynamic Value Field Encoder (paper Sec IV-A)
    model         — Local view + Contextual view + mutual attention fusion
    train         — Training loop w/ soft-label buffer
    inference     — Artifact loading + prediction + explainability
    registry      — Model artifact registry (list / latest / load)
"""
try:
    from .value_encoder import build_value_features
    from .model import DCLCGModel
    from .train import train_dclcg, save_artifact, ARTIFACT_DIR
    from .inference import predict_graph, load_artifact
    from .registry import list_models, get_latest_artifact
except Exception as e:
    import logging
    logging.getLogger("dclcg").warning("DC-LCG deep learning model unavailable (PyTorch fallback): %s", e)
    DCLCGModel = None
    build_value_features = lambda *args, **kwargs: {}
    train_dclcg = lambda *args, **kwargs: {}
    save_artifact = lambda *args, **kwargs: None
    predict_graph = lambda *args, **kwargs: {"probs": {}, "disguise": {}, "top_paths": {}}
    load_artifact = lambda *args, **kwargs: {}
    list_models = lambda *args, **kwargs: []
    get_latest_artifact = lambda *args, **kwargs: None
    ARTIFACT_DIR = ""

__all__ = [
    "build_value_features",
    "DCLCGModel",
    "train_dclcg",
    "save_artifact",
    "ARTIFACT_DIR",
    "predict_graph",
    "load_artifact",
    "list_models",
    "get_latest_artifact",
]
