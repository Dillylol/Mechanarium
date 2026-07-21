import { rulerReading } from '../domain/instruments.js'
import { bodyEnergy } from '../physics/metrics.js'

const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null
const vector = (value, unit) => ({ x: round(value?.x), y: round(value?.y), unit })
const scalar = (value, unit) => ({ value: round(value), unit })

function dimensions(entity) {
  if (entity.shape === 'box') return { width: scalar(entity.width, 'm'), height: scalar(entity.height, 'm') }
  if (entity.shape === 'beam') return { length: scalar(entity.length, 'm'), thickness: scalar(entity.thickness, 'm') }
  if (entity.shape === 'wheel') return { radius: scalar(entity.radius, 'm'), depth: scalar(entity.depth, 'm') }
  if (entity.radius !== undefined) return { radius: scalar(entity.radius, 'm') }
  if (entity.type === 'segment') return { length: scalar(entity.length, 'm'), thickness: scalar(entity.thickness, 'm') }
  if (entity.type === 'spline') return { knot_count: entity.knots?.length ?? 0, thickness: scalar(entity.thickness, 'm') }
  return {}
}

function describeBody(body) {
  return {
    id: body.id,
    name: body.name,
    kind: 'body',
    shape: body.shape,
    mode: body.mode ?? 'dynamic',
    locked: Boolean(body.locked),
    mass: scalar(body.mass, 'kg'),
    dimensions: dimensions(body),
    position: vector(body.position, 'm'),
    angle: scalar(body.angle, 'rad'),
  }
}

function describeTrack(track) {
  const geometry = track.type === 'spline'
    ? { knots: track.knots?.map((knot) => ({ id: knot.id, position: vector(knot.position, 'm') })) ?? [] }
    : { center: vector(track.center, 'm'), angle: scalar(track.angle, 'rad') }
  return {
    id: track.id,
    name: track.name,
    kind: 'track',
    type: track.type,
    dimensions: dimensions(track),
    friction_coefficient: round(track.friction),
    restitution: round(track.restitution),
    ...geometry,
  }
}

function describeEndpoint(endpoint) {
  return endpoint?.type === 'world'
    ? { type: 'world', position: vector(endpoint.position, 'm') }
    : { type: endpoint?.type, owner_id: endpoint?.ownerId, port_id: endpoint?.portId }
}

function describeForce(force) {
  return {
    id: force.id,
    name: force.name,
    kind: 'force',
    type: force.type,
    target_body_id: force.bodyId ?? null,
    vector: force.vector ? vector(force.vector, 'N') : null,
    center: force.center ? vector(force.center, 'm') : null,
    anchor: force.anchor ? vector(force.anchor, 'm') : null,
    strength: force.strength === undefined ? null : scalar(force.strength, 'm^3/s^2'),
    stiffness: force.stiffness === undefined ? null : scalar(force.stiffness, 'N/m'),
    rest_length: force.restLength === undefined ? null : scalar(force.restLength, 'm'),
    damping: force.damping === undefined ? null : scalar(force.damping, 'N*s/m'),
    drag_coefficient: force.coefficient === undefined ? null : scalar(force.coefficient, 'kg/m'),
  }
}

function describeConstraint(constraint) {
  return {
    id: constraint.id,
    name: constraint.name,
    kind: 'constraint',
    type: constraint.type,
    target_body_id: constraint.bodyId ?? null,
    height: constraint.y === undefined ? null : scalar(constraint.y, 'm'),
    friction_coefficient: round(constraint.friction),
    restitution: round(constraint.restitution),
  }
}

function latestInstrumentReadings(instrument, notebook) {
  if (instrument.type === 'ruler') {
    const reading = rulerReading(instrument)
    return {
      displacement: vector({ x: reading.dx, y: reading.dy }, 'm'),
      distance: scalar(reading.distance, 'm'),
      resolution: scalar(instrument.resolution, 'm'),
    }
  }
  const trials = notebook?.trials ?? []
  const events = trials.flatMap((trial) => trial.gateEvents ?? []).filter((event) => event.gateId === instrument.id)
  const results = trials.flatMap((trial) => trial.gateResults ?? []).filter((result) => result.fromGateId === instrument.id || result.toGateId === instrument.id)
  const event = events.at(-1)
  const result = results.at(-1)
  return {
    resolution: scalar(instrument.resolution, 's'),
    latest_event: event ? {
      body_id: event.bodyId,
      time: scalar(event.time, 's'),
      position: vector(event.position, 'm'),
      speed: scalar(event.speed, 'm/s'),
    } : null,
    latest_pair_result: result ? {
      interval: scalar(result.interval, 's'),
      spacing: scalar(result.spacing, 'm'),
      average_speed: scalar(result.averageSpeed, 'm/s'),
      acceleration: scalar(result.acceleration, 'm/s^2'),
    } : null,
  }
}

function bodyState(world, body) {
  const load = world.loadLedger?.get?.(body.id)
  const energy = bodyEnergy(body, world.gravity)
  return {
    evidence_kind: 'observation',
    kinematics: {
      position: vector(body.position, 'm'),
      velocity: vector(body.velocity, 'm/s'),
      speed: scalar(Math.hypot(body.velocity.x, body.velocity.y), 'm/s'),
      acceleration: vector(body.acceleration, 'm/s^2'),
      angle: scalar(body.angle, 'rad'),
      angular_velocity: scalar(body.angularVelocity, 'rad/s'),
      angular_acceleration: scalar(body.angularAcceleration, 'rad/s^2'),
    },
    forces: {
      net: vector(load?.netForce, 'N'),
      magnitude: scalar(load?.forceMagnitude ?? 0, 'N'),
      net_torque: scalar(load?.netTorque ?? 0, 'N*m'),
      components: load?.components?.map((component) => ({
        kind: component.kind,
        source_id: component.sourceId,
        force: vector(component.force, 'N'),
        application_point: vector(component.point, 'm'),
      })) ?? [],
    },
    energy: {
      evidence_kind: 'inference',
      translational_kinetic: scalar(energy.translational, 'J'),
      rotational_kinetic: scalar(energy.rotational, 'J'),
      gravitational_potential_about_y_0: scalar(energy.gravitational, 'J'),
      height_about_datum: scalar(energy.height, 'm'),
      mechanical: scalar(energy.mechanical, 'J'),
    },
    contact: {
      active: Boolean(body._contactLoads?.length || body._trackContact),
      loads: body._contactLoads?.map((contact) => ({ kind: contact.kind, source_id: contact.sourceId, force: vector(contact.force, 'N') })) ?? [],
      track: body._trackContact ? {
        track_id: body._trackContact.trackId,
        distance_along_track: scalar(body._trackContact.distance, 'm'),
        curvature: scalar(body._trackContact.curvature, '1/m'),
        gap: scalar(body._trackContact.gap, 'm'),
      } : null,
    },
  }
}

export function describeWorld({ scenario, world, selectedEntity, selectedBody, notebook } = {}) {
  if (!world) return null
  const selected = selectedEntity ?? selectedBody
  const selectedRuntimeBody = selected && world.bodies.find((body) => body.id === selected.id)
  const bodies = world.bodies.map(describeBody)
  const tracks = world.tracks.map(describeTrack)
  const instruments = world.instruments.map((instrument) => ({
    id: instrument.id,
    name: instrument.name,
    kind: 'instrument',
    type: instrument.type,
    geometry: instrument.type === 'ruler'
      ? { a: vector(instrument.a, 'm'), b: vector(instrument.b, 'm') }
      : { center: vector(instrument.center, 'm'), angle: scalar(instrument.angle, 'rad'), length: scalar(instrument.length, 'm'), target_body_id: instrument.targetBodyId, pair_id: instrument.pairId, pair_role: instrument.pairRole, nominal_spacing: scalar(instrument.nominalSpacing, 'm'), track_id: instrument.trackId, track_distance: scalar(instrument.trackDistance, 'm') },
    readings: latestInstrumentReadings(instrument, notebook),
  }))

  return {
    schema: 'vector-world-awareness-v1',
    evidence_note: 'Observation fields are supplied simulator state or measurements. Inference fields are quantities derived from that state.',
    world: {
      id: world.scenarioId,
      name: world.name,
      description: world.description,
      time: scalar(world.time, 's'),
      bounds: world.bounds ? {
        min_x: scalar(world.bounds.minX, 'm'), max_x: scalar(world.bounds.maxX, 'm'),
        min_y: scalar(world.bounds.minY, 'm'), max_y: scalar(world.bounds.maxY, 'm'),
      } : null,
      gravity: { enabled: Boolean(world.gravity?.enabled), magnitude: scalar(world.gravity?.g, 'm/s^2'), direction: vector(world.gravity?.direction, 'unit vector') },
    },
    entities: {
      bodies,
      tracks,
      forces: world.forces.map(describeForce),
      constraints: world.constraints.map(describeConstraint),
      connectors: world.connectors.map((connector) => ({
        id: connector.id, name: connector.name, kind: 'connector', type: connector.type,
        a: describeEndpoint(connector.a), b: describeEndpoint(connector.b),
        length: scalar(connector.length, 'm'), rest_length: scalar(connector.restLength, 'm'),
        stiffness: connector.stiffness === undefined ? null : scalar(connector.stiffness, 'N/m'),
        damping: connector.damping === undefined ? null : scalar(connector.damping, 'N*s/m'),
        tension: connector.tension === undefined ? null : scalar(connector.tension, 'N'),
      })),
      instruments,
    },
    topology: {
      ports: world.ports.map((port) => ({ id: port.id, owner_id: port.ownerId, name: port.name, kind: port.kind, local_position: vector(port.localPosition, 'm') })),
      joints: world.joints.map((joint) => ({ id: joint.id, type: joint.type, a: describeEndpoint(joint.a), b: describeEndpoint(joint.b) })),
      rail_joins: (world.railJoins ?? []).map((join) => ({ id: join.id, a: { owner_id: join.a.ownerId, endpoint: join.a.endpoint }, b: { owner_id: join.b.ownerId, endpoint: join.b.endpoint } })),
    },
    system_state: {
      evidence_kind: 'observation',
      energy: {
        translational_kinetic: scalar(world.metrics?.translationalKinetic, 'J'),
        rotational_kinetic: scalar(world.metrics?.rotationalKinetic, 'J'),
        potential: scalar(world.metrics?.potential, 'J'),
        total: scalar(world.metrics?.total, 'J'),
        conservation_error: scalar(world.energyError?.percent, '%'),
      },
      linear_momentum: vector(world.metrics?.linearMomentum, 'kg*m/s'),
      angular_momentum: scalar(world.metrics?.angularMomentum, 'kg*m^2/s'),
    },
    diagnostics: {
      evidence_kind: 'inference',
      messages: [...(world.diagnostics ?? [])],
      status: world.diagnostics?.length ? 'attention' : 'clear',
    },
    selected: selected ? {
      id: selected.id,
      name: selected.name,
      kind: selectedRuntimeBody ? 'body' : selected.type ?? selected.shape ?? 'entity',
      ...(selectedRuntimeBody ? bodyState(world, selectedRuntimeBody) : { evidence_kind: 'observation' }),
    } : null,
    scenario_version: scenario?.version ?? null,
  }
}

function formatScalar(value) {
  return value?.value === null || value?.value === undefined ? 'unavailable' : `${value.value} ${value.unit}`
}

export function formatWorldDescription(description, { detailed = false, selectedOnly = false } = {}) {
  if (!description) return 'Observation: Current world telemetry is unavailable. Inference: I cannot safely describe the apparatus without it.'
  const selected = description.selected
  if (selectedOnly && selected) {
    if (!selected.kinematics) return `Observation: ${selected.name} (${selected.id}) is selected, but it has no body kinematics. Inference: no motion claim is available.`
    const k = selected.kinematics
    const forceKinds = selected.forces.components.map((force) => `${force.kind} from ${force.source_id}`).join(', ') || 'none'
    const contact = selected.contact.active ? `active (${selected.contact.loads.map((load) => load.source_id).join(', ') || selected.contact.track?.track_id || 'unspecified source'})` : 'not active'
    return `Observation — selected body: ${selected.name} (${selected.id}); position (${k.position.x}, ${k.position.y}) m; velocity (${k.velocity.x}, ${k.velocity.y}) m/s; acceleration (${k.acceleration.x}, ${k.acceleration.y}) m/s²; net force (${selected.forces.net.x}, ${selected.forces.net.y}) N; force components: ${forceKinds}; contact: ${contact}. Inference — translational kinetic energy ${formatScalar(selected.energy.translational_kinetic)}, rotational kinetic energy ${formatScalar(selected.energy.rotational_kinetic)}, gravitational potential about y=0 ${formatScalar(selected.energy.gravitational_potential_about_y_0)}.`
  }
  const counts = description.entities
  const summary = `Observation — world: ${description.world.name} at ${formatScalar(description.world.time)}; ${counts.bodies.length} bodies, ${counts.tracks.length} tracks, ${counts.connectors.length} connectors, ${description.topology.joints.length} joints, ${counts.instruments.length} instruments. Gravity is ${description.world.gravity.enabled ? `on at ${formatScalar(description.world.gravity.magnitude)}` : 'off'}.`
  if (!detailed) {
    const selectedText = selected ? ` Selected: ${selected.name} (${selected.id}).` : ''
    return `${summary}${selectedText} Inference — diagnostics are ${description.diagnostics.status}; total energy is ${formatScalar(description.system_state.energy.total)} with ${formatScalar(description.system_state.energy.conservation_error)} conservation error.`
  }
  const bodyLines = counts.bodies.map((body) => {
    const dims = Object.entries(body.dimensions).map(([key, value]) => `${key} ${formatScalar(value)}`).join(', ')
    return `${body.name} [${body.id}], ${body.shape}, mass ${formatScalar(body.mass)}, ${dims}, position (${body.position.x}, ${body.position.y}) m`
  })
  const trackLines = counts.tracks.map((track) => `${track.name} [${track.id}], ${track.type}, ${Object.entries(track.dimensions).map(([key, value]) => typeof value === 'number' ? `${key} ${value}` : `${key} ${formatScalar(value)}`).join(', ')}`)
  const connectorLines = counts.connectors.map((connector) => `${connector.name} [${connector.id}] connects ${connector.a.port_id ?? 'world'} to ${connector.b.port_id ?? 'world'}; length ${formatScalar(connector.length)}`)
  const forceLines = counts.forces.map((force) => `${force.name ?? force.type} [${force.id}], ${force.type}${force.target_body_id ? ` on ${force.target_body_id}` : ''}`)
  const constraintLines = counts.constraints.map((constraint) => `${constraint.name ?? constraint.type} [${constraint.id}], ${constraint.type}${constraint.height ? ` at ${formatScalar(constraint.height)}` : ''}`)
  const instrumentLines = counts.instruments.map((instrument) => instrument.type === 'ruler'
    ? `${instrument.name} [${instrument.id}] reads ${formatScalar(instrument.readings.distance)}`
    : `${instrument.name} [${instrument.id}] latest event ${instrument.readings.latest_event ? formatScalar(instrument.readings.latest_event.time) : 'none'}`)
  const topology = [
    ...description.topology.joints.map((joint) => `${joint.id}: ${joint.a.port_id ?? 'world'} ↔ ${joint.b.port_id ?? 'world'} (${joint.type})`),
    ...description.topology.rail_joins.map((join) => `${join.id}: ${join.a.owner_id}:${join.a.endpoint} ↔ ${join.b.owner_id}:${join.b.endpoint} (continuous rail)`),
  ]
  const selectedText = selected ? `\nSelected: ${formatWorldDescription(description, { selectedOnly: true })}` : ''
  return `${summary}\nEntities:\n- ${[...bodyLines, ...trackLines, ...connectorLines, ...forceLines, ...constraintLines, ...instrumentLines].join('\n- ') || 'none'}\nTopology:\n- ${topology.join('\n- ') || 'no joints'}\nInference — diagnostics: ${description.diagnostics.messages.join('; ') || 'none'}; system energy: kinetic ${formatScalar(description.system_state.energy.translational_kinetic)}, rotational ${formatScalar(description.system_state.energy.rotational_kinetic)}, potential ${formatScalar(description.system_state.energy.potential)}, total ${formatScalar(description.system_state.energy.total)}; conservation error ${formatScalar(description.system_state.energy.conservation_error)}.${selectedText}`
}
