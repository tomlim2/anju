"""
SparseTap — The Sparse Dependency Discovery Challenge
KRAFTON AI R&D Hackathon · Round 1 · Day 2 · Participant #179

PROBLEM:
    seq[n] = seq[n-d1] XOR ... XOR seq[n-dS] XOR e[n],  e[n]~Bernoulli(0.2)
    S <= 16, d_i <= 64. Given 2000 noisy sequences (256 bits each),
    find offsets and predict 192 bits of a noise-free test sequence.

APPROACHES:
    1. BKW + Hierarchical FWHT  — main solver, solves in <1s
    2. Meet-in-the-Middle       — independent verification, solves in ~5s
    3. Simulated Annealing      — FAILED (flat energy landscape)
    4. Exhaustive S=1..3        — FAILED (S=8, infeasible)
    5. Gradient descent          — FAILED (vanishing gradients)
"""

import numpy as np
import json, time, os, sys
from itertools import combinations

DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "problem2_data.txt")
TEST_PREFIX = "0000010100011010010101100101001110100011110010110011010000111010"


# ============================================================
# Utilities
# ============================================================

def load_sequences(path):
    with open(path) as f:
        lines = [l.strip() for l in f if l.strip()]
    return np.array([[int(c) for c in line] for line in lines], dtype=np.uint8)


def build_system(seqs, W=64):
    """Build LPN system A x = b + noise (mod 2), 384K equations."""
    N, L = seqs.shape
    n_arr = np.arange(W, L)
    d_arr = np.arange(1, 65)
    feat_idx = n_arr[:, None] - d_arr[None, :]
    A = seqs[:, feat_idx.ravel()].reshape(N * len(n_arr), 64)
    b = seqs[:, n_arr].ravel()
    return A, b


def verify_offsets(seqs, offsets):
    """Training accuracy: fraction where XOR of offsets == seq[n]."""
    N, L = seqs.shape
    pos = np.arange(64, L)
    target = seqs[:, pos]
    xor_val = np.zeros((N, len(pos)), dtype=np.uint8)
    for d in offsets:
        xor_val ^= seqs[:, pos - d]
    return float(np.mean(xor_val == target))


def predict_noisefree(prefix, offsets):
    seq = [int(c) for c in prefix]
    for n in range(64, 256):
        bit = 0
        for d in offsets:
            bit ^= seq[n - d]
        seq.append(bit)
    return ''.join(str(b) for b in seq[64:])


# ============================================================
# Approach 1: BKW + Hierarchical FWHT
# ============================================================

def bkw_round(A, b, block_cols):
    """XOR equation pairs sharing same block_cols values."""
    powers = (1 << np.arange(len(block_cols)-1, -1, -1)).astype(np.int64)
    keys = A[:, block_cols].astype(np.int64) @ powers
    idx = np.argsort(keys)
    A, b, keys = A[idx], b[idx], keys[idx]

    new_A, new_b = [], []
    i = 0
    while i < len(b):
        j = i + 1
        while j < len(b) and keys[j] == keys[i]:
            j += 1
        for p in range((j - i) // 2):
            new_A.append(A[i+2*p] ^ A[i+2*p+1])
            new_b.append(b[i+2*p] ^ b[i+2*p+1])
        i = j
    if not new_A:
        return np.empty((0, A.shape[1]), dtype=np.uint8), np.empty(0, dtype=np.uint8)
    return np.array(new_A, dtype=np.uint8), np.array(new_b, dtype=np.uint8)


def fwht(a):
    h = 1
    while h < len(a):
        v = a.reshape(-1, 2*h)
        l, r = v[:, :h].copy(), v[:, h:].copy()
        v[:, :h] = l + r
        v[:, h:] = l - r
        h *= 2
    return a


def fwht_solve(A_sub, b, k):
    """FWHT over k columns: find mask maximizing Walsh coefficient."""
    powers = (1 << np.arange(k-1, -1, -1)).astype(np.int64)
    keys = A_sub.astype(np.int64) @ powers
    score = np.zeros(1 << k, dtype=np.float64)
    np.add.at(score, keys, 2.0 * b.astype(np.float64) - 1.0)
    fwht(score)
    score[0] = 0
    idx = int(np.argmax(np.abs(score)))
    mask = np.array([(idx >> (k-1-j)) & 1 for j in range(k)], dtype=np.uint8)
    return mask, np.abs(score[idx])


def fwht_subspace_solve(A_cols, b, n_cols, k=20, trials=5000):
    """Random subspace FWHT for n_cols > 20."""
    best_mask, best_peak = np.zeros(n_cols, dtype=np.uint8), 0
    N = len(b)
    threshold = 0.13 * N * 0.8
    for _ in range(trials):
        sub = np.sort(np.random.choice(n_cols, k, replace=False))
        mask, peak = fwht_solve(A_cols[:, sub], b, k)
        if peak > best_peak:
            best_peak = peak
            best_mask = np.zeros(n_cols, dtype=np.uint8)
            for j, c in enumerate(sub):
                best_mask[c] = mask[j]
            if peak > threshold:
                return best_mask
    return best_mask


def solve_bkw_fwht(seqs):
    """BKW 2 rounds + hierarchical FWHT back-substitution."""
    A, b = build_system(seqs)
    print(f"  System: {len(b)} eqs, 64 unknowns")

    A1, b1 = bkw_round(A, b, list(range(16)))
    print(f"  BKW round 1 → {len(b1)} eqs")
    A2, b2 = bkw_round(A1, b1, list(range(16, 32)))
    print(f"  BKW round 2 → {len(b2)} eqs")

    # Solve cols 32-63
    cols32 = list(range(32, 64))
    if len(cols32) <= 20:
        s32, _ = fwht_solve(A2[:, cols32], b2, len(cols32))
    else:
        s32 = fwht_subspace_solve(A2[:, cols32], b2, len(cols32))
    off32 = [33+j for j in range(32) if s32[j]]
    print(f"  s[32:63] = {off32}")

    # Back-sub → cols 16-31
    b1_adj = b1 ^ ((A1[:, 32:64] @ s32) % 2).astype(np.uint8)
    s16, _ = fwht_solve(A1[:, 16:32], b1_adj, 16)
    off16 = [17+j for j in range(16) if s16[j]]
    print(f"  s[16:31] = {off16}")

    # Back-sub → cols 0-15
    s16_63 = np.concatenate([s16, s32])
    b_adj = b ^ ((A[:, 16:64] @ s16_63) % 2).astype(np.uint8)
    s0, _ = fwht_solve(A[:, :16], b_adj, 16)
    off0 = [1+j for j in range(16) if s0[j]]
    print(f"  s[0:15]  = {off0}")

    full = np.concatenate([s0, s16, s32])
    return sorted([d+1 for d in range(64) if full[d]])


# ============================================================
# Approach 2: Meet-in-the-Middle
# ============================================================

def solve_mitm(seqs, S_total=8, n_samples=300):
    """Split LEFT(1-32) / RIGHT(33-64), correlation matrix matching."""
    rng = np.random.RandomState(42)
    si = rng.randint(0, len(seqs), n_samples)
    pi = rng.randint(64, 256, n_samples)
    target_pm = np.array([1-2*seqs[s,p] for s,p in zip(si,pi)], dtype=np.float32)
    feat = np.zeros((64, n_samples), dtype=np.float32)
    for d in range(64):
        feat[d] = np.array([1-2*seqs[s, p-(d+1)] for s,p in zip(si,pi)], dtype=np.float32)
    left_f, right_f = feat[:32], feat[32:]

    for S_left in [4, 3, 5, 2, 6, 1, 7, 0, 8]:
        S_right = S_total - S_left
        if S_right < 0 or S_right > 32:
            continue
        lc = list(combinations(range(32), S_left))
        rc = list(combinations(range(32), S_right))
        if len(lc) * len(rc) > 5e9:
            continue

        Z = np.zeros((len(lc), n_samples), dtype=np.float32)
        for i, c in enumerate(lc):
            s = target_pm.copy()
            for d in c: s *= left_f[d]
            Z[i] = s

        W = np.zeros((len(rc), n_samples), dtype=np.float32)
        for i, c in enumerate(rc):
            s = np.ones(n_samples, dtype=np.float32)
            for d in c: s *= right_f[d]
            W[i] = s

        C = (Z @ W.T) / n_samples
        mi = int(np.argmax(C))
        li, ri = divmod(mi, len(rc))
        if C[li, ri] > 0.3:
            offsets = sorted([d+1 for d in lc[li]] + [d+33 for d in rc[ri]])
            print(f"  S_left={S_left}: corr={C[li,ri]:.4f} → {offsets}")
            return offsets
    return []


# ============================================================
# Approach 3: Simulated Annealing (FAILED — defined only)
# ============================================================

def solve_sa(seqs, S=8, n_iter=10000):
    """
    SA over offset subsets. FAILS: energy landscape is flat —
    all wrong subsets give ~50% accuracy, only exact correct ~80%.
    No partial gradient signal for sparse parity.
    """
    N, L = seqs.shape
    pos = np.arange(64, L)
    np.random.seed(0)
    sub = seqs[np.random.choice(N, 500, replace=False)]
    def energy(offs):
        t = sub[:, pos]
        x = np.zeros_like(t)
        for d in offs: x ^= sub[:, pos-d]
        return 1.0 - float(np.mean(x == t))
    cur = sorted(np.random.choice(range(1,65), S, replace=False).tolist())
    cur_E = energy(cur)
    best, best_E = cur[:], cur_E
    T, alpha = 1.0, (0.01/1.0)**(1.0/n_iter)
    for _ in range(n_iter):
        nb = cur[:]
        nb[np.random.randint(S)] = np.random.choice([d for d in range(1,65) if d not in nb])
        nb.sort()
        nb_E = energy(nb)
        if nb_E < cur_E or np.random.random() < np.exp(-(nb_E-cur_E)/T):
            cur, cur_E = nb, nb_E
        if cur_E < best_E: best, best_E = cur[:], cur_E
        T *= alpha
        if best_E < 0.25: break
    return best, 1.0 - best_E


# ============================================================
# Approach 4: Exhaustive S=1..3 (FAILED — defined only)
# ============================================================

def solve_exhaustive(seqs, max_S=3):
    """
    Brute-force C(64,k) subsets for k=1..max_S.
    FAILS for S=8: C(64,8) ≈ 4.4B subsets, and pairwise
    correlations are zero for S>1 (sparse parity hardness).
    """
    N, L = seqs.shape
    pos = np.arange(64, L)
    target = seqs[:, pos]
    bits = np.zeros((64, N, len(pos)), dtype=np.uint8)
    for d in range(64):
        bits[d] = seqs[:, pos-(d+1)]
    for S in range(1, max_S+1):
        best_acc, best_c = 0.0, None
        for c in combinations(range(64), S):
            x = bits[c[0]].copy()
            for k in range(1, S): x ^= bits[c[k]]
            acc = np.mean(x == target)
            if acc > best_acc: best_acc, best_c = acc, sorted([d+1 for d in c])
            if acc > 0.75: return best_c, acc
    return None, 0.0


# ============================================================
# Approach 5: Gradient descent (FAILED — defined only)
# ============================================================

def solve_gd(seqs, n_epochs=100):
    """
    Sigmoid relaxation of offset selection. FAILS: 64-term soft
    product causes vanishing gradients. Sparse parity has no
    partial-subset signal to guide optimization.
    """
    z = 2.0*seqs[:500].astype(np.float64)-1.0
    pos = np.arange(64, 256)
    zt = z[:, pos]
    zs = np.zeros((64, 500, len(pos)))
    for d in range(64): zs[d] = z[:, pos-(d+1)]
    w = np.zeros(64)
    for _ in range(n_epochs):
        p = 1/(1+np.exp(-np.clip(w,-30,30)))
        terms = np.zeros((64, 500, len(pos)))
        log_prod = np.zeros((500, len(pos)))
        for d in range(64):
            terms[d] = np.clip((1-p[d])+p[d]*zs[d], 1e-10, None)
            log_prod += np.log(terms[d])
        sp = np.exp(log_prod)
        for d in range(64):
            g = -np.mean(zt * sp * (zs[d]-1)/terms[d]) * p[d]*(1-p[d])
            w[d] -= 0.1 * g
    p = 1/(1+np.exp(-w))
    return sorted([d+1 for d in range(64) if p[d]>0.5]), float(np.max(np.abs(p)))


# ============================================================
# Main — only runs BKW + MitM (fast)
# ============================================================

def main():
    print("=" * 60)
    print("SparseTap — Solution")
    print("KRAFTON AI R&D Hackathon · Day 2 · #179")
    print("=" * 60)

    seqs = load_sequences(DATA_FILE)
    print(f"Data: {seqs.shape[0]} seqs × {seqs.shape[1]} bits\n")

    # ── Approach 1: BKW + FWHT ──
    print("APPROACH 1: BKW + Hierarchical FWHT")
    t0 = time.time()
    off1 = solve_bkw_fwht(seqs)
    t1 = time.time() - t0
    acc1 = verify_offsets(seqs, off1)
    print(f"  → offsets={off1}, S={len(off1)}, acc={acc1:.6f}, {t1:.2f}s")
    print(f"  → {'SUCCESS' if acc1 > 0.75 else 'FAIL'}\n")

    # ── Approach 2: Meet-in-the-Middle ──
    print("APPROACH 2: Meet-in-the-Middle")
    t0 = time.time()
    off2 = solve_mitm(seqs)
    t2 = time.time() - t0
    acc2 = verify_offsets(seqs, off2) if off2 else 0.0
    print(f"  → offsets={off2}, acc={acc2:.6f}, {t2:.2f}s")
    print(f"  → {'SUCCESS' if acc2 > 0.75 else 'FAIL'}\n")

    # ── Cross-check ──
    if off1 == off2:
        print("CROSS-CHECK: BKW and MitM agree ✓")
    else:
        print(f"CROSS-CHECK: MISMATCH — BKW={off1}, MitM={off2}")

    # ── Final answer ──
    best = off1 if acc1 > 0.75 else off2
    best_acc = max(acc1, acc2)
    if best_acc > 0.75:
        pred = predict_noisefree(TEST_PREFIX, best)
        print(f"\nFINAL ANSWER")
        print(f"  Offsets: {best}")
        print(f"  S = {len(best)}")
        print(f"  Accuracy: {best_acc:.6f}")
        print(f"  Prediction: {pred}")
    else:
        print("\nNO VALID SOLUTION")

    print("=" * 60)


if __name__ == "__main__":
    main()
