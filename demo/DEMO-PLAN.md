# Mechanarium × Vector — Single-Loop Demo Plan

**Primary demo:** Vertical loop — release height \(6R\), radius \(R\), “will it complete the loop?”  
**Why this over double-loop FRQ:** Faster on camera, reliable feature compiler path (`release` + `loop` + `runout`), clear falsifiable prediction, photogate payoff in seconds.

**Extended reference (optional):** AP® Physics 1 **2024 Q1** screenshots in this folder for a longer session or stretch goal.

| File | Content |
| --- | --- |
| `Screenshot 2026-07-21 095328.png` | Full 2024 Q1 setup (double loop) |
| `Screenshot 2026-07-21 095332.png` | Energy bar charts |
| `Screenshot 2026-07-21 095336.png` | FBD at C, \(4R\) claim |

---

## What we demonstrate

1. **Build** — Vector compiles semantic features into an exact loop track + sliding block.
2. **Measure** — Photogates at bottom of hill and loop apex; notebook records trials.
3. **Predict** — Conservation of energy + centripetal condition at the top.
4. **Falsify** — Lower release height → detachment at apex (live or second prompt).
5. **Guide** — Vector scaffolds without full worked solution.

**Baseline preset for comparison:** `loop-the-loop` (Build → Experiments). Agent must build via **features**, not load a hidden double-loop preset.

---

## Pre-demo checklist

- [ ] `npm run dev` — web `http://127.0.0.1:5173/Mechanarium/`, agent `:8787`
- [ ] `.env` → **Vector / OpenAI** in footer
- [ ] Hard-refresh after agent changes
- [ ] Values: \(R = 1\,\text{m}\), \(M = 1\,\text{kg}\), \(g \approx 9.8\,\text{m/s}^2\)

---

## Video flow (< 3 min)

| Act | Time | Action |
| --- | --- | --- |
| **1 — Build** | ~30 s | Paste primary prompt → Apply proposal |
| **2 — Success run** | ~15 s | Release from \(6R\) → completes loop → gate reading |
| **3 — Harness story** | ~90 s | Failure analysis → feature compiler (see `DEMO-SCRIPT.md`) |
| **4 — Fail run** (optional) | ~15 s | Release \(\approx 2.5R\) → detachment at top |
| **5 — Scaffold** (optional) | ~15 s | “What’s minimum height?” — Vector asks, doesn’t answer |

---

## Primary build prompt

```text
Build a loop-the-loop investigation lab. Do not solve yet.

Apparatus:
- Sliding block (sphere, friction 0) released from rest at height 6R above the ground.
- Vertical circular loop of radius R = 1 m on the ground (ideal, frictionless track).
- Flat runout after the loop.

Instruments:
- Ruler for height reference.
- Photogate assembly at the bottom of the descent (before the loop).
- Photogate assembly at the top of the loop.

Use M = 1 kg. Propose the world — I will Apply. Then ask: what should we measure first to predict whether the block completes the loop?
```

**Expected Vector output:** `add_spline_track` with `features: [release, loop, runout]` + `add_body` (sphere) + `add_instrument` × 2–3. Proposal card, not scaffold-only.

**Example compiled features:**
```json
[
  { "type": "release", "position": { "x": -5.5, "y": 6.0 } },
  { "type": "loop",    "center": { "x": 0, "y": 1.0 }, "radius": 1.0 },
  { "type": "runout",  "position": { "x": 5.5, "y": 1.0 } }
]
```

---

## Follow-up prompts

### Measure
```text
I applied the lab. Walk me through one trial: record from release, read the bottom photogate, and tell me what that speed lets us infer about the top of the loop. Label observation vs inference.
```

### Scaffold minimum height
```text
Scaffold only: block released from rest at height h above the ground, loop radius R. What knowns do we need? What principle connects release height to speed at the top? Do not give the final formula until I try.
```

### Falsify (detachment)
```text
Rebuild the lab with release height 2.5 m instead of 6 m. Predict whether the block completes the loop, then tell me what photogate or contact evidence would prove it.
```

### Stuck escalation
```text
I'm stuck. Worked approach for minimum release height to stay on the track at the top, using energy and centripetal motion. Use R = 1 m and our sliding block assumptions.
```

---

## Physics beats (on camera)

| Topic | Symbolic | With \(R=1\) m |
| --- | --- | --- |
| Energy at release | \(E = mg(6R)\) | \(6mg\) J per kg |
| Speed at bottom (ideal) | \(v = \sqrt{12gR}\) from \(6R\to 0\) | \(\approx 10.8\) m/s |
| Contact at top | Need \(v_\text{top} \geq \sqrt{gR}\) | \(\sqrt{g} \approx 3.1\) m/s |
| Minimum release (slide) | \(h_\text{min} = 2.5R\) | \(2.5\) m |
| Demo detachment | Release \(\approx 2.5R\) | Loses contact at apex |

---

## Success criteria

- [ ] Proposal with track features + body + instruments
- [ ] **Vector / OpenAI** (or explicit fallback message)
- [ ] Trial produces photogate events
- [ ] Release from \(6R\) completes loop
- [ ] Optional: low release shows detachment
- [ ] Scaffold asks questions; solution only on request

---

## Presenter notes

- **Say:** “Vector proposes, we Apply, then we measure.”
- **Show:** Proposal card, Lab record, Data rail.
- **Compare:** Built track vs `loop-the-loop` preset — same physics, agent had to compile features.
- **Double-loop FRQ:** Mention as next step (“same pipeline, more features”) — don’t live-demo in 3 min.

---

## Related

- [`demo/DEMO-SCRIPT.md`](./DEMO-SCRIPT.md) — timed narration
- [`docs/vector_failure_analysis.md`](../docs/vector_failure_analysis.md) — why raw knots failed
