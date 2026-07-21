const msg = `Build a 1D momentum-collision lab for AP Physics 1 FRQ Q2 Version J. Do not solve yet—create the world only.

Setup:
- Horizontal track; friction ≈ 0; floor on if needed.
- Disk R (circle): mass m0=1 kg at x=0, v=+4 m/s (+x).
- Disk S (circle): mass 3m0=3 kg at rest to the right of R, same track so they collide.
- Given after collision: R has speed (1/2)v0 = 2 m/s in −x. Use that as the FRQ condition (set restitution so the collision matches if possible).
- Add a ruler along the track and a photogate assembly near the collision.

Then list knowns and Part B unknown (KE of S right after collision). Ask which part to investigate first.`

const scenario = {
  id: 'test', version: 4, name: 't',
  bodies: [{
    id: 'b1', name: 'Body', shape: 'circle', mass: 1, radius: 0.35, width: 0.7, height: 0.7,
    position: { x: 0, y: 1 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    angle: 0, angularVelocity: 0, angularAcceleration: 0, inertia: 0.06, restitution: 0.3,
    friction: 0.1, color: '#fff', locked: false, gravityEnabled: true, gravityMultiplier: 1,
  }],
  tracks: [], connectors: [], ports: [], joints: [], forces: [], instruments: [], constraints: [], railJoins: [],
  gravity: { enabled: true, g: 9.8, direction: { x: 0, y: -1 } },
  fixedStep: 0.008333, integrator: 'velocity-verlet',
  bounds: { minX: -20, maxX: 20, minY: -10, maxY: 20 }, duration: 30,
}

console.log('len', msg.length)
const res = await fetch('http://127.0.0.1:8787/api/agent', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:5173' },
  body: JSON.stringify({ message: msg, scenario, telemetry: {}, history: [] }),
})
console.log('status', res.status)
console.log((await res.text()).slice(0, 2000))
