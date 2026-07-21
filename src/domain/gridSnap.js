export function snapToGrid(position, step) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !step || step <= 0) {
    return position
  }
  const snapVal = (val) => {
    const inv = 1 / step
    return Math.round(val * inv) / inv
  }
  return {
    x: snapVal(position.x),
    y: snapVal(position.y),
  }
}
