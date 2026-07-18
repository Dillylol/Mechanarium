import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { netForceOnBody } from '../physics/forces.js'

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else child.material?.dispose()
  })
}

function bodyGeometry(body) {
  if (body.shape === 'box') return new THREE.BoxGeometry(body.width, body.height, body.width)
  if (/cylinder|roller/i.test(body.name)) return new THREE.CylinderGeometry(body.radius, body.radius, Math.max(0.45, body.radius * 1.4), 32)
  return new THREE.SphereGeometry(body.radius, 32, 20)
}

export default function WorldScene3D({ world, selectedId, onSelect, onMove, onMoveConstraint, onNudge, onDelete, onToggle, running, history, overlays }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const bodiesRef = useRef(new Map())
  const arrowsRef = useRef(new Map())
  const constraintsRef = useRef(null)
  const forceArtifactsRef = useRef(null)
  const springsRef = useRef(new Map())
  const trailRef = useRef(null)
  const gridRef = useRef(null)
  const handlersRef = useRef({ onSelect, onMove, onMoveConstraint, running })

  useEffect(() => {
    handlersRef.current = { onSelect, onMove, onMoveConstraint, running }
  }, [onMove, onMoveConstraint, onSelect, running])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || typeof WebGLRenderingContext === 'undefined') return undefined
    const bodyMeshes = bodiesRef.current
    const forceArrows = arrowsRef.current
    const springArtifacts = springsRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf4f4f0)
    scene.fog = new THREE.Fog(0xf4f4f0, 22, 42)
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100)
    camera.position.set(8, 6.5, 30)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'three-canvas'
    mount.prepend(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.minDistance = 7
    controls.maxDistance = 34
    controls.maxPolarAngle = Math.PI * 0.88

    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.1))
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
    keyLight.position.set(-5, 12, 8)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    scene.add(keyLight)

    const grid = new THREE.GridHelper(26, 26, 0x111111, 0xb9b9b4)
    grid.position.y = -3.6
    scene.add(grid)
    gridRef.current = grid

    const constraints = new THREE.Group()
    const forceArtifacts = new THREE.Group()
    scene.add(constraints, forceArtifacts)
    constraintsRef.current = constraints
    forceArtifactsRef.current = forceArtifacts
    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls

    const resize = () => {
      const width = mount.clientWidth || 900
      const height = mount.clientHeight || 600
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const intersection = new THREE.Vector3()
    let draggingId = null
    let draggingConstraint = null

    const setPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
    }

    const pointerDown = (event) => {
      setPointer(event)
      const hits = raycaster.intersectObjects([...bodiesRef.current.values(), ...constraintsRef.current.children], false)
      const bodyId = hits[0]?.object?.userData?.bodyId
      const constraintId = hits[0]?.object?.userData?.constraintId
      if (bodyId) handlersRef.current.onSelect(bodyId)
      if (bodyId && !handlersRef.current.running) {
        draggingId = bodyId
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (constraintId && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const center = hits[0].object.userData.center
        draggingConstraint = { id: constraintId, offset: { x: intersection.x - center.x, y: intersection.y - center.y } }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
    }

    const pointerMove = (event) => {
      if ((!draggingId && !draggingConstraint) || handlersRef.current.running) return
      setPointer(event)
      if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
        if (draggingId) handlersRef.current.onMove(draggingId, { x: intersection.x, y: intersection.y })
        if (draggingConstraint) handlersRef.current.onMoveConstraint(draggingConstraint.id, { x: intersection.x - draggingConstraint.offset.x, y: intersection.y - draggingConstraint.offset.y })
      }
    }

    const release = () => {
      draggingId = null
      draggingConstraint = null
      controls.enabled = true
    }

    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', release)
    renderer.domElement.addEventListener('pointercancel', release)

    let frame
    const render = () => {
      const blend = handlersRef.current.running ? 0.28 : 1
      for (const mesh of bodiesRef.current.values()) {
        if (mesh.userData.targetPosition) mesh.position.lerp(mesh.userData.targetPosition, blend)
        if (Number.isFinite(mesh.userData.targetAngle)) {
          mesh.rotation.z += (mesh.userData.targetAngle - mesh.rotation.z) * blend
        }
      }
      for (const [id, arrow] of arrowsRef.current) {
        const mesh = bodiesRef.current.get(id)
        if (mesh) arrow.position.copy(mesh.position)
      }
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', release)
      renderer.domElement.removeEventListener('pointercancel', release)
      controls.dispose()
      renderer.dispose()
      disposeObject(scene)
      renderer.domElement.remove()
      bodyMeshes.clear()
      forceArrows.clear()
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      controlsRef.current = null
      constraintsRef.current = null
      forceArtifactsRef.current = null
      springArtifacts.clear()
      trailRef.current = null
      gridRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!gridRef.current) return
    const ground = world.constraints.find((constraint) => constraint.type === 'ground')
    gridRef.current.visible = overlays.grid
    gridRef.current.position.y = ground?.y ?? -3.6
    gridRef.current.material.transparent = true
    gridRef.current.material.opacity = ground ? 1 : 0.22
  }, [overlays.grid, world.constraints])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const present = new Set(world.bodies.map((body) => body.id))

    for (const [id, mesh] of bodiesRef.current) {
      if (!present.has(id)) {
        scene.remove(mesh)
        disposeObject(mesh)
        bodiesRef.current.delete(id)
      }
    }

    for (const body of world.bodies) {
      let mesh = bodiesRef.current.get(body.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          bodyGeometry(body),
          new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.46, metalness: 0.04 }),
        )
        mesh.userData.bodyId = body.id
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.targetPosition = new THREE.Vector3(body.position.x, body.position.y, 0)
        mesh.userData.targetAngle = body.angle
        mesh.position.copy(mesh.userData.targetPosition)
        scene.add(mesh)
        bodiesRef.current.set(body.id, mesh)
      }
      mesh.userData.targetPosition.set(body.position.x, body.position.y, 0)
      mesh.userData.targetAngle = body.angle
      if (!running) mesh.position.copy(mesh.userData.targetPosition)
      if (/cylinder|roller/i.test(body.name)) mesh.rotation.x = Math.PI / 2
      if (!running) mesh.rotation.z = body.angle
      mesh.material.color.set(body.color)
      mesh.material.emissive.set(body.id === selectedId ? 0x2d2d2d : 0x000000)
    }

    for (const [id, arrow] of arrowsRef.current) {
      if (!present.has(id) || !overlays.vectors) {
        scene.remove(arrow)
        disposeObject(arrow)
        arrowsRef.current.delete(id)
      }
    }

    if (overlays.vectors) {
      for (const body of world.bodies) {
        const force = netForceOnBody(world.forces, body)
        const magnitude = Math.hypot(force.x, force.y)
        let arrow = arrowsRef.current.get(body.id)
        if (magnitude < 0.01) {
          if (arrow) arrow.visible = false
          continue
        }
        if (!arrow) {
          arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x009d5b, 0.24, 0.14)
          scene.add(arrow)
          arrowsRef.current.set(body.id, arrow)
        }
        arrow.visible = true
        arrow.position.copy(bodiesRef.current.get(body.id).position)
        arrow.setDirection(new THREE.Vector3(force.x / magnitude, force.y / magnitude, 0))
        arrow.setLength(Math.min(3.4, 0.75 + Math.log1p(magnitude) * 0.55), 0.24, 0.14)
      }
    }

    if (!trailRef.current) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(280 * 3), 3))
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x009d5b, transparent: true, opacity: 0.52 }))
      line.frustumCulled = false
      scene.add(line)
      trailRef.current = line
    }
    const samples = overlays.trails ? history.filter((sample) => sample.bodyId === selectedId).slice(-280) : []
    const trail = trailRef.current
    const positions = trail.geometry.getAttribute('position')
    samples.forEach((sample, index) => positions.setXYZ(index, sample.x, sample.y, -0.03))
    positions.needsUpdate = samples.length > 0
    trail.geometry.setDrawRange(0, samples.length)
    trail.visible = samples.length > 1
    if (trail.visible) trail.geometry.computeBoundingSphere()
  }, [history, overlays.trails, overlays.vectors, running, selectedId, world.bodies, world.forces])

  useEffect(() => {
    const group = constraintsRef.current
    const forceGroup = forceArtifactsRef.current
    if (!group || !forceGroup) return
    for (const child of [...group.children]) { group.remove(child); disposeObject(child) }
    for (const child of [...forceGroup.children]) { forceGroup.remove(child); disposeObject(child) }
    springsRef.current.clear()

    for (const constraint of world.constraints) {
      if (constraint.type === 'incline') {
        const dx = constraint.end.x - constraint.start.x
        const dy = constraint.end.y - constraint.start.y
        const length = Math.hypot(dx, dy)
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 1.35), new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.75 }))
        ramp.position.set((constraint.start.x + constraint.end.x) / 2, (constraint.start.y + constraint.end.y) / 2, 0)
        ramp.rotation.z = Math.atan2(dy, dx)
        ramp.receiveShadow = true
        ramp.userData.constraintId = constraint.id
        ramp.userData.center = { x: ramp.position.x, y: ramp.position.y }
        group.add(ramp)
      }
    }

    for (const force of world.forces) {
      if (force.type === 'spring') {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
        const spring = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 }))
        spring.frustumCulled = false
        forceGroup.add(spring)
        springsRef.current.set(force.id, spring)
      }
      if (force.type === 'central') {
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x009fe3, roughness: 0.35 }))
        core.position.set(force.center.x, force.center.y, 0)
        core.castShadow = true
        forceGroup.add(core)
      }
    }
  }, [world.constraints, world.forces])

  useEffect(() => {
    for (const force of world.forces) {
      if (force.type !== 'spring') continue
      const spring = springsRef.current.get(force.id)
      const body = world.bodies.find((candidate) => candidate.id === force.bodyId)
      if (!spring || !body) continue
      const positions = spring.geometry.getAttribute('position')
      positions.setXYZ(0, force.anchor.x, force.anchor.y, 0)
      positions.setXYZ(1, body.position.x, body.position.y, 0)
      positions.needsUpdate = true
      spring.geometry.computeBoundingSphere()
    }
  }, [world.bodies, world.forces])

  const onKeyDown = (event) => {
    if (event.code === 'Space') { event.preventDefault(); onToggle(); return }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete(); return }
    const directions = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] }
    if (directions[event.key] && !running) {
      event.preventDefault()
      onNudge(...directions[event.key])
    }
  }

  return (
    <div
      ref={mountRef}
      className="world-scene"
      role="application"
      tabIndex="0"
      aria-label="Three-dimensional physics world. Drag empty space to orbit the camera. Select and drag bodies or ramps while paused. Use arrow keys to move a selected body."
      onKeyDown={onKeyDown}
    >
      <div className="scene-hint" aria-hidden="true"><span>Drag to orbit</span><span>Scroll to zoom</span></div>
      <div className="scene-status" aria-live="polite">
        {world.bodies.find((body) => body.id === selectedId)?.name ?? 'No selection'} · {world.time.toFixed(2)} s · {world.constraints.some((constraint) => constraint.type === 'ground') ? 'ground on' : 'reference grid only'}
      </div>
    </div>
  )
}
