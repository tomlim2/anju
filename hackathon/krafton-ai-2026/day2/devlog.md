# Day 2 Devlog — KRAFTON AI R&D Hackathon

**Date:** 2026-03-29 (Sun) 13:00~17:00 KST
**Participant:** #179

---

## Timeline

| Time | Phase | Activity | Status |
|------|-------|----------|--------|
| ~10:45 | Prep | Created day2 directory | Done |
| ~11:32 | Prep | Wrote report_template.md, run_experiment.py | Done |
| ~12:35 | Prep | Wrote diffusion_template.py (DDPM/DDIM + guidance) | Done |
| ~12:36 | Prep | Wrote rl_template.py (PPO/REINFORCE) | Done |
| ~12:37 | Test | RL template run — CartPole PPO 100K steps | Done |
| ~12:41 | Test | Diffusion template run — MNIST ch=32 1 epoch smoke | Done |
| ~13:00 | Start | Problem received — **SparseTap** (noisy XOR LFSR recovery) | Done |
| ~13:03 | Setup | problem2_data.txt + DAY2.html copied to day2/ | Done |
| ~13:05 | Plan | 계획설계.md — 3관점 분석 + 타임라인 + 차별화 전략 작성 | Done |
| ~13:10 | Plan | 6체제 확정 (4→6 에이전트), 시나리오별 지시문 준비 | Done |
| ~13:15 | Deploy | 3호기: 서브에이전트 3개 병렬 풀이 지시 | Done |
| ~13:15 | Deploy | 5호기: 리포트 초안 (결과 전 작성 가능 부분) 지시 | Done |
| ~13:15 | Deploy | 6호기: 검증 스크립트 작성 완료, offset 대기 | Done |
| ~13:15 | Status | 2호기: 상관 분석 구현 중 | In Progress |
| ~13:15 | Status | 4호기: GD 구현 + 실행 중 (시간 소요 중) | In Progress |
| ~13:18 | Status | 2호기: S=6까지 18분 소요, exhaustive 한계 → kill | Done |
| ~13:18 | Pivot | 2호기: FWHT 서브스페이스 하이브리드 solver로 전환 | Superseded |
| ~13:20 | Insight | Gemini 분석: Sparse LPN 문제, Piling-up Lemma로 greedy 구조적 불가 | Key Finding |
| ~13:20 | Pivot | 2호기: GF(2) regression + majority vote로 긴급 전환 | In Progress |
| ~14:25 | **VERIFY** | 2호기 BKW offsets [5,14,21,29,36,42,50,57] → **ALL PASS** | **CONFIRMED** |
| | | Training acc=0.7997 (expected 0.8), split stable, bootstrap CI [0.798,0.802] | |
| | | Leave-one-out: 8개 모두 CRITICAL (제거 시 →50%), superset 추가 시 →50% | |
| | | Prediction 100% match, self-check 199/199 positions pass | |
| 15:00~16:00 | Experiment | ablation + cross-check | Pending |
| 16:00~16:30 | Report | answer 확정 + 코드 통합 + 리포트 완성 | Pending |
| 16:30~16:50 | Package | ZIP + 더블체크 | Pending |
| 16:50~17:00 | Submit | 구글폼 제출 | Pending |

---

## Pre-built Templates

### 1. DiffusionBoard (`diffusion_template.py`)
- TinyUNet (ch=32, ~56K params) + NoiseSchedule
- Sampling: DDPM (full T), DDIM (50 steps)
- Guidance: classifier guidance + test-time optimization (DAS-based)
- Eval: pixel FID, sample grid save
- Test: 1 epoch smoke passed, test_samples.png confirmed

### 2. AgentBoard (`rl_template.py`)
- Actor-Critic shared trunk (hidden=64, 2-layer, ~8K params)
- Algorithms: PPO (clipped + GAE) + REINFORCE
- Envs: CartPole-v1 + SimpleGridEnv template
- Test: 100K steps PPO done, avg_reward 18.5→141.5 (converged)

### 3. Experiment Runner (`run_experiment.py`)
- `--smoke`: 2min CPU smoke test
- `--full`: GPU check + process collision detection + metadata save
- `--check`: health check only

---

## RL Pre-test Results

```
Steps   2K → avg 18.5
Steps  40K → avg 91.2  (CartPole solved)
Steps  83K → avg 141.5 (peak)
Steps 100K → avg 135.7 (stable)
```

PPO converges on CartPole-v1. Template verified.

---

## Diffusion Pre-test Results

- 1 epoch smoke only (loss 0.2005)
- test_samples.png: noisy (expected at 1 epoch)
- Full training: 50 epochs needed (~5-10min on MPS)

---

## Session Ops

### Role Assignment (6체제)

| Agent | Role | Status |
|-------|------|--------|
| **1호기 (SS1)** | 지통실 — 계획, devlog, 결과 종합, 제출 | Active |
| **2호기** | 통계적 상관 분석 구현 (메인 solver) | Working |
| **3호기 (SS3)** | 서브에이전트 3개 병렬 풀이 | Working |
| **4호기** | Gradient descent 구현 (보고서 필수) | Working (GD 실행중) |
| **5호기** | 리포트 PDF 전담 | Working (초안) |
| **6호기** | 실시간 검증 루프 | Ready (스크립트 완료, 대기) |

### 시나리오 대응 준비

시나리오별_지시문.md에 A/B/C/D 4가지 시나리오별 각 호기 지시문 사전 준비 완료.

---

## Day 1 Summary (Reference)

- **Problem:** 6-bit binary multiplication transformer
- **Result:** P2 = 17,280 params, Acc2 = 100%
- **Key:** d_model=32 is stability threshold, 2-layer minimum
- **P1 (hand-coded):** -1 (incomplete, needs 2+ layers)

---

## Notes

- Single submission only — double-check before submit
- AI usage encouraged
- Low-compute problems (no extra resources provided)
- Device: MPS (Apple Silicon)

### RANSAC v2 — 14:14
- Trials: 161987, Elapsed: 55.0s
- Offsets: []
- Accuracy: 0.0000
- Status: **TIMEOUT**

### GD Continuous Relaxation — 14:38:05→14:38
- Offsets: [1, 6, 15, 23, 39, 47, 49, 63], True: [5, 14, 21, 29, 36, 42, 50, 57]
- Success: False, Acc: 0.4989
- Status: **FAIL (expected)**

### LASSO / Compressed Sensing — 14:41:07→14:41
- Best offsets: [25, 26, 27, 28, 29, 30, 63, 64], True: [5, 14, 21, 29, 36, 42, 50, 57]
- Success: False, Acc: 0.5013 (true: 0.7999)
- Status: **FAIL (expected)**

### RL Bandit Search — 14:41:07→14:42
- Offsets: [1, 16, 24, 25, 28, 34, 46, 53], True: [5, 14, 21, 29, 36, 42, 50, 57]
- Success: False, Acc: 0.5034
- Restarts: 7, Steps: 700
- Status: **FAIL**

### RL Bandit Search — 14:41:32→14:42
- Offsets: [1, 8, 21, 25, 31, 38, 45, 58], True: [5, 14, 21, 29, 36, 42, 50, 57]
- Success: False, Acc: 0.5031
- Restarts: 7, Steps: 700
- Status: **FAIL**

### 2호기 LASSO Sparse Recovery (solve_lasso.py) — ~14:50
- Lasso selected 14 wrong offsets — 0/8 correct
- Column correlations at true offsets: all ≈ 0 (range -0.013 to +0.015)
- Training accuracy: ~57% (vs 80% with true offsets)
- Root cause: XOR in ±1 = degree-8 product, not linear. RIP violated.
- Status: **FAIL (expected, documented)**

### 2호기 Greedy Sequential Recovery (solve_greedy.py) — ~14:50
- All 64 single-offset biases in [0.4986, 0.5016] — zero signal
- Pairwise biases also ≈ 0.5 — zero signal
- Root cause: Piling-up Lemma — partial match = zero correlation in GF(2)
- Status: **FAIL (intentional, for report)**

### 3호기 Meet-in-the-Middle (solve_mitm.py) — 14:55
- Split: LEFT(1-32) vs RIGHT(33-64), S_left=4, S_right=4
- ±1 space: Z(35960×300) @ W.T(300×35960) correlation matrix
- 1.3B pairs scanned in 2.4s via BLAS matmul
- Max correlation: 0.54 (theory: 0.6), N=300 samples
- **Offsets: [5, 14, 21, 29, 36, 42, 50, 57] — CORRECT**
- Full accuracy: 0.7999
- Total time: **3.2s**
- Status: **SUCCESS**

### 4호기 Simulated Annealing (solve_sa.py) — 14:46
- 10000 iterations, T: 1.0→0.01, S=8
- Best: [1,5,11,32,37,42,47,62], Acc: 0.5008
- Root cause: energy landscape completely flat (~50% for ALL wrong subsets)
- Time: 10.9s
- Status: **FAIL (expected, for report — demonstrates sparse parity hardness)**

### 4호기 solution.py 통합 — 15:00
- BKW+FWHT: 0.77s → offsets=[5,14,21,29,36,42,50,57], acc=0.7999 → **SUCCESS**
- MitM: 2.36s → same offsets → **SUCCESS**
- Cross-check: **AGREE ✓**
- Total: **3.13s**
- Failed approaches (SA, Exhaustive, GD) defined as functions, not executed
- Status: **Done**
