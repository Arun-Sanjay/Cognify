# Adaptive Practice Engine: Research Review and Recommended Algorithm

Scope: the GATE CS Operating Systems unit, with about 550 authored items. Each item is tagged with a topic, a subtopic and an author difficulty from 1 to 5. Items are MCQ (4 options), MSQ or NAT. The stack is FastAPI plus SQL, with no ML infrastructure. The engine has to work from a cold start, and it should optimise **learning gain** rather than measurement precision.

Verification legend. **[V]** means I read the number in the primary source (full text or the publisher abstract). **[V-abs]** means it was confirmed only from an abstract or index listing. **[2nd]** means it came from a secondary source that cites the primary. **[derived]** means I computed it from standard formulas. **[heuristic]** means it is my engineering choice, with no direct empirical backing.

---

## 1. Evidence summary

### 1.1 Elo rating for learners and items
- Basic model (Pelánek 2016, CAE) **[V]**: `P = 1/(1+e^-(θs−di))`, with `θs += K(c−P)` and `di += K(P−c)`.
- The same paper gives a guessing correction for k-option MCQ **[V]**: `P = 1/k + (1−1/k)·σ(θs−di)`.
- Uncertainty-based K **[V]**: `U(n) = a/(1+b·n)`, with **a = 1, b = 0.05** fitted by grid search on Outline Maps data. Pelánek says the "exact choice … is not important, many different choices of a, b provide very similar results". His §5.3 recommends this as "a good starting point".
  - A larger later study (Pelánek et al. 2017, UMUAI) fitted **α = 1, β = 0.06** on about 3.9 M answers from 91 k learners **[V]**.
  - Older fixed-K work used **K = 0.4** (Antal 2013; Wauters et al. 2012, as cited by Pelánek) **[V]**.
- Other uncertainty schedules **[V, as reported by Pelánek 2016]**:
  - Wauters et al. 2011 use `U(n) = w0/(1+a·e^(b·n))` with w0 = 0.2 and b = 50.
  - Klinkenberg et al. 2011 (Math Garden) start at `U = 1` and update `U := U − 1/40 + D/30` after each answer, where D is the number of days since the previous attempt. Uncertainty therefore grows again during inactivity.
- Accuracy against IRT **[V]**:
  - Elo difficulty estimates correlate **0.97** with Rasch JMLE on real data (UMUAI 2017).
  - In simulation, Elo matches JMLE under adaptive item selection, while proportion-correct "fails" (CAE 2016).
  - About **10 answers per student** give a skill estimate that correlates **0.8** with ground truth, once item difficulties are known (CAE 2016, simulation).
- Accuracy against richer models (UMUAI 2017 Table 1) **[V]**:

  | Model | AUC | RMSE |
  |---|---|---|
  | Elo, single skill | 0.743 | 0.4142 |
  | Hierarchical (concept) Elo | 0.751 | 0.4115 |
  | Bayesian (particle) uncertainty | 0.741 | 0.4147 |

  The gain from hierarchical skills was "statistically significant … but rather small". Principled Bayesian uncertainty modelling did not beat the simple U(n).
- Math Garden (Klinkenberg, Straatemeier & van der Maas 2011) **[V-abs]**:
  - Elo-based on-the-fly ability and difficulty estimation over 3,648 children and more than 3.5 M items.
  - Items were sampled for a mean success probability of **0.75**.
  - The scoring rule combines accuracy and response time (**[V]** via Pelánek): `S = (2c−1)(a·d − a·t)`, where d is the time limit and a is the discrimination.

### 1.2 IRT and CAT
- Rasch/1PL is the same logistic link as Elo. 2PL adds a discrimination a_i, and 3PL adds a guessing floor c_i.
- Classical CAT picks the item with maximum Fisher information at the current θ (van der Linden & Pashley 2010).
- For Rasch, `I(θ) = p(1−p)`, which peaks at **p = 0.5** **[derived]**.
- For 3PL with c = 0.25 and a = 1, information peaks at `θ − b = ln((1+√(1+8c))/2) ≈ 0.31`. That puts the peak at **P ≈ 0.68** observed correct **[derived, standard Birnbaum/Lord result]**.
- Measurement cost of targeting easier items, using Rasch information per item **[derived]**:

  | Target p | Information per item | Items for SE(θ) = 0.5 |
  |---|---|---|
  | 0.50 | 0.25 | 16 |
  | 0.70 | 0.21 | 19 |
  | 0.75 | 0.19 | 21 |
  | 0.85 | 0.13 | 31 |

  Eggen & Verschoor (2006) studied exactly this trade-off: difficulty-controlled CAT that selects easier items while keeping as much efficiency as possible **[V-abs]**.
- **Why measurement-optimal is not learning-optimal.** Max-information selection minimises the posterior variance of θ. It treats θ as fixed and ignores motivation, so a learner fails about half the time. Learning systems trade a modest loss in measurement efficiency (about 20–30% more items at p = 0.7–0.75) for higher success rates.
  - Papoušek, Pelánek & Stanislav (EDM 2014) state this explicitly **[V]**: 50% is optimal "from the testing perspective", but "rather low and for most students it would decrease motivation", so they aimed at 75%.
- Data needs:
  - Calibrating 2PL/3PL offline needs hundreds of responses per item. Wauters et al. (2012), as cited in Pelánek 2016 **[V]**, found that about 200 students gave reliable data-driven difficulty estimates.
  - A free-floating 3PL c parameter is notoriously hard to estimate from small data **[heuristic/common knowledge]**. Fixing c from the item format, as Elo does, avoids this.

### 1.3 Target success rate
- **Wilson, Shenhav, Straccia & Cohen (2019), Nat. Commun. 10:4646** **[V]**:
  - For binary classification learned by stochastic gradient descent with Gaussian noise, the optimal training error rate is `ER* = ½(1 − erf(1/√2)) = Φ(−1) ≈ **15.87%**`, which is about 85% accuracy.
  - The optimum is ≈ **18.39%** with Laplacian noise and **25%** with Cauchy noise.
  - The authors caution that the result is limited to two-category tasks and gradient learners. They note that "no formal theoretical work has addressed the effect of training accuracy on learning" in human education.
  - **Takeaway:** this is a theoretical anchor, not an empirical result for exam prep.
- **Papoušek, Stanislav & Pelánek (2016), ITS, LNCS 9684 pp. 267–272**, with the extended analysis in Pelánek et al. 2017 UMUAI §6.4.2 **[V]**:
  - Design: a randomised trial on outlinemaps.org, about **37,000 learners and 3.3 M answers**. Target success rates were **95 / 80 / 65 / 50%**, labelled as error rates 5 / 20 / 35 / 50%.
  - Short-term engagement was better with easier questions. Survival after 10 answers was 89.2% (C5), 87.0%, 84.0% and 81.2% (C50), ±0.77%.
  - Survival after 100 answers was about equal across conditions, at 26.0–26.5%.
  - The **return rate** rose with difficulty: 15.2%, 16.0%, 16.6% and 16.8%, ±0.75%.
  - **Learning**, measured by power-law learning rate on random "reference" questions, was **better for harder practice**. The main difference was between the 95% condition and all the others.
  - Learners' "appropriate difficulty" self-ratings peaked at **60–70% success**, and the authors suggest **≈65%**. In-school users preferred **≈75%**.
  - Realised success rates only spanned 65–90%, because there were not enough hard items. Their system default was 75%.
- **Math Garden** used 0.75 (Klinkenberg 2011 **[V-abs]**).
  - Jansen et al. (2013), with conditions at 60/75/90%, found that the *easiest* condition gave the best maths learning, mediated by more problems solved **[2nd, via Papoušek 2016]**. The domain there is procedural maths for children.
- **Desirable difficulties** (Bjork & Bjork 2011) **[V-abs]**: spacing, interleaving, varied practice and testing all lower performance during practice but raise retention and transfer. Practice accuracy is therefore a poor proxy for learning, which argues against very easy targets.
- **Synthesis.** The evidence brackets the optimum at roughly **65–85% success**, with clear harm only at the extremes (around 95% or 50%).
  - For adult, self-motivated GATE aspirants, **0.70** is a defensible default.
  - Use a slightly easier warm-up, since "start with easy questions to hook learners up, then switch to more difficult" is Papoušek 2016's own recommendation **[V]**.

### 1.4 Knowledge tracing
- **BKT** (Corbett & Anderson 1995) is a two-state HMM per skill with P(L0), P(T), P(G) and P(S).
  - The parameters must be fitted, typically by EM or grid search on historic data.
  - Mastery is declared at P(L) ≥ 0.95 (the classical Cognitive Tutor threshold **[2nd]**).
  - It has no item difficulty, which is a poor fit for a 1–5 graded bank.
- **PFA** (Pavlik, Cen & Koedinger 2009) is logistic in counts of prior successes and failures per KC: `m = β + γ·s + δ·f`. It needs γ, δ and β fitted from data.
- **PFAE / Elo with learning** (Papoušek et al. 2014) **[V]** uses asymmetric updates:
  - `K += γ(1−P)` if correct.
  - `K += δ·P` if wrong.
  - Fitted values were γ = 2.23 ± 0.05 and δ = −0.89 ± 0.04 (geography facts, UMUAI 2017).
- **Comparison on geography data** (EDM 2014 Table 1) **[V]**. PFAE beat both baselines on all three metrics:

  | Model | AUC | RMSE |
  |---|---|---|
  | BKT | 0.668 | 0.262 |
  | PFA | 0.669 | 0.265 |
  | PFAE | 0.682 | 0.262 |
  | PFAE + time | 0.714 | 0.259 |

- **DKT** (Piech et al. 2015, NIPS) **[V]** is an LSTM over interaction sequences.
  - Reported AUC 0.86 on ASSISTments, against BKT at 0.67, and 0.85 against 0.68 on Khan Math.
  - Khajah, Lindsey & Mozer (2016) **[V]** got 0.73 for classic BKT on the same data, and **0.83 for BKT with forgetting**. They concluded the gap is mostly closed by shallow extensions.
  - Xiong et al. (2016) **[V-abs]** found DKT has no overall edge over PFA on properly prepared ASSISTments data.
  - DKT needs tens of thousands of learner sequences.
- Pelánek's 2017 overview **[V]** says the BKT-versus-logistic choice "is not fully resolved". Logistic models fit gradually changing knowledge better, and simple methods "often provide reasonable predictions".

### 1.5 Retrieval, spacing, interleaving and feedback
- **Roediger & Karpicke (2006)** **[V]**. At a 1-week test, testing beat restudying:
  - Experiment 1: tested **56%** vs restudy **42%** (d = 0.83).
  - Experiment 2: STTT **61%** vs SSSS **40%**.
  - At 5 minutes, restudy was ahead (81% vs 75%).
- **Meta-analyses.**
  - Rowland (2014) **[V-abs]**: g ≈ **0.50**, and recall tests produce bigger effects than recognition.
  - Adesope, Trevisan & Sundararajan (2017) **[2nd]**: **0.51** vs restudy and **0.93** vs filler. Their overall g is often quoted as 0.61, which I did not verify.
- **Interleaving: Rohrer & Taylor (2007)** **[V-abs]**. With mixed rather than blocked practice, scores on a test 1 week later were **63% vs 20%**, even though practice accuracy was lower (60% vs 89%).
- **Spacing.**
  - Cepeda et al. (2006) **[V-abs]** is a meta-analysis of 839 assessments in 317 experiments.
  - Cepeda et al. (2008) **[V-abs]**, with N > 1,350: the optimal gap is about **20% of the retention interval** for tests a few weeks away, falling to about **5–10%** for a one-year delay.
- **Feedback.**
  - Butler & Roediger (2008) **[V-abs]**: feedback after MC tests increases later correct recall and reduces lure intrusions, the negative testing effect of MC.
  - Butler, Godbole & Marsh (2013) **[V-abs]**: **explanation feedback beats correct-answer-only feedback for transfer** to new questions.

### 1.6 Guessing and response time
- **MCQ (k = 4).** Use the shifted logistic with c = 1/k = **0.25** (Pelánek 2016; Papoušek 2014 use the identical `1/n + (1−1/n)σ` form) **[V]**.
- **MSQ.** GATE MSQ items have 4 options, one or more correct, and credit only for the exact set. A uniform random non-empty subset is correct with probability **1/15 ≈ 0.067** **[derived]**. Partial knowledge and elimination raise this, so use c = 0.07 and refit later **[heuristic]**.
- **NAT.** c = 0.
- **Response time.**
  - Math Garden's high-speed-high-stakes rule is in §1.1.
  - Papoušek 2014 **[V]** found that "even simple modification of γ … by comparison of the response time to mean response time leads to a slight improvement". Response time is lognormal, so use log(t).
  - Recommendation: log response time but **do not** score it in v1. GATE questions are multi-step problems where speed is weakly diagnostic and timing is noisy (tab switches). Revisit once data exists.

---

## 2. Model comparison

| Model | Data needed before use | Cold start | Accuracy evidence | Implementation complexity | Fit here |
|---|---|---|---|---|---|
| **Elo + uncertainty U(n)** | None; seed from author difficulty | Good: large early K, ≈10 answers to a usable θ | AUC 0.743 vs 0.751 best hierarchical (UMUAI 2017); r = 0.97 with Rasch JMLE | 2 numbers per learner × subtopic and per item; O(1) SQL update | **Best** |
| Elo, hierarchical (topic + subtopic) | None | Better: a new subtopic borrows topic θ | Small but significant gain over flat Elo | +1 row per learner per topic | **Adopt** |
| PFAE (asymmetric γ/δ) | γ/δ must be fitted (logs from a few thousand answers) | OK once fitted | Beat BKT/PFA (AUC 0.682 vs 0.668/0.669) | Low | Phase 2 |
| Rasch/2PL/3PL CAT | Offline calibration, ~200+ responses per item; more for 2PL/3PL | Poor without calibration | Gold standard for measurement; assumes static θ | Medium–high (MLE/EAP, info tables) | Concepts only |
| BKT | 4 params per skill fitted by EM on historic logs | Poor (needs params) | AUC 0.67–0.73 on ASSISTments; ≈ PFA | Medium; ignores item difficulty | No |
| PFA | β, γ, δ per KC fitted | Poor | ≈ BKT | Low–medium | No (PFAE subsumes it) |
| DKT | 10^4–10^5+ sequences, GPU training | None | AUC 0.86 claimed; ≈ BKT+forgetting (0.83) / PFA on clean data | High (ML infra) | No |

---

## 3. Recommended algorithm (v1)

### 3.1 State (SQL)
- `learner_skill(user_id, scope, scope_id, theta REAL, n INT, last_at TIMESTAMP)`, where scope is either `topic` or `subtopic`.
- `item_stats(item_id, d REAL, n INT)`, with `d` seeded from the author rating.
- `attempt(user_id, item_id, correct, response_ms, p_pred, theta_before, d_before, created_at, session_id)`. This is the full log, kept for refitting later.
- `review_queue(user_id, item_id, due_at, step)`, used for spaced re-asking of missed items.

### 3.2 Initial item difficulty from author rating (logit scale)
| Author difficulty | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| d₀ | −2.0 | −1.0 | 0.0 | +1.0 | +2.0 |

- Rationale **[heuristic]**: this matches the usual N(0,1)-ish IRT range. For a θ = 0 learner it gives P(correct, NAT) = 0.88 / 0.73 / 0.50 / 0.27 / 0.12. Expert ratings are only moderately accurate, which is why d is then learned online.
- Seed `item_stats.n = 10`, a pseudo-count meaning "the author rating is worth about 10 answers" **[heuristic]**.
- A new learner starts at θ = 0. Treat the GATE population as average, so a rating-3 NAT item is a coin flip.

### 3.3 Prediction
```
θ_eff   = θ_topic + θ_sub                       # hierarchical Elo
σ       = 1 / (1 + exp(−(θ_eff − d_i)))
c       = 0.25 (MCQ, 4 options) | 0.07 (MSQ) | 0.0 (NAT)
P       = c + (1 − c)·σ                          # Pelánek 2016 shifted logistic
```

### 3.4 Updates after each answer (c_obs ∈ {0,1})
```
U(n)        = 1 / (1 + 0.05·n)                   # a=1, b=0.05 (Pelánek 2016)
K_sub       = max(U(n_sub_eff), 0.15)             # floor keeps tracking learning [heuristic]
K_topic     = 0.5 · max(U(n_topic_eff), 0.10)      # topic moves slower [heuristic]
err         = c_obs − P
θ_sub      += K_sub   · err
θ_topic    += K_topic · err
if first attempt by this user on this item:       # repeats measure memory, not difficulty
    K_item  = U(n_item)                           # starts at 1/(1+0.05·10)=0.67
    d_i    −= K_item · err ;  n_item += 1
n_sub += 1 ; n_topic += 1
```
- **Elo convention for repeats** **[V]**: Papoušek/Pelánek use only the first answer to an item for difficulty and prior-skill estimation. Repeated attempts still update θ_sub, with `K_sub × 0.5` for re-asked items **[heuristic]**.
- **Inactivity**: `n_eff = n · 0.5^(days_since_last/30)`. This is a simple analogue of Klinkenberg's `U := U − 1/40 + D/30`, where uncertainty grows when a learner returns after a gap **[heuristic adaptation]**.
- **Clamps**: θ to [−4, 4] and d to [−3.5, 3.5].
- For MSQ/NAT the error term is larger in expectation because there is no guessing floor. That is correct behaviour: those items are more informative.

### 3.5 Next-item selection (adaptive mode)
This uses the linear-scoring approach of Papoušek et al. (EDM 2014) **[V]**, extended for subtopics.

**Step 1: choose the subtopic** (only when the user selected several). Sample with probability proportional to `w_s`:
```
w_s = (1 − σ(θ_eff,s − d_ref)) + 0.5·U(n_s)       # weakness + uncertainty bonus
d_ref = +1.0                                      # GATE-level (rating-4) item
```
- Hard interleaving rule: **no more than 2 consecutive items from the same subtopic** when two or more are selected.
- Basis: interleaving evidence (Rohrer & Taylor 2007). The cap value itself is **[heuristic]**.

**Step 2: choose the item within the subtopic.** Take the highest total score among eligible items:
```
S_prob  = P/P_t           if P ≤ P_t            # Papoušek's normalised distance
          (1−P)/(1−P_t)   if P >  P_t
S_time  = −1 / max(k_since_seen, 1)              # k = items since this item was last shown
S_count = 1 / sqrt(1 + times_seen)
S_type  = +0.1 if question type differs from previous item   [heuristic variety]
Score   = 10·S_prob + 3·S_time + 2·S_count + S_type + 0.05·rand()
```
- **Target success rate P_t = 0.70** by default (evidence in §1.3).
  - Warm-up: P_t = 0.80 for the first 3 items of each session (Papoušek 2016 "hook" advice).
  - "Challenge" setting: P_t = 0.60. "Confidence" setting: P_t = 0.80.
  - Optional closed loop: if the realised success over the last 10 items is more than 10 points off target, shift P_t by ±0.05 the other way, kept within [0.6, 0.85] **[heuristic]**.
- **Hard filters on eligibility**:
  - (a) Never repeat an item within the same session, except a due re-queue.
  - (b) Items answered correctly are ineligible for 7 days.
  - (c) Exclude items whose P is outside [0.35, 0.95], unless no items remain.
- **Weights.** Papoušek used W_prob = 10, W_count = 10 and W_time = 120 with time in seconds. The weights above are rescaled for an items-based clock and **must be tuned** **[heuristic]**.

**Step 3: re-queue missed items** (spaced retrieval). Each wrong answer inserts the item into `review_queue`:
- **In-session retry** after 5–8 intervening items. Show the explanation first (Butler et al. 2013), then the retry tests retrieval rather than short-term memory. The Papoušek model found a strong short-term memory effect `w/t` with w = 80 s, so do not re-ask immediately.
- **Expanding reviews**: +1 day, +3 days, +7 days, then `max(7 d, 0.15 × days_until_GATE)`.
  - Cepeda 2008 puts the optimal gap at about 10–20% of the retention interval.
  - The exam date is known, so set the retention interval to days until GATE.
- **Selection priority**: a due review item is served instead of Step 2 with probability 0.3, capped at 30% of a session **[heuristic]**. It still counts toward interleaving.
- **Progression**: a correct review advances `step`. An incorrect one resets to the in-session retry.

### 3.6 Feedback
Give immediate feedback after every item: the correct answer **plus a worked explanation**, and for MCQ/MSQ an explanation of why the chosen distractor is wrong. The evidence is in §1.5 (Butler & Roediger 2008; Butler, Godbole & Marsh 2013).

### 3.7 Stopping and mastery
- **Session end**: a user-chosen length (10/20/30), or earlier if no eligible items remain within P ∈ [0.35, 0.95].
- **Subtopic "mastered"** requires all three of the following **[heuristic; thresholds parallel BKT's 0.95 convention but tuned for logistic]**:
  1. `n_sub ≥ 12`, which gives SE(θ) of roughly ≤ 0.6 at p ≈ 0.7 (§1.2).
  2. `σ(θ_eff − 1.0) ≥ 0.80`, meaning the learner would get **80% of rating-4 NAT items** right.
  3. At least 4 correct in the last 5 attempts in that subtopic, with at least one of them a review item answered ≥ 1 day after the original miss. This guards against the "massed practice illusion" (Roediger & Karpicke 2006, 5-min vs 1-week reversal).
- **Mastery decay**: mastery is lost if θ drops back below threshold, or after 30 days without practice (n_eff decay in §3.4).
- **Display**: show θ to users as a 0–100 "readiness" score = `100·σ(θ_eff − 1.0)`, plus an uncertainty band from U(n).

### 3.8 Phase 2, once roughly 20–50 k attempts are logged
1. Grid-search a, b and the K floors by minimising log-loss/RMSE on held-out attempts, as Pelánek et al. did. They prefer RMSE because the selection uses absolute P values.
2. Refit d₀ per author rating as the mean learned d per rating, and refit c for MSQ.
3. Try PFAE asymmetric γ/δ per subtopic.
4. Try log response time as a feature.
5. Run A/B tests of P_t ∈ {0.65, 0.75, 0.85}. Measure learning on **randomly chosen reference items** that the adaptive policy did not choose, every 10th item (the Papoušek 2016 method). Do not measure on practice accuracy.

---

## 4. References (all checked online on 2026-10-01)

1. Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education*, 98, 169–179. doi:10.1016/j.compedu.2016.03.017. Preprint: https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf
2. Pelánek, R., Papoušek, J., Řihák, J., Stanislav, V., & Nižnan, J. (2017). Elo-based learner modeling for the adaptive practice of facts. *User Modeling and User-Adapted Interaction*, 27(1), 89–118. doi:10.1007/s11257-016-9185-7. Preprint: https://www.fi.muni.cz/~xpelanek/publications/umuai-adaptive-practice.pdf
3. Papoušek, J., Pelánek, R., & Stanislav, V. (2014). Adaptive practice of facts in domains with varied prior knowledge. *Proc. Educational Data Mining 2014*, 6–13. https://www.fi.muni.cz/~xpelanek/publications/EDM14-adaptive-facts.pdf
4. Papoušek, J., Stanislav, V., & Pelánek, R. (2016). Impact of question difficulty on engagement and learning. *Intelligent Tutoring Systems (ITS 2016)*, LNCS 9684, 267–272. https://www.fi.muni.cz/~xpelanek/publications/its-target-difficulty.pdf. Technical report FIMU-RS-2016-02: https://www.fi.muni.cz/~xpelanek/publications/FIMU-RS-2016-02.pdf
5. Klinkenberg, S., Straatemeier, M., & van der Maas, H. L. J. (2011). Computer adaptive practice of Maths ability using a new item response model for on the fly ability and difficulty estimation. *Computers & Education*, 57(2), 1813–1824. doi:10.1016/j.compedu.2011.02.003. https://eric.ed.gov/?id=EJ925823
6. Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The Eighty Five Percent Rule for optimal learning. *Nature Communications*, 10, 4646. doi:10.1038/s41467-019-12552-4. https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579/
7. Pelánek, R. (2017). Bayesian knowledge tracing, logistic models, and beyond: an overview of learner modeling techniques. *UMUAI*, 27, 313–350. doi:10.1007/s11257-017-9193-2. https://www.fi.muni.cz/~xpelanek/publications/umuai-overview.pdf
8. Corbett, A. T., & Anderson, J. R. (1995). Knowledge tracing: Modeling the acquisition of procedural knowledge. *UMUAI*, 4(4), 253–278. doi:10.1007/BF01099821
9. Pavlik, P. I., Cen, H., & Koedinger, K. R. (2009). Performance Factors Analysis – A new alternative to knowledge tracing. *Proc. AIED 2009*, Frontiers in AI and Applications 200, 531–538. https://files.eric.ed.gov/fulltext/ED506305.pdf
10. Piech, C., Bassen, J., Huang, J., Ganguli, S., Sahami, M., Guibas, L., & Sohl-Dickstein, J. (2015). Deep knowledge tracing. *NIPS 28*. https://papers.nips.cc/paper/5654-deep-knowledge-tracing
11. Khajah, M., Lindsey, R. V., & Mozer, M. C. (2016). How deep is knowledge tracing? *Proc. EDM 2016*. https://arxiv.org/abs/1604.02416
12. Xiong, X., Zhao, S., Van Inwegen, E. G., & Beck, J. E. (2016). Going deeper with deep knowledge tracing. *Proc. EDM 2016*. https://www.semanticscholar.org/paper/4891d27b8bd0df9caad58805bae4491e860afdc0
13. van der Linden, W. J., & Pashley, P. J. (2010). Item selection and ability estimation in adaptive testing. In *Elements of Adaptive Testing* (Springer), 3–30. https://link.springer.com/chapter/10.1007/978-0-387-85461-8_1
14. Eggen, T. J. H. M., & Verschoor, A. J. (2006). Optimal testing with easy and difficult items in computerized adaptive testing. *Applied Psychological Measurement*, 30(5), 379–393. doi:10.1177/0146621606288890
15. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3), 249–255. doi:10.1111/j.1467-9280.2006.01693.x
16. Rowland, C. A. (2014). The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. *Psychological Bulletin*, 140(6), 1432–1463. doi:10.1037/a0037559
17. Adesope, O. O., Trevisan, D. A., & Sundararajan, N. (2017). Rethinking the use of tests: A meta-analysis of practice testing. *Review of Educational Research*, 87(3), 659–701. doi:10.3102/0034654316689306
18. Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35, 481–498. doi:10.1007/s11251-007-9015-8
19. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380. doi:10.1037/0033-2909.132.3.354
20. Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science*, 19(11), 1095–1102. doi:10.1111/j.1467-9280.2008.02209.x
21. Butler, A. C., & Roediger, H. L. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition*, 36(3), 604–616. doi:10.3758/MC.36.3.604
22. Butler, A. C., Godbole, N., & Marsh, E. J. (2013). Explanation feedback is better than correct answer feedback for promoting transfer of learning. *Journal of Educational Psychology*, 105(2), 290–298. doi:10.1037/a0031026
23. Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In Gernsbacher et al. (Eds.), *Psychology and the Real World* (pp. 56–64). Worth.

**Not independently verified:**
- Jansen et al. (2013), *Learning and Individual Differences* 24:190–197. Cited via ref. 4.
- Wauters et al. (2011, 2012) and Nižnan et al. (2015). Cited via ref. 1.
- Adesope's overall g = 0.61.
- DOIs for refs 8, 14, 15, 16, 17, 19 and 23. Titles, venues and pages were confirmed, but the DOI strings are from my knowledge of these papers' standard records and were not resolved one by one.
