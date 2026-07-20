import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPreset } from '../domain/presets.js'
import { createWorld } from '../physics/world.js'
import AgentDock from './AgentDock.jsx'

afterEach(() => vi.unstubAllGlobals())

describe('Vector agent dock', () => {
  it('sends the actual selected body and bounded follow-up context', async () => {
    const scenario = getPreset('momentum-collision')
    const world = createWorld(scenario)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'First response', actions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Follow-up response', actions: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AgentDock scenario={scenario} world={world} selectedBody={world.bodies[1]} notebook={{ trials: [] }} onApply={vi.fn()} />)

    const input = screen.getByLabelText('Ask Vector, the physics agent')
    await user.type(input, 'Which cart is selected?')
    await user.click(screen.getByRole('button', { name: 'Send request to Vector' }))
    expect(await screen.findByText('First response')).toBeInTheDocument()

    const firstPayload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstPayload.telemetry.selected_body.id).toBe(world.bodies[1].id)
    expect(firstPayload.history).toEqual([])

    await user.type(input, 'What about its momentum?')
    await user.click(screen.getByRole('button', { name: 'Send request to Vector' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondPayload = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondPayload.history).toEqual([
      { role: 'user', content: 'Which cart is selected?' },
      { role: 'assistant', content: 'First response' },
    ])
  })

  it('requires confirmation before applying a roller coaster proposal', async () => {
    const scenario = getPreset('projectile-motion')
    const world = createWorld(scenario)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const onApply = vi.fn()
    const user = userEvent.setup()
    render(<AgentDock scenario={scenario} world={world} selectedBody={world.bodies[0]} notebook={{ trials: [] }} onApply={onApply} />)
    await user.type(screen.getByLabelText('Ask Vector, the physics agent'), 'Create a rollercoaster')
    await user.click(screen.getByRole('button', { name: 'Send request to Vector' }))
    expect(await screen.findByRole('dialog', { name: 'Vector world proposal' })).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith([{ type: 'load_preset', target: 'spline-roller-coaster' }])
  })
})
