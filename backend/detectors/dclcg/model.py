"""
model.py — DC-LCG dual-view architecture (PyTorch, CPU-friendly).

Implements the three core modules of the basepaper in a compact form:

  LOCAL VIEW (paper Sec IV-B)
      Soft-label-guided dynamic grouping: neighbours are split into an
      illicit-like and licit-like group using the soft-label buffer,
      aggregated with probability weights, then fused with hybrid attention.

  CONTEXTUAL VIEW (paper Sec IV-C)
      Random-walk candidate paths per node -> dynamic pruning by soft
      labels -> transformer encoding -> multipath semantic fusion.

  MUTUAL ATTENTION FUSION (paper Sec IV-D)
      Bidirectional attention between the two view embeddings followed by
      a classifier head for the illicit probability.
"""
from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn

# ---------------------------------------------------------------------------
# Graph container used by both views (plain adjacency, no networkx needed)
# ---------------------------------------------------------------------------

class WalkGraph:
    """Lightweight adjacency structure for sampling + grouping."""

    def __init__(self, accounts: Sequence[str], edges: Sequence[Tuple[str, str]]):
        self.index: Dict[str, int] = {a: i for i, a in enumerate(accounts)}
        self.n = len(accounts)
        self.neighbors: List[List[int]] = [[] for _ in range(self.n)]
        for u, v in edges:
            ui, vi = self.index.get(u), self.index.get(v)
            if ui is None or vi is None or ui == vi:
                continue
            if vi not in self.neighbors[ui]:
                self.neighbors[ui].append(vi)

    def random_walks(
        self,
        soft_labels: np.ndarray,
        walk_length: int = 6,
        walks_per_node: int = 4,
        prune_keep: int = 4,
        seed: int = 7,
    ) -> Dict[int, List[List[int]]]:
        """
        Sample candidate paths per node and apply DYNAMIC PATH PRUNING:
        within each walk only the top-`prune_keep` nodes by current soft
        label survive (paper Eq.10).
        Returns {node_index: [path_as_index_list, ...]}.
        """
        rng = np.random.default_rng(seed)
        paths: Dict[int, List[List[int]]] = {}
        for start in range(self.n):
            node_paths: List[List[int]] = []
            for _ in range(walks_per_node):
                cur = start
                walk: List[int] = [cur]
                for _ in range(walk_length - 1):
                    nbrs = self.neighbors[cur]
                    if not nbrs:
                        break
                    cur = int(rng.choice(nbrs))
                    walk.append(cur)
                    if len(walk) >= self.n:
                        break
                # Dynamic path pruning by soft labels
                scored = sorted(walk, key=lambda ix: -float(soft_labels[ix]))
                keep = set(scored[:prune_keep])
                pruned = [ix for ix in walk if ix in keep]
                # Always keep the start/endpoints context
                if walk and walk[0] not in keep:
                    pruned = [walk[0]] + pruned
                # De-duplicate consecutive repeats after pruning
                dedup: List[int] = []
                for ix in pruned:
                    if not dedup or dedup[-1] != ix:
                        dedup.append(ix)
                if len(dedup) >= 2:
                    node_paths.append(dedup)
            paths[start] = node_paths or [[start]]
        return paths


# ---------------------------------------------------------------------------
# Local view — soft-label-guided grouping + aggregation (Eqs. 2-9)
# ---------------------------------------------------------------------------

class LocalViewLayer(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.linear = nn.Linear(dim, dim)
        # Hybrid attention over [illicit_group, licit_group] scores
        self.attn = nn.Linear(dim, 2)

    def forward(
        self,
        h: torch.Tensor,           # (N, D) node features
        soft_labels: torch.Tensor, # (N,)  illicit probabilities
        neighbors: List[List[int]],
    ) -> torch.Tensor:
        n, d = h.shape
        out = h.new_zeros(n, d)

        h_illicit_sum = torch.zeros_like(h)
        w_illicit_sum = torch.zeros(n, device=h.device)
        h_licit_sum = torch.zeros_like(h)
        w_licit_sum = torch.zeros(n, device=h.device)

        for i in range(n):
            nbrs = neighbors[i]
            if not nbrs:
                continue
            idx = torch.tensor(nbrs, dtype=torch.long, device=h.device)
            p = soft_labels[idx].clamp(0.0, 1.0)
            hn = h[idx]
            h_illicit_sum[i] = (hn * p.unsqueeze(1)).sum(dim=0)
            w_illicit_sum[i] = p.sum()
            h_licit_sum[i] = (hn * (1.0 - p).unsqueeze(1)).sum(dim=0)
            w_licit_sum[i] = (1.0 - p).sum()

        # Nodes with no neighbours keep zero sums; clamp AFTER the loop so
        # every denominator is safe (avoids 0/0 -> NaN).
        w_illicit_sum = w_illicit_sum.clamp(min=1e-6)
        w_licit_sum = w_licit_sum.clamp(min=1e-6)

        illicit_group = h_illicit_sum / w_illicit_sum.unsqueeze(1)
        licit_group = h_licit_sum / w_licit_sum.unsqueeze(1)

        # Probability-weighted intragroup aggregation + hybrid intergroup
        scores = self.attn(illicit_group + licit_group)          # (N, 2)
        alpha = torch.softmax(scores, dim=1).unsqueeze(2)        # (N, 2, 1)
        groups = torch.stack([illicit_group, licit_group], dim=1)  # (N, 2, D)
        fused = (alpha * groups).sum(dim=1)                      # (N, D)

        out = torch.tanh(self.linear(fused + h))                 # residual
        return out


# ---------------------------------------------------------------------------
# Contextual view — transformer multipath semantic fusion (Eqs. 11-15)
# ---------------------------------------------------------------------------

class ContextualView(nn.Module):
    def __init__(self, dim: int, n_heads: int = 2, n_layers: int = 1):
        super().__init__()
        layer = nn.TransformerEncoderLayer(
            d_model=dim, nhead=n_heads, dim_feedforward=dim * 2,
            dropout=0.1, batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(layer, num_layers=n_layers)

    def forward(
        self,
        h: torch.Tensor,
        paths: Dict[int, List[List[int]]],
    ) -> torch.Tensor:
        n, d = h.shape
        ctx = h.new_zeros(n, d)
        for i in range(n):
            node_paths = paths.get(i) or [[i]]
            seqs = []
            for p in node_paths[:4]:                     # cap multipath fusion
                idx = torch.tensor(p, dtype=torch.long, device=h.device)
                seqs.append(h[idx])                      # (len_i, D)
            padded = nn.utils.rnn.pad_sequence(seqs, batch_first=True)
            mask = (
                torch.arange(padded.size(1), device=h.device).unsqueeze(0)
                >= torch.tensor([s.size(0) for s in seqs], device=h.device).unsqueeze(1)
            )
            encoded = self.encoder(padded, src_key_padding_mask=mask)
            lengths = torch.tensor([s.size(0) for s in seqs],
                                   device=h.device, dtype=torch.float32)
            emb = encoded.sum(dim=1) / lengths.unsqueeze(1)
            ctx[i] = emb.mean(dim=0)                     # multipath semantic fusion
        return ctx


# ---------------------------------------------------------------------------
# Full DC-LCG model with mutual attention fusion (Eqs. 16-19)
# ---------------------------------------------------------------------------

class DCLCGModel(nn.Module):
    def __init__(self, in_dim: int, hidden_dim: int = 32, n_layers: int = 2):
        super().__init__()
        self.input_proj = nn.Linear(in_dim, hidden_dim)
        self.local_layers = nn.ModuleList(
            [LocalViewLayer(hidden_dim) for _ in range(n_layers)]
        )
        self.contextual = ContextualView(hidden_dim)
        # Mutual attention gates between the two views
        self.gate_local = nn.Linear(hidden_dim * 2, 1)
        self.gate_ctx = nn.Linear(hidden_dim * 2, 1)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, 1),
        )

    def forward(
        self,
        x: torch.Tensor,
        soft_labels: torch.Tensor,
        neighbors: List[List[int]],
        paths: Dict[int, List[List[int]]],
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        h = torch.relu(self.input_proj(x))
        for layer in self.local_layers:
            h = layer(h, soft_labels.detach(), neighbors)

        c = self.contextual(h, paths)

        pair_l = torch.cat([h, c], dim=1)
        pair_c = torch.cat([c, h], dim=1)
        a_l = torch.sigmoid(self.gate_local(pair_l))
        a_c = torch.sigmoid(self.gate_ctx(pair_c))

        # Mutual-attention gated fusion of BOTH view embeddings
        fused = torch.cat([a_l * h, a_c * c], dim=1)      # (N, 2H)
        logits = self.classifier(fused).squeeze(-1)       # (N,)
        probs = torch.sigmoid(logits)
        return probs, h, c
