"""
MultiplierBoard v3 — Low-Rank Factorized Projections
SS3: HIGH PRIORITY experiment

Key insight: problem spec explicitly allows "Low-rank / factorized projections"
Rank-1 factorization: nn.Linear(d, d) → U(d, 1) + V(1, d)
Params: d*d → d + d = 2d (massive reduction)

Expected params:
  d=16/rank-1: ~896
  d=12/rank-1: ~672
  d=8/rank-1:  ~448
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math
import random
import numpy as np
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

# ============================================================
# Data (same as multiplier.py)
# ============================================================

def encode_pair(a, b):
    a_bits = [(a >> i) & 1 for i in range(6)]
    b_bits = [(b >> i) & 1 for i in range(6)]
    p = a * b
    p_bits = [(p >> i) & 1 for i in range(12)]
    return a_bits + b_bits, p_bits

def make_dataset(n=100000):
    inputs, targets = [], []
    for _ in range(n):
        a, b = random.randint(0, 63), random.randint(0, 63)
        inp, tgt = encode_pair(a, b)
        inputs.append(inp)
        targets.append(tgt)
    return torch.tensor(inputs, dtype=torch.long), torch.tensor(targets, dtype=torch.long)

def sinusoidal_pe(max_len, d_model):
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe

# ============================================================
# Low-Rank Linear
# ============================================================

class LowRankLinear(nn.Module):
    """Factorized linear: W = V @ U, rank r << min(in, out)."""
    def __init__(self, in_dim, out_dim, rank=1, bias=True):
        super().__init__()
        self.U = nn.Linear(in_dim, rank, bias=False)
        self.V = nn.Linear(rank, out_dim, bias=bias)

    def forward(self, x):
        return self.V(self.U(x))

# ============================================================
# Low-Rank Transformer Block
# ============================================================

class LowRankAttention(nn.Module):
    """Multi-head attention with low-rank Q/K/V/O projections."""
    def __init__(self, d_model, n_heads, rank=1):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        assert d_model % n_heads == 0

        # Low-rank Q, K, V projections
        self.W_Q = LowRankLinear(d_model, d_model, rank=rank, bias=False)
        self.W_K = LowRankLinear(d_model, d_model, rank=rank, bias=False)
        self.W_V = LowRankLinear(d_model, d_model, rank=rank, bias=False)
        self.W_O = LowRankLinear(d_model, d_model, rank=rank, bias=False)

    def forward(self, x, mask):
        B, T, d = x.shape
        nh, dh = self.n_heads, self.d_head

        Q = self.W_Q(x).view(B, T, nh, dh).transpose(1, 2)
        K = self.W_K(x).view(B, T, nh, dh).transpose(1, 2)
        V = self.W_V(x).view(B, T, nh, dh).transpose(1, 2)

        scores = Q @ K.transpose(-2, -1) / math.sqrt(dh)
        scores = scores.masked_fill(mask.unsqueeze(0).unsqueeze(0), float('-inf'))
        attn_w = F.softmax(scores, dim=-1)
        out = attn_w @ V

        out = out.transpose(1, 2).contiguous().view(B, T, d)
        return self.W_O(out)


class LowRankTransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, d_ff, rank=1):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = LowRankAttention(d_model, n_heads, rank=rank)
        self.ln2 = nn.LayerNorm(d_model)
        # FFN: also low-rank
        self.ff_up = LowRankLinear(d_model, d_ff, rank=rank, bias=True)
        self.ff_down = LowRankLinear(d_ff, d_model, rank=rank, bias=True)

    def forward(self, x, mask):
        h = self.ln1(x)
        h = self.attn(h, mask)
        x = x + h
        h = self.ln2(x)
        h = self.ff_down(F.gelu(self.ff_up(h)))
        x = x + h
        return x


class LowRankMultiplyTransformer(nn.Module):
    def __init__(self, d_model=16, n_heads=2, n_layers=2, d_ff=32, rank=1):
        super().__init__()
        self.d_model = d_model
        self.seq_len = 24

        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pos_enc', sinusoidal_pe(self.seq_len, d_model))

        self.layers = nn.ModuleList([
            LowRankTransformerBlock(d_model, n_heads, d_ff, rank=rank)
            for _ in range(n_layers)
        ])

        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, 2, bias=False)

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        for layer in self.layers:
            h = layer(h, mask)
        h = self.ln_f(h)
        return self.head(h)

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


# Also: looped low-rank
class LoopedLowRankMultiplyTransformer(nn.Module):
    """Looped (weight-tied) + low-rank. Maximum param efficiency."""
    def __init__(self, d_model=16, n_heads=2, n_loops=4, d_ff=32, rank=1):
        super().__init__()
        self.d_model = d_model
        self.n_loops = n_loops
        self.seq_len = 24

        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pos_enc', sinusoidal_pe(self.seq_len, d_model))

        self.block = LowRankTransformerBlock(d_model, n_heads, d_ff, rank=rank)

        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, 2, bias=False)

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        for _ in range(self.n_loops):
            h = self.block(h, mask)
        h = self.ln_f(h)
        return self.head(h)

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


# ============================================================
# Training (Fixed protocol)
# ============================================================

def train_model(model, device='cpu', epochs=200, batch_size=256, verbose=True):
    model = model.to(device)
    train_inp, train_tgt = make_dataset(100000)
    train_inp, train_tgt = train_inp.to(device), train_tgt.to(device)

    optimizer = AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)

    for epoch in range(epochs):
        model.train()
        perm = torch.randperm(len(train_inp), device=device)
        inp_shuf = train_inp[perm]
        tgt_shuf = train_tgt[perm]
        total_loss = 0
        n_batches = 0

        for i in range(0, len(train_inp), batch_size):
            inp = inp_shuf[i:i+batch_size]
            tgt = tgt_shuf[i:i+batch_size]
            full_seq = torch.cat([inp, tgt], dim=1)
            logits = model(full_seq)
            output_logits = logits[:, 11:23].reshape(-1, 2)
            output_targets = tgt.reshape(-1)
            loss = F.cross_entropy(output_logits, output_targets)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        scheduler.step()

        if verbose and (epoch + 1) % 20 == 0:
            acc = evaluate_model(model, device, n=1000)
            print(f"  Epoch {epoch+1:3d} | Loss: {total_loss/n_batches:.4f} | Acc: {acc:.4f}")

    return model


def evaluate_model(model, device='cpu', n=10000):
    model.eval()
    correct = 0
    batch_size = 512
    with torch.no_grad():
        for start in range(0, n, batch_size):
            bs = min(batch_size, n - start)
            inps, expecteds = [], []
            for _ in range(bs):
                a, b = random.randint(0, 63), random.randint(0, 63)
                inp, exp = encode_pair(a, b)
                inps.append(inp)
                expecteds.append(exp)
            seq = torch.tensor(inps, dtype=torch.long, device=device)
            exp_tensor = torch.tensor(expecteds, dtype=torch.long, device=device)
            for step in range(12):
                logits = model(seq)
                next_tok = logits[:, -1].argmax(dim=-1, keepdim=True)
                seq = torch.cat([seq, next_tok], dim=1)
            predicted = seq[:, 12:]
            correct += (predicted == exp_tensor).all(dim=1).sum().item()
    return correct / n


def evaluate_exhaustive(model, device='cpu'):
    model.eval()
    correct = 0
    total = 4096
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
            correct += (predicted == exp).all(dim=1).sum().item()
    return correct / total


# ============================================================
# Experiments
# ============================================================

if __name__ == "__main__":
    torch.manual_seed(42)
    random.seed(42)
    np.random.seed(42)

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f"Device: {device}")

    results = []

    # ---- EXP-008: Low-rank d=16, L=2, rank=1 ----
    print(f"\n{'='*60}")
    print("EXP-008: LowRank d=16, L=2, h=2, ff=32, rank=1")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LowRankMultiplyTransformer(d_model=16, n_heads=2, n_layers=2, d_ff=32, rank=1)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-008", "lowrank", 16, 2, 2, 32, 1, p, acc_full))

    # ---- EXP-009: Low-rank d=16, L=2, rank=2 ----
    print(f"\n{'='*60}")
    print("EXP-009: LowRank d=16, L=2, h=2, ff=32, rank=2")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LowRankMultiplyTransformer(d_model=16, n_heads=2, n_layers=2, d_ff=32, rank=2)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-009", "lowrank", 16, 2, 2, 32, 2, p, acc_full))

    # ---- EXP-010: Looped low-rank d=16, loops=4, rank=1 ----
    print(f"\n{'='*60}")
    print("EXP-010: Looped+LowRank d=16, h=2, loops=4, ff=32, rank=1")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LoopedLowRankMultiplyTransformer(d_model=16, n_heads=2, n_loops=4, d_ff=32, rank=1)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-010", "loop+lr", 16, 4, 2, 32, 1, p, acc_full))

    # ---- EXP-011: Looped low-rank d=12, loops=4, rank=1 ----
    print(f"\n{'='*60}")
    print("EXP-011: Looped+LowRank d=12, h=2, loops=4, ff=24, rank=1")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LoopedLowRankMultiplyTransformer(d_model=12, n_heads=2, n_loops=4, d_ff=24, rank=1)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-011", "loop+lr", 12, 4, 2, 24, 1, p, acc_full))

    # ---- EXP-012: Looped low-rank d=16, loops=6, rank=2 ----
    print(f"\n{'='*60}")
    print("EXP-012: Looped+LowRank d=16, h=2, loops=6, ff=32, rank=2")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LoopedLowRankMultiplyTransformer(d_model=16, n_heads=2, n_loops=6, d_ff=32, rank=2)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-012", "loop+lr", 16, 6, 2, 32, 2, p, acc_full))

    # ---- EXP-013: Low-rank d=12, L=2, rank=2 ----
    print(f"\n{'='*60}")
    print("EXP-013: LowRank d=12, L=2, h=2, ff=24, rank=2")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = LowRankMultiplyTransformer(d_model=12, n_heads=2, n_layers=2, d_ff=24, rank=2)
    p = model.count_parameters()
    print(f"Parameters: {p}")
    model = train_model(model, device=device)
    acc = evaluate_model(model, device, n=5000)
    print(f"Quick eval (5K): {acc:.4f}")
    if acc >= 0.90:
        acc_full = evaluate_exhaustive(model, device)
        print(f"Exhaustive (4096): {acc_full:.6f}")
    else:
        acc_full = acc
    results.append(("EXP-013", "lowrank", 12, 2, 2, 24, 2, p, acc_full))

    # ---- Summary ----
    print(f"\n{'='*60}")
    print("SUMMARY �� Low-Rank Experiments")
    print(f"{'='*60}")
    print(f"{'EXP':<8} {'type':<9} {'d':>3} {'L':>3} {'h':>2} {'ff':>3} {'r':>2} {'params':>7} {'acc':>8}")
    print("-" * 60)
    for exp, typ, d, l, h, ff, r, params, acc in results:
        print(f"{exp:<8} {typ:<9} {d:>3} {l:>3} {h:>2} {ff:>3} {r:>2} {params:>7} {acc:>8.4f}")
