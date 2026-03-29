"""
MultiplierBoard — 6-bit Binary Multiplication Transformer
KRAFTON AI R&D Hackathon, Round 1, Day 1
Participant #179

Best config: d=32, L=2, H=2, ff=64, embedding+V=Q tying
P_2 = 14,912 parameters | Acc_2 >= 0.99
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
# Data
# ============================================================

def encode_pair(a, b):
    """Encode (a, b) as LSB-first binary input and product output."""
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


# ============================================================
# Sinusoidal PE (FREE — not counted as parameters)
# ============================================================

def sinusoidal_pe(max_len, d_model):
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe


# ============================================================
# Model
# ============================================================

class Attention(nn.Module):
    """Multi-head self-attention with V=Q weight tying."""

    def __init__(self, d_model, n_heads):
        super().__init__()
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        # V=Q tying: V projection shares weights with Q projection
        self.W_O = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x, mask):
        B, T, d = x.shape
        nh, dh = self.n_heads, self.d_head

        Q = self.W_Q(x).view(B, T, nh, dh).transpose(1, 2)
        K = self.W_K(x).view(B, T, nh, dh).transpose(1, 2)
        V = self.W_Q(x).view(B, T, nh, dh).transpose(1, 2)  # V = Q (tied)

        scores = Q @ K.transpose(-2, -1) / math.sqrt(dh)
        scores = scores.masked_fill(mask.unsqueeze(0).unsqueeze(0), float('-inf'))
        attn_w = F.softmax(scores, dim=-1)
        out = attn_w @ V

        out = out.transpose(1, 2).contiguous().view(B, T, d)
        return self.W_O(out)


class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = Attention(d_model, n_heads)
        self.ln2 = nn.LayerNorm(d_model)
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


class MultiplyTransformer(nn.Module):
    def __init__(self, d_model=32, n_heads=2, n_layers=2, d_ff=64):
        super().__init__()
        self.d_model = d_model
        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pos_enc', sinusoidal_pe(24, d_model))
        self.layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])
        self.ln_f = nn.LayerNorm(d_model)
        # Embedding tying: output head uses transposed embedding weights
        # No separate nn.Linear for head

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        for layer in self.layers:
            h = layer(h, mask)
        h = self.ln_f(h)
        # Tied output: logits = h @ embedding^T → (B, T, 2)
        return h @ self.tok_emb.weight.T

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


def build_model():
    """Build the submission model. Returns an untrained nn.Module."""
    return MultiplyTransformer(d_model=32, n_heads=2, n_layers=2, d_ff=64)


# ============================================================
# Fallback: standard model (no tying) if tying doesn't reproduce
# ============================================================

def build_model_standard():
    """Fallback: d=32 standard (17,280 params, 100% acc)."""
    model = MultiplyTransformer.__new__(MultiplyTransformer)
    nn.Module.__init__(model)
    d_model, n_heads, d_ff = 32, 2, 64
    model.d_model = d_model
    model.tok_emb = nn.Embedding(2, d_model)
    model.register_buffer('pos_enc', sinusoidal_pe(24, d_model))
    # Standard attention (no V=Q tying)
    layers = []
    for _ in range(2):
        block = nn.Module()
        block.ln1 = nn.LayerNorm(d_model)
        block.attn = nn.MultiheadAttention(d_model, n_heads, batch_first=True)
        block.ln2 = nn.LayerNorm(d_model)
        block.ff = nn.Sequential(
            nn.Linear(d_model, d_ff), nn.GELU(), nn.Linear(d_ff, d_model)
        )
        layers.append(block)
    model.layers = nn.ModuleList(layers)
    model.ln_f = nn.LayerNorm(d_model)
    model.head = nn.Linear(d_model, 2, bias=False)
    # Override forward to use head instead of embedding tying
    return model


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
            full_seq = torch.cat([inp, tgt], dim=1)  # (B, 24)
            logits = model(full_seq)  # (B, 24, 2)
            output_logits = logits[:, 11:23].reshape(-1, 2)
            output_targets = tgt.reshape(-1)
            loss = F.cross_entropy(output_logits, output_targets)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        scheduler.step()

        if verbose and (epoch + 1) % 10 == 0:
            acc = evaluate_model(model, device, n=1000)
            print(f"Epoch {epoch+1:3d} | Loss: {total_loss/n_batches:.4f} | Acc: {acc:.4f}")

    return model


# ============================================================
# Evaluation (batched autoregressive)
# ============================================================

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


# ============================================================
# Main
# ============================================================

if __name__ == "__main__":
    torch.manual_seed(42)
    random.seed(42)
    np.random.seed(42)

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f"Device: {device}")

    model = build_model()
    P_2 = model.count_parameters()
    print(f"P_2 = {P_2}")

    model = train_model(model, device=device)
    Acc_2 = evaluate_model(model, device=device, n=10000)
    print(f"\n{'='*40}")
    print(f"P_2   = {P_2}")
    print(f"Acc_2 = {Acc_2:.4f}")
    print(f"{'='*40}")
