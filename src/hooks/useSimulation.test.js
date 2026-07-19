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
})
