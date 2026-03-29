"""
P_1 Analysis — Train tiny models and analyze weights/attention patterns
SS3: Hand-coded weights attempt via reverse-engineering
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

# ============================================================
# Sinusoidal PE
# ============================================================

def sinusoidal_pe(max_len, d_model):
    pe = torch.zeros(max_len, d_model)
    pos = torch.arange(0, max_len).unsqueeze(1).float()
    div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe

# ============================================================
# Model (same architecture, configurable)
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

    def forward(self, x, mask, need_weights=False):
        h = self.ln1(x)
        if need_weights:
            h, attn_weights = self.attn(h, h, h, attn_mask=mask, need_weights=True)
        else:
            h, _ = self.attn(h, h, h, attn_mask=mask)
            attn_weights = None
        x = x + h
        x = x + self.ff(self.ln2(x))
        return x, attn_weights


class MultiplyTransformer(nn.Module):
    def __init__(self, d_model=48, n_heads=4, n_layers=2, d_ff=96):
        super().__init__()
        self.d_model = d_model
        self.seq_len = 24
        self.tok_emb = nn.Embedding(2, d_model)
        self.register_buffer('pos_enc', sinusoidal_pe(self.seq_len, d_model))
        self.layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])
        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, 2, bias=False)

    def forward(self, x, need_weights=False):
        B, T = x.shape
        h = self.tok_emb(x) + self.pos_enc[:T]
        mask = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
        all_attn = []
        for layer in self.layers:
            h, attn_w = layer(h, mask, need_weights=need_weights)
            if attn_w is not None:
                all_attn.append(attn_w)
        h = self.ln_f(h)
        logits = self.head(h)
        if need_weights:
            return logits, all_attn
        return logits

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())


# ============================================================
# Training
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
    """Test ALL 4096 input pairs."""
    model.eval()
    correct = 0
    total = 4096
    with torch.no_grad():
        # Process in batches
        all_inps = []
        all_exps = []
        for a in range(64):
            for b in range(64):
                inp, exp = encode_pair(a, b)
                all_inps.append(inp)
                all_exps.append(exp)

        all_inps = torch.tensor(all_inps, dtype=torch.long, device=device)
        all_exps = torch.tensor(all_exps, dtype=torch.long, device=device)

        batch_size = 512
        for start in range(0, total, batch_size):
            end = min(start + batch_size, total)
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
# Analysis: dump attention patterns
# ============================================================

def analyze_attention(model, device='cpu'):
    """Analyze attention patterns on representative inputs."""
    model.eval()

    # Test cases: 0×0, 1×1, 3×5, 7×7, 63×63, 23×37
    test_cases = [(0,0), (1,1), (3,5), (7,7), (63,63), (23,37), (42,13)]

    for a, b in test_cases:
        inp, exp = encode_pair(a, b)
        seq = torch.tensor([inp], dtype=torch.long, device=device)

        # Run with teacher forcing (full sequence)
        full = torch.tensor([inp + exp], dtype=torch.long, device=device)
        logits, attn_weights = model(full, need_weights=True)

        print(f"\n{'='*60}")
        print(f"{a} × {b} = {a*b}")
        print(f"Input:  {inp}")
        print(f"Output: {exp}")

        for layer_idx, attn in enumerate(attn_weights):
            attn_np = attn[0].detach().cpu().numpy()  # (T, T)
            print(f"\nLayer {layer_idx} attention (output positions → input positions):")
            # Show attention from output positions (12-23) to input positions (0-11)
            for out_pos in range(12, 24):
                top_k = np.argsort(attn_np[out_pos])[-5:][::-1]
                top_vals = [(int(idx), f"{attn_np[out_pos][idx]:.3f}") for idx in top_k]
                print(f"  P_{out_pos-12} (pos {out_pos}): top5 = {top_vals}")


def dump_weights(model):
    """Dump all model weights for inspection."""
    print("\n" + "="*60)
    print("WEIGHT DUMP")
    print("="*60)
    for name, param in model.named_parameters():
        p = param.detach().cpu().numpy()
        print(f"\n{name}: shape={p.shape}, range=[{p.min():.4f}, {p.max():.4f}], norm={np.linalg.norm(p):.4f}")
        if p.size < 50:
            print(f"  values: {p}")


# ============================================================
# Main: sweep tiny configs
# ============================================================

if __name__ == "__main__":
    torch.manual_seed(42)
    random.seed(42)
    np.random.seed(42)

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f"Device: {device}")

    # Sweep from small to smaller
    configs = [
        # (d_model, n_heads, n_layers, d_ff)
        (16, 2, 2, 32),   # ~2K params
        (12, 2, 2, 24),   # ~1K params
        (8,  2, 2, 16),   # ~600 params
        (8,  1, 2, 16),   # ~500 params
        (6,  1, 2, 12),   # ~300 params
    ]

    best_model = None
    best_params = float('inf')
    best_config = None
    best_acc = 0

    for d_model, n_heads, n_layers, d_ff in configs:
        print(f"\n{'='*60}")
        print(f"Config: d={d_model}, h={n_heads}, L={n_layers}, ff={d_ff}")
        torch.manual_seed(42)
        random.seed(42)
        np.random.seed(42)

        model = MultiplyTransformer(d_model=d_model, n_heads=n_heads, n_layers=n_layers, d_ff=d_ff)
        n_params = model.count_parameters()
        print(f"Parameters: {n_params}")

        model = train_model(model, device=device, verbose=True)

        # Quick eval
        acc = evaluate_model(model, device=device, n=5000)
        print(f"\nQuick eval (5K): Acc = {acc:.4f}")

        if acc >= 0.99:
            # Exhaustive eval
            acc_full = evaluate_exhaustive(model, device=device)
            print(f"Exhaustive eval (4096): Acc = {acc_full:.6f}")

            if acc_full >= 0.99 and n_params < best_params:
                best_model = model
                best_params = n_params
                best_config = (d_model, n_heads, n_layers, d_ff)
                best_acc = acc_full

    print(f"\n{'='*60}")
    print(f"BEST CONFIG: {best_config}")
    print(f"BEST PARAMS: {best_params}")
    print(f"BEST ACC: {best_acc:.6f}")

    if best_model is not None:
        print("\n\nAnalyzing best model...")
        analyze_attention(best_model, device=device)
        dump_weights(best_model)

        # Save for further analysis
        torch.save(best_model.state_dict(),
                    '/Users/younsoolim/Desktop/www/anju/hackathon/krafton-ai-2026/day1/best_tiny_model.pt')
        print(f"\nModel saved.")
