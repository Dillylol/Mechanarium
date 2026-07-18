import { DEFAULT_FIXED_STEP, DEFAULT_MAX_FRAME_DELTA, DEFAULT_MAX_STEPS } from './constants.js'

export function createFixedStepClock(options = {}) {
  const fixedStep = options.fixedStep ?? DEFAULT_FIXED_STEP
  const maxFrameDelta = options.maxFrameDelta ?? DEFAULT_MAX_FRAME_DELTA
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS

  if (!(fixedStep > 0) || !(maxFrameDelta > 0) || !(maxSteps > 0)) {
    throw new RangeError('Clock values must be greater than zero.')
  }

  let accumulator = 0
  let simulationTime = 0
  let droppedTime = 0

  return {
    get fixedStep() { return fixedStep },
    get simulationTime() { return simulationTime },
    get droppedTime() { return droppedTime },

    advance(frameDelta, step) {
      if (!Number.isFinite(frameDelta) || frameDelta < 0) {
        throw new RangeError('Frame delta must be a finite, non-negative number.')
      }

      const acceptedDelta = Math.min(frameDelta, maxFrameDelta)
      droppedTime += frameDelta - acceptedDelta
      accumulator += acceptedDelta
      let steps = 0

      while (accumulator + Number.EPSILON >= fixedStep && steps < maxSteps) {
        step(fixedStep, simulationTime)
        simulationTime += fixedStep
        accumulator -= fixedStep
        steps += 1
      }

      if (steps === maxSteps && accumulator >= fixedStep) {
        const overflowSteps = Math.floor((accumulator + Number.EPSILON) / fixedStep)
        const skipped = overflowSteps * fixedStep
        droppedTime += skipped
        accumulator -= skipped
      }

      return { steps, alpha: accumulator / fixedStep, simulationTime, droppedTime }
    },

    reset() {
      accumulator = 0
      simulationTime = 0
      droppedTime = 0
    },
  }
}
