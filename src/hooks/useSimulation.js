import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { beamInertia, createBody, createConnector, createSplineTrack, createTrack, createWheel, fitAutoLengthBeams, validateScenario, wheelInertia } from '../domain/scenario.js'
import { sampleSpline, splinePointAtDistance } from '../domain/spline.js'
import { createInstrument, deriveGateResults, detectPhotogateCrossings, sampleTrialWorld } from '../domain/instruments.js'
import { getPreset } from '../domain/presets.js'
import { alignBeamToSpline } from '../domain/railWeld.js'
import { createFixedStepClock } from '../physics/clock.js'
import { bodyLoadState, connectorState, resolveEndpoint, resolvePort, wheelCenterMount } from '../physics/assembly.js'
import { bodyEnergy } from '../physics/metrics.js'
import { magnitude } from '../physics/vector.js'
import { createWorld, stepWorld, worldToScenario } from '../physics/world.js'
import { snapToGrid } from '../domain/gridSnap.js'

const HISTORY_LIMIT = 4800
const UI_PUBLISH_INTERVAL_MS = 1000 / 30
const MAX_TRIAL_SAMPLES = 120000
const nextId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const notebookKey = (scenarioId) => `mechanarium:notebook:${scenarioId}`
const emptyNotebook = (scenarioId) => ({ version: 1, scenarioId, trials: [] })
const loadNotebook = (scenarioId) => {
  try {
    const stored = localStorage.getItem(notebookKey(scenarioId))
    const parsed = stored && JSON.parse(stored)
    return parsed?.version === 1 && Array.isArray(parsed.trials) ? parsed : emptyNotebook(scenarioId)
  } catch {
    return emptyNotebook(scenarioId)
  }
}

function portLabel(world, port) {
  const owner = [...world.bodies, ...world.tracks].find((candidate) => candidate.id === port.ownerId)
  return `${owner?.name ?? port.ownerId} · ${port.name}`
}

function nearestPort(world, position, radius, predicate = () => true) {
  return world.ports
    .filter(predicate)
    .map((port) => ({ port, resolved: resolvePort(world, port.id) }))
    .filter((candidate) => candidate.resolved)
    .map((candidate) => ({ ...candidate, distance: Math.hypot(candidate.resolved.x - position.x, candidate.resolved.y - position.y) }))
    .filter((candidate) => candidate.distance <= radius)
    .sort((a, b) => a.distance - b.distance)[0] ?? null
}

function rotateLocal(position, angle) {
  return {
    x: position.x * Math.cos(angle) - position.y * Math.sin(angle),
    y: position.x * Math.sin(angle) + position.y * Math.cos(angle),
  }
}

function findBodySnapCandidate(world, bodyId, position, radius) {
  const body = world.bodies.find((candidate) => candidate.id === bodyId)
  if (!body) return null
  const sourcePorts = world.ports.filter((port) => port.ownerId === bodyId)
  const targetPorts = world.ports.filter((port) => port.ownerId !== bodyId)
  let best = null
  for (const sourcePort of sourcePorts) {
    const offset = rotateLocal(sourcePort.localPosition, body.angle ?? 0)
    const sourcePosition = { x: position.x + offset.x, y: position.y + offset.y }
    for (const targetPort of targetPorts) {
      const target = resolvePort(world, targetPort.id)
      if (!target) continue
      const distance = Math.hypot(target.x - sourcePosition.x, target.y - sourcePosition.y)
      if (distance > radius || best && distance >= best.distance) continue
      const targetOwner = world.tracks.find((track) => track.id === targetPort.ownerId)
      const beamEndpoint = sourcePort.id.endsWith(':start') ? 'start' : sourcePort.id.endsWith(':end') ? 'end' : null
      const splineEndpointName = targetPort.id.endsWith(':start') ? 'start' : targetPort.id.endsWith(':end') ? 'end' : null
      const railAlignment = body.shape === 'beam' && body.mode === 'track' && targetOwner?.type === 'spline' && beamEndpoint && splineEndpointName
        ? alignBeamToSpline({ ...body, position }, beamEndpoint, targetOwner, splineEndpointName)
        : null
      best = {
        bodyId, sourcePort, targetPort, distance,
        alignedPosition: railAlignment?.position ?? { x: position.x + target.x - sourcePosition.x, y: position.y + target.y - sourcePosition.y },
        alignedAngle: railAlignment?.angle,
        railJoin: railAlignment?.join,
      }
    }
  }
  if (!best) return null
  return {
    ...best,
    sourcePortId: best.sourcePort.id,
    targetPortId: best.targetPort.id,
    sourceLabel: portLabel(world, best.sourcePort),
    targetLabel: portLabel(world, best.targetPort),
  }
}

function sampleWorld(world, bodyId) {
  const body = world.bodies.find((candidate) => candidate.id === bodyId) ?? world.bodies[0]
  if (!body) return null
  const routedConnector = world.connectors.find((candidate) => candidate.route?.wheelId === body.id)
  const connector = routedConnector ? connectorState(world, routedConnector) : world.connectors[0] ? connectorState(world, world.connectors[0]) : null
  const loads = bodyLoadState(world, body.id)
  const energy = bodyEnergy(body, world.gravity)
  const componentMagnitude = (kind) => (loads.components ?? []).filter((component) => component.kind === kind).reduce((sum, component) => sum + Math.hypot(component.force.x, component.force.y), 0)
  const axle = (loads.components ?? []).find((component) => component.kind === 'axle-reaction')?.force ?? { x: 0, y: 0 }
  return {
    time: world.time, body: body.name, bodyId: body.id,
    x: body.position.x, y: body.position.y,
    vx: body.velocity.x, vy: body.velocity.y,
    ax: body.acceleration.x, ay: body.acceleration.y,
    speed: magnitude(body.velocity),
    angle: body.angle, angularVelocity: body.angularVelocity,
    angularAcceleration: body.angularAcceleration,
    torque: loads.netTorque,
    netTorque: loads.netTorque,
    netForce: loads.forceMagnitude,
    netForceX: loads.netForce.x,
    netForceY: loads.netForce.y,
    linearMomentum: body.mass * magnitude(body.velocity),
    impulse: body._initialVelocity ? body.mass * magnitude({ x: body.velocity.x - body._initialVelocity.x, y: body.velocity.y - body._initialVelocity.y }) : 0,
    slipError: loads.slipError ?? 0,
    tensionA: loads.tensionA ?? connector?.tensionA ?? '',
    tensionB: loads.tensionB ?? connector?.tensionB ?? '',
    axleReactionX: axle.x,
    axleReactionY: axle.y,
    normalForce: componentMagnitude('normal'),
    frictionForce: componentMagnitude('friction'),
    trackCoordinate: body._trackContact?.distance ?? '',
    trackCurvature: body._trackContact?.curvature ?? '',
    trackRadius: body._trackContact?.curvature ? Math.abs(1 / body._trackContact.curvature) : '',
    inertia: body.inertia,
    assemblyInertia: body.assemblyInertia ?? body.inertia,
    connectorLength: connector?.length ?? '', connectorTension: connector?.tension ?? '', connectorExtension: connector?.extension ?? '', connectorElasticEnergy: connector?.elasticEnergy ?? '',
    translationalKinetic: energy.translational,
    rotationalKinetic: energy.rotational,
    kinetic: energy.kinetic,
    potential: energy.gravitational,
    gravitationalPotential: energy.gravitational,
    height: energy.height,
    totalEnergy: energy.mechanical,
    systemTotalEnergy: world.metrics.total,
    energyError: world.energyError.percent,
  }
}

export function useSimulation(initialPreset = 'projectile-motion', gridSettings = { snap: false, step: 0.5 }) {
  const [initial] = useState(() => {
    const supplied = typeof initialPreset === 'function' ? initialPreset() : initialPreset
    return typeof supplied === 'string' ? getPreset(supplied) : supplied
  })
  const [sourceScenario, setSourceScenario] = useState(initial)
  const [world, setWorld] = useState(() => createWorld(initial))
  const [selectedId, setSelectedId] = useState(initial.bodies[0].id)
  const [connectionPortId, setConnectionPortId] = useState(null)
  const [snapProposal, setSnapProposal] = useState(null)
  const [snapFeedback, setSnapFeedback] = useState('')
  const [dragSnapCandidate, setDragSnapCandidate] = useState(null)
  const [running, setRunningState] = useState(false)
  const [reversing, setReversingState] = useState(false)
  const [runError, setRunError] = useState('')
  const [speed, setSpeed] = useState(1)
  const [history, setHistory] = useState([])
  const [recordingStatus, setRecordingStatus] = useState('idle')
  const [pendingTrial, setPendingTrial] = useState(null)
  const [notebook, setNotebook] = useState(() => loadNotebook(initial.id))
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const worldRef = useRef(world)
  const selectedRef = useRef(selectedId)
  const clockRef = useRef(createFixedStepClock({ fixedStep: world.fixedStep }))
  const recordingStatusRef = useRef('idle')
  const trialDraftRef = useRef(null)
  const activeTrialRef = useRef(null)
  const gateStateRef = useRef({})
  const worldSnapshotsRef = useRef([])

  useEffect(() => { worldRef.current = world }, [world])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])
  useEffect(() => { recordingStatusRef.current = recordingStatus }, [recordingStatus])
  useEffect(() => {
    try { localStorage.setItem(notebookKey(notebook.scenarioId), JSON.stringify(notebook)) } catch { /* storage is optional */ }
  }, [notebook])
  useEffect(() => {
    if (!snapFeedback) return undefined
    const timeout = setTimeout(() => setSnapFeedback(''), 3200)
    return () => clearTimeout(timeout)
  }, [snapFeedback])

  const record = useCallback((nextWorld) => {
    const samples = nextWorld.bodies.map((body) => sampleWorld(nextWorld, body.id)).filter(Boolean)
    if (samples.length) setHistory((current) => [...current, ...samples].slice(-HISTORY_LIMIT))
    worldSnapshotsRef.current.push(nextWorld)
    if (worldSnapshotsRef.current.length > 6000) worldSnapshotsRef.current.shift()
  }, [])

  const setTrialStatus = useCallback((status) => {
    recordingStatusRef.current = status
    setRecordingStatus(status)
  }, [])

  const beginRecording = useCallback(() => {
    const draft = trialDraftRef.current ?? {}
    const seed = draft.seed ?? Math.floor(Math.random() * 0xffffffff)
    activeTrialRef.current = {
      id: nextId('trial'),
      name: draft.name?.trim() || `Trial ${Date.now().toString(36).toUpperCase()}`,
      independentVariable: draft.independentVariable?.trim() || '',
      independentValue: draft.independentValue ?? '',
      notes: draft.notes?.trim() || '',
      seed,
      startedAt: new Date().toISOString(),
      samples: sampleTrialWorld(worldRef.current),
      gateEvents: [],
      instrumentSnapshot: structuredClone(worldRef.current.instruments),
    }
    gateStateRef.current = {}
    setPendingTrial(null)
    setTrialStatus('recording')
  }, [setTrialStatus])

  const captureTrialStep = useCallback((previousWorld, nextWorld) => {
    const active = activeTrialRef.current
    if (!active) return
    const samples = sampleTrialWorld(nextWorld)
    if (active.samples.length + samples.length <= MAX_TRIAL_SAMPLES) active.samples.push(...samples)
    const detected = detectPhotogateCrossings(previousWorld, nextWorld, nextWorld.instruments, gateStateRef.current, active.seed + active.gateEvents.length)
    gateStateRef.current = detected.state
    active.gateEvents.push(...detected.events)
  }, [])

  const finishRecording = useCallback((finishedWorld = worldRef.current) => {
    const active = activeTrialRef.current
    if (!active) return
    const completed = {
      ...active,
      endedAt: new Date().toISOString(),
      duration: finishedWorld.time - (active.samples[0]?.time ?? 0),
      gateResults: deriveGateResults(active.gateEvents, active.instrumentSnapshot),
    }
    activeTrialRef.current = null
    gateStateRef.current = {}
    setPendingTrial(completed)
    setTrialStatus('review')
  }, [setTrialStatus])

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
      clockRef.current.advance(elapsed, (dt) => {
        const previousWorld = next
        next = stepWorld(next, dt)
        captureTrialStep(previousWorld, next)
      })
      worldRef.current = next
      if (now - lastPublished >= UI_PUBLISH_INTERVAL_MS || next.time >= next.duration) {
        lastPublished = now; setWorld(next); record(next)
      }
      if (next.time >= next.duration) { finishRecording(next); setRunningState(false) }
      else frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [captureTrialStep, finishRecording, record, running, speed])

  useEffect(() => {
    if (!reversing) return undefined
    let frameId
    let previous
    let lastPublished
    const frame = (now) => {
      if (previous === undefined) { previous = now; lastPublished = now; frameId = requestAnimationFrame(frame); return }
      previous = now
      const interval = UI_PUBLISH_INTERVAL_MS / Math.max(0.1, speed)
      if (now - lastPublished >= interval) {
        lastPublished = now
        let prevWorld = null
        if (worldSnapshotsRef.current.length > 0) {
          prevWorld = worldSnapshotsRef.current.pop()
        }
        if (prevWorld) {
          worldRef.current = prevWorld
          setWorld(prevWorld)
          const bodyCount = Math.max(1, prevWorld.bodies?.length ?? 1)
          setHistory((current) => current.slice(0, -bodyCount))
        }
        if (!prevWorld || prevWorld.time <= 0.001 || worldSnapshotsRef.current.length === 0) {
          setReversingState(false)
          return
        }
      }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [reversing, speed])

  const applyScenarioStateInternal = useCallback((input, options = {}) => {
    const result = validateScenario(input)
    if (!result.valid) throw new TypeError(result.errors.join(' '))
    const scenario = result.scenario
    const nextWorld = createWorld(scenario)
    setSourceScenario(structuredClone(scenario))
    setWorld(nextWorld); worldRef.current = nextWorld
    clockRef.current = createFixedStepClock({ fixedStep: nextWorld.fixedStep })
    if (!options.keepSelectedId || !nextWorld.bodies.some((b) => b.id === selectedRef.current)) {
      setSelectedId(nextWorld.bodies[0]?.id ?? null)
    }
    setConnectionPortId(null)
    setSnapProposal(null)
    setDragSnapCandidate(null)
    activeTrialRef.current = null
    gateStateRef.current = {}
    trialDraftRef.current = null
    worldSnapshotsRef.current = []
    setPendingTrial(null)
    setTrialStatus('idle')
    setNotebook((current) => current.scenarioId === scenario.id ? current : loadNotebook(scenario.id))
    setHistory([]); setRunningState(false); setReversingState(false); setRunError('')
  }, [setTrialStatus])

  const replaceScenario = useCallback((input) => {
    const currentSnapshot = structuredClone(worldToScenario(worldRef.current))
    setUndoStack((stack) => [...stack, currentSnapshot].slice(-50))
    setRedoStack([])
    applyScenarioStateInternal(input)
  }, [applyScenarioStateInternal])

  const setRunning = useCallback((value) => {
    const next = typeof value === 'function' ? value(running) : value
    if (next) setReversingState(false)
    if (next && worldRef.current.diagnostics.length) {
      setRunError(worldRef.current.diagnostics.join(' ')); setRunningState(false); return false
    }
    if (next && recordingStatusRef.current === 'armed') beginRecording()
    if (!next && recordingStatusRef.current === 'recording') finishRecording()
    setRunError(''); setRunningState(next); return true
  }, [beginRecording, finishRecording, running])

  const toggleReverse = useCallback(() => {
    if (reversing) {
      setReversingState(false)
    } else if (worldRef.current.time > 0.001 || worldSnapshotsRef.current.length > 0) {
      setRunningState(false)
      setReversingState(true)
    }
  }, [reversing])

  const loadPreset = useCallback((id) => replaceScenario(getPreset(id)), [replaceScenario])
  const reset = useCallback(() => replaceScenario(sourceScenario), [replaceScenario, sourceScenario])
  const armTrial = useCallback((metadata = {}) => {
    if (running) return false
    trialDraftRef.current = { ...metadata }
    setPendingTrial(null)
    setTrialStatus('armed')
    return true
  }, [running, setTrialStatus])
  const discardTrial = useCallback(() => {
    trialDraftRef.current = null
    activeTrialRef.current = null
    setPendingTrial(null)
    setTrialStatus('idle')
  }, [setTrialStatus])
  const savePendingTrial = useCallback(() => {
    if (!pendingTrial) return
    setNotebook((current) => ({ ...current, trials: [...current.trials, pendingTrial] }))
    trialDraftRef.current = null
    setPendingTrial(null)
    setTrialStatus('idle')
  }, [pendingTrial, setTrialStatus])
  const deleteTrial = useCallback((trialId) => setNotebook((current) => ({ ...current, trials: current.trials.filter((trial) => trial.id !== trialId) })), [])
  const stepOnce = useCallback(() => {
    setRunningState(false)
    if (worldRef.current.diagnostics.length) { setRunError(worldRef.current.diagnostics.join(' ')); return }
    const next = stepWorld(worldRef.current)
    worldRef.current = next; setWorld(next); record(next)
  }, [record])

  const commitScenarioEdit = useCallback((edit) => {
    const currentSnapshot = structuredClone(worldToScenario(worldRef.current))
    setUndoStack((stack) => [...stack, currentSnapshot].slice(-50))
    setRedoStack([])
    const scenario = worldToScenario(worldRef.current)
    edit(scenario)
    fitAutoLengthBeams(scenario)
    applyScenarioStateInternal(scenario, { keepSelectedId: true })
  }, [applyScenarioStateInternal])

  const undo = useCallback(() => {
    if (undoStack.length === 0 || running) return
    const prevSnapshot = undoStack[undoStack.length - 1]
    const currentSnapshot = structuredClone(worldToScenario(worldRef.current))
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) => [...stack, currentSnapshot].slice(-50))
    applyScenarioStateInternal(prevSnapshot, { keepSelectedId: true })
  }, [undoStack, running, applyScenarioStateInternal])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || running) return
    const nextSnapshot = redoStack[redoStack.length - 1]
    const currentSnapshot = structuredClone(worldToScenario(worldRef.current))
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) => [...stack, currentSnapshot].slice(-50))
    applyScenarioStateInternal(nextSnapshot, { keepSelectedId: true })
  }, [redoStack, running, applyScenarioStateInternal])

  const updateBody = useCallback((bodyId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.map((body) => {
        if (body.id !== bodyId) return body
        const next = { ...body, ...changes }
        if (body.shape === 'beam' && ('length' in changes || 'mass' in changes)) next.inertia = beamInertia(next.mass, next.length)
        if (body.shape === 'wheel' && ('radius' in changes || 'mass' in changes || 'inertiaModel' in changes)) next.inertia = wheelInertia(next.mass, next.radius, next.inertiaModel)
        if (body.shape === 'wheel' && changes.rotationMode === 'fixed') next.angularVelocity = 0
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
    const label = portLabel(worldRef.current, resolved.port)
    commitScenarioEdit((scenario) => { scenario.joints.push({ id: nextId('pin'), type: 'pin', a: { type: 'world', position: { x: resolved.x, y: resolved.y } }, b: { type: 'port', ownerId: resolved.port.ownerId, portId } }) })
    setSnapFeedback(`Pinned: ${label} → world`)
  }, [commitScenarioEdit])

  const connectPort = useCallback((portId, type) => {
    if (!connectionPortId) { setConnectionPortId(portId); return }
    if (!type || connectionPortId === portId) { setConnectionPortId(null); return }
    const first = worldRef.current.portIndex.get(connectionPortId)
    const second = worldRef.current.portIndex.get(portId)
    if (!first || !second || first.ownerId === second.ownerId) throw new TypeError('Choose ports on two different entities.')
    const firstPosition = resolvePort(worldRef.current, first.id)
    const secondPosition = resolvePort(worldRef.current, second.id)
    if (!firstPosition || !secondPosition) throw new TypeError('Both structural ports must have a valid position.')
    setSnapProposal({
      kind: 'joint', jointType: type, firstPortId: first.id, secondPortId: second.id,
      movingOwnerId: second.ownerId,
      delta: { x: firstPosition.x - secondPosition.x, y: firstPosition.y - secondPosition.y },
      sourcePortId: second.id, targetPortId: first.id,
      sourceLabel: portLabel(worldRef.current, second), targetLabel: portLabel(worldRef.current, first),
      message: `${portLabel(worldRef.current, second)} will align with ${portLabel(worldRef.current, first)} and form a ${type} joint.`,
    })
    setConnectionPortId(null)
  }, [connectionPortId])

  const updateTrack = useCallback((trackId, changes) => {
    commitScenarioEdit((scenario) => { scenario.tracks = scenario.tracks.map((track) => track.id === trackId ? { ...track, ...changes } : track) })
    setSelectedId(trackId)
  }, [commitScenarioEdit])

  const updateConnector = useCallback((connectorId, changes) => {
    commitScenarioEdit((scenario) => { scenario.connectors = scenario.connectors.map((connector) => connector.id === connectorId ? { ...connector, ...changes } : connector) })
    setSelectedId(connectorId)
  }, [commitScenarioEdit])

  const routeConnector = useCallback((connectorId, wheelId) => {
    const connector = worldRef.current.connectors.find((candidate) => candidate.id === connectorId && candidate.type === 'rope')
    if (!connector) return
    if (!wheelId) {
      updateConnector(connectorId, { route: undefined })
      return
    }
    const wheel = worldRef.current.bodies.find((body) => body.id === wheelId && body.shape === 'wheel')
    const a = resolveEndpoint(worldRef.current, connector.a)
    const b = resolveEndpoint(worldRef.current, connector.b)
    if (!wheel || !a || !b) return
    const aSide = a.position.x <= wheel.position.x ? 'left' : 'right'
    updateConnector(connectorId, { route: { type: 'wheel', wheelId, wrap: 'top', aSide } })
  }, [updateConnector])

  const moveConnectorEndpoint = useCallback((connectorId, key, position) => {
    const targetPos = gridSettings?.snap ? snapToGrid(position, gridSettings.step) : position
    updateConnector(connectorId, { [key]: { type: 'world', position: targetPos } })
  }, [gridSettings, updateConnector])

  const moveAssemblyPart = useCallback((bodyId, position, snapRadius = 0.45) => {
    const candidate = findBodySnapCandidate(worldRef.current, bodyId, position, snapRadius)
    const targetPos = candidate?.alignedPosition ?? (gridSettings?.snap ? snapToGrid(position, gridSettings.step) : position)
    updateBody(bodyId, { position: targetPos, ...(Number.isFinite(candidate?.alignedAngle) ? { angle: candidate.alignedAngle } : {}) })
    setDragSnapCandidate((current) => {
      if (!candidate) return null
      if (current?.bodyId === candidate.bodyId && current.sourcePortId === candidate.sourcePortId && current.targetPortId === candidate.targetPortId) return current
      return candidate
    })
  }, [gridSettings, updateBody])

  const requestBodySnap = useCallback((bodyId, snapRadius = 0.45) => {
    const body = worldRef.current.bodies.find((candidate) => candidate.id === bodyId)
    const candidate = body && findBodySnapCandidate(worldRef.current, bodyId, body.position, snapRadius)
    setDragSnapCandidate(null)
    if (!candidate) return
    if (candidate.railJoin) {
      setSnapProposal({
        kind: 'rail', bodyId, alignedPosition: candidate.alignedPosition, alignedAngle: candidate.alignedAngle,
        railJoin: candidate.railJoin,
        sourcePortId: candidate.sourcePort.id, targetPortId: candidate.targetPort.id,
        sourceLabel: candidate.sourceLabel, targetLabel: candidate.targetLabel,
        message: `${candidate.sourceLabel} will become a continuous rail with ${candidate.targetLabel}.`,
      })
      return
    }
    setSnapProposal({
      kind: 'joint', jointType: 'rigid', firstPortId: candidate.targetPort.id, secondPortId: candidate.sourcePort.id,
      movingOwnerId: bodyId,
      delta: { x: candidate.alignedPosition.x - body.position.x, y: candidate.alignedPosition.y - body.position.y },
      sourcePortId: candidate.sourcePort.id, targetPortId: candidate.targetPort.id,
      sourceLabel: candidate.sourceLabel, targetLabel: candidate.targetLabel,
      message: `${candidate.sourceLabel} is aligned with ${candidate.targetLabel}. Confirm to mount the parts rigidly.`,
    })
  }, [])

  const clearBodySnap = useCallback(() => setDragSnapCandidate(null), [])

  const requestConnectorSnap = useCallback((connectorId, key, position, snapRadius = 0.45) => {
    const connector = worldRef.current.connectors.find((candidate) => candidate.id === connectorId)
    if (!connector) return
    const otherEndpoint = connector[key === 'a' ? 'b' : 'a']
    const candidate = nearestPort(worldRef.current, position, snapRadius, (port) => port.id !== otherEndpoint.portId)
    if (!candidate) { setSnapProposal(null); setSnapFeedback('No compatible attachment point is within snap range.'); return }
    setSnapProposal({
      kind: 'connector', connectorId, endpointKey: key,
      sourcePortId: null, targetPortId: candidate.port.id,
      sourceLabel: `${connector.name} endpoint ${key.toUpperCase()}`, targetLabel: portLabel(worldRef.current, candidate.port),
      target: { ownerId: candidate.port.ownerId, portId: candidate.port.id },
      message: `${connector.name} endpoint ${key.toUpperCase()} is ready to attach to ${portLabel(worldRef.current, candidate.port)}.`,
    })
  }, [])

  const requestTrackSnap = useCallback((trackId, position, snapRadius = 0.45) => {
    const track = worldRef.current.tracks.find((candidate) => candidate.id === trackId)
    if (!track) return
    const tangent = { x: Math.cos(track.angle), y: Math.sin(track.angle) }
    const endpoints = [
      { id: `${track.id}:start`, name: 'Start', position: { x: position.x - tangent.x * track.length / 2, y: position.y - tangent.y * track.length / 2 } },
      { id: `${track.id}:end`, name: 'End', position: { x: position.x + tangent.x * track.length / 2, y: position.y + tangent.y * track.length / 2 } },
    ]
    let best = null
    for (const endpoint of endpoints) {
      const candidate = nearestPort(worldRef.current, endpoint.position, snapRadius, (port) => port.ownerId !== trackId && port.kind === 'track' && !port.id.endsWith(':center'))
      if (candidate && (!best || candidate.distance < best.distance)) best = { endpoint, ...candidate }
    }
    if (!best) { setSnapProposal(null); setSnapFeedback('No compatible track endpoint is within snap range.'); return }
    const alignedCenter = { x: position.x + best.resolved.x - best.endpoint.position.x, y: position.y + best.resolved.y - best.endpoint.position.y }
    setSnapProposal({
      kind: 'track', trackId, alignedCenter,
      sourcePortId: best.endpoint.id, targetPortId: best.port.id,
      sourceLabel: `${track.name} · ${best.endpoint.name}`, targetLabel: portLabel(worldRef.current, best.port),
      message: `${track.name} ${best.endpoint.name.toLowerCase()} is aligned with ${portLabel(worldRef.current, best.port)}.`,
    })
  }, [])

  const confirmSnap = useCallback(() => {
    const proposal = snapProposal
    if (!proposal) return
    if (proposal.kind === 'connector') {
      updateConnector(proposal.connectorId, { [proposal.endpointKey]: { type: 'port', ownerId: proposal.target.ownerId, portId: proposal.target.portId } })
    } else if (proposal.kind === 'track') {
      updateTrack(proposal.trackId, { center: proposal.alignedCenter })
    } else if (proposal.kind === 'rail') {
      commitScenarioEdit((scenario) => {
        const beam = scenario.bodies.find((body) => body.id === proposal.bodyId)
        if (!beam) return
        beam.position = proposal.alignedPosition
        beam.angle = proposal.alignedAngle
        beam.ideal = true
        const joinedTrack = scenario.tracks.find((track) => track.id === proposal.railJoin.b.ownerId)
        if (joinedTrack) joinedTrack.ideal = true
        scenario.railJoins = scenario.railJoins.filter((join) => ![join.a, join.b].some((endpoint) => endpoint.ownerId === beam.id))
        scenario.railJoins.push(proposal.railJoin)
      })
    } else if (proposal.kind === 'joint') {
      commitScenarioEdit((scenario) => {
        const body = scenario.bodies.find((candidate) => candidate.id === proposal.movingOwnerId)
        const track = scenario.tracks.find((candidate) => candidate.id === proposal.movingOwnerId)
        if (body) body.position = { x: body.position.x + proposal.delta.x, y: body.position.y + proposal.delta.y }
        if (track?.type === 'spline') track.knots = track.knots.map((knot) => ({ ...knot, position: { x: knot.position.x + proposal.delta.x, y: knot.position.y + proposal.delta.y } }))
        else if (track) track.center = { x: track.center.x + proposal.delta.x, y: track.center.y + proposal.delta.y }
        const first = worldRef.current.portIndex.get(proposal.firstPortId)
        const second = worldRef.current.portIndex.get(proposal.secondPortId)
        scenario.joints.push({ id: nextId(proposal.jointType), type: proposal.jointType, a: { type: 'port', ownerId: first.ownerId, portId: first.id }, b: { type: 'port', ownerId: second.ownerId, portId: second.id } })
      })
    }
    setSnapFeedback(`Snapped: ${proposal.sourceLabel} → ${proposal.targetLabel}`)
    setSnapProposal(null)
  }, [commitScenarioEdit, snapProposal, updateConnector, updateTrack])

  const cancelSnap = useCallback(() => {
    setSnapProposal(null)
    setConnectionPortId(null)
    setSnapFeedback('Snap cancelled; the object remains freely placed.')
  }, [])

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
  const updateInstrument = useCallback((id, changes) => {
    commitScenarioEdit((scenario) => {
      const current = scenario.instruments.find((instrument) => instrument.id === id)
      if (!current?.pairId) {
        scenario.instruments = scenario.instruments.map((instrument) => instrument.id === id ? { ...instrument, ...changes } : instrument)
        return
      }
      const dx = changes.center ? changes.center.x - current.center.x : 0
      const dy = changes.center ? changes.center.y - current.center.y : 0
      scenario.instruments = scenario.instruments.map((instrument) => {
        if (instrument.pairId !== current.pairId) return instrument
        const grouped = {
          ...instrument,
          ...(changes.targetBodyId !== undefined ? { targetBodyId: changes.targetBodyId } : {}),
          ...(changes.nominalSpacing !== undefined ? { nominalSpacing: changes.nominalSpacing } : {}),
          ...(changes.angle !== undefined ? { angle: changes.angle } : {}),
          ...(changes.length !== undefined ? { length: changes.length } : {}),
          ...(changes.resolution !== undefined ? { resolution: changes.resolution } : {}),
          ...(changes.noiseEnabled !== undefined ? { noiseEnabled: changes.noiseEnabled } : {}),
          ...(changes.noiseSigma !== undefined ? { noiseSigma: changes.noiseSigma } : {}),
        }
        if (changes.center) grouped.center = { x: instrument.center.x + dx, y: instrument.center.y + dy }
        if (instrument.id === id) Object.assign(grouped, changes)
        return grouped
      })
      if (changes.nominalSpacing !== undefined || changes.angle !== undefined) {
        const a = scenario.instruments.find((instrument) => instrument.pairId === current.pairId && instrument.pairRole === 'A')
        const b = scenario.instruments.find((instrument) => instrument.pairId === current.pairId && instrument.pairRole === 'B')
        if (a && b) {
          const spacing = changes.nominalSpacing ?? a.nominalSpacing
          b.center = { x: a.center.x + Math.sin(a.angle) * spacing, y: a.center.y - Math.cos(a.angle) * spacing }
        }
      }
    })
    setSelectedId(id)
  }, [commitScenarioEdit])
  const removeForce = useCallback((id) => commitScenarioEdit((scenario) => { scenario.forces = scenario.forces.filter((item) => item.id !== id) }), [commitScenarioEdit])
  const removeConstraint = useCallback((id) => commitScenarioEdit((scenario) => { scenario.constraints = scenario.constraints.filter((item) => item.id !== id) }), [commitScenarioEdit])

  const removeEntity = useCallback((id) => {
    if (worldRef.current.bodies.length <= 1 && worldRef.current.bodies.some((body) => body.id === id)) return
    const removedInstrument = worldRef.current.instruments.find((instrument) => instrument.id === id)
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.filter((body) => body.id !== id)
      scenario.tracks = scenario.tracks.filter((track) => track.id !== id)
      scenario.connectors = scenario.connectors
        .filter((connector) => connector.id !== id && connector.a.ownerId !== id && connector.b.ownerId !== id && connector.a.portId !== id && connector.b.portId !== id)
        .map((connector) => connector.route?.wheelId === id ? { ...connector, route: undefined } : connector)
      scenario.ports = scenario.ports.filter((port) => port.ownerId !== id && port.id !== id)
      scenario.joints = scenario.joints.filter((joint) => joint.id !== id && joint.a.ownerId !== id && joint.b.ownerId !== id && joint.a.portId !== id && joint.b.portId !== id)
      scenario.forces = scenario.forces.filter((force) => force.bodyId !== id)
      scenario.instruments = scenario.instruments.filter((instrument) => instrument.id !== id && instrument.targetBodyId !== id && (!removedInstrument?.pairId || instrument.pairId !== removedInstrument.pairId))
      scenario.railJoins = scenario.railJoins.filter((join) => join.a.ownerId !== id && join.b.ownerId !== id)
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
      } else if (target === 'wheel') {
        scenario.bodies.push(createWheel({ id, position: { x: 0, y: 2.5 } }))
      } else if (target === 'ramp') {
        scenario.tracks.push(createTrack({ id, center: { x: 0, y: 0 }, angle: Math.PI / 9, length: 6, ideal: true }))
      } else if (['spline', 'loop', 'hill', 'valley'].includes(target)) {
        scenario.tracks.push(createSplineTrack({ id, name: target === 'spline' ? 'Custom spline' : `${target[0].toUpperCase()}${target.slice(1)} track`, template: target === 'spline' ? 'blank' : target, ideal: true }))
      } else if (target === 'spring' || target === 'rope') {
        const body = scenario.bodies.find((candidate) => candidate.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.connectors.push(createConnector(target, { id, a: { type: 'world', position: { x: body.position.x - 2.5, y: body.position.y + 1 } }, b: { type: 'port', ownerId: body.id, portId: `${body.id}:center` }, length: 2.5, restLength: 2.5 }))
      } else if (target === 'attachment') {
        const selectedOwner = [...scenario.bodies, ...scenario.tracks].find((candidate) => candidate.id === selectedRef.current)
        const owner = selectedOwner?.type === 'spline' ? scenario.bodies[0] : (selectedOwner ?? scenario.bodies[0])
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
      } else if (target === 'ruler' || target === 'photogate') {
        const index = scenario.instruments.filter((instrument) => instrument.type === target).length
        const targetBody = scenario.bodies.find((body) => body.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.instruments.push(createInstrument(target, target === 'ruler'
          ? { id, name: `Ruler ${index + 1}`, a: { x: -2, y: 1 + index * 0.35 }, b: { x: 2, y: 1 + index * 0.35 } }
          : { id, name: `Photogate ${index + 1}`, center: { x: -1 + index * 2, y: 1 }, angle: Math.PI / 2, targetBodyId: targetBody.id }))
      } else if (target === 'photogateAssembly') {
        const pairId = nextId('photogate-pair')
        const targetBody = scenario.bodies.find((body) => body.id === selectedRef.current) ?? scenario.bodies[0]
        scenario.instruments.push(
          createInstrument('photogate', { id: `${id}-a`, name: 'Photogate assembly A', center: { x: -0.5, y: 1 }, angle: Math.PI / 2, targetBodyId: targetBody.id, pairId, pairRole: 'A', nominalSpacing: 1 }),
          createInstrument('photogate', { id: `${id}-b`, name: 'Photogate assembly B', center: { x: 0.5, y: 1 }, angle: Math.PI / 2, targetBodyId: targetBody.id, pairId, pairRole: 'B', nominalSpacing: 1 }),
        )
      }
    })
    if (!['gravity', 'floor'].includes(target)) setSelectedId(target === 'photogateAssembly' ? `${id}-a` : id)
  }, [commitScenarioEdit])

  const moveEntity = useCallback((id, position) => {
    const targetPos = gridSettings?.snap ? snapToGrid(position, gridSettings.step) : position
    if (worldRef.current.bodies.some((body) => body.id === id)) updateBody(id, { position: targetPos })
    else if (worldRef.current.tracks.some((track) => track.id === id)) {
      const track = worldRef.current.tracks.find((candidate) => candidate.id === id)
      if (track.type === 'spline') {
        const samples = track._samples ?? sampleSpline(track)
        const center = samples.reduce((sum, sample) => ({ x: sum.x + sample.position.x / samples.length, y: sum.y + sample.position.y / samples.length }), { x: 0, y: 0 })
        updateTrack(id, { knots: track.knots.map((knot) => ({ ...knot, position: { x: knot.position.x + targetPos.x - center.x, y: knot.position.y + targetPos.y - center.y } })) })
      } else updateTrack(id, { center: targetPos })
    }
    else if (worldRef.current.forces.some((force) => force.id === id && force.type === 'central')) updateForce(id, { center: targetPos })
    else if (worldRef.current.instruments.some((instrument) => instrument.id === id && instrument.type === 'photogate')) updateInstrument(id, { center: targetPos })
  }, [gridSettings, updateBody, updateForce, updateInstrument, updateTrack])

  const alignInstrument = useCallback((instrumentId, radius = 0.6) => {
    const instrument = worldRef.current.instruments.find((candidate) => candidate.id === instrumentId)
    const bodyRails = worldRef.current.bodies
      .filter((body) => body.shape === 'beam' && body.mode === 'track')
      .map((beam) => ({ ...beam, type: 'segment', center: beam.position, bodyRail: true }))
    const alignmentRails = [...worldRef.current.tracks, ...bodyRails]
    if (!instrument || !alignmentRails.length) return false
    const origin = instrument.center ?? { x: (instrument.a.x + instrument.b.x) / 2, y: (instrument.a.y + instrument.b.y) / 2 }
    let best = null
    for (const track of alignmentRails) {
      if (track.type === 'spline') {
        const samples = track._samples ?? sampleSpline(track)
        for (const sample of samples) {
          const distance = Math.hypot(sample.position.x - origin.x, sample.position.y - origin.y)
          if (distance <= radius && (!best || distance < best.distance)) best = { track, tangent: sample.tangent, point: sample.position, coordinate: sample.distance, distance, angle: Math.atan2(sample.tangent.y, sample.tangent.x) }
        }
        continue
      }
      const tangent = { x: Math.cos(track.angle), y: Math.sin(track.angle) }
      const normal = { x: -tangent.y, y: tangent.x }
      const relative = { x: origin.x - track.center.x, y: origin.y - track.center.y }
      const along = Math.max(-track.length / 2, Math.min(track.length / 2, relative.x * tangent.x + relative.y * tangent.y))
      const point = { x: track.center.x + tangent.x * along + normal.x * track.thickness / 2, y: track.center.y + tangent.y * along + normal.y * track.thickness / 2 }
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y)
      if (distance <= radius && (!best || distance < best.distance)) best = { track, tangent, point, coordinate: along + track.length / 2, distance, angle: track.angle }
    }
    if (!best) return false
    if (instrument.type === 'photogate' && instrument.pairId) {
      const trackLength = best.track.type === 'spline' ? (best.track._samples ?? sampleSpline(best.track)).at(-1)?.distance ?? 0 : best.track.length
      const spacing = Math.min(instrument.nominalSpacing, trackLength)
      const requestedStart = instrument.pairRole === 'A' ? best.coordinate : best.coordinate - spacing
      const startCoordinate = Math.max(0, Math.min(Math.max(0, trackLength - spacing), requestedStart))
      const pointAt = (distance) => {
        if (best.track.type === 'spline') return splinePointAtDistance(best.track, distance)
        const clamped = Math.max(0, Math.min(best.track.length, distance))
        const tangent = { x: Math.cos(best.track.angle), y: Math.sin(best.track.angle) }
        const normal = { x: -tangent.y, y: tangent.x }
        return {
          position: {
            x: best.track.center.x + tangent.x * (clamped - best.track.length / 2) + normal.x * best.track.thickness / 2,
            y: best.track.center.y + tangent.y * (clamped - best.track.length / 2) + normal.y * best.track.thickness / 2,
          },
          tangent,
          distance: clamped,
        }
      }
      const aPoint = pointAt(startCoordinate)
      const bPoint = pointAt(startCoordinate + spacing)
      commitScenarioEdit((scenario) => {
        scenario.instruments = scenario.instruments.map((candidate) => {
          if (candidate.pairId !== instrument.pairId) return candidate
          const point = candidate.pairRole === 'A' ? aPoint : bPoint
          return {
            ...candidate,
            center: point.position,
            angle: Math.atan2(point.tangent.y, point.tangent.x) + Math.PI / 2,
            nominalSpacing: spacing,
            trackId: best.track.bodyRail ? null : best.track.id,
            trackDistance: point.distance,
          }
        })
      })
    } else if (instrument.type === 'photogate') updateInstrument(instrument.id, { center: best.point, angle: best.angle + Math.PI / 2, trackId: best.track.bodyRail ? null : best.track.id, trackDistance: best.coordinate })
    else {
      const readingLength = Math.hypot(instrument.b.x - instrument.a.x, instrument.b.y - instrument.a.y)
      updateInstrument(instrument.id, { a: { x: best.point.x - best.tangent.x * readingLength / 2, y: best.point.y - best.tangent.y * readingLength / 2 }, b: { x: best.point.x + best.tangent.x * readingLength / 2, y: best.point.y + best.tangent.y * readingLength / 2 } })
    }
    setSnapFeedback(`Measurement alignment: ${instrument.name} aligned to ${best.track.name}; no physical connection was created.`)
    return true
  }, [commitScenarioEdit, updateInstrument])

  const placeBodyAtStart = useCallback((trackId, bodyId = selectedRef.current) => {
    const track = worldRef.current.tracks.find((candidate) => candidate.id === trackId)
    const body = worldRef.current.bodies.find((candidate) => candidate.id === bodyId) ?? worldRef.current.bodies.find((candidate) => candidate.shape !== 'beam')
    if (!track || !body) return
    if (track.type === 'spline') {
      const samples = track._samples ?? sampleSpline(track)
      const length = samples.at(-1)?.distance ?? 0
      const point = splinePointAtDistance(track, track.startEnd === 'end' ? length : 0)
      if (!point) return
      updateBody(body.id, { position: { x: point.position.x + point.normal.x * body.radius, y: point.position.y + point.normal.y * body.radius }, velocity: { x: 0, y: 0 } })
      return
    }
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
    if (preset) {
      loadPreset(preset.target)
    }
    const remaining = preset ? actions.filter((action) => action !== preset) : actions
    remaining.forEach((action) => {
      if (action.type === 'add_body') {
        commitScenarioEdit((scenario) => {
          const isBox = action.target === 'box'
          const shape = 'circle'
          const radius = 0.28
          if (scenario.bodies.length > 0) {
            const body = scenario.bodies[0]
            body.name = isBox ? 'Particle M' : 'Sphere'
            body.shape = 'circle'
            body.radius = radius
            body.friction = 0
            body.restitution = 0
            body.color = '#f2cf00'
            const track = scenario.tracks.find((t) => t.type === 'spline')
            if (track) {
              const point = splinePointAtDistance(track, 0)
              if (point) {
                body.position = { x: point.position.x + point.normal.x * radius, y: point.position.y + point.normal.y * radius }
                body.velocity = { x: 0, y: 0 }
              }
            }
          } else {
            const id = nextId(action.target)
            const track = scenario.tracks.find((t) => t.type === 'spline')
            const point = track ? splinePointAtDistance(track, 0) : null
            const pos = point ? { x: point.position.x + point.normal.x * radius, y: point.position.y + point.normal.y * radius } : { x: 0, y: 2.5 }
            scenario.bodies.push(createBody({ id, name: isBox ? 'Particle M' : 'Sphere', shape: 'circle', radius, position: pos, friction: 0, restitution: 0, color: '#f2cf00' }))
          }
        })
      }
      if (action.type === 'update_body') {
        commitScenarioEdit((scenario) => {
          const body = scenario.bodies.find((b) => b.id === action.entityId || b.name === action.name || b.id === action.target) || scenario.bodies[0]
          if (!body) return
          if (action.name) body.name = action.name
          if (typeof action.value === 'number') body.mass = action.value
          if (typeof action.mass === 'number') body.mass = action.mass
          if (typeof action.vx === 'number') body.velocity = { ...body.velocity, x: action.vx }
          if (typeof action.vy === 'number') body.velocity = { ...body.velocity, y: action.vy }
          if (typeof action.x === 'number') body.position = { ...body.position, x: action.x }
          if (typeof action.y === 'number') body.position = { ...body.position, y: action.y }
          if (typeof action.restitution === 'number') body.restitution = action.restitution
          if (typeof action.friction === 'number') body.friction = action.friction
        })
      }
      if (action.type === 'add_track' || action.type === 'add_constraint' && action.target === 'ramp') addElement('ramp')
      if (action.type === 'add_spline_track') {
        const track = createSplineTrack({ ideal: true, friction: 0, restitution: 0, ...action.track, type: 'spline', id: action.track?.id ?? nextId('spline') })
        commitScenarioEdit((scenario) => {
          scenario.tracks = [track]
          if (scenario.bodies.length > 0) {
            const body = scenario.bodies[0]
            const point = splinePointAtDistance(track, 0)
            if (point) {
              body.position = { x: point.position.x + point.normal.x * (body.radius ?? 0.3), y: point.position.y + point.normal.y * (body.radius ?? 0.3) }
              body.velocity = { x: 0, y: 0 }
              body.friction = 0
              body.restitution = 0
            }
          }
        })
      }
      if (action.type === 'add_beam') addElement('beam')
      if (action.type === 'add_wheel' || action.type === 'add_body' && action.target === 'wheel') addElement('wheel')
      if (action.type === 'add_connector' || action.type === 'add_force' && ['spring', 'rope'].includes(action.target)) {
        addElement(action.target)
        if (action.unattached !== undefined || action.attached !== undefined || action.connectorMode) {
          commitScenarioEdit((scenario) => {
            const targetConnector = scenario.connectors[scenario.connectors.length - 1]
            if (targetConnector) {
              const isUnattached = action.unattached ?? (action.attached === false || action.connectorMode === 'push')
              targetConnector.unattached = isUnattached
              targetConnector.attached = !isUnattached
              targetConnector.mode = isUnattached ? 'push' : 'pull-push'
            }
          })
        }
      }
      if (action.type === 'update_connector') {
        commitScenarioEdit((scenario) => {
          scenario.connectors = scenario.connectors.map((c) => {
            if (action.entityId && c.id !== action.entityId) return c
            const isUnattached = action.unattached ?? (action.attached === false || action.connectorMode === 'push')
            return {
              ...c,
              unattached: isUnattached,
              attached: !isUnattached,
              mode: isUnattached ? 'push' : 'pull-push',
              stiffness: typeof action.value === 'number' ? action.value : c.stiffness,
            }
          })
        })
      }
      if (action.type === 'add_port') addElement('attachment')
      if (action.type === 'add_instrument' && ['ruler', 'photogate', 'photogateAssembly'].includes(action.target)) addElement(action.target)
      if (action.type === 'add_joint') {
        if (!action.entityId || !action.portId || !action.otherEntityId || !action.otherPortId || !['rigid', 'pin'].includes(action.target)) throw new TypeError('A joint action requires two exact entity/port references and a rigid or pin type.')
        commitScenarioEdit((scenario) => { scenario.joints.push({ id: nextId(action.target), type: action.target, a: { type: 'port', ownerId: action.entityId, portId: action.portId }, b: { type: 'port', ownerId: action.otherEntityId, portId: action.otherPortId } }) })
      }
      if (action.type === 'connect_endpoint') {
        if (!action.entityId || !['a', 'b'].includes(action.endpoint) || !action.otherEntityId || !action.otherPortId) throw new TypeError('A connector action requires an exact connector, endpoint, owner, and port.')
        updateConnector(action.entityId, { [action.endpoint]: { type: 'port', ownerId: action.otherEntityId, portId: action.otherPortId } })
      }
      if (action.type === 'add_event') {
        const evt = action.event ?? {
          id: `evt-${crypto.randomUUID()}`,
          trigger: action.trigger ?? 'apex',
          type: action.eventType ?? 'explosion',
          targetId: action.targetId ?? worldRef.current.bodies[0]?.id,
          ratio: action.ratio ?? 0.25,
          impulseX: action.impulseX ?? 5,
        }
        commitScenarioEdit((scenario) => {
          scenario.events = [...(scenario.events ?? []), evt]
        })
      }
      if (action.type === 'add_constraint' && action.target === 'floor' && !worldRef.current.constraints.some((constraint) => constraint.type === 'ground')) addElement('floor')
      if (action.type === 'remove_constraint' && action.target === 'floor') commitScenarioEdit((scenario) => { scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground') })
      if (action.target === 'gravity') updateGravity({ enabled: !['remove_force', 'disable_gravity'].includes(action.type), g: action.value ?? worldRef.current.gravity.g })
      if (action.type === 'add_force' && action.target === 'central') addElement('attractor')
    })
  }, [addElement, commitScenarioEdit, loadPreset, updateConnector, updateGravity])

  const selectedBody = useMemo(() => selectedId ? (world.bodies.find((body) => body.id === selectedId) ?? null) : null, [selectedId, world.bodies])
  const selectedEntity = useMemo(() => selectedId ? (world.bodies.find((item) => item.id === selectedId) ?? world.tracks.find((item) => item.id === selectedId) ?? world.connectors.find((item) => item.id === selectedId) ?? world.ports.find((item) => item.id === selectedId) ?? null) : null, [selectedId, world.bodies, world.connectors, world.ports, world.tracks])
  const selectedConnectorState = useMemo(() => selectedEntity?.a ? connectorState(world, selectedEntity) : null, [selectedEntity, world])
  const selectedLoadState = useMemo(() => selectedBody?.id ? bodyLoadState(world, selectedBody.id) : null, [selectedBody, world])
  const eligibleWheels = useMemo(() => world.bodies.filter((body) => body.shape === 'wheel' && wheelCenterMount(world, body)?.fixed && !world.connectors.some((connector) => connector.id !== selectedEntity?.id && connector.route?.wheelId === body.id)), [selectedEntity?.id, world])
  const connectionPortLabel = useMemo(() => {
    const port = connectionPortId && world.portIndex.get(connectionPortId)
    return port ? portLabel(world, port) : ''
  }, [connectionPortId, world])

  return {
    world, scenario: worldToScenario(world), selectedBody, selectedEntity, selectedConnectorState, selectedLoadState, eligibleWheels, selectedId, setSelectedId, connectionPortId, connectionPortLabel, snapProposal, snapFeedback, dragSnapCandidate,
    running, setRunning, reversing, canReverse: Boolean(reversing || (world.time > 0.001 && worldSnapshotsRef.current.length > 0)), toggleReverse, runError, speed, setSpeed, history, loadPreset, replaceScenario, reset, stepOnce,
    recordingStatus, pendingTrial, notebook, armTrial, discardTrial, savePendingTrial, deleteTrial,
    canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undo, redo,
    updateBody, updateTrack, updateConnector, routeConnector, updateInstrument, moveAssemblyPart, requestBodySnap, clearBodySnap, moveConnectorEndpoint, requestConnectorSnap, requestTrackSnap, confirmSnap, cancelSnap, disconnectConnector, updatePort, pinPortToWorld, connectPort, updateGravity, updateForce, removeForce, updateConstraint, removeConstraint,
    addElement, applyActions, removeBody: removeEntity, removeEntity, moveEntity, moveConstraint: moveEntity, alignInstrument, placeBodyAtStart, prepareOrbit,
  }
}
