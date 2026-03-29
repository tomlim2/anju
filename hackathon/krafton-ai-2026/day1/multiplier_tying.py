"""
MultiplierBoard — Weight Tying Experiments (SS3)
Base: d=32, L=2, H=2, ff=64 (EXP-002a: 17,280 params, 100%)

Tying strategies:
  A. Embedding tying: head.weight = tok_emb.weight (saves d*2 params)
  B. K=Q: key projection shares weights with query (saves d*d params)
  C. V=Q: value projection shares weights with query (saves d*d params)
  D. Shared LayerNorm across layers (saves 2*d params per extra layer)
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
# Custom Attention with Weight Tying
# ============================================================

class TiedAttention(nn.Module):
    """
    Multi-head attention with optional weight tying:
      tie_kq: K projection = Q projection
      tie_vq: V projection = Q projection
    """
    def __init__(self, d_model, n_heads, tie_kq=False, tie_vq=False):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        self.tie_kq = tie_kq
        self.tie_vq = tie_vq

        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        if not tie_kq:
            self.W_K = nn.Linear(d_model, d_model, bias=False)
        if not tie_vq:
            self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.W_O = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, mask):
        B, T, d = x.shape
        nh, dh = self.n_heads, self.d_head

        Q = self.W_Q(x).view(B, T, nh, dh).transpose(1, 2)
        K = (self.W_Q(x) if self.tie_kq else self.W_K(x)).view(B, T, nh, dh).transpose(1, 2)
        V = (self.W_Q(x) if self.tie_vq else self.W_V(x)).view(B, T, nh, dh).transpose(1, 2)

        scores = Q @ K.transpose(-2, -1) / math.sqrt(dh)
        scores = scores.masked_fill(mask.unsqueeze(0).unsqueeze(0), float('-inf'))
        attn_w = F.softmax(scores, dim=-1)
        out = attn_w @ V

        out = out.transpose(1, 2).contiguous().view(B, T, d)
        return self.W_O(out)


class TiedTransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, d_ff, tie_kq=False, tie_vq=False,
                 shared_ln1=None, shared_ln2=None):
        super().__init__()
        self.ln1 = shared_ln1 if shared_ln1 is not None else nn.LayerNorm(d_model)
        self.attn = TiedAttention(d_model, n_heads, tie_kq=tie_kq, tie_vq=tie_vq)
        self.ln2 = shared_ln2 if shared_ln2 is not None else nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model),
        )

    def forward(self, x, mask):
        h = self.ln1(x)
        h = self.attn(h, mask)
        x = x + h
        x = x + self.ff(self.ln2(x))
        return x


class TiedMultiplyTransformer(nn.Module):
    def __init__(self, d_model=32, n_heads=2, n_layers=2, d_ff=64,
                 tie_embed=False, tie_kq=False, tie_vq=False, share_ln=False):
        super().__init__()
        self.d_model = d_model
        self.tie_embed = tie_embed

        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pos_enc', sinusoidal_pe(24, d_model))

        # Shared LayerNorm if requested
        shared_ln1 = nn.LayerNorm(d_model) if share_ln else None
        shared_ln2 = nn.LayerNorm(d_model) if share_ln else None

        self.layers = nn.ModuleList([
            TiedTransformerBlock(d_model, n_heads, d_ff,
                                 tie_kq=tie_kq, tie_vq=tie_vq,
                                 shared_ln1=shared_ln1 if i > 0 else None,
                                 shared_ln2=shared_ln2 if i > 0 else None)
            for i in range(n_layers)
        ])

        self.ln_f = nn.LayerNorm(d_model)

        if tie_embed:
            # head shares weight with embedding (d_model → 2, using emb weight)
            self.head = None  # use tok_emb.weight instead
        else:
            self.head = nn.Linear(d_model, 2, bias=False)

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        for layer in self.layers:
            h = layer(h, mask)
        h = self.ln_f(h)
        if self.tie_embed:
            # logits = h @ emb.weight^T → (B, T, 2)
            return h @ self.tok_emb.weight.T
        else:
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

    # ---- EXP-T1: d=32, embed tying only ----
    print(f"\n{'='*60}")
    print("EXP-T1: d=32, L=2, H=2, ff=64, embed_tie=True")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = TiedMultiplyTransformer(
        d_model=32, n_heads=2, n_layers=2, d_ff=64,
        tie_embed=True, tie_kq=False, tie_vq=False, share_ln=False
    )
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
    results.append(("EXP-T1", "emb_tie", 32, 2, "—", p, f"{acc_full:.4f}"))

    # ---- EXP-T2: d=32, embed + K=Q + V=Q ----
    print(f"\n{'='*60}")
    print("EXP-T2: d=32, L=2, H=2, ff=64, embed+KQ+VQ tie")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = TiedMultiplyTransformer(
        d_model=32, n_heads=2, n_layers=2, d_ff=64,
        tie_embed=True, tie_kq=True, tie_vq=True, share_ln=False
    )
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
    results.append(("EXP-T2", "emb+kq+vq", 32, 2, "—", p, f"{acc_full:.4f}"))

    # ---- EXP-T3: d=32, ALL tying (embed + K=Q + V=Q + shared LN) ----
    print(f"\n{'='*60}")
    print("EXP-T3: d=32, L=2, H=2, ff=64, ALL tying")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    model = TiedMultiplyTransformer(
        d_model=32, n_heads=2, n_layers=2, d_ff=64,
        tie_embed=True, tie_kq=True, tie_vq=True, share_ln=True
    )
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
    results.append(("EXP-T3", "all_tie", 32, 2, "—", p, f"{acc_full:.4f}"))

    # ---- Summary ----
    print(f"\n{'='*60}")
    print("SUMMARY — Weight Tying Experiments (d=32 base)")
    print(f"{'='*60}")
    print(f"{'EXP':<8} {'tying':<12} {'d':>3} {'L':>3} {'notes':<8} {'params':>7} {'acc':>8}")
    print("-" * 60)
    for row in results:
        print(f"{row[0]:<8} {row[1]:<12} {row[2]:>3} {row[3]:>3} {row[4]:<8} {row[5]:>7} {row[6]:>8}")

    # If best tying works at d=32, try d=24
    best_acc = max(float(r[6]) for r in results)
    if best_acc >= 0.99:
        print(f"\n\nBest d=32 tying hits {best_acc:.4f}. Trying d=24...")

        # ---- EXP-T4: d=24 with best tying ----
        print(f"\n{'='*60}")
        print("EXP-T4: d=24, L=2, H=2, ff=48, ALL tying")
        torch.manual_seed(42); random.seed(42); np.random.seed(42)
        model = TiedMultiplyTransformer(
            d_model=24, n_heads=2, n_layers=2, d_ff=48,
            tie_embed=True, tie_kq=True, tie_vq=True, share_ln=True
        )
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
        print(f"\nEXP-T4 result: {p} params, acc={acc_full:.4f}")
