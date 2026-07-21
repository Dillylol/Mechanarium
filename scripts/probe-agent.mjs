const scenario = {
  id: 'test',
  version: 4,
  name: 't',
  bodies: [{
    id: 'b1', name: 'Body', shape: 'circle', mass: 1, radius: 0.35, width: 0.7, height: 0.7,
    position: { x: 0, y: 1 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    angle: 0, angularVelocity: 0, angularAcceleration: 0, inertia: 0.06, restitution: 0.3,
    friction: 0.1, color: '#fff', locked: false, gravityEnabled: true, gravityMultiplier: 1,
  }],
  tracks: [], connectors: [], ports: [], joints: [], forces: [], instruments: [],
  constraints: [], railJoins: [],
  gravity: { enabled: true, g: 9.8, direction: { x: 0, y: -1 } },
  fixedStep: 0.008333, integrator: 'velocity-verlet',
  bounds: { minX: -20, maxX: 20, minY: -10, maxY: 20 }, duration: 30,
}

const res = await fetch('http://127.0.0.1:8787/api/agent', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:5173' },
  body: JSON.stringify({ message: 'add a sphere', scenario, telemetry: {}, history: [] }),
})
const text = await res.text()
console.log('status', res.status)
console.log(text.slice(0, 2000))
