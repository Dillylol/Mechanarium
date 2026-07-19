import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

describe('Mechanarium assembly studio', () => {
  it('opens the 3D world with builder, controls, and data', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projectile Motion' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: /three-dimensional physics world/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
    expect(screen.getByRole('complementary', { name: /world data/i })).toHaveTextContent('Total energy')
  })

  it('adds bodies with per-object gravity controls', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Sphere' }))
    expect(screen.getByRole('heading', { name: 'Sphere' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Gravity for this object' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: 'Gravity multiplier (×)' })).toHaveValue(1)
  })

  it('edits ramps by center, angle, and length, then removes them', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Ramp' }))
    const centerX = screen.getByRole('spinbutton', { name: 'Center x (m)' })
    await user.clear(centerX); await user.type(centerX, '-3'); await user.tab()
    expect(screen.getByRole('spinbutton', { name: 'Center x (m)' })).toHaveValue(-3)
    expect(screen.getByRole('spinbutton', { name: 'Angle (deg)' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Length (m)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place selected body at start' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Remove Ramp' }))
    expect(screen.queryByRole('heading', { name: 'Ramp' })).not.toBeInTheDocument()
  })

  it('exposes master gravity and ground toggles', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Turn Gravity Off' }))
    expect(screen.getByRole('checkbox', { name: 'Enable master gravity' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Turn Gravity On' }))
    expect(screen.getByRole('spinbutton', { name: 'Magnitude (m/s²)' })).toHaveValue(9.8066)
    await user.click(screen.getByRole('button', { name: 'Turn Floor Off' }))
    expect(screen.getByRole('button', { name: 'Turn Floor On' })).toBeEnabled()
  })

  it('builds beams, custom ports, and ropes while paused', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Beam' }))
    expect(screen.getByRole('heading', { name: 'Beam' })).toBeInTheDocument()
    const beamMode = screen.getByRole('combobox', { name: 'Beam mode' })
    expect(beamMode).toHaveValue('dynamic')
    await user.selectOptions(beamMode, 'pinned')
    expect(screen.getByRole('region', { name: 'Assembly constraints' })).toHaveTextContent('pin')
    await user.click(screen.getByRole('button', { name: 'Add Attachment Point' }))
    expect(screen.getByRole('heading', { name: 'Port 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pin this port to world' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add Rope' }))
    expect(screen.getByRole('heading', { name: 'Rope' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Maximum length (m)' })).toBeInTheDocument()
  })

  it('previews and explicitly confirms structural snaps', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add Beam' }))
    await user.click(screen.getByRole('button', { name: 'Add Attachment Point' }))
    await user.click(screen.getByRole('button', { name: 'Add Block' }))
    await user.click(screen.getByRole('button', { name: 'Add Attachment Point' }))
    await user.click(screen.getByRole('button', { name: 'Select Beam Port 1' }))
    await user.click(screen.getByRole('button', { name: 'Use as first structural port' }))
    await user.click(screen.getByRole('button', { name: 'Select Block Port 2' }))
    await user.click(screen.getByRole('button', { name: 'Preview rigid snap' }))
    expect(screen.getByRole('dialog', { name: 'Snap placement' })).toHaveTextContent('Snap candidate')
    expect(screen.getByRole('region', { name: 'Assembly constraints' })).not.toHaveTextContent('rigid')
    await user.click(screen.getByRole('button', { name: 'Snap to place' }))
    expect(screen.getByRole('region', { name: 'Assembly constraints' })).toHaveTextContent('rigid')
    expect(screen.getByText(/Snapped:/)).toBeInTheDocument()
  })

  it('loads all new prepared SHM systems', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('tab', { name: /Labs/ }))
    for (const name of ['Inclined Spring Oscillator', 'Massless-Rope Pendulum', 'Uniform-Beam Pendulum', 'Compound Beam Oscillator']) {
      await user.click(screen.getByRole('button', { name: new RegExp(name) }))
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('locks structural fields while running and resets edits to time zero', async () => {
    const callbacks = []
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callbacks.push(callback); return callbacks.length })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.getByRole('spinbutton', { name: 'Mass (kg)' })).toBeDisabled()
    act(() => callbacks.shift()(10)); act(() => callbacks.shift()(50))
    expect(screen.getByText('0.033 s')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    const mass = screen.getByRole('spinbutton', { name: 'Mass (kg)' })
    await user.clear(mass); await user.type(mass, '2.5'); await user.tab()
    expect(screen.getByText('0.000 s')).toBeInTheDocument()
    requestFrame.mockRestore(); cancelFrame.mockRestore()
  })

  it('advances one fixed step and exports assembly-aware accessible data', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Advance one fixed step' }))
    expect(screen.getByText('0.008 s')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Assembly constraints' })).toHaveTextContent('Topology valid')
  })

  it('saves Scenario v2 locally', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.click(screen.getByRole('button', { name: 'Save world locally' }))
    expect(localStorage.getItem('mechanarium:last-scenario')).toContain('"version": 2')
  })

  it('applies a natural-language assembly request through the local fallback', async () => {
    const user = userEvent.setup(); render(<App />)
    await user.type(screen.getByLabelText('Ask the world-building agent'), 'Add a sphere, beam, rope, and attachment point')
    await user.click(screen.getByRole('button', { name: 'Send world-building request' }))
    expect(await screen.findByText(/Applied 4 world changes/i)).toBeInTheDocument()
    expect(screen.getByText(/Tracks & connectors/)).toBeInTheDocument()
  })
})
