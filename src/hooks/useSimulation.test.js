import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolvePort } from '../physics/assembly.js'
import { alignBeamToSpline } from '../domain/railWeld.js'
import { useSimulation } from './useSimulation.js'

describe('assembly part dragging', () => {
  it('acquires a foreign port, aligns the body, and proposes a rigid mount on release', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('beam'))

    const projectile = result.current.world.bodies.find((body) => body.id === 'projectile')
    const beam = result.current.world.bodies.find((body) => body.shape === 'beam')
    const beamStart = resolvePort(result.current.world, `${beam.id}:start`)
    const pickupPosition = { x: beamStart.x - projectile.radius, y: beamStart.y }

    act(() => result.current.moveAssemblyPart(projectile.id, pickupPosition, 0.5))
    expect(result.current.dragSnapCandidate).toMatchObject({ bodyId: projectile.id, targetPortId: `${beam.id}:start` })
    expect(resolvePort(result.current.world, `${projectile.id}:east`).x).toBeCloseTo(beamStart.x, 8)

    act(() => result.current.requestBodySnap(projectile.id, 0.5))
    expect(result.current.snapProposal).toMatchObject({ kind: 'joint', jointType: 'rigid', targetPortId: `${beam.id}:start` })

    act(() => result.current.confirmSnap())
    expect(result.current.world.joints.some((joint) => joint.type === 'rigid' && joint.b.ownerId === projectile.id)).toBe(true)
  })

  it('moves an attractor without exposing it to assembly mounting', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('attractor'))

    const attractor = result.current.world.forces.find((force) => force.type === 'central')
    const portCount = result.current.world.ports.length

    act(() => result.current.moveEntity(attractor.id, { x: 2.25, y: -1.5 }))

    expect(result.current.world.forces.find((force) => force.id === attractor.id).center).toEqual({ x: 2.25, y: -1.5 })
    expect(result.current.world.ports).toHaveLength(portCount)
    expect(result.current.world.ports.some((port) => port.ownerId === attractor.id)).toBe(false)
    expect(result.current.snapProposal).toBeNull()
    expect(result.current.world.joints).toHaveLength(0)
  })

  it('adds measurement-only instruments and cancels an armed trial on structural edits', () => {
    const { result } = renderHook(() => useSimulation())
    const initialPortCount = result.current.world.ports.length
    act(() => result.current.addElement('ruler'))
    act(() => result.current.addElement('photogate'))
    expect(result.current.world.instruments.map((instrument) => instrument.type)).toEqual(['ruler', 'photogate'])
    expect(result.current.world.ports).toHaveLength(initialPortCount)
    expect(result.current.world.joints).toHaveLength(0)
    act(() => result.current.armTrial({ name: 'Baseline', notes: 'Faster on a steeper incline.' }))
    expect(result.current.recordingStatus).toBe('armed')
    act(() => result.current.updateInstrument(result.current.world.instruments[0].id, { resolution: 0.01 }))
    expect(result.current.recordingStatus).toBe('idle')
    expect(result.current.notebook.trials).toHaveLength(0)
  })

  it('creates a movable paired-plane photogate assembly', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('photogateAssembly'))
    const gates = result.current.world.instruments.filter((instrument) => instrument.pairId)
    expect(gates).toHaveLength(2)
    expect(gates.map((gate) => gate.pairRole).sort()).toEqual(['A', 'B'])
    const before = gates.find((gate) => gate.pairRole === 'B').center.x
    act(() => result.current.updateInstrument(gates.find((gate) => gate.pairRole === 'A').id, { center: { x: 1, y: 2 } }))
    expect(result.current.world.instruments.find((gate) => gate.pairRole === 'B').center.x - before).toBeCloseTo(1.5, 8)
  })

  it('moves and deletes a spawned spline track as one object', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('hill'))
    const track = result.current.world.tracks.find((candidate) => candidate.type === 'spline')
    expect(track.ideal).toBe(true)
    const before = track.knots.map((knot) => ({ ...knot.position }))
    act(() => result.current.moveEntity(track.id, { x: 3, y: 2 }))
    const moved = result.current.world.tracks.find((candidate) => candidate.id === track.id)
    expect(moved.knots[0].position.x - before[0].x).toBeCloseTo(moved.knots[1].position.x - before[1].x, 8)
    expect(moved.knots[0].position.y - before[0].y).toBeCloseTo(moved.knots[1].position.y - before[1].y, 8)
    act(() => result.current.removeEntity(track.id))
    expect(result.current.world.tracks.some((candidate) => candidate.id === track.id)).toBe(false)
  })

  it('mounts a paired photogate assembly on a straight track beam', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('beam'))
    const beam = result.current.world.bodies.find((body) => body.shape === 'beam')
    act(() => result.current.updateBody(beam.id, { mode: 'track', position: { x: 0, y: 1 } }))
    act(() => result.current.addElement('photogateAssembly'))
    const gateA = result.current.world.instruments.find((instrument) => instrument.pairRole === 'A')
    act(() => result.current.alignInstrument(gateA.id, 1))
    const mounted = result.current.world.instruments.filter((instrument) => instrument.pairId === gateA.pairId)
    expect(mounted).toHaveLength(2)
    expect(mounted.every((instrument) => instrument.trackId === null)).toBe(true)
    expect(mounted.every((instrument) => instrument.center.y > 1)).toBe(true)
  })

  it('welds a track beam continuously to a spline endpoint', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('beam'))
    const beam = result.current.world.bodies.find((body) => body.shape === 'beam')
    act(() => result.current.updateBody(beam.id, { mode: 'track' }))
    act(() => result.current.addElement('hill'))
    const spline = result.current.world.tracks.find((track) => track.type === 'spline')
    const updatedBeam = result.current.world.bodies.find((body) => body.id === beam.id)
    const alignment = alignBeamToSpline(updatedBeam, 'end', spline, 'start')
    act(() => result.current.updateBody(beam.id, { position: alignment.position, angle: alignment.angle }))
    act(() => result.current.requestBodySnap(beam.id, 0.5))
    expect(result.current.snapProposal).toMatchObject({ kind: 'rail', bodyId: beam.id })
    act(() => result.current.confirmSnap())
    expect(result.current.world.railJoins).toHaveLength(1)
  })

  it('records isolated per-object telemetry with units-ready energy fields', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.addElement('sphere'))
    act(() => result.current.stepOnce())
    expect(new Set(result.current.history.map((sample) => sample.bodyId)).size).toBe(2)
    for (const sample of result.current.history) {
      expect(sample).toEqual(expect.objectContaining({
        angularAcceleration: expect.any(Number),
        translationalKinetic: expect.any(Number),
        rotationalKinetic: expect.any(Number),
        gravitationalPotential: expect.any(Number),
        height: expect.any(Number),
        totalEnergy: expect.any(Number),
      }))
    }
  })

  it('preserves initial velocity when moving an object and supports undo and redo', () => {
    const { result } = renderHook(() => useSimulation('momentum-collision'))
    const cartA = result.current.world.bodies.find((body) => body.name === 'Cart A')
    const initialX = cartA.position.x

    act(() => result.current.updateBody(cartA.id, { velocity: { x: 4, y: 0 } }))
    expect(result.current.world.bodies.find((b) => b.id === cartA.id).velocity.x).toBe(4)

    act(() => result.current.moveEntity(cartA.id, { x: 1, y: 0 }))
    expect(result.current.world.bodies.find((b) => b.id === cartA.id).position.x).toBe(1)
    expect(result.current.world.bodies.find((b) => b.id === cartA.id).velocity.x).toBe(4)

    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.world.bodies.find((b) => b.id === cartA.id).position.x).toBe(initialX)

    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(result.current.world.bodies.find((b) => b.id === cartA.id).position.x).toBe(1)
  })
})
