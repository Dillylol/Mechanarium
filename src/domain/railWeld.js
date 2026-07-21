const endpointSign = (endpoint) => endpoint === 'start' ? -1 : endpoint === 'end' ? 1 : 0

export function splineEndpoint(track, endpoint) {
  if (track?.type !== 'spline' || !['start', 'end'].includes(endpoint)) return null
  const knot = endpoint === 'start' ? track.knots[0] : track.knots.at(-1)
  if (!knot) return null
  const length = Math.hypot(knot.tangent.x, knot.tangent.y)
  if (length < 1e-9) return null
  return {
    position: { ...knot.position },
    tangent: { x: knot.tangent.x / length, y: knot.tangent.y / length },
  }
}

export function alignBeamToSpline(beam, beamEndpoint, spline, splineEndpointName) {
  if (beam?.shape !== 'beam' || beam.mode !== 'track') return null
  const beamSign = endpointSign(beamEndpoint)
  const splineSign = endpointSign(splineEndpointName)
  const target = splineEndpoint(spline, splineEndpointName)
  if (!beamSign || !splineSign || !target) return null
  const directionSign = -splineSign / beamSign
  const tangent = { x: target.tangent.x * directionSign, y: target.tangent.y * directionSign }
  const normal = { x: -tangent.y, y: tangent.x }
  const angle = Math.atan2(tangent.y, tangent.x)
  const position = {
    x: target.position.x - tangent.x * beam.length / 2 * beamSign - normal.x * beam.thickness / 2,
    y: target.position.y - tangent.y * beam.length / 2 * beamSign - normal.y * beam.thickness / 2,
  }
  return {
    position,
    angle,
    join: {
      id: `rail-join-${beam.id}-${beamEndpoint}-${spline.id}-${splineEndpointName}`,
      a: { ownerId: beam.id, endpoint: beamEndpoint },
      b: { ownerId: spline.id, endpoint: splineEndpointName },
    },
  }
}

export function validateRailJoins(scenario) {
  const errors = []
  const owners = new Map([...scenario.bodies, ...scenario.tracks].map((owner) => [owner.id, owner]))
  const used = new Set()
  for (const join of scenario.railJoins ?? []) {
    if (!join?.id || !join.a || !join.b) {
      errors.push('Rail join requires an id and two endpoints.')
      continue
    }
    const a = owners.get(join.a.ownerId)
    const b = owners.get(join.b.ownerId)
    const validOwner = (owner) => owner?.type === 'spline' || owner?.type === 'segment' || owner?.shape === 'beam' && owner.mode === 'track'
    if (!validOwner(a) || !validOwner(b) || !['start', 'end'].includes(join.a.endpoint) || !['start', 'end'].includes(join.b.endpoint)) errors.push(`Rail join ${join.id} references an invalid rail endpoint.`)
    const keys = [`${join.a.ownerId}:${join.a.endpoint}`, `${join.b.ownerId}:${join.b.endpoint}`]
    for (const key of keys) {
      if (used.has(key)) errors.push(`Rail endpoint ${key} is already joined.`)
      used.add(key)
    }
  }
  return errors
}
