# Why Vector Fails: The Fundamental Gap

## The Core Thesis

There are **two completely different pipelines** producing the same type of output (a spline track). One works perfectly. The other fails. The difference isn't intelligence — it's **architecture**. Vector is being asked to do something that no LLM can reliably do: generate 78+ precise floating-point numbers from a visual diagram in a single forward pass.

---

## Pipeline A: How the Working Preset Was Built (Me)

When I built the double-loop, I performed a **two-stage translation**:

### Stage 1: FRQ Semantics → Mathematical Model
I read the diagram and extracted **symbolic parameters**:
- Point A height: `6R`
- Loop 1: ground-level, radius `R`, center at `(cx1, R)`
- Loop 2: on a `2R` platform, radius `R`, center at `(cx2, 3R)`
- Frictionless, captive rail, block of mass `M`

### Stage 2: Mathematical Model → Procedural Code
I wrote **functions that compute geometry** — I never hand-typed a single coordinate:

```javascript
// circleKnot computes EXACT analytical derivatives from the parametric circle
function circleKnot(id, center, radius, theta, span = Math.PI / 2) {
  return createSplineKnot({
    id,
    position:        { x: center.x + radius * Math.cos(theta),
                       y: center.y + radius * Math.sin(theta) },
    tangent:         { x: -radius * span * Math.sin(theta),
                       y:  radius * span * Math.cos(theta) },
    secondDerivative:{ x: -radius * span² * Math.cos(theta),
                       y: -radius * span² * Math.sin(theta) },
  })
}
```

For a loop knot at θ = 0 (rightmost point), center = (-2.5, 1), R = 1:

| Field | Formula | Result |
|---|---|---|
| position.x | -2.5 + 1·cos(0) | **-1.5** |
| position.y | 1 + 1·sin(0) | **1.0** |
| tangent.x | -1·(π/2)·sin(0) | **0** |
| tangent.y | 1·(π/2)·cos(0) | **1.5708** |
| secondDeriv.x | -1·(π/2)²·cos(0) | **-2.4674** |
| secondDeriv.y | -1·(π/2)²·sin(0) | **0** |

**Every value is computed by `Math.cos()` and `Math.sin()`, not hallucinated.** The quintic Hermite spline interpolator then uses these exact tangents and second derivatives to reconstruct a perfect circle between adjacent knots.

---

## Pipeline B: What Vector Actually Does

Vector receives the FRQ image and must output a **single JSON blob** containing every knot with all three vectors (position, tangent, secondDerivative) as raw floating-point numbers:

```json
{
  "type": "add_spline_track",
  "track": {
    "knots": [
      { "id": "k0", "position": {"x": -7.5, "y": 6.0},
        "tangent": {"x": 5.0, "y": -4.0},
        "secondDerivative": {"x": ???, "y": ???} },
      { "id": "k1", "position": {"x": -2.7, "y": 0.0},
        "tangent": {"x": ???, "y": ???},
        "secondDerivative": {"x": ???, "y": ???} },
      // ... 11 more knots, each with 6 floats ...
    ]
  }
}
```

That's **13 knots × 6 values = 78 floating-point tokens** that Vector must generate *from a picture*.

---

## The 5 Fundamental Failure Modes

### 1. Token-Level Arithmetic Hallucination

LLMs generate numbers token by token. They don't compute `cos(π/2)` — they predict the most likely next token. When Vector needs to output `tangent: { x: 0, y: 1.5708 }` for the rightmost loop point, it's doing *pattern matching from training data*, not trigonometry.

**What happens:** Tangent vectors are approximately right in direction but wrong in magnitude. A tangent of `{x: 0, y: 1.0}` instead of `{x: 0, y: 1.5708}` means the spline curve overshoots or undershoots, producing an ellipse instead of a circle.

### 2. No Procedural Computation Layer

The `circleKnot()` function is **a computational primitive** — it guarantees that for any angle θ on a circle of radius R:
- The tangent is exactly perpendicular to the radius
- The second derivative points exactly inward (centripetal)
- The magnitudes are exactly scaled by `R·span` and `R·span²`

Vector has no access to this function. It can't call `circleKnot('loop1-right', {x:-2.5, y:1}, 1, 0)`. Instead, it must mentally perform the computation and serialize the result as tokens. **This is the single biggest failure mode.**

### 3. The Second Derivative Problem

> [!CAUTION]
> The second derivative is the most critical and most fragile parameter.

The quintic Hermite interpolation uses all three vectors (position, tangent, secondDerivative) to determine curve shape. For a circular arc, the second derivative must point **exactly inward toward the center** with magnitude `R·span²`.

Vector's system prompt only gives position examples for loop knots (lines 28-33 of agent.mjs):
```
1. Bottom Entry:  { id: 'loop-bottom-in',  position: { x: cx - 0.2, y: cy - R } }
2. Rightmost:     { id: 'loop-right',      position: { x: cx + R,   y: cy     } }
...
```

**No tangent or second derivative examples are given.** The schema requires them (`required: ['id', 'position', 'tangent', 'secondDerivative']`), but Vector has to guess. When it guesses wrong:
- The spline between knots isn't circular — it's a wobbly quintic curve
- The curvature varies unpredictably, causing the rider to detach or jitter
- The track visually looks "close" but physically breaks

### 4. Semantic → Coordinate Translation Without Intermediate Representation

When I built the track, my mental model was:

```
FRQ diagram → { "Loop 1: center=(-2.5, 1), R=1", "Loop 2: center=(3.5, 3), R=1" }
    → circleKnot() calls
    → exact coordinates
```

Vector's pipeline is:

```
FRQ image pixels → raw coordinate JSON
```

There's **no intermediate symbolic representation**. Vector can't say "I need a loop of radius 1 centered at (-2.5, 1)" and have the system compute the knots. It must go straight from visual interpretation to 78 numbers.

### 5. The AutoComplete Trap

The `autoCompleteSplineKnots()` function (line 144-163 of spline.js) computes fallback tangents and second derivatives when none are provided. It uses a simple finite-difference formula:

```javascript
autoTangent = (nextPos - prevPos) / 2    // Catmull-Rom style
autoSecondDeriv = prevPos + nextPos - 2·currentPos  // Central difference
```

But this is a **chord-based linear approximation** — it cannot reconstruct a circular arc from position data alone. For 5 knots around a circle, the auto-computed tangent at the rightmost point would be:

```
autoTangent = (topPos - bottomPos) / 2 = ((cx, cy+R) - (cx, cy-R)) / 2 = (0, R)
```

The correct tangent magnitude is `R·π/2 ≈ 1.5708R`, but auto gets `R = 1.0`. That's a **36% magnitude error**. The resulting spline won't be circular.

So even if Vector outputs only positions and relies on autoComplete, the geometry breaks. And if Vector outputs explicit tangents/secondDerivatives, it halluccinates the values.

**Vector is trapped between two bad options.**

---

## Side-By-Side Comparison: What Makes the Preset Perfect

| Aspect | Preset (circleKnot) | Vector (raw JSON) |
|--------|---------------------|-------------------|
| Position accuracy | Exact: `cx + R·cos(θ)` | ~Correct (positions are easy) |
| Tangent direction | Exact: perpendicular to radius | Approximately right |
| Tangent magnitude | Exact: `R·π/2` | Wrong — typically `1.0` or `2.0` |
| Second derivative direction | Exact: toward center | Often wrong or zero |
| Second derivative magnitude | Exact: `R·(π/2)²` | Almost always wrong |
| Circle fidelity | Perfect circle per span | Wobbly quintic approximation |
| Physics behavior | Smooth ride through both loops | Jitter, detachment, sticking |

---

## The Solution Architecture

The fix is **not** to make Vector better at arithmetic. It's to **give Vector the same computational primitives that I used**, expressed as a high-level feature language that the engine compiles into exact knots.

### What Vector Should Be Able to Output:

Instead of 78 raw floats, Vector should output a **feature description**:

```json
{
  "type": "add_spline_track",
  "track": {
    "features": [
      { "type": "release",  "position": { "x": -7.5, "y": 6.0 } },
      { "type": "loop",     "center": { "x": -2.5, "y": 1.0 }, "radius": 1.0 },
      { "type": "ramp",     "from": { "x": -2.3, "y": 0.0 }, "to": { "x": 3.3, "y": 2.0 } },
      { "type": "loop",     "center": { "x": 3.5, "y": 3.0 }, "radius": 1.0 },
      { "type": "runout",   "position": { "x": 7.5, "y": 2.0 } }
    ]
  }
}
```

**This is the semantic-to-coordinate translator that Vector is missing.** A feature compiler in the engine calls `circleKnot()` for loops, computes smooth transitions, and outputs the same analytically-exact knot arrays that the working preset uses.

### Why This Works:

1. **Vector only needs to output ~15 numbers** (feature positions, centers, radii) instead of 78
2. **All numbers are directly readable from the diagram** — heights, centers, radii
3. **The computational precision lives in the engine**, not in token generation
4. **The feature language maps 1:1 to how physics students think** — "a loop of radius R at this height"
5. **`circleKnot()` already exists** — we just need a compiler that calls it

---

## What This Means for the Hackathon

> [!IMPORTANT]  
> The fundamental insight: **Vector doesn't fail because it's dumb. It fails because we're asking it to be a calculator.** LLMs are semantic engines, not computational ones. The architecture must separate semantic understanding (what Vector is good at) from numerical computation (what code is good at).

The harness needs exactly one new component: a **Feature Compiler** that sits between Vector's JSON output and the spline engine. Vector describes *what* to build in physics terms. The compiler figures out *how* to build it with analytical precision.

This is the same pattern your friend described in the text: *"allow for the AI to have a larger workspace to code a better system that accurately represents the problem."* The "larger workspace" isn't more tokens or more reasoning — it's **computational tools that do the math for it**.
