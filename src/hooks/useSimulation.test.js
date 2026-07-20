import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolvePort } from '../physics/assembly.js'
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
})
