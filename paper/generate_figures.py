import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

output_dir = r"C:\traceacc\TraceAcc1\paper"
os.makedirs(output_dir, exist_ok=True)

# -------------------------------------------------------------
# Figure 4: Clean Data Flow Architecture (Enclosed Cards)
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(13.5, 7.2), dpi=300)
ax.set_xlim(0, 126)
ax.set_ylim(0, 85)
ax.axis('off')

def draw_card(ax, x, y, w, h, title, lines, header_color='#1e3a8a', bg_color='#ffffff', edge_color='#cbd5e1'):
    rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=1.5",
                                  facecolor=bg_color, edgecolor=edge_color, linewidth=1.3)
    ax.add_patch(rect)
    header_rect = patches.FancyBboxPatch((x, y + h - 6.0), w, 6.0, boxstyle="round,pad=0.1,rounding_size=1.2",
                                         facecolor=header_color, edgecolor=edge_color, linewidth=1.3)
    ax.add_patch(header_rect)
    ax.text(x + w/2, y + h - 3.0, title, ha='center', va='center', color='white', fontsize=8.5, fontweight='bold')
    
    y_pos = y + h - 9.2
    for line in lines:
        ax.text(x + 1.8, y_pos, line, ha='left', va='center', color='#1e293b', fontsize=7.2)
        y_pos -= 2.9

# Stage 1: Ingestion
draw_card(ax, 2, 30, 16, 23, "1. Ingestion", 
          ["• UPI / AML CSV", "• API Data Stream", "• Senders & Receivers", "• Timestamps & Amounts"],
          header_color='#1e3a8a')

# Stage 2: Validation
draw_card(ax, 21, 30, 16, 23, "2. Validation & Prep", 
          ["• Schema validation", "• Zero-loss missing check", "• Rolling time features", "• Min-Max normalization"],
          header_color='#1e3a8a')

# Stage 3: Dynamic Graph
draw_card(ax, 40, 30, 16, 23, "3. Dynamic Graph", 
          ["• Accounts -> Nodes", "• Transfers -> Edges", "• Time-stamped edges", "• Multigraph snapshot"],
          header_color='#1e3a8a')

# Stage 4: 4 Evidence Branches
draw_card(ax, 61, 65, 17, 16, "4A. DC-LCG GNN", 
          ["• Dual-view embeddings", "• Local + Context views", "• Camouflage filtering"], header_color='#047857')

draw_card(ax, 61, 45, 17, 16, "4B. AML Patterns", 
          ["• Cycles, Fan-in/out", "• Structuring chains", "• Diamond pass-through"], header_color='#047857')

draw_card(ax, 61, 25, 17, 16, "4C. Temporal & Velocity", 
          ["• Rapid fund movement", "• Burst frequencies", "• Cadence deviations"], header_color='#047857')

draw_card(ax, 61, 5, 17, 16, "4D. Community & ML", 
          ["• Louvain bridge nodes", "• Isolation Forest / LOF", "• DBSCAN anomaly score"], header_color='#047857')

# Stage 5: Evidence Fusion
draw_card(ax, 83, 21, 18, 41, "5. Evidence Fusion", 
          ["Normalized Evidence Vector:", 
           " e = [G, B, T, C, M]", 
           "",
           "Calibrated Weights:",
           " w = [35, 20, 15, 10, 20]%", 
           "",
           "Composite Risk Score:",
           " R(v) = w^T e in [0, 1]",
           "",
           "Threshold Prioritization:",
           " tau_alert = 0.65"], 
          header_color='#b45309', bg_color='#fffbeb', edge_color='#fde68a')

# Stage 6: Forensic Reporting
draw_card(ax, 105, 21, 18, 41, "6. Investigation", 
          ["• High-risk alert queue", 
           "• Subgraph visualizer", 
           "• Chronological timeline", 
           "• Entity link analysis", 
           "• Investigator sign-off",
           "",
           "Integrity Verification:",
           "• SHA-256 digital seal"],
          header_color='#b91c1c', bg_color='#fef2f2', edge_color='#fecaca')

# Connectors
def draw_arrow(ax, x1, y1, x2, y2, color='#475569'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(facecolor=color, edgecolor=color, arrowstyle="->", lw=1.6, mutation_scale=12))

# Linear flow 1 -> 2 -> 3
draw_arrow(ax, 18, 41.5, 21, 41.5)
draw_arrow(ax, 37, 41.5, 40, 41.5)

# Distribution bus from Stage 3 to Stages 4A-4D
ax.plot([56, 58.5, 58.5], [41.5, 41.5, 73], color='#475569', lw=1.6)
ax.plot([58.5, 58.5], [41.5, 13], color='#475569', lw=1.6)

draw_arrow(ax, 58.5, 73, 61, 73)
draw_arrow(ax, 58.5, 53, 61, 53)
draw_arrow(ax, 58.5, 33, 61, 33)
draw_arrow(ax, 58.5, 13, 61, 13)

# Gathering bus from Stages 4A-4D into Stage 5
ax.plot([78, 80.5, 80.5], [73, 73, 41.5], color='#475569', lw=1.6)
ax.plot([78, 80.5], [53, 53], color='#475569', lw=1.6)
ax.plot([78, 80.5], [33, 33], color='#475569', lw=1.6)
ax.plot([78, 80.5, 80.5], [13, 13, 41.5], color='#475569', lw=1.6)
draw_arrow(ax, 80.5, 41.5, 83, 41.5)

# Flow 5 -> 6
draw_arrow(ax, 101, 41.5, 105, 41.5)

plt.tight_layout()
fig.savefig(os.path.join(output_dir, "fig4_dataflow_architecture.png"), dpi=300)
fig.savefig(os.path.join(output_dir, "fig4_dataflow_architecture.pdf"))
plt.close(fig)
print("Figure 4 perfectly padded and enclosed.")
