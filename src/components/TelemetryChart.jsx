import { useEffect, useRef } from 'react'

export default function TelemetryChart({ history }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const width = canvas.clientWidth || 420
    const height = canvas.clientHeight || 150
    const ratio = window.devicePixelRatio || 1
    const pixelWidth = Math.round(width * ratio)
    const pixelHeight = Math.round(height * ratio)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#fafaf7'; context.fillRect(0, 0, width, height)
    if (history.length < 2) {
      context.fillStyle = '#70706c'; context.font = '11px Inter, sans-serif'; context.fillText('Run or step to collect data.', 12, 24)
      return
    }
    const samples = history.slice(-240)
    const maxEnergy = Math.max(...samples.flatMap((sample) => [Math.abs(sample.kinetic), Math.abs(sample.potential), Math.abs(sample.totalEnergy)]), 1)
    const minEnergy = Math.min(...samples.flatMap((sample) => [sample.kinetic, sample.potential, sample.totalEnergy]), 0)
    const range = Math.max(maxEnergy - minEnergy, 1e-9)
    const colors = { kinetic: '#009d5b', potential: '#b32727', totalEnergy: '#111111' }
    for (const key of Object.keys(colors)) {
      context.strokeStyle = colors[key]; context.lineWidth = key === 'totalEnergy' ? 2.5 : 1.5
      context.beginPath()
      samples.forEach((sample, index) => {
        const x = 12 + (index / (samples.length - 1)) * (width - 24)
        const y = height - 16 - ((sample[key] - minEnergy) / range) * (height - 30)
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
      })
      context.stroke()
    }
  }, [history])

  return (
    <div className="chart-wrap">
      <div className="chart-legend" aria-hidden="true"><span className="kinetic">Kinetic</span><span className="potential">Potential</span><span className="total">Total</span></div>
      <canvas ref={canvasRef} className="telemetry-chart" role="img" aria-label="Energy history chart showing kinetic, potential, and total energy" />
    </div>
  )
}
