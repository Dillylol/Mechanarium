import { useEffect, useMemo, useRef } from 'react'

const SERIES = {
  energy: [
    { key: 'kinetic', label: 'Kinetic', color: '#009d5b' },
    { key: 'potential', label: 'Potential', color: '#b32727' },
    { key: 'totalEnergy', label: 'Total', color: '#111111' },
  ],
  kinematics: [
    { key: 'x', label: 'Position x', color: '#009d5b' },
    { key: 'y', label: 'Position y', color: '#009fe3' },
    { key: 'speed', label: 'Speed', color: '#b32727' },
  ],
}

const DYNAMICS_SERIES = {
  netTorque: { key: 'netTorque', label: 'Net torque', color: '#f2cf00' },
  netForce: { key: 'netForce', label: 'Net force', color: '#111111' },
  angularAcceleration: { key: 'angularAcceleration', label: 'Angular acceleration', color: '#7a3db8' },
  tensionA: { key: 'tensionA', label: 'Tension A', color: '#009fe3' },
  tensionB: { key: 'tensionB', label: 'Tension B', color: '#006f9e' },
}

export default function TelemetryChart({ history, mode = 'energy', dynamicsMetric = 'netTorque' }) {
  const canvasRef = useRef(null)
  const series = useMemo(() => mode === 'dynamics' ? [DYNAMICS_SERIES[dynamicsMetric]] : SERIES[mode], [dynamicsMetric, mode])

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
    const values = samples.flatMap((sample) => series.map(({ key }) => sample[key] ?? 0))
    const maxValue = Math.max(...values, 1)
    const minValue = Math.min(...values, 0)
    const range = Math.max(maxValue - minValue, 1e-9)
    for (const { key, color } of series) {
      context.strokeStyle = color
      context.lineWidth = key === 'totalEnergy' || key === 'speed' ? 2.5 : 1.5
      context.beginPath()
      samples.forEach((sample, index) => {
        const x = 12 + (index / (samples.length - 1)) * (width - 24)
        const y = height - 16 - (((sample[key] ?? 0) - minValue) / range) * (height - 30)
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
      })
      context.stroke()
    }
  }, [dynamicsMetric, history, mode, series])

  return (
    <div className="chart-wrap">
      <div className="chart-legend" aria-hidden="true">{series.map(({ key, label, color }) => <span key={key} style={{ color }}>{label}</span>)}</div>
      <canvas ref={canvasRef} className="telemetry-chart" role="img" aria-label={`${mode === 'energy' ? 'Energy' : mode === 'dynamics' ? 'Dynamics' : 'Kinematics'} history chart`} />
    </div>
  )
}
