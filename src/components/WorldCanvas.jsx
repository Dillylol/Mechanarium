import { useEffect, useRef, useState } from 'react'
import { netForceOnBody } from '../physics/forces.js'
import { magnitude } from '../physics/vector.js'

function makeTransform(bounds, width, height) {
  const worldWidth = bounds.maxX - bounds.minX
  const worldHeight = bounds.maxY - bounds.minY
  const scale = Math.min(width / worldWidth, height / worldHeight)
  const offsetX = (width - worldWidth * scale) / 2
  const offsetY = (height - worldHeight * scale) / 2
  return {
    scale,
    toScreen: (point) => ({
      x: offsetX + (point.x - bounds.minX) * scale,
      y: height - offsetY - (point.y - bounds.minY) * scale,
    }),
    toWorld: (point) => ({
      x: (point.x - offsetX) / scale + bounds.minX,
      y: (height - point.y - offsetY) / scale + bounds.minY,
    }),
  }
}

function arrow(context, start, force, transform, color) {
  const forceMagnitude = magnitude(force)
  if (forceMagnitude < 0.01) return
  const visualLength = Math.min(90, 18 + Math.log1p(forceMagnitude) * 16)
  const unit = { x: force.x / forceMagnitude, y: -force.y / forceMagnitude }
  const end = { x: start.x + unit.x * visualLength, y: start.y + unit.y * visualLength }
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(start.x, start.y)
  context.lineTo(end.x, end.y)
  context.stroke()
  context.save()
  context.translate(end.x, end.y)
  context.rotate(Math.atan2(unit.y, unit.x))
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(-8, -4)
  context.lineTo(-8, 4)
  context.closePath()
  context.fill()
  context.restore()
  context.fillStyle = '#d8e7f6'
  context.font = '11px Inter, sans-serif'
  context.fillText(`F = ${forceMagnitude.toFixed(1)} N`, end.x + 5, end.y - 5)
  void transform
}

export default function WorldCanvas({ world, selectedId, onSelect, onMove, onNudge, onDelete, onToggle, running, history, overlays }) {
  const canvasRef = useRef(null)
  const [dragging, setDragging] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const width = canvas.clientWidth || 900
    const height = canvas.clientHeight || 600
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const transform = makeTransform(world.bounds, width, height)

    context.fillStyle = '#081321'
    context.fillRect(0, 0, width, height)

    if (overlays.grid) {
      context.strokeStyle = 'rgba(143, 184, 255, .09)'
      context.lineWidth = 1
      for (let x = Math.ceil(world.bounds.minX); x <= world.bounds.maxX; x += 1) {
        const a = transform.toScreen({ x, y: world.bounds.minY })
        const b = transform.toScreen({ x, y: world.bounds.maxY })
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke()
      }
      for (let y = Math.ceil(world.bounds.minY); y <= world.bounds.maxY; y += 1) {
        const a = transform.toScreen({ x: world.bounds.minX, y })
        const b = transform.toScreen({ x: world.bounds.maxX, y })
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke()
      }
    }

    for (const force of world.forces) {
      if (force.type === 'spring') {
        const body = world.bodies.find((candidate) => candidate.id === force.bodyId)
        if (body) {
          const start = transform.toScreen(force.anchor)
          const end = transform.toScreen(body.position)
          context.strokeStyle = '#ff7fa6'
          context.lineWidth = 3
          context.setLineDash([6, 5])
          context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
          context.setLineDash([])
        }
      }
      if (force.type === 'central') {
        const center = transform.toScreen(force.center)
        const gradient = context.createRadialGradient(center.x, center.y, 2, center.x, center.y, 28)
        gradient.addColorStop(0, '#fff3b0')
        gradient.addColorStop(1, 'rgba(255, 179, 92, 0)')
        context.fillStyle = gradient
        context.beginPath(); context.arc(center.x, center.y, 28, 0, Math.PI * 2); context.fill()
      }
    }

    for (const constraint of world.constraints) {
      if (constraint.type === 'ground') {
        const start = transform.toScreen({ x: world.bounds.minX, y: constraint.y })
        const end = transform.toScreen({ x: world.bounds.maxX, y: constraint.y })
        context.strokeStyle = '#6c839d'; context.lineWidth = 3
        context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
      }
      if (constraint.type === 'incline') {
        const start = transform.toScreen(constraint.start)
        const end = transform.toScreen(constraint.end)
        context.strokeStyle = '#9eb1c7'; context.lineWidth = 6; context.lineCap = 'round'
        context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke()
      }
    }

    if (overlays.trails) {
      const trail = history.filter((sample) => sample.bodyId === selectedId)
      if (trail.length > 1) {
        context.strokeStyle = 'rgba(120, 230, 213, .55)'; context.lineWidth = 2
        context.beginPath()
        trail.forEach((sample, index) => {
          const point = transform.toScreen(sample)
          if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y)
        })
        context.stroke()
      }
    }

    for (const body of world.bodies) {
      const point = transform.toScreen(body.position)
      const radius = Math.max(10, body.radius * transform.scale)
      context.save()
      context.translate(point.x, point.y)
      context.rotate(-body.angle)
      context.fillStyle = body.color
      context.shadowColor = `${body.color}66`
      context.shadowBlur = 18
      context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill()
      context.shadowBlur = 0
      context.strokeStyle = 'rgba(5, 15, 25, .7)'; context.lineWidth = 3
      context.beginPath(); context.moveTo(0, 0); context.lineTo(radius * .78, 0); context.stroke()
      if (body.id === selectedId) {
        context.strokeStyle = '#ffffff'; context.lineWidth = 2; context.setLineDash([4, 4])
        context.beginPath(); context.arc(0, 0, radius + 7, 0, Math.PI * 2); context.stroke()
      }
      context.restore()
      context.fillStyle = '#edf5ff'; context.font = '600 12px Inter, sans-serif'; context.textAlign = 'center'
      context.fillText(body.name, point.x, point.y + radius + 20)
      if (overlays.vectors) arrow(context, point, netForceOnBody(world.forces, body), transform, '#78e6d5')
    }
  }, [history, overlays, selectedId, world])

  const eventPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const bodyAt = (point) => {
    const canvas = canvasRef.current
    const transform = makeTransform(world.bounds, canvas.clientWidth || 900, canvas.clientHeight || 600)
    const worldPoint = transform.toWorld(point)
    return [...world.bodies].reverse().find((body) => Math.hypot(body.position.x - worldPoint.x, body.position.y - worldPoint.y) <= body.radius * 1.5)
  }

  const onPointerDown = (event) => {
    const body = bodyAt(eventPoint(event))
    if (!body) return
    onSelect(body.id)
    if (!running) {
      setDragging(body.id)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
  }

  const onPointerMove = (event) => {
    if (!dragging || running) return
    const canvas = canvasRef.current
    const transform = makeTransform(world.bounds, canvas.clientWidth || 900, canvas.clientHeight || 600)
    onMove(dragging, transform.toWorld(eventPoint(event)))
  }

  const onKeyDown = (event) => {
    if (event.code === 'Space') { event.preventDefault(); onToggle(); return }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete(); return }
    const directions = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }
    if (directions[event.key] && !running) {
      event.preventDefault()
      onNudge(...directions[event.key])
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="world-canvas"
      role="img"
      tabIndex="0"
      aria-label="Interactive physics world. Select a body, then use arrow keys to reposition it while paused. Press Space to play or pause."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
      onKeyDown={onKeyDown}
    />
  )
}
