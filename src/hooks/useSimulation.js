import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBody, validateScenario } from '../domain/scenario.js'
import { getPreset } from '../domain/presets.js'
import { createFixedStepClock } from '../physics/clock.js'
import { magnitude } from '../physics/vector.js'
import { createWorld, stepWorld, worldToScenario } from '../physics/world.js'

const HISTORY_LIMIT = 480
const UI_PUBLISH_INTERVAL_MS = 1000 / 30

function sampleWorld(world, bodyId) {
  const body = world.bodies.find((candidate) => candidate.id === bodyId) ?? world.bodies[0]
  if (!body) return null
  return {
    time: world.time,
    body: body.name,
    bodyId: body.id,
    x: body.position.x,
    y: body.position.y,
    vx: body.velocity.x,
    vy: body.velocity.y,
    ax: body.acceleration.x,
    ay: body.acceleration.y,
    speed: magnitude(body.velocity),
    kinetic: world.metrics.translationalKinetic + world.metrics.rotationalKinetic,
    potential: world.metrics.potential,
    totalEnergy: world.metrics.total,
    energyError: world.energyError.percent,
  }
}

export function useSimulation(initialPreset = 'projectile-motion') {
  const [sourceScenario, setSourceScenario] = useState(() => getPreset(initialPreset))
  const [world, setWorld] = useState(() => createWorld(getPreset(initialPreset)))
  const [selectedId, setSelectedId] = useState(() => getPreset(initialPreset).bodies[0].id)
  const [running, setRunning] = useState(false)
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
      if (previous === undefined) {
        previous = now
        lastPublished = now
        frameId = requestAnimationFrame(frame)
        return
      }
      const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1) * speed
      previous = now
      let next = worldRef.current
      clockRef.current.advance(elapsed, (dt) => { next = stepWorld(next, dt) })
      worldRef.current = next
      if (now - lastPublished >= UI_PUBLISH_INTERVAL_MS || next.time >= next.duration) {
        lastPublished = now
        setWorld(next)
        record(next)
      }
      if (next.time >= next.duration) setRunning(false)
      else frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [record, running, speed])

  const replaceScenario = useCallback((scenario) => {
    const result = validateScenario(scenario)
    if (!result.valid) throw new TypeError(result.errors.join(' '))
    const nextWorld = createWorld(scenario)
    setSourceScenario(structuredClone(scenario))
    setWorld(nextWorld)
    worldRef.current = nextWorld
    clockRef.current = createFixedStepClock({ fixedStep: nextWorld.fixedStep })
    setSelectedId(nextWorld.bodies[0].id)
    setHistory([])
    setRunning(false)
  }, [])

  const loadPreset = useCallback((id) => replaceScenario(getPreset(id)), [replaceScenario])
  const reset = useCallback(() => replaceScenario(sourceScenario), [replaceScenario, sourceScenario])

  const stepOnce = useCallback(() => {
    setRunning(false)
    const next = stepWorld(worldRef.current)
    worldRef.current = next
    setWorld(next)
    record(next)
  }, [record])

  const commitScenarioEdit = useCallback((edit) => {
    const scenario = worldToScenario(worldRef.current)
    edit(scenario)
    replaceScenario(scenario)
  }, [replaceScenario])

  const updateBody = useCallback((bodyId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.map((body) => body.id === bodyId ? { ...body, ...changes } : body)
    })
    setSelectedId(bodyId)
  }, [commitScenarioEdit])

  const addBody = useCallback(() => {
    const id = `body-${Date.now()}`
    commitScenarioEdit((scenario) => {
      scenario.bodies.push(createBody({ id, name: `Body ${scenario.bodies.length + 1}`, position: { x: 0, y: 2.5 }, color: '#78e6d5' }))
    })
    setSelectedId(id)
  }, [commitScenarioEdit])

  const removeBody = useCallback((bodyId) => {
    if (worldRef.current.bodies.length <= 1) return
    commitScenarioEdit((scenario) => {
      scenario.bodies = scenario.bodies.filter((body) => body.id !== bodyId)
      scenario.forces = scenario.forces.filter((force) => force.bodyId !== bodyId)
      scenario.constraints = scenario.constraints.filter((constraint) => constraint.bodyId !== bodyId)
    })
  }, [commitScenarioEdit])

  const updateForce = useCallback((forceId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.forces = scenario.forces.map((force) => force.id === forceId ? { ...force, ...changes } : force)
    })
  }, [commitScenarioEdit])

  const removeForce = useCallback((forceId) => {
    commitScenarioEdit((scenario) => {
      scenario.forces = scenario.forces.filter((force) => force.id !== forceId)
    })
  }, [commitScenarioEdit])

  const updateConstraint = useCallback((constraintId, changes) => {
    commitScenarioEdit((scenario) => {
      scenario.constraints = scenario.constraints.map((constraint) => constraint.id === constraintId ? { ...constraint, ...changes } : constraint)
    })
  }, [commitScenarioEdit])

  const removeConstraint = useCallback((constraintId) => {
    commitScenarioEdit((scenario) => {
      scenario.constraints = scenario.constraints.filter((constraint) => constraint.id !== constraintId)
    })
  }, [commitScenarioEdit])

  const moveConstraint = useCallback((constraintId, center) => {
    commitScenarioEdit((scenario) => {
      const constraint = scenario.constraints.find((candidate) => candidate.id === constraintId && candidate.type === 'incline')
      if (!constraint) return
      const currentCenter = { x: (constraint.start.x + constraint.end.x) / 2, y: (constraint.start.y + constraint.end.y) / 2 }
      const delta = { x: center.x - currentCenter.x, y: center.y - currentCenter.y }
      constraint.start = { x: constraint.start.x + delta.x, y: constraint.start.y + delta.y }
      constraint.end = { x: constraint.end.x + delta.x, y: constraint.end.y + delta.y }
    })
  }, [commitScenarioEdit])

  const prepareOrbit = useCallback((forceId) => {
    commitScenarioEdit((scenario) => {
      const force = scenario.forces.find((candidate) => candidate.id === forceId && candidate.type === 'central')
      const body = force && scenario.bodies.find((candidate) => candidate.id === force.bodyId)
      if (!force || !body) return
      let dx = body.position.x - force.center.x
      let dy = body.position.y - force.center.y
      let radius = Math.hypot(dx, dy)
      if (radius < 0.5) {
        radius = 4
        dx = radius
        dy = 0
        body.position = { x: force.center.x + radius, y: force.center.y }
      }
      const speed = Math.sqrt(force.strength / radius)
      body.velocity = { x: (-dy / radius) * speed, y: (dx / radius) * speed }
      scenario.forces = scenario.forces.filter((candidate) => candidate.type !== 'gravity' || candidate.bodyId)
      scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground')
    })
  }, [commitScenarioEdit])

  const applyActions = useCallback((actions) => {
    const presetAction = actions.find((action) => action.type === 'load_preset')
    if (presetAction?.target) {
      loadPreset(presetAction.target)
      return
    }

    const generatedIds = actions.map((_, index) => `builder-${Date.now()}-${index}`)
    const newBodyIndex = actions.findIndex((action) => action.type === 'add_body')
    const newBodyId = newBodyIndex >= 0 ? generatedIds[newBodyIndex] : null
    commitScenarioEdit((scenario) => {
      actions.forEach((action, index) => {
        if (action.type === 'remove_force' && action.target === 'gravity') {
          scenario.forces = scenario.forces.filter((force) => force.type !== 'gravity' || force.bodyId)
        }

        if (action.type === 'remove_constraint' && action.target === 'floor') {
          scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground')
        }

        if (action.type === 'add_body') {
          const isBox = action.target === 'box'
          scenario.bodies.push(createBody({
            id: generatedIds[index],
            name: action.name || (isBox ? 'Block' : 'Sphere'),
            shape: isBox ? 'box' : 'circle',
            radius: isBox ? 0.55 : 0.42,
            width: isBox ? 1.1 : 0.84,
            height: isBox ? 1.1 : 0.84,
            position: { x: action.x ?? 0, y: action.y ?? 2.5 },
            color: isBox ? '#111111' : '#f2cf00',
          }))
          const hasAttractor = scenario.forces.some((force) => force.type === 'central')
          if (!hasAttractor && !scenario.forces.some((force) => force.type === 'gravity' && !force.bodyId)) {
            scenario.forces.push({ id: `environment-gravity-${Date.now()}`, type: 'gravity', g: 9.80665 })
          }
          if (!hasAttractor && !scenario.constraints.some((constraint) => constraint.type === 'ground')) {
            scenario.constraints.push({ id: `environment-ground-${Date.now()}`, type: 'ground', y: -3.6, restitution: 0.35, friction: 0.08 })
          }
        }

        if (action.type === 'add_constraint' && action.target === 'ramp') {
          scenario.constraints.push({ id: generatedIds[index], type: 'incline', start: { x: -4.5, y: 2.8 }, end: { x: 4.5, y: -2.2 }, rolling: true })
        }

        if (action.type === 'add_constraint' && action.target === 'floor') {
          scenario.constraints = scenario.constraints.filter((constraint) => constraint.type !== 'ground')
          scenario.constraints.push({ id: generatedIds[index], type: 'ground', y: -3.6, restitution: 0.72, friction: 0.04 })
        }

        if (action.type === 'add_force' && action.target === 'gravity') {
          const gravity = scenario.forces.find((force) => force.type === 'gravity' && !force.bodyId)
          if (gravity) gravity.g = action.value ?? 9.80665
          else scenario.forces.push({ id: generatedIds[index], type: 'gravity', g: action.value ?? 9.80665 })
        }

        if (action.type === 'add_force' && action.target === 'spring') {
          const bodyId = newBodyId ?? selectedRef.current ?? scenario.bodies[0]?.id
          const body = scenario.bodies.find((candidate) => candidate.id === bodyId)
          if (body) scenario.forces.push({
            id: generatedIds[index],
            type: 'spring',
            bodyId,
            anchor: { x: body.position.x - 2.5, y: body.position.y },
            stiffness: 5,
            restLength: 1.4,
            damping: 0.05,
          })
        }

        if (action.type === 'add_force' && action.target === 'central') {
          const bodyId = newBodyId ?? selectedRef.current ?? scenario.bodies[0]?.id
          const existing = scenario.forces.find((force) => force.type === 'central' && force.bodyId === bodyId)
          if (!existing && bodyId) scenario.forces.push({
            id: generatedIds[index],
            type: 'central',
            bodyId,
            center: { x: 0, y: 0 },
            strength: 19.36,
            softening: 0.05,
          })
        }
      })
    })
    const addedBodyIndex = actions.findIndex((action) => action.type === 'add_body')
    if (addedBodyIndex >= 0) setSelectedId(generatedIds[addedBodyIndex])
  }, [commitScenarioEdit, loadPreset])

  const addElement = useCallback((target) => {
    if (target === 'gravity') {
      const gravity = worldRef.current.forces.find((force) => force.type === 'gravity' && !force.bodyId)
      if (gravity) removeForce(gravity.id)
      else applyActions([{ type: 'add_force', target: 'gravity' }])
      return
    }
    if (target === 'floor') {
      const ground = worldRef.current.constraints.find((constraint) => constraint.type === 'ground')
      if (ground) removeConstraint(ground.id)
      else applyActions([{ type: 'add_constraint', target: 'floor' }])
      return
    }
    const type = target === 'sphere' || target === 'box'
      ? 'add_body'
      : target === 'ramp' || target === 'floor'
        ? 'add_constraint'
        : 'add_force'
    applyActions([{ type, target: target === 'attractor' ? 'central' : target }])
  }, [applyActions, removeConstraint, removeForce])

  const selectedBody = useMemo(
    () => world.bodies.find((body) => body.id === selectedId) ?? world.bodies[0],
    [selectedId, world.bodies],
  )

  return {
    world,
    scenario: worldToScenario(world),
    selectedBody,
    selectedId,
    setSelectedId,
    running,
    setRunning,
    speed,
    setSpeed,
    history,
    loadPreset,
    replaceScenario,
    reset,
    stepOnce,
    updateBody,
    addBody,
    addElement,
    applyActions,
    removeBody,
    updateForce,
    removeForce,
    updateConstraint,
    removeConstraint,
    moveConstraint,
    prepareOrbit,
  }
}
