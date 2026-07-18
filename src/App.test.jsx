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

  it('makes ramps editable and removable', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Ramp' }))
    const startX = screen.getByRole('spinbutton', { name: 'Start x (m)' })
    await user.clear(startX)
    await user.type(startX, '-3')
    await user.tab()
    expect(screen.getByRole('spinbutton', { name: 'Start x (m)' })).toHaveValue(-3)
    await user.click(screen.getByRole('button', { name: 'Remove Ramp' }))
    expect(screen.queryByRole('spinbutton', { name: 'Start x (m)' })).not.toBeInTheDocument()
  })

  it('exposes clear gravity and ground toggles', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Turn Gravity Off' }))
    expect(screen.getByRole('button', { name: 'Turn Gravity On' })).toBeEnabled()
    expect(screen.queryByRole('spinbutton', { name: 'Acceleration (m/s²)' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Turn Gravity On' }))
    expect(screen.getByRole('spinbutton', { name: 'Acceleration (m/s²)' })).toHaveValue(9.8066)

    await user.click(screen.getByRole('button', { name: 'Turn Floor Off' }))
    expect(screen.getByRole('button', { name: 'Turn Floor On' })).toBeEnabled()
  })

  it('gives newly spawned bodies gravity and a collision ground in a floating lab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: /Labs/ }))
    await user.click(screen.getByRole('button', { name: /Spring Oscillator/ }))
    await user.click(screen.getByRole('tab', { name: /Build/ }))
    expect(screen.getByRole('button', { name: 'Turn Gravity On' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(screen.getByRole('button', { name: 'Turn Gravity Off' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Turn Floor Off' })).toBeEnabled()
  })

  it('presents selected-body kinematics and can prepare an orbit manually', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Kinematics' }))
    expect(screen.getByText('Speed · Projectile')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kinematics history chart' })).toBeInTheDocument()
    expect(screen.getByText('-9.81 m/s²')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Attractor' }))
    await user.click(screen.getByRole('button', { name: 'Prepare clean circular orbit' }))
    expect(screen.getByRole('button', { name: 'Turn Gravity On' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Turn Floor On' })).toBeEnabled()
    expect(screen.getByRole('table')).toHaveTextContent('1.7')
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
