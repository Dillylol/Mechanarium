import { serializeScenario } from './scenario.js'

const csvCell = (value) => {
  const string = String(value ?? '')
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

export function telemetryToCsv(history) {
  const columns = ['time_s', 'body', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'ax_m_s2', 'ay_m_s2', 'speed_m_s', 'angle_rad', 'angular_velocity_rad_s', 'torque_Nm', 'intrinsic_inertia_kg_m2', 'assembly_inertia_kg_m2', 'connector_length_m', 'connector_tension_N', 'connector_extension_m', 'connector_elastic_energy_J', 'kinetic_J', 'potential_J', 'total_energy_J', 'energy_error_percent']
  const rows = history.map((sample) => [
    sample.time,
    sample.body,
    sample.x,
    sample.y,
    sample.vx,
    sample.vy,
    sample.ax,
    sample.ay,
    sample.speed,
    sample.angle,
    sample.angularVelocity,
    sample.torque,
    sample.inertia,
    sample.assemblyInertia,
    sample.connectorLength,
    sample.connectorTension,
    sample.connectorExtension,
    sample.connectorElasticEnergy,
    sample.kinetic,
    sample.potential,
    sample.totalEnergy,
    sample.energyError,
  ])
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function scenarioJson(scenario) {
  return serializeScenario(scenario)
}

export function notebookJson(notebook) {
  return JSON.stringify(notebook, null, 2)
}

export function notebookToCsv(notebook) {
  const columns = ['record_type', 'trial_id', 'trial_name', 'independent_variable', 'independent_value', 'notes', 'time_s', 'body_id', 'body', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'ax_m_s2', 'ay_m_s2', 'speed_m_s', 'gate_id', 'gate_name', 'direction']
  const rows = []
  for (const trial of notebook.trials ?? []) {
    const metadata = [trial.id, trial.name, trial.independentVariable, trial.independentValue, trial.notes]
    for (const sample of trial.samples ?? []) rows.push(['sample', ...metadata, sample.time, sample.bodyId, sample.bodyName, sample.x, sample.y, sample.vx, sample.vy, sample.ax, sample.ay, sample.speed, '', '', ''])
    for (const event of trial.gateEvents ?? []) rows.push(['gate', ...metadata, event.time, event.bodyId, event.bodyName, event.position?.x, event.position?.y, event.velocity?.x, event.velocity?.y, '', '', event.speed, event.gateId, event.gateName, event.direction])
  }
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
