# Mechanarium Hackathon Demo Script (< 3 min)

**Demo problem:** Single vertical loop — minimum release height / “will it complete the loop?”  
**Total target:** 2:45  
**Audience:** Hackathon judges — GPT integration + measurable physics  
**Assets:** dev stack running, footer **Vector / OpenAI** (image optional)

---

## Beat sheet

| Time | Section | On screen |
| --- | --- | --- |
| 0:00–0:45 | **Hook + live physics** | Vector builds loop lab → Apply → trial → completes loop |
| 0:45–2:10 | **Harness engineering** | Raw knots failed → feature compiler fix |
| 2:10–2:45 | **Close** | Detachment beat or scaffold → tagline |

---

## 0:00 — Hook (10 sec)

**[VISUAL: Mechanarium 3D workspace]**

> "This is Mechanarium — a physics lab you build, measure, and reason in. Classic exam question: release a block from height \(6R\) into a vertical loop of radius \(R\). Will it stay on the track? We built an AI that constructs the experiment — and teaches you through it."

---

## 0:10 — Live demo: build → measure (35 sec)

**[VISUAL: Vector input — paste prompt below. Show proposal card → Apply.]**

**Paste (no image required):**
```text
Build a loop-the-loop investigation lab. Do not solve yet.

Apparatus:
- Sliding block (sphere, friction 0) released from rest at height 6R above the ground.
- Vertical circular loop of radius R = 1 m sitting on the ground (ideal, frictionless track).
- Flat runout after the loop.

Instruments:
- Ruler for height reference.
- Photogate assembly at the bottom of the descent (before the loop).
- Photogate assembly at the top of the loop.

Use M = 1 kg. Propose the world — I will Apply. Then ask: what should we measure first to predict whether the block completes the loop?
```

> "Vector returns a **validated proposal** — semantic track features, block, photogates. We approve it."

**[VISUAL: Apply → Run → block completes the loop. Flash notebook gate reading.]**

> "One trial. Photogate gives speed at the bottom. From \(6R\) release, it clears the top — energy and centripetal force check out."

**[Optional 8 sec: lower release or ask Vector to rebuild at height \(2.5R\) → detachment at apex]**

> "Drop the release height and the same physics fails on camera — the block loses contact. That's not animation — it's the solver."

---

## 0:45 — The problem we hit (30 sec)

**[VISUAL: Split screen — wobbly early track vs clean loop]**

> "This didn't work on the first prompt. Our harness asked GPT for **raw spline knots** — position, tangent, second derivative for every point. Roughly **seventy-eight floats** from a diagram."

**[VISUAL: Flash `docs/vector_failure_analysis.md`]**

> "LLMs predict tokens; they don't compute \(\cos\theta\). Tangents were wrong in magnitude. Second derivatives were guessed. Loops looked circular and **jittered or broke**. We also hit harness bugs — build requests treated as homework tutoring, silent fallback to local mode."

---

## 1:15 — The fix: Feature Compiler (55 sec)

**[VISUAL: Architecture flow]**

```
Problem description  →  GPT (semantic features)  →  compileFeatures()  →  circleKnot()  →  simulator
```

> "Don't ask the model to do trigonometry. Give it physics vocabulary — **release, loop, runout** — and compile in code."

**[VISUAL: Example feature JSON on screen]**

```json
"features": [
  { "type": "release", "position": { "x": -5.5, "y": 6.0 } },
  { "type": "loop",    "center": { "x": 0, "y": 1.0 }, "radius": 1.0 },
  { "type": "runout",  "position": { "x": 5.5, "y": 1.0 } }
]
```

**[VISUAL: `src/domain/spline.js` — `compileFeatures` + `circleKnot`]**

> "Three features become thirteen exact knots. `circleKnot` computes analytical tangents and centripetal second derivatives. The quintic spline reconstructs a real circle — same math we used for the working preset."

**[VISUAL: `server/agent.mjs` — features-only schema]**

> "Raw knot arrays are gone from the tool schema. Vector outputs centers and radii — numbers you read off the problem. Policy validates every action before Apply."

---

## 2:10 — Integrated platform (35 sec)

**[VISUAL: AgentDock + Lab panel + energy telemetry]**

> "**GPT-5.6 Luna** runs behind a bounded agent server — strict JSON schema, rate limits, Apply/Cancel previews. Every request carries **live telemetry**: energy, gate trials, world inventory."

> "Vector builds the lab, places instruments, cites **Observation** vs **Inference**, and scaffolds without giving away the exam. Same workflow AP Physics rewards — but runnable."

**[VISUAL: Block completing loop; optional scaffold card]**

> "Semantic AI up front. Deterministic math in the middle. Measured truth at the end."

---

## 2:40 — Close (5 sec)

> "Mechanarium. Build worlds. Discover the laws that move them."

---

## Speaker notes

- **Pre-Apply backup:** Load preset **Loop-the-Loop** if the API is slow; still narrate the proposal flow.
- **Detachment beat:** Ask Vector *"Rebuild with release height 2.5 m and predict whether it completes the loop"* — or manually lower release knot after first run.
- **Skip if tight:** 78-floats detail, 108 tests line, second photogate.
- **Must keep:** Apply → run → gate reading → feature compiler story.

---

## B-roll checklist

- [ ] `npm run dev` — `http://127.0.0.1:5173/Mechanarium/`, agent `:8787`
- [ ] Footer: **Vector / OpenAI**
- [ ] Proposal card → Apply → loop completion in one take
- [ ] Notebook shows at least one photogate event
- [ ] Optional: detachment clip at low release height

---

## Related docs

- [`demo/DEMO-PLAN.md`](./DEMO-PLAN.md) — single-loop prompts + follow-ups
- [`docs/vector_failure_analysis.md`](../docs/vector_failure_analysis.md)
- [`docs/AGENT-DEPLOYMENT.md`](../docs/AGENT-DEPLOYMENT.md)
