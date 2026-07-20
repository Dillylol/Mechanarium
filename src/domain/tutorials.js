const investigationSteps = (measurement) => [
  { id: 'objective', title: 'Learning objective', instruction: 'Read the objective and identify the phenomenon you will test.', completion: 'manual' },
  { id: 'prediction', title: 'Make a prediction', instruction: 'State what you expect to change, what should remain constant, and why.', completion: 'manual', hint: 'Use a principle, not just a direction such as “faster.”' },
  { id: 'setup', title: 'Inspect the setup', instruction: 'Load the prepared world and verify its bodies, interactions, and initial conditions.', completion: 'preset' },
  { id: 'measure', title: 'Choose evidence', instruction: measurement, completion: 'manual', hint: 'A useful measurement must distinguish between competing predictions.' },
  { id: 'run', title: 'Run the experiment', instruction: 'Run or step the world and watch the relevant telemetry.', completion: 'ran' },
  { id: 'evidence', title: 'Review evidence', instruction: 'Compare your prediction with the observed motion, force, or energy data.', completion: 'manual' },
  { id: 'explain', title: 'Explain', instruction: 'Write a claim supported by a measurement and the governing physics principle.', completion: 'manual', hint: 'Separate what you observed from what you infer.' },
]

export const TUTORIALS = Object.freeze([
  {
    id: 'onboarding', name: 'Mechanarium Basics', category: 'Interface tour', presetId: null,
    objective: 'Build, edit, run, measure, record, and ask Vector without changing hidden physics.',
    steps: [
      { id: 'navigate', title: 'Navigate the laboratory', instruction: 'Orbit with an empty-space drag, zoom with the wheel, and select a visible object.', completion: 'manual' },
      { id: 'build', title: 'Build', instruction: 'Use Build to add a body, track, connector, or force.', completion: 'manual' },
      { id: 'edit', title: 'Edit', instruction: 'Pause, select an entity, then drag it or use its exact Inspector fields.', completion: 'manual' },
      { id: 'run', title: 'Run and reset', instruction: 'Run, pause, single-step, change playback speed, and reset the world.', completion: 'ran' },
      { id: 'measure', title: 'Measure', instruction: 'Place a ruler or photogate and inspect live telemetry.', completion: 'instrument' },
      { id: 'record', title: 'Record evidence', instruction: 'Arm a trial, run the world, save it, and compare or export the result.', completion: 'trial' },
      { id: 'vector', title: 'Ask Vector', instruction: 'Ask for a world change or a conceptual explanation. Large changes appear as previews.', completion: 'manual' },
    ],
  },
  { id: 'projectile-lab', name: 'Projectile Independence', category: 'Kinematics', presetId: 'projectile-motion', objective: 'Use motion data to distinguish horizontal and vertical acceleration.', steps: investigationSteps('Track vx, vy, ax, and ay. Decide which values should stay constant.') },
  { id: 'incline-lab', name: 'Rolling Down an Incline', category: 'Rotation', presetId: 'rolling-incline', objective: 'Connect gravitational energy, translation, rotation, and static friction.', steps: investigationSteps('Measure speed and angular speed, then compare v with ωR.') },
  { id: 'atwood-lab', name: 'Massive Pulley Atwood', category: 'Dynamics', presetId: 'rotating-atwood', objective: 'Explain why pulley inertia produces unequal rope tensions and lower acceleration.', steps: investigationSteps('Compare tension A, tension B, pulley torque, and mass acceleration.') },
  { id: 'loop-lab', name: 'Loop Contact', category: 'Circular motion', presetId: 'loop-the-loop', objective: 'Find how release height determines whether an object maintains contact at the top of a loop.', steps: investigationSteps('Watch speed, curvature radius, normal force, and whether track contact is retained.') },
])

export function getTutorial(id) {
  return TUTORIALS.find((tutorial) => tutorial.id === id) ?? null
}
