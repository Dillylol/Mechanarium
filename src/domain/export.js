import { serializeScenario } from './scenario.js'

const csvCell = (value) => {
  const string = String(value ?? '')
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

export function telemetryToCsv(history) {
  const columns = ['time_s', 'body', 'x_m', 'y_m', 'speed_m_s', 'kinetic_J', 'potential_J', 'total_energy_J', 'energy_error_percent']
  const rows = history.map((sample) => [
    sample.time,
    sample.body,
    sample.x,
    sample.y,
    sample.speed,
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

export function downloadText(filename, contents, type) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
