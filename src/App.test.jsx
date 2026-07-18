import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'

describe('Mechanarium sandbox', () => {
  it('loads the projectile lab with accessible controls and data', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projectile Motion' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
    expect(screen.getByRole('img', { name: /interactive physics world/i })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('Projectile')
  })

  it('switches presets and resets the inspector selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Spring Oscillator/i }))
    expect(screen.getByRole('heading', { name: 'Spring Oscillator' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spring mass' })).toBeInTheDocument()
  })

  it('steps deterministically and collects exportable data', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Step' }))
    expect(screen.getByText('0.008 s')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Export collected data/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Telemetry CSV exported')
  })

  it('adds a configurable body while paused', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add body' }))
    expect(screen.getByRole('heading', { name: 'Body 2' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('Body 2')
  })

  it('edits body properties and stores a local scenario', async () => {
    const user = userEvent.setup()
    render(<App />)
    const mass = screen.getByRole('spinbutton', { name: 'Mass (kg)' })
    await user.clear(mass)
    await user.type(mass, '2.5')
    await user.tab()
    expect(screen.getByRole('spinbutton', { name: 'Mass (kg)' })).toHaveValue(2.5)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(localStorage.getItem('mechanarium:last-scenario')).toContain('"mass": 2.5')
    expect(screen.getByRole('status')).toHaveTextContent('saved on this device')
  })

  it('allows visual overlays to be toggled independently', async () => {
    const user = userEvent.setup()
    render(<App />)
    const vectors = screen.getByRole('checkbox', { name: 'vectors' })
    expect(vectors).toBeChecked()
    await user.click(vectors)
    expect(vectors).not.toBeChecked()
  })
})
