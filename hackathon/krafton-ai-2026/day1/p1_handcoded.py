"""
P_1 Hand-Coded Weights — 6-bit Binary Multiplication Transformer
SS3: Theoretical design + implementation attempt

Approach: No-residual architecture for clean bit extraction
- Attention gathers input bits into clean dimensions (no PE contamination)
- MLP computes column_k AND products → sum → carry → parity → P_k
- Key insight: removing residual allows V projection to output clean bit values

Architecture v2 (no residual):
  h = tok_emb(x) + PE          # embedding
  attn_out = self_attn(h)      # NO residual (not h + attn_out)
  mlp_in = [attn_out | PE_k]   # concat clean bits + position info
  logits = head(MLP(mlp_in))   # compute output
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math
import random
import numpy as np


# ============================================================
# Data
# ============================================================

def encode_pair(a, b):
    a_bits = [(a >> i) & 1 for i in range(6)]
    b_bits = [(b >> i) & 1 for i in range(6)]
    p = a * b
    p_bits = [(p >> i) & 1 for i in range(12)]
    return a_bits + b_bits, p_bits


def sinusoidal_pe(max_len, d_model):
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe


# ============================================================
# No-Residual Hand-Coded Model
# ============================================================

class HandCodedMultiplier(nn.Module):
    """
    Custom transformer for hand-coded 6-bit binary multiplication.

    KEY DESIGN DECISION: No residual connections.
    This allows attention to output CLEAN bit values without PE contamination.

    Architecture:
    - d_model = D (split: D_bits for bit gathering + D_pos for position info)
    - 1 self-attention layer, no residual, no LayerNorm
    - ReLU MLP
    - Sinusoidal PE (free)

    Flow:
    1. h = tok_emb(x) + PE
    2. attn_out = self_attn(h, h, h)  [NO residual]
    3. For output positions: attn_out has clean bit values + position routing
    4. mlp_out = MLP(attn_out)
    5. logits = head(mlp_out)
    """

    def __init__(self, d_model=24, n_heads=12, d_ff=72):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        assert d_model % n_heads == 0

        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pe', sinusoidal_pe(24, d_model))

        # Manual attention projections for full control
        # in_proj_weight: (3*d_model, d_model) = [W_Q; W_K; W_V]
        self.W_Q = nn.Parameter(torch.zeros(d_model, d_model))
        self.W_K = nn.Parameter(torch.zeros(d_model, d_model))
        self.W_V = nn.Parameter(torch.zeros(d_model, d_model))
        self.W_O = nn.Parameter(torch.zeros(d_model, d_model))

        # MLP
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, 2)  # output directly to 2 logits

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pe[:T]  # (B, T, d_model)

        # Manual multi-head attention
        d = self.d_model
        dh = self.d_head
        nh = self.n_heads

        Q = h @ self.W_Q.T  # (B, T, d)
        K = h @ self.W_K.T
        V = h @ self.W_V.T

        # Reshape for multi-head: (B, T, d) → (B, nh, T, dh)
        Q = Q.view(B, T, nh, dh).transpose(1, 2)
        K = K.view(B, T, nh, dh).transpose(1, 2)
        V = V.view(B, T, nh, dh).transpose(1, 2)

        # Attention scores
        scores = Q @ K.transpose(-2, -1) / math.sqrt(dh)  # (B, nh, T, T)

        # Causal mask
        causal = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        scores = scores.masked_fill(causal.unsqueeze(0).unsqueeze(0), float('-inf'))

        attn_w = F.softmax(scores, dim=-1)  # (B, nh, T, T)
        attn_out = attn_w @ V  # (B, nh, T, dh)

        # Reshape back: (B, nh, T, dh) → (B, T, d)
        attn_out = attn_out.transpose(1, 2).contiguous().view(B, T, d)

        # O projection
        attn_out = attn_out @ self.W_O.T  # (B, T, d)

        # NO RESIDUAL — this is the key design choice
        # MLP directly on attention output → 2 logits
        logits = self.fc2(F.relu(self.fc1(attn_out)))  # (B, T, 2)

        return logits

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


# ============================================================
# Weight Setting: V2 — Clean bit extraction via PE annihilation
# ============================================================

def set_weights_v2(model):
    """
    Set hand-coded weights with clean bit extraction.

    Strategy:
    1. Embedding: 0→[0,...], 1→[1,0,...] (bit value in dim 0)
    2. For each head h (h=0..11): V_h annihilates PE(h) so V outputs clean bit value
    3. Q/K route output positions to attend sharply to input position h
    4. O maps head outputs so dim h = bit_h
    5. MLP computes AND products → column sum → carry → parity → logits
    """
    d = model.d_model
    nh = model.n_heads
    dh = model.d_head
    pe = model.pe.clone()  # (24, d)

    with torch.no_grad():
        # --- Embedding ---
        model.tok_emb.weight.zero_()
        model.tok_emb.weight[1, 0] = 1.0  # token 1 → [1, 0, 0, ...]

        # --- V Projection: annihilate PE at target position ---
        # For head h: V_h maps (d_model) → (d_head)
        # V_h stored in W_V rows [h*dh : (h+1)*dh, :]
        # We want: V_h × PE(h) = 0 and V_h × tok_emb(1) = [1, 0, ...] in d_head dims

        W_V = torch.zeros(d, d)

        for h in range(min(nh, 12)):
            pe_h = pe[h]  # PE at target position h

            for di in range(dh):
                row_idx = h * dh + di
                if di == 0:
                    # Row must: dot(row, PE(h)) = 0 AND row[0] = 1
                    # row = [1, r1, r2, ...] with PE(h)[0] + r1*PE(h)[1] + ... = 0
                    row = torch.zeros(d)
                    row[0] = 1.0

                    # Find component to cancel: use dim 1 if available
                    # PE(h)[0] + r1 * PE(h)[1] = 0 → r1 = -PE(h)[0] / PE(h)[1]
                    if abs(pe_h[1]) > 1e-6:
                        row[1] = -pe_h[0] / pe_h[1]
                    elif abs(pe_h[2]) > 1e-6:
                        row[2] = -pe_h[0] / pe_h[2]
                    else:
                        # PE(h)[0] ≈ 0, row is already orthogonal
                        pass

                    W_V[row_idx] = row
                else:
                    # Extra d_head dims: zero (unused for now)
                    pass

        model.W_V.copy_(W_V)

        # --- Q/K Projection: sharp attention to target position ---
        SCALE = 20.0

        W_Q = torch.zeros(d, d)
        W_K = torch.zeros(d, d)

        for h in range(min(nh, 12)):
            pe_h = pe[h]
            pe_h_norm = pe_h / (pe_h.norm() + 1e-8)

            for di in range(dh):
                row_idx = h * dh + di
                if di == 0:
                    W_K[row_idx] = SCALE * pe_h_norm
                    W_Q[row_idx] = SCALE * pe_h_norm

        model.W_Q.copy_(W_Q)
        model.W_K.copy_(W_K)

        # --- O Projection: map head h output dim 0 → model dim h ---
        W_O = torch.zeros(d, d)
        for h in range(min(nh, 12)):
            # head h's output is in concat dims [h*dh : (h+1)*dh]
            # Map dim h*dh (the bit value) to model dim h
            W_O[h, h * dh] = 1.0

        model.W_O.copy_(W_O)

        # --- MLP: compute multiplication ---
        # After attention (no residual), output position 11+k has:
        #   dim h ≈ bit_h for h=0..11 (clean bit values)
        #   dims 12+ ≈ 0 (unused heads or position info)
        #
        # MLP fc1: (d_model, d_ff), bias (d_ff)
        # MLP fc2: (d_ff, 2), bias (2)
        #
        # Strategy for MLP:
        # Layer 1 hidden neurons compute AND products:
        #   neuron_{i,j} = ReLU(dim_i + dim_{6+j} - 1) = A_i AND B_j
        #
        # Layer 2 sums products by column and outputs logits.
        # But column selection depends on position k... which we DON'T have
        # in the clean representation (PE was removed by no-residual).
        #
        # PROBLEM: without residual, position info is lost!
        # Solution: use remaining heads (12+) to pass PE info, or
        # use extra V dims to carry position.

        d_ff = model.fc1.out_features

        model.fc1.weight.zero_()
        model.fc1.bias.zero_()
        model.fc2.weight.zero_()
        model.fc2.bias.zero_()

        # AND product neurons (first 36 neurons)
        neuron = 0
        for i in range(6):
            for j in range(6):
                if neuron < d_ff:
                    model.fc1.weight[neuron, i] = 1.0       # A_i (dim i)
                    model.fc1.weight[neuron, 6 + j] = 1.0   # B_j (dim 6+j)
                    model.fc1.bias[neuron] = -1.0            # AND threshold
                    neuron += 1

        # For now: just compute P_0 = AND(A_0, B_0) as proof of concept
        # P_0 corresponds to neuron 0 (i=0, j=0): AND(A_0, B_0)
        # logit[1] should be high when P_0=1, logit[0] when P_0=0
        #
        # But this only works at position 11 (predicting P_0).
        # ALL positions use the same weights, so this would output AND(A_0,B_0)
        # at every position — WRONG for k>0.
        #
        # Without position info, all positions compute the same thing.
        # This is a fundamental limitation of the no-residual design.

        # TEMPORARY: at least verify P_0 works
        # fc2: (d_ff, 2)
        # logit_1 = sum of relevant neurons, logit_0 = -(sum)
        model.fc2.weight[1, 0] = 2.0    # AND(A_0, B_0) → logit for "1"
        model.fc2.weight[0, 0] = -2.0   # inverse for "0"
        model.fc2.bias[1] = -0.5
        model.fc2.bias[0] = 0.5

    return model


# ============================================================
# Weight Setting: V3 — Hybrid (attention with selective residual)
# ============================================================

def set_weights_v3(model):
    """
    Hybrid approach: attention gathers bits AND preserves position info.

    Key insight: use SOME heads for bit gathering (with PE annihilation in V)
    and OTHER heads to pass through position information.

    With d_model=24, n_heads=12, d_head=2:
    - Heads 0-11: gather input bit h (V annihilates PE)
    - Head output dim 0: clean bit value
    - Head output dim 1: PE-based position signal

    After O projection:
    - dims 0-11: clean bit values
    - dims 12-23: position signals (to tell MLP which k we're computing)
    """
    d = model.d_model
    nh = model.n_heads
    dh = model.d_head
    pe = model.pe.clone()

    with torch.no_grad():
        model.tok_emb.weight.zero_()
        model.tok_emb.weight[1, 0] = 1.0

        W_V = torch.zeros(d, d)
        W_Q = torch.zeros(d, d)
        W_K = torch.zeros(d, d)
        W_O = torch.zeros(d, d)

        SCALE = 20.0

        for h in range(min(nh, 12)):
            pe_h = pe[h]
            pe_h_norm = pe_h / (pe_h.norm() + 1e-8)

            # Q/K: sharp attention to position h
            for di in range(dh):
                row_idx = h * dh + di
                if di == 0:
                    W_K[row_idx] = SCALE * pe_h_norm
                    W_Q[row_idx] = SCALE * pe_h_norm

            # V dim 0: clean bit value (PE annihilated)
            row_idx_0 = h * dh
            row = torch.zeros(d)
            row[0] = 1.0
            if abs(pe_h[1]) > 1e-6:
                row[1] = -pe_h[0] / pe_h[1]
            elif abs(pe_h[2]) > 1e-6:
                row[2] = -pe_h[0] / pe_h[2]
            W_V[row_idx_0] = row

            # V dim 1: pass through a PE component for position info
            # Use a different PE dim that varies across positions
            row_idx_1 = h * dh + 1
            # Just pass through a specific PE dimension
            pe_dim = min(h + 2, d - 1)  # avoid dim 0,1 (used for bit)
            row2 = torch.zeros(d)
            row2[pe_dim] = 1.0
            W_V[row_idx_1] = row2

        model.W_V.copy_(W_V)
        model.W_Q.copy_(W_Q)
        model.W_K.copy_(W_K)

        # O: map head h's bit (dim 0) → model dim h
        #    map head h's PE signal (dim 1) → model dim 12+h
        for h in range(min(nh, 12)):
            W_O[h, h * dh] = 1.0           # bit → dim h
            W_O[12 + h, h * dh + 1] = 1.0  # PE signal → dim 12+h

        model.W_O.copy_(W_O)

        # MLP setup (placeholder)
        d_ff = model.fc1.out_features
        model.fc1.weight.zero_()
        model.fc1.bias.zero_()
        model.fc2.weight.zero_()
        model.fc2.bias.zero_()

        # AND products (36 neurons)
        neuron = 0
        for i in range(6):
            for j in range(6):
                if neuron < d_ff:
                    model.fc1.weight[neuron, i] = 1.0
                    model.fc1.weight[neuron, 6 + j] = 1.0
                    model.fc1.bias[neuron] = -1.0
                    neuron += 1

    return model


# ============================================================
# Testing
# ============================================================

def test_exhaustive(model, device='cpu'):
    model.eval()
    model = model.to(device)
    correct = 0
    total = 4096
    errors = []

    with torch.no_grad():
        all_inps, all_exps = [], []
        for a in range(64):
            for b in range(64):
                inp, exp = encode_pair(a, b)
                all_inps.append(inp)
                all_exps.append(exp)

        all_inps = torch.tensor(all_inps, dtype=torch.long, device=device)
        all_exps = torch.tensor(all_exps, dtype=torch.long, device=device)

        bs = 512
        for start in range(0, total, bs):
            end = min(start + bs, total)
            seq = all_inps[start:end]
            exp = all_exps[start:end]
            for step in range(12):
                logits = model(seq)
                next_tok = logits[:, -1].argmax(dim=-1, keepdim=True)
                seq = torch.cat([seq, next_tok], dim=1)
            predicted = seq[:, 12:]
            matches = (predicted == exp).all(dim=1)
            correct += matches.sum().item()
            if len(errors) < 10:
                for idx in range(end - start):
                    if not matches[idx] and len(errors) < 10:
                        gi = start + idx
                        a, b = gi // 64, gi % 64
                        pred_val = sum(int(predicted[idx][i]) * (2**i) for i in range(12))
                        errors.append(f"  {a}×{b}={a*b}, got {pred_val}")

    return correct / total, errors


def inspect_attention_and_repr(model, device='cpu'):
    """Inspect what the representation looks like at output positions."""
    model.eval()
    model = model.to(device)

    cases = [(3, 5), (7, 7), (1, 1), (63, 63), (0, 0)]
    pe = model.pe.clone()

    for a, b in cases:
        inp, exp = encode_pair(a, b)
        full = torch.tensor([inp + exp], dtype=torch.long, device=device)
        B, T = full.shape

        with torch.no_grad():
            h = model.tok_emb(full) + pe[:T]
            d = model.d_model
            nh = model.n_heads
            dh = model.d_head

            Q = h @ model.W_Q.T
            K = h @ model.W_K.T
            V = h @ model.W_V.T

            Q = Q.view(B, T, nh, dh).transpose(1, 2)
            K = K.view(B, T, nh, dh).transpose(1, 2)
            V = V.view(B, T, nh, dh).transpose(1, 2)

            scores = Q @ K.transpose(-2, -1) / math.sqrt(dh)
            causal = torch.triu(torch.ones(T, T, device=device), diagonal=1).bool()
            scores = scores.masked_fill(causal.unsqueeze(0).unsqueeze(0), float('-inf'))
            attn_w = F.softmax(scores, dim=-1)
            attn_out = attn_w @ V
            attn_out = attn_out.transpose(1, 2).contiguous().view(B, T, d)
            attn_out = attn_out @ model.W_O.T

        repr_11 = attn_out[0, 11].cpu().numpy()

        print(f"\n{a}×{b}={a*b} | bits={inp}")
        print(f"  After attn (pos 11), dims 0-11: {repr_11[:12].round(3)}")
        print(f"  Input bits:                      {inp}")

        # Check if dims match bits
        match = all(
            (repr_11[h] > 0.5) == (inp[h] == 1)
            for h in range(12)
        )
        print(f"  All bits match (>0.5 ↔ 1)? {match}")


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f"Device: {device}")

    D_MODEL = 24
    N_HEADS = 12
    D_FF = 72

    model = HandCodedMultiplier(d_model=D_MODEL, n_heads=N_HEADS, d_ff=D_FF)
    print(f"Parameters: {model.count_parameters()}")

    # V2: no-residual with PE annihilation
    print("\n=== V2: No-Residual + PE Annihilation ===")
    set_weights_v2(model)
    print("\nRepresentation check:")
    inspect_attention_and_repr(model, device)

    print("\nExhaustive test:")
    acc, errors = test_exhaustive(model, device)
    print(f"Accuracy: {acc:.4f} ({int(acc*4096)}/4096)")
    for e in errors[:5]:
        print(e)

    # V3: hybrid
    print("\n\n=== V3: Hybrid (bit + position) ===")
    set_weights_v3(model)
    print("\nRepresentation check:")
    inspect_attention_and_repr(model, device)
