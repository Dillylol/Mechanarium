import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { beamInertia, createBody, createConnector, createTrack, fitAutoLengthBeams, validateScenario } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { createFixedStepClock } from '../physics/clock.js'
import { connectorState, resolveEndpoint, resolvePort } from '../physics/assembly.js'
import { magnitude } from '../physics/vector.js'
import { createWorld, stepWorld, worldToScenario } from '../physics/world.js'

const HISTORY_LIMIT = 480
const UI_PUBLISH_INTERVAL_MS = 1000 / 30
const nextId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function sampleWorld(world, bodyId) {
  const body = world.bodies.find((candidate) => candidate.id === bodyId) ?? world.bodies[0]
  if (!body) return null
  const connector = world.connectors[0] ? connectorState(world, world.connectors[0]) : null
  return {
    time: world.time, body: body.name, bodyId: body.id,
    x: body.position.x, y: body.position.y,
    vx: body.velocity.x, vy: body.velocity.y,
    ax: body.acceleration.x, ay: body.acceleration.y,
    speed: magnitude(body.velocity),
    angle: body.angle, angularVelocity: body.angularVelocity,
    torque: (body.angularAcceleration ?? 0) * (body.assemblyInertia ?? body.inertia),
    inertia: body.inertia,
    assemblyInertia: body.assemblyInertia ?? body.inertia,
    connectorLength: connector?.length ?? '', connectorTension: connector?.tension ?? '', connectorExtension: connector?.extension ?? '', connectorElasticEnergy: connector?.elasticEnergy ?? '',
    kinetic: world.metrics.translationalKinetic + world.metrics.rotationalKinetic,
    potential: world.metrics.potential, totalEnergy: world.metrics.total,
    energyError: world.energyError.percent,
  }
}

export function useSimulation(initialPreset = 'projectile-motion') {
  const initial = getPreset(initialPreset)
  const [sourceScenario, setSourceScenario] = useState(initial)
  const [world, setWorld] = useState(() => createWorld(initial))
  const [selectedId, setSelectedId] = useState(initial.bodies[0].id)
  const [connectionPortId, setConnectionPortId] = useState(null)
  const [running, setRunningState] = useState(false)
  const [runError, setRunError] = useState('')
  const [speed, setSpeed] = useState(1)
  const [history, setHistory] = useState([])
  const worldRef = useRef(world)
  const selectedRef = useRef(selectedId)
  const clockRef = useRef(createFixedStepClock({ fixedStep: world.fixedStep }))

  useEffect(() => { worldRef.current = world }, [world])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const record = useCallback((nextWorld) => {
    const sample = sampleWorld(nextWorld, selectedRef.current)
    if (sample) setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), sample])
  }, [])

  useEffect(() => {
    if (!running) return undefined
    let frameId
    let previous
    let lastPublished
    const frame = (now) => {
      if (previous === undefined) { previous = now; lastPublished = now; frameId = requestAnimationFrame(frame); return }
      const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1) * speed
      previous = now
      let next = worldRef.current
      clockRef.current.advance(elapsed, (dt) => { next = stepWorld(next, dt) })
      worldRef.current = next
      if (now - lastPublished >= UI_PUBLISH_INTERVAL_MS || next.time >= next.duration) {
        lastPublished = now; setWorld(next); record(next)
      }
      if (next.time >= next.duration) setRunningState(false)
      else frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [record, running, speed])

  const replaceScenario = useCallback((input) => {
    const result = validateScenario(input)
    if (!result.valid) throw new TypeError(result.errors.join(' '))
    const scenario = result.scenario
    const nextWorld = createWorld(scenario)
    setSourceScenario(structuredClone(scenario))
    setWorld(nextWorld); worldRef.current = nextWorld
    clockRef.current = createFixedStepClock({ fixedStep: nextWorld.fixedStep })
    setSelectedId(nextWorld.bodies[0].id)
    setConnectionPortId(null)
    setHistory([]); setRunningState(false); setRunError('')
  }, [])

  const setRunning = useCallback((value) => {
    const next = typeof value === 'function' ? value(running) : value
    if (next && worldRef.current.diagnostics.length) {
      setRunError(worldRef.current.diagnostics.join(' ')); setRunningState(false); return false
    }
    setRunError(''); setRunningState(next); return true
  }, [running])

  const loadPreset = useCallback((id) => replaceScenario(getPreset(id)), [replaceScenario])
  const reset = useCallback(() => replaceScenario(sourceScenario), [replaceScenario, sourceScenario])
  const stepOnce = useCallback(() => {
    setRunningState(false)
    if (worldRef.current.diagnostics.length) { setRunError(worldRef.current.diagnostics.join(' ')); return }
    const next = stepWorld(worldRef.current)
    worldRef.current = next; setWorld(next); record(next)
  }, [record])

  const commitScenarioEdit = useCallback((edit) => {
    const scenario = worldToScenario(worldRef.current)
    edit(scenario)
    fitAutoLengthBeams(scenario)
    replaceScenario(scenario)
  }, [replaceScenario])

  const updateBody = useCallback((bodyId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.map((body) => {
        if (body.id !== bodyId) return body
        const next = { ...body, ...changes }
        if (body.shape === 'beam' && ('length' in changes || 'mass' in changes)) next.inertia = beamInertia(next.mass, next.length)
        return next
      })
      const body = scenario.bodies.find((candidate) => candidate.id === bodyId)
      if (body?.shape === 'beam' && changes.mode === 'pinned' && !scenario.joints.some((joint) => joint.autoPinFor === bodyId)) {
        const tangent = { x: Math.cos(body.angle), y: Math.sin(body.angle) }
        scenario.joints.push({ id: nextId('pin'), type: 'pin', autoPinFor: bodyId, a: { type: 'world', position: { x: body.position.x - tangent.x * body.length / 2, y: body.position.y - tangent.y * body.length / 2 } }, b: { type: 'port', ownerId: bodyId, portId: `${bodyId}:start` } })
      }
      if (body?.shape === 'beam' && changes.mode && changes.mode !== 'pinned') scenario.joints = scenario.joints.filter((joint) => joint.autoPinFor !== bodyId)
    })
    setSelectedId(bodyId)
  }, [commitScenarioEdit])

  const updatePort = useCallback((portId, changes) => {
    commitScenarioEdit((scenario) => { scenario.ports = scenario.ports.map((port) => port.id === portId ? { ...port, ...changes } : port) })
    setSelectedId(portId)
  }, [commitScenarioEdit])

  const pinPortToWorld = useCallback((portId) => {
    const resolved = resolvePort(worldRef.current, portId)
    if (!resolved) return
    commitScenarioEdit((scenario) => { scenario.joints.push({ id: nextId('pin'), type: 'pin', a: { type: 'world', position: { x: resolved.x, y: resolved.y } }, b: { type: 'port', ownerId: resolved.port.ownerId, portId } }) })
  }, [commitScenarioEdit])

  const connectPort = useCallback((portId, type) => {
    if (!connectionPortId) { setConnectionPortId(portId); return }
    if (!type || connectionPortId === portId) { setConnectionPortId(null); return }
    const first = worldRef.current.portIndex.get(connectionPortId)
    const second = worldRef.current.portIndex.get(portId)
    if (!first || !second || first.ownerId === second.ownerId) throw new TypeError('Choose ports on two different entities.')
    commitScenarioEdit((scenario) => { scenario.joints.push({ id: nextId(type), type, a: { type: 'port', ownerId: first.ownerId, portId: first.id }, b: { type: 'port', ownerId: second.ownerId, portId: second.id } }) })
    setConnectionPortId(null)
  }, [commitScenarioEdit, connectionPortId])

  const updateTrack = useCallback((trackId, changes) => {
    commitScenarioEdit((scenario) => { scenario.tracks = scenario.tracks.map((track) => track.id === trackId ? { ...track, ...changes } : track) })
    setSelectedId(trackId)
  }, [commitScenarioEdit])

  const updateConnector = useCallback((connectorId, changes) => {
    commitScenarioEdit((scenario) => { scenario.connectors = scenario.connectors.map((connector) => connector.id === connectorId ? { ...connector, ...changes } : connector) })
    setSelectedId(connectorId)
  }, [commitScenarioEdit])

  const moveConnectorEndpoint = useCallback((connectorId, key, position, snap = true, snapRadius = 0.45) => {
    const nearest = snap ? worldRef.current.ports.map((port) => ({ port, resolved: resolvePort(worldRef.current, port.id) })).filter((item) => item.resolved).map((item) => ({ ...item, distance: Math.hypot(item.resolved.x - position.x, item.resolved.y - position.y) })).sort((a, b) => a.distance - b.distance)[0] : null
    const endpoint = nearest && nearest.distance <= snapRadius ? { type: 'port', ownerId: nearest.port.ownerId, portId: nearest.port.id } : { type: 'world', position }
    updateConnector(connectorId, { [key]: endpoint })
  }, [updateConnector])

  const disconnectConnector = useCallback((connectorId) => {
    const connector = worldRef.current.connectors.find((candidate) => candidate.id === connectorId)
    if (!connector) return
    const a = resolveEndpoint(worldRef.current, connector.a)?.position
    const b = resolveEndpoint(worldRef.current, connector.b)?.position
    if (a && b) updateConnector(connectorId, { a: { type: 'world', position: { x: a.x, y: a.y } }, b: { type: 'world', position: { x: b.x, y: b.y } } })
  }, [updateConnector])

  const updateGravity = useCallback((changes) => commitScenarioEdit((scenario) => { scenario.gravity = { ...scenario.gravity, ...changes } }), [commitScenarioEdit])
  const updateConstraint = useCallback((id, changes) => commitScenarioEdit((scenario) => { scenario.constraints = scenario.constraints.map((item) => item.id === id ? { ...item, ...changes } : item) }), [commitScenarioEdit])
  const updateForce = useCallback((id, changes) => commitScenarioEdit((scenario) => { scenario.forces = scenario.forces.map((item) => item.id === id ? { ...item, ...changes } : item) }), [commitScenarioEdit])
  const removeForce = useCallback((id) => commitScenarioEdit((scenario) => { scenario.forces = scenario.forces.filter((item) => item.id !== id) }), [commitScenarioEdit])
  const removeConstraint = useCallback((id) => commitScenarioEdit((scenario) => { scenario.constraints = scenario.constraints.filter((item) => item.id !== id) }), [commitScenarioEdit])

  const removeEntity = useCallback((id) => {
    if (worldRef.current.bodies.length <= 1 && worldRef.current.bodies.some((body) => body.id === id)) return
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.filter((body) => body.id !== id)
      scenario.tracks = scenario.tracks.filter((track) => track.id !== id)
      scenario.connectors = scenario.connectors.filter((connector) => connector.id !== id && connector.a.ownerId !== id && connector.b.ownerId !== id && connector.a.portId !== id && connector.b.portId !== id)
      scenario.ports = scenario.ports.filter((port) => port.ownerId !== id && port.id !== id)
      scenario.joints = scenario.joints.filter((joint) => joint.id !== id && joint.a.ownerId !== id && joint.b.ownerId !== id && joint.a.portId !== id && joint.b.portId !== id)
      scenario.forces = scenario.forces.filter((force) => force.bodyId !== id)
    })
  }, [commitScenarioEdit])

  const addElement = useCallback((target) => {
    const id = nextId(target)
    commitScenarioEdit((scenario) => {
      if (target === 'sphere' || target === 'box') {
        const isBox = target === 'box'
        scenario.bodies.push(createBody({ id, name: isBox ? 'Block' : 'Sphere', shape: target === 'box' ? 'box' : 'circle', radius: isBox ? 0.55 : 0.42, width: 1.1, height: 1.1, position: { x: 0, y: 2.5 }, color: isBox ? '#111111' : '#f2cf00' }))
      } else if (target === 'beam') {
        scenario.bodies.push(createBody({ id, name: 'Beam', shape: 'beam', mode: 'dynamic', mass: 1.5, length: 3.5, position: { x: 0, y: 2.5 } }))
      } else if (target === 'ramp') {
        scenario.tracks.push(createTrack({ id, center: { x: 0, y: 0 }, angle: Math.PI / 9, length: 6 }))
      } else if (target === 'spring' || target === 'rope') {
        const body = scenario.bodies.find((candidate) => candidate.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.connectors.push(createConnector(target, { id, a: { type: 'world', position: { x: body.position.x - 2.5, y: body.position.y + 1 } }, b: { type: 'port', ownerId: body.id, portId: `${body.id}:center` }, length: 2.5, restLength: 2.5 }))
      } else if (target === 'attachment') {
        const owner = [...scenario.bodies, ...scenario.tracks].find((candidate) => candidate.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.ports.push({ id, ownerId: owner.id, name: `Port ${scenario.ports.length + 1}`, kind: 'custom', custom: true, localPosition: { x: 0, y: 0.5 } })
      } else if (target === 'gravity') {
        scenario.gravity.enabled = !scenario.gravity.enabled
      } else if (target === 'floor') {
        const existing = scenario.constraints.find((constraint) => constraint.type === 'ground')
        scenario.constraints = existing ? scenario.constraints.filter((constraint) => constraint.id !== existing.id) : [...scenario.constraints, { id, type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 }]
      } else if (target === 'attractor') {
        const body = scenario.bodies.find((candidate) => candidate.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.forces.push({ id, type: 'central', bodyId: body.id, center: { x: 0, y: 0 }, strength: 19.36, softening: 0.05 })
        body.gravityEnabled = false
      }
    })
    if (!['gravity', 'floor'].includes(target)) setSelectedId(id)
  }, [commitScenarioEdit])

  const moveEntity = useCallback((id, position, snapRadius = 0.45) => {
    if (worldRef.current.bodies.some((body) => body.id === id)) updateBody(id, { position, velocity: { x: 0, y: 0 } })
    else {
      const track = worldRef.current.tracks.find((candidate) => candidate.id === id)
      if (!track) return
      const tangent = { x: Math.cos(track.angle), y: Math.sin(track.angle) }
      const endpoints = [-1, 1].map((sign) => ({ x: position.x + tangent.x * track.length / 2 * sign, y: position.y + tangent.y * track.length / 2 * sign }))
      const targets = worldRef.current.tracks.filter((candidate) => candidate.id !== id).flatMap((candidate) => {
        const direction = { x: Math.cos(candidate.angle), y: Math.sin(candidate.angle) }
        return [-1, 1].map((sign) => ({ x: candidate.center.x + direction.x * candidate.length / 2 * sign, y: candidate.center.y + direction.y * candidate.length / 2 * sign }))
      })
      let snapped = position
      let best = snapRadius
      for (const endpoint of endpoints) for (const target of targets) {
        const distance = Math.hypot(endpoint.x - target.x, endpoint.y - target.y)
        if (distance < best) { best = distance; snapped = { x: position.x + target.x - endpoint.x, y: position.y + target.y - endpoint.y } }
      }
      updateTrack(id, { center: snapped })
    }
  }, [updateBody, updateTrack])

  const placeBodyAtStart = useCallback((trackId, bodyId = selectedRef.current) => {
    const track = worldRef.current.tracks.find((candidate) => candidate.id === trackId)
    const body = worldRef.current.bodies.find((candidate) => candidate.id === bodyId) ?? worldRef.current.bodies.find((candidate) => candidate.shape !== 'beam')
    if (!track || !body) return
    const sign = track.startEnd === 'end' ? 1 : -1
    const tangent = { x: Math.cos(track.angle), y: Math.sin(track.angle) }
    const normal = { x: -tangent.y, y: tangent.x }
    updateBody(body.id, { position: { x: track.center.x + tangent.x * track.length / 2 * sign + normal.x * (track.thickness / 2 + body.radius), y: track.center.y + tangent.y * track.length / 2 * sign + normal.y * (track.thickness / 2 + body.radius) }, velocity: { x: 0, y: 0 } })
  }, [updateBody])

  const prepareOrbit = useCallback((forceId) => commitScenarioEdit((scenario) => {
    const force = scenario.forces.find((candidate) => candidate.id === forceId && candidate.type === 'central')
    const body = force && scenario.bodies.find((candidate) => candidate.id === force.bodyId)
    if (!force || !body) return
    const dx = body.position.x - force.center.x; const dy = body.position.y - force.center.y
    const radius = Math.max(0.5, Math.hypot(dx, dy)); const speedValue = Math.sqrt(force.strength / radius)
    body.velocity = { x: (-dy / radius) * speedValue, y: (dx / radius) * speedValue }; body.gravityEnabled = false
    scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground')
  }), [commitScenarioEdit])

  const applyActions = useCallback((actions) => {
    const preset = actions.find((action) => action.type === 'load_preset')
    if (preset) { loadPreset(preset.target); return }
    actions.forEach((action) => {
      if (action.type === 'add_body') addElement(action.target)
      if (action.type === 'add_track' || action.type === 'add_constraint' && action.target === 'ramp') addElement('ramp')
      if (action.type === 'add_beam') addElement('beam')
      if (action.type === 'add_connector' || action.type === 'add_force' && ['spring', 'rope'].includes(action.target)) addElement(action.target)
      if (action.type === 'add_port') addElement('attachment')
      if (action.type === 'add_joint') {
        if (!action.entityId || !action.portId || !action.otherEntityId || !action.otherPortId || !['rigid', 'pin'].includes(action.target)) throw new TypeError('A joint action requires two exact entity/port references and a rigid or pin type.')
        commitScenarioEdit((scenario) => { scenario.joints.push({ id: nextId(action.target), type: action.target, a: { type: 'port', ownerId: action.entityId, portId: action.portId }, b: { type: 'port', ownerId: action.otherEntityId, portId: action.otherPortId } }) })
      }
      if (action.type === 'connect_endpoint') {
        if (!action.entityId || !['a', 'b'].includes(action.endpoint) || !action.otherEntityId || !action.otherPortId) throw new TypeError('A connector action requires an exact connector, endpoint, owner, and port.')
        updateConnector(action.entityId, { [action.endpoint]: { type: 'port', ownerId: action.otherEntityId, portId: action.otherPortId } })
      }
      if (action.target === 'floor') addElement('floor')
      if (action.target === 'gravity') updateGravity({ enabled: !['remove_force', 'disable_gravity'].includes(action.type), g: action.value ?? worldRef.current.gravity.g })
      if (action.type === 'add_force' && action.target === 'central') addElement('attractor')
    })
  }, [addElement, commitScenarioEdit, loadPreset, updateConnector, updateGravity])

  const selectedBody = useMemo(() => world.bodies.find((body) => body.id === selectedId) ?? world.bodies[0], [selectedId, world.bodies])
  const selectedEntity = useMemo(() => world.bodies.find((item) => item.id === selectedId) ?? world.tracks.find((item) => item.id === selectedId) ?? world.connectors.find((item) => item.id === selectedId) ?? world.ports.find((item) => item.id === selectedId) ?? selectedBody, [selectedBody, selectedId, world.bodies, world.connectors, world.ports, world.tracks])
  const selectedConnectorState = useMemo(() => selectedEntity?.a ? connectorState(world, selectedEntity) : null, [selectedEntity, world])

  return {
    world, scenario: worldToScenario(world), selectedBody, selectedEntity, selectedConnectorState, selectedId, setSelectedId, connectionPortId,
    running, setRunning, runError, speed, setSpeed, history, loadPreset, replaceScenario, reset, stepOnce,
    updateBody, updateTrack, updateConnector, moveConnectorEndpoint, disconnectConnector, updatePort, pinPortToWorld, connectPort, updateGravity, updateForce, removeForce, updateConstraint, removeConstraint,
    addElement, applyActions, removeBody: removeEntity, removeEntity, moveEntity, moveConstraint: moveEntity, placeBodyAtStart, prepareOrbit,
  }
}
