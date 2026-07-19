import { useEffect, useRef, useState } from 'react'

const SERIES = {
  time: { label: 'Time', unit: 's' },
  x: { label: 'Position x', unit: 'm' },
  y: { label: 'Position y', unit: 'm' },
  vx: { label: 'Velocity x', unit: 'm/s' },
  vy: { label: 'Velocity y', unit: 'm/s' },
  ax: { label: 'Acceleration x', unit: 'm/s²' },
  ay: { label: 'Acceleration y', unit: 'm/s²' },
  speed: { label: 'Speed', unit: 'm/s' },
}

export default function TrialPlot({ trials }) {
  const canvasRef = useRef(null)
  const [xKey, setXKey] = useState('time')
  const [yKey, setYKey] = useState('speed')

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const width = canvas.clientWidth || 420
    const height = canvas.clientHeight || 150
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#fafaf7'; context.fillRect(0, 0, width, height)
    const drawable = trials.map((trial) => ({ trial, samples: trial.samples?.filter((sample) => Number.isFinite(sample[xKey]) && Number.isFinite(sample[yKey])) ?? [] })).filter(({ samples }) => samples.length > 1)
    if (!drawable.length) { context.fillStyle = '#70706c'; context.font = '11px Inter, sans-serif'; context.fillText('Save a recorded trial to plot measurements.', 12, 24); return }
    const points = drawable.flatMap(({ samples }) => samples)
    const minX = Math.min(...points.map((sample) => sample[xKey])); const maxX = Math.max(...points.map((sample) => sample[xKey]))
    const minY = Math.min(...points.map((sample) => sample[yKey])); const maxY = Math.max(...points.map((sample) => sample[yKey]))
    const rangeX = Math.max(maxX - minX, 1e-9); const rangeY = Math.max(maxY - minY, 1e-9)
    const colors = ['#111111', '#009d5b', '#009fe3', '#b32727']
    drawable.forEach(({ samples }, trialIndex) => {
      context.strokeStyle = colors[trialIndex % colors.length]; context.lineWidth = 2; context.beginPath()
      samples.forEach((sample, index) => {
        const x = 12 + ((sample[xKey] - minX) / rangeX) * (width - 24)
        const y = height - 16 - ((sample[yKey] - minY) / rangeY) * (height - 30)
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
      })
      context.stroke()
    })
  }, [trials, xKey, yKey])

  return <section className="trial-plot" aria-label="Trial plot">
    <div className="trial-plot-controls">
      <label>Horizontal axis<select aria-label="Trial plot horizontal axis" value={xKey} onChange={(event) => setXKey(event.target.value)}>{Object.entries(SERIES).map(([key, series]) => <option key={key} value={key}>{series.label} ({series.unit})</option>)}</select></label>
      <label>Vertical axis<select aria-label="Trial plot vertical axis" value={yKey} onChange={(event) => setYKey(event.target.value)}>{Object.entries(SERIES).map(([key, series]) => <option key={key} value={key}>{series.label} ({series.unit})</option>)}</select></label>
    </div>
    <canvas ref={canvasRef} className="telemetry-chart" role="img" aria-label={`${SERIES[yKey].label} versus ${SERIES[xKey].label} for saved trials`} />
  </section>
}
