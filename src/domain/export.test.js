import { describe, expect, it } from 'vitest'
import { telemetryToCsv } from './export.js'

describe('telemetry export', () => {
  it('creates a labelled SI-unit CSV and escapes body names', () => {
    const csv = telemetryToCsv([{
      time: 1,
      body: 'Cart, A',
      x: 2,
      y: 3,
      vx: 1.5,
      vy: -2,
      ax: 0,
      ay: -9.80665,
      speed: 4,
      kinetic: 5,
      potential: 6,
      totalEnergy: 11,
      energyError: 0.1,
    }])
    expect(csv).toContain('time_s,body,x_m,y_m,vx_m_s,vy_m_s,ax_m_s2,ay_m_s2,speed_m_s')
    expect(csv).toContain('1,"Cart, A",2,3,1.5,-2,0,-9.80665,4,5,6,11,0.1')
  })
})
