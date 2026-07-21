# **Why Vector Fails: Architectural Analysis & The Fundamental Gap**
*An Investigation into Generative LLM Spline Synthesis vs. Procedural Compiler Architecture*

> **Key Thesis**: Large Language Models are semantic reasoning engines, not numerical calculators. Forcing an LLM to generate $78+$ raw floating-point knot derivatives introduces token-level arithmetic hallucinations, whereas procedural feature compilers guarantee $C^2$ physical accuracy.

---

## **The Core Thesis**

When requesting custom track geometry or double-loop roller coasters in Mechanarium, there are **two completely different pipelines** producing spline track definitions:

1. **Pipeline A (Procedural Preset Engine)**: Works flawlessly every time.
2. **Pipeline B (Direct Vector LLM JSON Generation)**: Frequently distorts, detaches riders, or fails.

The difference is not model intelligence — it is **architectural separation of concerns**. Vector is asked to perform an operation no LLM can reliably execute: generating $78+$ raw, interdependent floating-point numbers representing positions $\vec{x}$, tangents $\vec{p}'$, and second-derivative curvature vectors $\vec{p}''$ from an FRQ image or natural-language prompt in a single forward generation pass.

---

## **Pipeline A: How Procedural Presets Are Constructed**

When building analytical track geometry (such as the double-loop preset), the system performs a **two-stage translation**:

### Stage 1: Problem Semantics $\rightarrow$ Mathematical Model
The problem definition specifies symbolic parameters:
- Entry height: $h = 6R$
- Ground Loop 1: Radius $R$, centered at $(cx_1, R)$
- Elevated Loop 2: Radius $R$, mounted on a $2R$ platform, centered at $(cx_2, 3R)$
- Constraints: Captive friction-free rail, mass $M$

### Stage 2: Mathematical Model $\rightarrow$ Procedural Generator
Instead of hardcoding raw knot numbers, procedural functions compute analytical derivatives:

```javascript
// circleKnot computes EXACT analytical derivatives from the parametric circle
function circleKnot(id, center, radius, theta, span = Math.PI / 2) {
  return createSplineKnot({
    id,
    position: { 
      x: center.x + radius * Math.cos(theta),
      y: center.y + radius * Math.sin(theta) 
    },
    tangent: { 
      x: -radius * span * Math.sin(theta),
      y:  radius * span * Math.cos(theta) 
    },
    secondDerivative: { 
      x: -radius * span**2 * Math.cos(theta),
      y: -radius * span**2 * Math.sin(theta) 
    },
  })
}
```

For a loop knot at $\theta = 0$ (rightmost point), center $= (-2.5, 1.0)$, $R = 1.0$:

| Vector Field | Analytical Formula | Exact Value |
|---|---|---|
| `position.x` | $-2.5 + 1.0 \cdot \cos(0)$ | **$-1.5$** |
| `position.y` | $1.0 + 1.0 \cdot \sin(0)$ | **$1.0$** |
| `tangent.x` | $-1.0 \cdot \left(\frac{\pi}{2}\right) \cdot \sin(0)$ | **$0.0$** |
| `tangent.y` | $1.0 \cdot \left(\frac{\pi}{2}\right) \cdot \cos(0)$ | **$1.5708$** |
| `secondDerivative.x` | $-1.0 \cdot \left(\frac{\pi}{2}\right)^2 \cdot \cos(0)$ | **$-2.4674$** |
| `secondDerivative.y` | $-1.0 \cdot \left(\frac{\pi}{2}\right)^2 \cdot \sin(0)$ | **$0.0$** |

**Every value is derived via `Math.cos()` and `Math.sin()` in runtime JavaScript.** The quintic Hermite spline interpolator uses these exact derivative vectors to reconstruct a mathematically exact circular arc between knots.

---

## **Pipeline B: What Vector Is Currently Forced to Do**

Vector receives an image or text prompt and must emit a raw JSON payload containing every knot with all three vectors explicit:

```json
{
  "type": "add_spline_track",
  "track": {
    "knots": [
      { 
        "id": "k0", 
        "position": { "x": -7.5, "y": 6.0 },
        "tangent": { "x": 5.0, "y": -4.0 },
        "secondDerivative": { "x": 0.0, "y": 0.0 }
      },
      { 
        "id": "k1", 
        "position": { "x": -2.5, "y": 0.0 },
        "tangent": { "x": 1.5708, "y": 0.0 },
        "secondDerivative": { "x": 0.0, "y": 2.4674 }
      }
      // ... 11 additional knots, each requiring 6 floating-point values ...
    ]
  }
}
```

This forces the LLM to output **13 knots $\times$ 6 floating-point values = 78 interdependent floating-point tokens** in a single forward generation pass.

---

## **The 5 Fundamental Failure Modes**

### 1. Token-Level Arithmetic Hallucination
LLMs generate numbers token-by-token using probabilistic next-token prediction. They do not evaluate $\cos(\theta)$ or $\sin(\theta)$. When Vector outputs `tangent: { x: 0, y: 1.5708 }`, it is performing pattern matching from training data rather than evaluating derivative calculus. Minor token errors in tangent magnitudes cause severe spline distortion, producing flattened or bulged elliptical loops.

### 2. Lack of Procedural Computation Primitives
`circleKnot()` is a procedural primitive that guarantees:
- Tangents $\vec{p}'$ are strictly orthogonal to radial vectors $\vec{r}$.
- Second derivatives $\vec{p}''$ point directly inward (centripetal direction).
- Vector magnitudes scale precisely as $R \cdot \text{span}$ and $R \cdot \text{span}^2$.

Without primitive helper functions, Vector must mental-model derivative magnitudes and output them as serialized strings, leading to numerical drift.

### 3. The Second-Derivative Centripetal Requirement
Quintic Hermite splines require valid second-derivative vectors ($\vec{p}''$) to maintain $C^2$ curvature continuity. For a circular arc, $\vec{p}''$ must point **exactly inward toward the loop center** with magnitude $R \cdot \left(\frac{\pi}{2}\right)^2$. Incorrect second-derivative vectors introduce unexpected curvature spikes $\kappa(u)$, causing moving bodies to experience artificial normal-force spikes and detach from the track.

### 4. Direct Visual-to-Float Translation Without Intermediate Representations
Vector attempts to translate visual pixels directly to floating-point coordinates:

$$\text{FRQ Diagram Pixels} \longrightarrow \text{Raw Knot JSON (78 Floats)}$$

Proper architecture requires an intermediate symbolic representation:

$$\text{FRQ Diagram} \longrightarrow \text{Symbolic Spec (e.g., Loop at } c=(-2.5,1), R=1) \longrightarrow \text{Engine Compiler } (\texttt{circleKnot}) \longrightarrow \text{Exact Spline}$$

### 5. The Auto-Complete Trap
If Vector omits tangents and relies on `autoCompleteSplineKnots()`, the engine falls back to finite-difference chordal approximations:

$$\vec{t}_{\text{auto}} = \frac{\vec{p}_{i+1} - \vec{p}_{i-1}}{2}$$

For 5 knots distributed on a circle of radius $R = 1.0$:

$$\vec{t}_{\text{auto}} = \frac{(cx, cy+R) - (cx, cy-R)}{2} = (0, R) = (0, 1.0)$$

However, the analytically exact tangent magnitude is $R \cdot \frac{\pi}{2} \approx 1.5708R$. Using `autoCompleteSplineKnots()` introduces a **36% magnitude error**, deforming the circle into a pinched oval.

---

## **Comparative Summary: Preset vs. Raw LLM Generation**

| Geometric Property | Procedural Engine (`circleKnot`) | Direct LLM Output (Raw JSON) |
|---|---|---|
| **Knot Positions** | Exact: $cx + R\cos\theta$ | Approximately correct |
| **Tangent Direction** | Exact: $\perp$ to radial vector | Approximately correct |
| **Tangent Magnitude** | Exact: $R \cdot \frac{\pi}{2} \approx 1.5708 R$ | Incorrect (typically $1.0$ or $2.0$) |
| **Second Derivative Direction** | Exact: Centripetal (toward center) | Often zero or misaligned |
| **Second Derivative Magnitude** | Exact: $R \cdot \left(\frac{\pi}{2}\right)^2 \approx 2.4674 R$ | Almost always hallucinated |
| **Curvature Continuity** | Guaranteed $C^2$ continuity | Discontinuous / wobbly |
| **Physics Simulation** | Smooth ride through vertical loops | Jitter, detachment, or boundary sticking |

---

## **Solution Architecture: The Feature Compiler Pattern**

The solution is to equip Vector with **procedural compiler primitives**. Vector outputs a high-level semantic specification:

```json
{
  "type": "add_spline_track",
  "track": {
    "features": [
      { "type": "release", "position": { "x": -7.5, "y": 6.0 } },
      { "type": "loop",    "center": { "x": -2.5, "y": 1.0 }, "radius": 1.0 },
      { "type": "ramp",    "from": { "x": -2.3, "y": 0.0 }, "to": { "x": 3.3, "y": 2.0 } },
      { "type": "loop",    "center": { "x": 3.5, "y": 3.0 }, "radius": 1.0 },
      { "type": "runout",  "position": { "x": 7.5, "y": 2.0 } }
    ]
  }
}
```

### Why This Architecture Succeeds:
1. **Reduces Output Complexity**: Vector outputs $\sim 12$ high-level parameters instead of 78 floating-point numbers.
2. **Separates Reasoning from Computation**: LLM performs semantic parsing; deterministic JavaScript engine executes trigonometry.
3. **Guarantees $C^2$ Physics Accuracy**: The engine calls `circleKnot()` internally, ensuring analytical precision and zero rider detachment.
