"""
MultiplierBoard — 6-bit Binary Multiplication Transformer
KRAFTON AI R&D Hackathon, Round 1, Day 1
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
    return pe  # (max_len, d_model)

# ============================================================
# Model
# ============================================================

class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads, batch_first=True)
        self.ln2 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model),
        )

    def forward(self, x, mask):
        h = self.ln1(x)
        h, _ = self.attn(h, h, h, attn_mask=mask)
        x = x + h
        x = x + self.ff(self.ln2(x))
        return x


class MultiplyTransformer(nn.Module):
    def __init__(self, d_model=48, n_heads=4, n_layers=2, d_ff=96):
        super().__init__()
        self.d_model = d_model
        self.seq_len = 24

        # Token embedding (vocab=2)
        self.tok_emb = nn.Embedding(2, d_model)

        # Sinusoidal PE — FREE (registered as buffer, not parameter)
        self.register_buffer('pos_enc', sinusoidal_pe(self.seq_len, d_model))

        # Transformer layers
        self.layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])

        self.ln_f = nn.LayerNorm(d_model)
        # Output head — tied with token embedding (weight tying)
        self.head = nn.Linear(d_model, 2, bias=False)

    def forward(self, x):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        for layer in self.layers:
            h = layer(h, mask)
        h = self.ln_f(h)
        logits = self.head(h)
        return logits

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


def build_model(d_model=48, n_heads=4, n_layers=2, d_ff=96):
    return MultiplyTransformer(d_model=d_model, n_heads=n_heads, n_layers=n_layers, d_ff=d_ff)

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

            # Teacher forcing: full sequence [input | target]
            full_seq = torch.cat([inp, tgt], dim=1)  # (B, 24)
            logits = model(full_seq)  # (B, 24, 2)

            # Loss: predict output tokens at positions 12-23
            # logits[:, 11:23] predicts next token = tgt[:, 0:12]
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
            acc = evaluate_model(model, device, n=1000)  # quick check
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

            seq = torch.tensor(inps, dtype=torch.long, device=device)  # (bs, 12)
            exp_tensor = torch.tensor(expecteds, dtype=torch.long, device=device)

            # Autoregressive: generate 12 output tokens
            for step in range(12):
                logits = model(seq)
                next_tok = logits[:, -1].argmax(dim=-1, keepdim=True)
                seq = torch.cat([seq, next_tok], dim=1)

            predicted = seq[:, 12:]  # (bs, 12)
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

    # --- Sweep multiple sizes ---
    configs = [
        (32, 2, 2, 64),   # d_model, n_heads, n_layers, d_ff
        (24, 2, 2, 48),
        (16, 2, 2, 32),
    ]

    for d_model, n_heads, n_layers, d_ff in configs:
        print(f"\n{'='*50}")
        print(f"Config: d={d_model}, h={n_heads}, L={n_layers}, ff={d_ff}")
        torch.manual_seed(42)
        random.seed(42)
        np.random.seed(42)

        model = build_model(d_model=d_model, n_heads=n_heads, n_layers=n_layers, d_ff=d_ff)
        print(f"Parameters: {model.count_parameters()}")
        model = train_model(model, device=device)

        acc = evaluate_model(model, device=device, n=10000)
        print(f"\n=== Final: d={d_model} ===")
        print(f"P_2 = {model.count_parameters()}")
        print(f"Acc_2 = {acc:.4f}")
