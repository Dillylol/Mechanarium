import { serializeScenario } from './scenario.js'

const csvCell = (value) => {
  const string = String(value ?? '')
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string
}

export function telemetryToCsv(history) {
  const columns = ['time_s', 'body', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'ax_m_s2', 'ay_m_s2', 'speed_m_s', 'angle_rad', 'angular_velocity_rad_s', 'torque_Nm', 'intrinsic_inertia_kg_m2', 'assembly_inertia_kg_m2', 'net_force_x_N', 'net_force_y_N', 'net_force_N', 'net_torque_Nm', 'angular_acceleration_rad_s2', 'tension_a_N', 'tension_b_N', 'axle_reaction_x_N', 'axle_reaction_y_N', 'normal_force_N', 'friction_force_N', 'track_coordinate_m', 'track_curvature_1_m', 'track_radius_m', 'slip_error_m_s', 'connector_length_m', 'connector_tension_N', 'connector_extension_m', 'connector_elastic_energy_J', 'translational_kinetic_J', 'rotational_kinetic_J', 'body_kinetic_J', 'body_gravitational_potential_J', 'body_height_m', 'body_mechanical_energy_J', 'system_total_energy_J', 'energy_error_percent']
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
    sample.netForceX,
    sample.netForceY,
    sample.netForce,
    sample.netTorque,
    sample.angularAcceleration,
    sample.tensionA,
    sample.tensionB,
    sample.axleReactionX,
    sample.axleReactionY,
    sample.normalForce,
    sample.frictionForce,
    sample.trackCoordinate,
    sample.trackCurvature,
    sample.trackRadius,
    sample.slipError,
    sample.connectorLength,
    sample.connectorTension,
    sample.connectorExtension,
    sample.connectorElasticEnergy,
    sample.translationalKinetic,
    sample.rotationalKinetic,
    sample.kinetic,
    sample.gravitationalPotential,
    sample.height,
    sample.totalEnergy,
    sample.systemTotalEnergy,
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
  const columns = ['record_type', 'trial_id', 'trial_name', 'independent_variable', 'independent_value', 'notes', 'time_s', 'body_id', 'body', 'x_m', 'y_m', 'vx_m_s', 'vy_m_s', 'ax_m_s2', 'ay_m_s2', 'speed_m_s', 'track_coordinate_m', 'track_curvature_1_m', 'track_radius_m', 'gate_id', 'gate_name', 'direction']
  const rows = []
  for (const trial of notebook.trials ?? []) {
    const metadata = [trial.id, trial.name, trial.independentVariable, trial.independentValue, trial.notes]
    for (const sample of trial.samples ?? []) rows.push(['sample', ...metadata, sample.time, sample.bodyId, sample.bodyName, sample.x, sample.y, sample.vx, sample.vy, sample.ax, sample.ay, sample.speed, sample.trackCoordinate, sample.trackCurvature, sample.trackRadius, '', '', ''])
    for (const event of trial.gateEvents ?? []) rows.push(['gate', ...metadata, event.time, event.bodyId, event.bodyName, event.position?.x, event.position?.y, event.velocity?.x, event.velocity?.y, '', '', event.speed, '', '', '', event.gateId, event.gateName, event.direction])
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
