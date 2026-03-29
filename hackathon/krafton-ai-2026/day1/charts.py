"""
Charts for MultiplierBoard report.
Run after experiments finish. Reads results from JSON files.

Usage:
  python charts.py                    # generate all charts
  python charts.py --training FILE    # training curve from specific JSON
"""

import json
import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 1. Training Curve (loss + accuracy vs epoch)
# ============================================================

def plot_training_curve(json_path, out_path=None):
    """Plot loss and accuracy vs epoch from per-epoch JSON log.

    Expected JSON format:
    [{"epoch": 1, "loss": 0.69, "acc": 0.50}, ...]
    """
    with open(json_path) as f:
        data = json.load(f)

    epochs = [d["epoch"] for d in data]
    losses = [d["loss"] for d in data]
    accs = [d["acc"] for d in data]

    fig, ax1 = plt.subplots(figsize=(8, 4))

    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss", color="tab:red")
    ax1.plot(epochs, losses, color="tab:red", alpha=0.7, label="Loss")
    ax1.tick_params(axis="y", labelcolor="tab:red")

    ax2 = ax1.twinx()
    ax2.set_ylabel("Accuracy", color="tab:blue")
    ax2.plot(epochs, accs, color="tab:blue", alpha=0.7, label="Accuracy")
    ax2.tick_params(axis="y", labelcolor="tab:blue")
    ax2.set_ylim(0, 1.05)
    ax2.axhline(y=0.99, color="gray", linestyle="--", alpha=0.5, label="99% threshold")

    # Find epoch where acc first >= 99%
    for d in data:
        if d["acc"] >= 0.99:
            ax2.annotate(f'99% at ep{d["epoch"]}',
                        xy=(d["epoch"], 0.99), fontsize=9,
                        arrowprops=dict(arrowstyle="->"),
                        xytext=(d["epoch"]+20, 0.85))
            break

    fig.tight_layout()

    if out_path is None:
        label = os.path.splitext(os.path.basename(json_path))[0]
        out_path = os.path.join(OUT_DIR, f"chart_training_{label}.png")

    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Saved: {out_path}")


# ============================================================
# 2. Param Count vs Accuracy (scatter)
# ============================================================

def plot_param_vs_acc(results, out_path=None):
    """Scatter plot of parameter count vs accuracy.

    results: list of dicts with keys: label, params, acc
    Example:
    [
        {"label": "EXP-001 d=48", "params": 38208, "acc": 1.0},
        {"label": "EXP-002a d=32", "params": 17000, "acc": 0.99},
        ...
    ]
    """
    fig, ax = plt.subplots(figsize=(8, 4))

    params = [r["params"] for r in results]
    accs = [r["acc"] for r in results]
    labels = [r["label"] for r in results]

    ax.scatter(params, accs, s=80, zorder=5)

    for i, label in enumerate(labels):
        ax.annotate(label, (params[i], accs[i]),
                   textcoords="offset points", xytext=(5, 5), fontsize=8)

    ax.axhline(y=0.99, color="gray", linestyle="--", alpha=0.5, label="99% threshold")
    ax.set_xlabel("Parameter Count")
    ax.set_ylabel("Accuracy")
    ax.set_title("Model Size vs Accuracy")
    ax.set_xscale("log")
    ax.set_ylim(0, 1.05)
    ax.legend()
    ax.grid(True, alpha=0.3)

    fig.tight_layout()

    if out_path is None:
        out_path = os.path.join(OUT_DIR, "chart_param_vs_acc.png")

    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"Saved: {out_path}")


# ============================================================
# 3. Architecture Diagram (text-based for report)
# ============================================================

def print_architecture_diagram():
    """Print ASCII architecture diagram for the report."""
    diagram = """
    ┌─────────────────────────────────────────────┐
    │            MultiplierBoard Model             │
    ├─────────────────────────────────────────────┤
    │                                             │
    │  Input: A₀..A₅ B₀..B₅ (12 tokens)          │
    │         ↓                                   │
    │  ┌─────────────┐                            │
    │  │ Token Embed  │  nn.Embedding(2, d)       │
    │  │  + Sin PE    │  (PE is FREE)             │
    │  └──────┬──────┘                            │
    │         ↓                                   │
    │  ┌─────────────────────────────────┐        │
    │  │      TransformerBlock × L       │←─┐     │
    │  │  ┌───────────────────────────┐  │  │     │
    │  │  │ LN → MHA → Residual      │  │  │     │
    │  │  │ LN → FFN(d→ff→d) → Res   │  │  │ wt  │
    │  │  └───────────────────────────┘  │  │ tie │
    │  └─────────────┬───────────────────┘──┘     │
    │                ↓                            │
    │  ┌─────────────┐                            │
    │  │  LayerNorm   │                           │
    │  └──────┬──────┘                            │
    │         ↓                                   │
    │  ┌─────────────┐                            │
    │  │ Output Head  │  nn.Linear(d, 2)          │
    │  └──────┬──────┘                            │
    │         ↓                                   │
    │  Output: P₀..P₁₁ (12 tokens, autoregressive)│
    │                                             │
    └─────────────────────────────────────────────┘

    Causal mask: upper-triangular, prevents future token leakage.
    Decoding: greedy argmax at each output position.
    """
    print(diagram)
    return diagram


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    # Check for training curve JSON argument
    if len(sys.argv) > 1 and sys.argv[1] == "--training":
        plot_training_curve(sys.argv[2])
        sys.exit(0)

    # Try to plot training curves from any JSON files found
    json_files = [f for f in os.listdir(OUT_DIR) if f.startswith("training_") and f.endswith(".json")]
    for jf in json_files:
        plot_training_curve(os.path.join(OUT_DIR, jf))

    # Example: plot param vs acc with current data
    # SS1/SS3: update this list as results come in
    results = [
        {"label": "EXP-001 d=48", "params": 38208, "acc": 1.0},
        # {"label": "EXP-002a d=32", "params": TBD, "acc": TBD},
        # {"label": "EXP-002b d=24", "params": TBD, "acc": TBD},
        # {"label": "EXP-002c d=16", "params": TBD, "acc": TBD},
    ]

    # Only plot if we have >1 result
    if len(results) > 1:
        plot_param_vs_acc(results)
    else:
        print("Need ≥2 results for param-vs-acc chart. Update results list and rerun.")

    # Print architecture diagram
    print_architecture_diagram()

    print("\nDone. Charts saved as PNG in day1/")
    print("SS1/SS3: Save per-epoch data as training_<exp>.json for training curves.")
    print("Format: [{\"epoch\": 1, \"loss\": 0.69, \"acc\": 0.50}, ...]")
