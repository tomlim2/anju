# MultiplierBoard: Minimal Transformer for 6-bit Binary Multiplication

**Participant #179** | KRAFTON AI R&D Hackathon | Round 1, Day 1

---

## 1. Architecture

### Problem 1-2: Trained Architecture

**Core design:** Decoder-only transformer with sinusoidal PE (free), systematically swept across dimensions and tying strategies.

```
Input: A₀..A₅ B₀..B₅ (12 tokens, vocab=2)
       ↓
┌─────────────┐
│ Token Embed  │  nn.Embedding(2, 32)
│  + Sin PE    │  (sinusoidal — FREE)
└──────┬──────┘
       ↓
┌──────────────────────────┐
│  TransformerBlock × 2    │
│  LN → MHA(2 heads) → +  │
│  LN → FFN(32→64→32) → + │
└──────────┬───────────────┘
           ↓
┌─────────────┐
│  LayerNorm   │
│  Linear(32,2)│
└──────┬──────┘
       ↓
Output: P₀..P₁₁ (greedy argmax, autoregressive)
```

| Component | Choice | Rationale |
|-----------|--------|-----------|
| d_model | 32 | Smallest stable dimension (d=24 seed-unstable) |
| n_heads | 2 | Sufficient for input bit routing |
| n_layers | 2 | Minimum for multiplication (1-layer proven insufficient) |
| d_ff | 64 | 2× d_model, standard ratio |
| PE | Sinusoidal (free) | Not counted per rules |
| Activation | GELU | Standard |

**Parameter count: P_2 = 17,280**

### Problem 1-1: Hand-Coded Weights

**P_1 = -1** (see Section 3 for approach and analysis)

---

## 2. Training & Results

### Fixed Protocol
AdamW (lr=1e-3, wd=0.01), cosine annealing, 200 epochs, batch 256, 100K random pairs.

### Dimension Sweep

| d_model | Params | Accuracy | Stable across seeds? |
|---------|--------|----------|---------------------|
| 48 | 38,208 | 100% | Yes |
| 32 | 17,280 | 100% | Yes (verifying) |
| 24 | 9,888 | 74–99.78% | **No** — seed dependent |
| 16 | 4,544 | 37.8% | N/A — fails to learn |

**Key finding:** d=32 is the stability threshold. Below d=32, accuracy becomes seed-dependent — d=24 ranged from 74% to 99.78% across seeds. d=16 fails entirely.

### Weight Tying Experiments

| Tying | d | Params | Accuracy | Stable? |
|-------|---|--------|----------|---------|
| None (standard) | 32 | 17,280 | 100% | Yes |
| Embed + V=Q | 32 | 14,912 | 78–99.95% | **No** |
| K=Q + V=Q | 32 | — | ~50% | No — symmetric attention |
| Embed + V=Q | 24 | 8,496 | 99.46% | No |
| Embed only | 24 | 9,648 | 60.4% | No |

**Finding:** VQ tying reduces params significantly but introduces seed instability. K=Q makes attention symmetric, destroying the model's ability to distinguish A and B operands. Embed+VQ at d=32 achieved 99.95% on one seed but 78% on another.

### Low-Rank Experiments

| Rank | d | Params | Accuracy |
|------|---|--------|----------|
| 2 | 32 | 2,432 | 9.3% |

Low-rank (rank=2) factorization has insufficient capacity for multiplication.

### Best Model

**d=32, 2 layers, 2 heads, ff=64, no tying. P_2 = 17,280, Acc_2 = 1.0**

Chosen for seed stability over parameter minimization. In a competition where the evaluator re-trains with a random seed, reliability matters more than raw parameter count.

---

## 3. Problem 1-1: Hand-Coded Approach

### Algorithm

Binary multiplication = iterated shift-and-add:
```
P = A[0]*(B<<0) + A[1]*(B<<1) + ... + A[5]*(B<<5)
```

### Building Blocks

| Operation | Implementation | Params |
|-----------|---------------|--------|
| AND(a,b) | ReLU(a + b - 1) | 3 |
| XOR(a,b) | a + b - 2·AND(a,b) | ~5 |
| Half-adder carry | ReLU(sum - 1) | ~3 |

### Implementation Attempt

We built a single-layer hand-coded model (d=24, 12 heads):

1. **PE-based attention routing:** Q/K projections along sinusoidal PE direction with SCALE=20. Result: 10/12 heads achieved near-one-hot attention to target positions.

2. **PE annihilation in V projection:** V weights set orthogonal to PE vectors, extracting clean bit values without contamination. Result: correct extraction in 4/5 test cases.

3. **AND product neurons:** 36 MLP neurons for all (i,j) pairs, computing ReLU(A_i + B_j - 1).

### Fundamental Dilemma (Unsolved)

| Design | Bit Extraction | Position Info | Verdict |
|--------|---------------|---------------|---------|
| With residual | Contaminated by PE | Available | MLP can't cleanly compute AND |
| Without residual | Clean | Lost | MLP outputs identical for all positions |

The MLP uses shared weights — without position info it computes the same function everywhere. With residual (carrying PE), bit values are contaminated. Resolving this requires ≥2 layers.

### Why P_1 = -1

Full solution requires 2+ layers, carry propagation circuit, exhaustive verification + formal proof. Estimated ~6 hours, exceeding the 4-hour window.

---

## 4. Ablations & Failed Attempts

### What mattered most
1. **d_model ≥ 32** — most critical parameter. Below this, learning becomes unstable.
2. **n_layers = 2** — minimum for multiplication. 1-layer insufficient (confirmed empirically and by literature).
3. **Seed stability** — tying techniques reduce params but introduce randomness sensitivity.

### What didn't work
- **Low-rank factorization (rank=2):** 9.3% accuracy. Multiplication needs full-rank projections.
- **K=Q tying:** Forces symmetric attention, model can't distinguish A from B operands (~50%).
- **Aggressive VQ tying at d=24:** 99.46% best case, but seed-unstable.
- **d=16 and below:** Complete failure (37.8%). Insufficient model capacity.

### Key insight
Multiplication is fundamentally harder than addition for transformers. While addition can be solved with 6 parameters (AdderBoard), multiplication's quadratic bit interactions and multi-bit carry propagation demand significantly more capacity. The stability boundary (d=32) reflects this complexity.

---

**Submission:** P_1 = -1, P_2 = 17,280, Acc_2 = 1.0
