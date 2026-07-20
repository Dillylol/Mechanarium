import { describe, expect, it } from 'vitest'
import { notebookJson, notebookToCsv, telemetryToCsv } from './export.js'

describe('telemetry export', () => {
  it('exports notebook samples and gate events separately from world JSON', () => {
    const notebook = { version: 1, scenarioId: 'lab', trials: [{ id: 'trial-1', name: 'Baseline', independentVariable: 'angle', independentValue: '20 deg', notes: 'prediction', samples: [{ time: 0.1, bodyId: 'cart', bodyName: 'Cart', x: 1, y: 2, vx: 3, vy: 0, ax: 1, ay: 0, speed: 3 }], gateEvents: [{ time: 0.2, bodyId: 'cart', bodyName: 'Cart', gateId: 'gate-a', gateName: 'Gate A', direction: 1, position: { x: 2, y: 0 }, velocity: { x: 4, y: 0 }, speed: 4 }] }] }
    const csv = notebookToCsv(notebook)
    expect(csv).toContain('record_type,trial_id,trial_name')
    expect(csv).toContain('sample,trial-1,Baseline')
    expect(csv).toContain('gate,trial-1,Baseline')
    expect(notebookJson(notebook)).toContain('"scenarioId": "lab"')
  })
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
    expect(csv).toContain('angle_rad,angular_velocity_rad_s,torque_Nm,intrinsic_inertia_kg_m2,assembly_inertia_kg_m2,connector_length_m,connector_tension_N')
    expect(csv).toContain('1,"Cart, A",2,3,1.5,-2,0,-9.80665,4')
  })
})
