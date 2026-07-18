import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

describe('Mechanarium studio', () => {
  it('opens a three-dimensional world with builder, controls, and data', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projectile Motion' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: /three-dimensional physics world/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'trails' })).not.toBeChecked()
    expect(screen.getByRole('complementary', { name: /world data/i })).toHaveTextContent('Total energy')
  })

  it('adds world elements from the left builder', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(screen.getByRole('heading', { name: 'Sphere' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('Sphere')
  })

  it('switches to prepared labs and loads an oscillator', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /Labs/ }))
    await user.click(screen.getByRole('button', { name: /Spring Oscillator/ }))
    expect(screen.getByRole('heading', { name: 'Spring Oscillator' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spring mass' })).toBeInTheDocument()
  })

  it('advances one deterministic step and toggles overlays', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Advance one fixed step' }))
    expect(screen.getByText('0.008 s')).toBeInTheDocument()
    const vectors = screen.getByRole('checkbox', { name: 'vectors' })
    await user.click(vectors)
    expect(vectors).not.toBeChecked()
  })

  it('runs when animation frames use a different timestamp origin', async () => {
    const callbacks = []
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
    act(() => callbacks.shift()(10))
    act(() => callbacks.shift()(50))
    expect(screen.getByText('0.033 s')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    requestFrame.mockRestore()
    cancelFrame.mockRestore()
  })

  it('edits the selected body and saves the world locally', async () => {
    const user = userEvent.setup()
    render(<App />)
    const mass = screen.getByRole('spinbutton', { name: 'Mass (kg)' })
    await user.clear(mass)
    await user.type(mass, '2.5')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Save world locally' }))
    expect(localStorage.getItem('mechanarium:last-scenario')).toContain('"mass": 2.5')
    expect(screen.getByText('Saved on this device')).toBeInTheDocument()
  })

  it('applies a natural-language world-building request through the local fallback', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Ask the world-building agent'), 'Add a sphere, ramp, floor, and gravity')
    await user.click(screen.getByRole('button', { name: 'Send world-building request' }))
    expect(await screen.findByRole('heading', { name: 'Sphere' })).toBeInTheDocument()
    expect(screen.getByText(/Applied 4 world changes/i)).toBeInTheDocument()
  })
})
