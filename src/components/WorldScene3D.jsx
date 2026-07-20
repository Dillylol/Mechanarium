import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bodyLoadState, resolveEndpoint, wheelRouteGeometry } from '../physics/assembly.js'

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else child.material?.dispose()
  })
}

function bodyGeometry(body) {
  if (body.shape === 'beam') return new THREE.BoxGeometry(body.length, body.thickness, 0.72)
  if (body.shape === 'box') return new THREE.BoxGeometry(body.width, body.height, body.width)
  if (/cylinder|roller/i.test(body.name)) return new THREE.CylinderGeometry(body.radius, body.radius, Math.max(0.45, body.radius * 1.4), 32)
  return new THREE.SphereGeometry(body.radius, 32, 20)
}

function createBodyObject(body) {
  if (body.shape !== 'wheel') {
    const mesh = new THREE.Mesh(bodyGeometry(body), new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.46, metalness: 0.04 }))
    mesh.userData.bodySurface = true
    return mesh
  }
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.38, metalness: 0.1 })
  const geometry = body.inertiaModel === 'hoop'
    ? new THREE.TorusGeometry(body.radius * 0.82, body.radius * 0.18, 18, 48)
    : new THREE.CylinderGeometry(body.radius, body.radius, body.depth, 48)
  if (body.inertiaModel === 'disk') geometry.rotateX(Math.PI / 2)
  const wheel = new THREE.Mesh(geometry, material)
  wheel.userData.bodySurface = true
  wheel.castShadow = true
  wheel.receiveShadow = true
  const hubGeometry = new THREE.CylinderGeometry(body.radius * 0.12, body.radius * 0.12, body.depth * 1.15, 24)
  hubGeometry.rotateX(Math.PI / 2)
  const hub = new THREE.Mesh(hubGeometry, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }))
  const marker = new THREE.Mesh(new THREE.BoxGeometry(body.radius * 0.68, Math.max(0.04, body.radius * 0.07), body.depth * 1.2), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
  marker.position.x = body.radius * 0.34
  group.add(wheel, hub, marker)
  return group
}

function styleBodyObject(object, body, selected) {
  object.traverse((child) => {
    child.userData.bodyId = body.id
    if (!child.userData.bodySurface) return
    child.material.color.set(body.color)
    child.material.emissive?.set(selected ? 0x2d2d2d : 0x000000)
  })
}

const LOAD_COLORS = {
  gravity: 0xb32727,
  'tension-a': 0x009fe3,
  'tension-b': 0x009fe3,
  tension: 0x009fe3,
  'axle-reaction': 0x7a3db8,
  normal: 0x00a965,
  friction: 0xf08c00,
  net: 0x111111,
}

function forceArrow(force, origin, color) {
  const magnitudeValue = Math.hypot(force.x, force.y)
  if (magnitudeValue < 0.01) return null
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(force.x / magnitudeValue, force.y / magnitudeValue, 0), new THREE.Vector3(origin.x, origin.y, 0.34), Math.min(3.2, 0.42 + Math.log1p(magnitudeValue) * 0.42), color, 0.22, 0.13)
  arrow.userData.forceOverlay = true
  return arrow
}

function torqueArrow(body, torque) {
  if (Math.abs(torque) < 0.005) return null
  const group = new THREE.Group()
  const sign = Math.sign(torque)
  const radius = Math.max(body.radius ?? 0.4, 0.35) * 1.32
  const start = sign > 0 ? 0.2 : Math.PI - 0.2
  const sweep = Math.PI * 1.35 * sign
  const points = Array.from({ length: 28 }, (_, index) => {
    const angle = start + sweep * index / 27
    return new THREE.Vector3(body.position.x + Math.cos(angle) * radius, body.position.y + Math.sin(angle) * radius, 0.42)
  })
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xf2cf00 })))
  const endAngle = start + sweep
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 16), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
  head.position.copy(points.at(-1))
  head.rotation.z = endAngle + (sign > 0 ? Math.PI / 2 : -Math.PI / 2)
  group.add(head)
  group.userData.forceOverlay = true
  return group
}

function addTransformGizmos(group, entity, center) {
  const tangent = { x: Math.cos(entity.angle), y: Math.sin(entity.angle) }
  const angleHandle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 10, 24), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
  angleHandle.position.set(center.x + tangent.x * (entity.length / 2 + 0.65), center.y + tangent.y * (entity.length / 2 + 0.65), 0.15)
  angleHandle.userData = { entityId: entity.id, id: entity.id, gizmo: 'angle', center }
  group.add(angleHandle)
  for (const sign of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.24), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
    handle.position.set(center.x + tangent.x * entity.length / 2 * sign, center.y + tangent.y * entity.length / 2 * sign, 0.18)
    handle.rotation.z = entity.angle
    handle.userData = { entityId: entity.id, id: entity.id, gizmo: 'length', center }
    group.add(handle)
  }
  const start = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 16), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
  start.position.set(center.x - tangent.x * entity.length / 2, center.y - tangent.y * entity.length / 2 + 0.35, 0.16)
  start.userData = { entityId: entity.id }
  group.add(start)
}

export default function WorldScene3D({ world, selectedId, onSelect, onMove, onRequestBodySnap, onClearBodySnap, onMoveConstraint, onMoveForce, onMoveInstrument, onAlignInstrument, onRequestTrackSnap, onTransform, onMoveConnectorEndpoint, onRequestConnectorSnap, onDisconnect, onNudge, onDelete, onToggle, running, history, overlays, snapProposal, dragSnapCandidate }) {
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
  const portArtifactsRef = useRef(new Map())
  const endpointHandlesRef = useRef(new Map())
  const trailRef = useRef(null)
  const gridRef = useRef(null)
  const [draggedPartId, setDraggedPartId] = useState(null)
  const handlersRef = useRef({ onSelect, onMove, onRequestBodySnap, onClearBodySnap, onMoveConstraint, onMoveForce, onMoveInstrument, onAlignInstrument, onRequestTrackSnap, onTransform, onMoveConnectorEndpoint, onRequestConnectorSnap, running })
  const worldStateRef = useRef(world)
  const assemblyRenderKey = useMemo(() => JSON.stringify({
    running,
    selectedId,
    tracks: world.tracks,
    connectors: world.connectors.map((connector) => ({ id: connector.id, name: connector.name, type: connector.type, a: connector.a, b: connector.b, length: connector.length, restLength: connector.restLength, stiffness: connector.stiffness, damping: connector.damping, route: connector.route })),
    forces: world.forces,
    instruments: world.instruments,
    ports: world.ports,
    snapProposal,
    dragSnapCandidate,
    draggedPartId,
    selectedBeam: running ? null : world.bodies.find((body) => body.id === selectedId && body.shape === 'beam'),
  }), [draggedPartId, dragSnapCandidate, running, selectedId, snapProposal, world.bodies, world.connectors, world.forces, world.instruments, world.ports, world.tracks])

  useEffect(() => {
    handlersRef.current = { onSelect, onMove, onRequestBodySnap, onClearBodySnap, onMoveConstraint, onMoveForce, onMoveInstrument, onAlignInstrument, onRequestTrackSnap, onTransform, onMoveConnectorEndpoint, onRequestConnectorSnap, running }
  }, [onAlignInstrument, onClearBodySnap, onMove, onMoveConnectorEndpoint, onMoveConstraint, onMoveForce, onMoveInstrument, onRequestBodySnap, onRequestConnectorSnap, onRequestTrackSnap, onSelect, onTransform, running])

  useEffect(() => { worldStateRef.current = world }, [world])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || typeof WebGLRenderingContext === 'undefined') return undefined
    const bodyMeshes = bodiesRef.current
    const forceArrows = arrowsRef.current
    const springArtifacts = springsRef.current
    const portArtifacts = portArtifactsRef.current
    const endpointHandles = endpointHandlesRef.current

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
    let draggingForce = null
    let draggingInstrument = null
    let draggingGizmo = null
    let draggingEndpoint = null
    let lastPointerPosition = null
    let lastConstraintPosition = null

    const setPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
    }
    const snapRadius = () => {
      const height = renderer.domElement.clientHeight || 600
      const distance = camera.position.distanceTo(controls.target)
      return 18 * (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / height)
    }

    const pointerDown = (event) => {
      setPointer(event)
      const hits = raycaster.intersectObjects([...bodiesRef.current.values(), ...constraintsRef.current.children, ...forceArtifactsRef.current.children], true)
      const bodyId = hits[0]?.object?.userData?.bodyId
      const constraintId = hits[0]?.object?.userData?.constraintId ?? hits[0]?.object?.userData?.entityId
      const connectorId = hits[0]?.object?.userData?.connectorId
      const forceId = hits[0]?.object?.userData?.forceId
      const instrumentId = hits[0]?.object?.userData?.instrumentId
      if (bodyId || constraintId || connectorId || forceId || instrumentId) handlersRef.current.onSelect(bodyId ?? constraintId ?? connectorId ?? forceId ?? instrumentId)
      if (hits[0]?.object?.userData?.gizmo && !handlersRef.current.running) {
        draggingGizmo = hits[0].object.userData
        controls.enabled = false
        return
      }
      if (hits[0]?.object?.userData?.endpoint && !handlersRef.current.running) {
        draggingEndpoint = hits[0].object.userData
        controls.enabled = false
        return
      }
      if (bodyId && !handlersRef.current.running) {
        draggingId = bodyId
        setDraggedPartId(bodyId)
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (constraintId && hits[0].object.userData.center && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const center = hits[0].object.userData.center
        draggingConstraint = { id: constraintId, offset: { x: intersection.x - center.x, y: intersection.y - center.y } }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (forceId && hits[0].object.userData.center && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const center = hits[0].object.userData.center
        draggingForce = { id: forceId, offset: { x: intersection.x - center.x, y: intersection.y - center.y } }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (instrumentId && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const instrument = worldStateRef.current.instruments.find((candidate) => candidate.id === instrumentId)
        const center = hits[0].object.userData.center ?? instrument?.center ?? (instrument?.a && instrument?.b ? { x: (instrument.a.x + instrument.b.x) / 2, y: (instrument.a.y + instrument.b.y) / 2 } : intersection)
        draggingInstrument = {
          id: instrumentId,
          endpoint: hits[0].object.userData.endpoint,
          offset: { x: intersection.x - center.x, y: intersection.y - center.y },
          a: instrument?.a,
          b: instrument?.b,
          center,
        }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
    }

    const pointerMove = (event) => {
      if ((!draggingId && !draggingConstraint && !draggingForce && !draggingInstrument && !draggingGizmo && !draggingEndpoint) || handlersRef.current.running) return
      setPointer(event)
      if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
        lastPointerPosition = { x: intersection.x, y: intersection.y }
        if (draggingId) handlersRef.current.onMove(draggingId, { x: intersection.x, y: intersection.y }, snapRadius())
        if (draggingConstraint) {
          lastConstraintPosition = { x: intersection.x - draggingConstraint.offset.x, y: intersection.y - draggingConstraint.offset.y }
          handlersRef.current.onMoveConstraint(draggingConstraint.id, lastConstraintPosition)
        }
        if (draggingForce) handlersRef.current.onMoveForce(draggingForce.id, { x: intersection.x - draggingForce.offset.x, y: intersection.y - draggingForce.offset.y })
        if (draggingInstrument) {
          if (draggingInstrument.endpoint) handlersRef.current.onMoveInstrument(draggingInstrument.id, { [draggingInstrument.endpoint]: { x: intersection.x, y: intersection.y } })
          else if (draggingInstrument.a && draggingInstrument.b) {
            const center = { x: intersection.x - draggingInstrument.offset.x, y: intersection.y - draggingInstrument.offset.y }
            const dx = center.x - draggingInstrument.center.x
            const dy = center.y - draggingInstrument.center.y
            handlersRef.current.onMoveInstrument(draggingInstrument.id, { a: { x: draggingInstrument.a.x + dx, y: draggingInstrument.a.y + dy }, b: { x: draggingInstrument.b.x + dx, y: draggingInstrument.b.y + dy } })
          } else handlersRef.current.onMoveInstrument(draggingInstrument.id, { center: { x: intersection.x - draggingInstrument.offset.x, y: intersection.y - draggingInstrument.offset.y } })
        }
        if (draggingEndpoint) handlersRef.current.onMoveConnectorEndpoint(draggingEndpoint.connectorId, draggingEndpoint.endpoint, { x: intersection.x, y: intersection.y })
        if (draggingGizmo) {
          const dx = intersection.x - draggingGizmo.center.x
          const dy = intersection.y - draggingGizmo.center.y
          if (draggingGizmo.gizmo === 'angle') {
            const rawAngle = Math.atan2(dy, dx)
            handlersRef.current.onTransform(draggingGizmo.id, { angle: event.shiftKey ? Math.round(rawAngle / (Math.PI / 12)) * (Math.PI / 12) : rawAngle })
          }
          if (draggingGizmo.gizmo === 'length') handlersRef.current.onTransform(draggingGizmo.id, { length: Math.max(0.25, Math.hypot(dx, dy) * 2) })
        }
      }
    }

    const release = () => {
      if (draggingId && lastPointerPosition) handlersRef.current.onRequestBodySnap(draggingId, snapRadius())
      else if (draggingId) handlersRef.current.onClearBodySnap()
      if (draggingEndpoint && lastPointerPosition) handlersRef.current.onRequestConnectorSnap(draggingEndpoint.connectorId, draggingEndpoint.endpoint, lastPointerPosition, snapRadius())
      if (draggingConstraint && lastConstraintPosition) handlersRef.current.onRequestTrackSnap(draggingConstraint.id, lastConstraintPosition, snapRadius())
      if (draggingInstrument && !draggingInstrument.endpoint) handlersRef.current.onAlignInstrument(draggingInstrument.id, snapRadius())
      draggingId = null
      draggingConstraint = null
      draggingForce = null
      draggingInstrument = null
      draggingGizmo = null
      draggingEndpoint = null
      lastPointerPosition = null
      lastConstraintPosition = null
      setDraggedPartId(null)
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
      portArtifacts.clear()
      endpointHandles.clear()
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
        mesh = createBodyObject(body)
        mesh.userData.bodyId = body.id
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.targetPosition = new THREE.Vector3(body.position.x, body.position.y, 0)
        mesh.userData.targetAngle = body.angle
        mesh.position.copy(mesh.userData.targetPosition)
        scene.add(mesh)
        bodiesRef.current.set(body.id, mesh)
      }
      const geometryKey = body.shape === 'wheel' ? `${body.inertiaModel}:${body.radius}:${body.depth}` : body.shape === 'beam' ? `${body.length}:${body.thickness}` : `${body.shape}:${body.radius}:${body.width}:${body.height}`
      if (mesh.userData.geometryKey && mesh.userData.geometryKey !== geometryKey) {
        scene.remove(mesh)
        disposeObject(mesh)
        mesh = createBodyObject(body)
        mesh.userData.bodyId = body.id
        mesh.userData.targetPosition = new THREE.Vector3(body.position.x, body.position.y, 0)
        mesh.userData.targetAngle = body.angle
        scene.add(mesh)
        bodiesRef.current.set(body.id, mesh)
      }
      mesh.userData.geometryKey = geometryKey
      mesh.userData.targetPosition.set(body.position.x, body.position.y, 0)
      mesh.userData.targetAngle = body.angle
      if (!running) mesh.position.copy(mesh.userData.targetPosition)
      if (body.shape !== 'wheel' && /cylinder|roller/i.test(body.name)) mesh.rotation.x = Math.PI / 2
      if (!running) mesh.rotation.z = body.angle
      styleBodyObject(mesh, body, body.id === selectedId)
    }

    const desiredOverlays = new Map()
    if (overlays.net) for (const body of world.bodies) {
      const state = bodyLoadState(world, body.id)
      const arrow = forceArrow(state.netForce, body.position, LOAD_COLORS.net)
      if (arrow) desiredOverlays.set(`net:${body.id}`, arrow)
    }
    const selected = world.bodies.find((body) => body.id === selectedId)
    if (selected && overlays.components) {
      const state = bodyLoadState(world, selected.id)
      for (const component of state.components) {
        const arrow = forceArrow(component.force, component.point, LOAD_COLORS[component.kind] ?? 0x009d5b)
        if (arrow) desiredOverlays.set(`component:${component.id}`, arrow)
      }
    }
    if (selected?.shape === 'wheel' && overlays.torque) {
      const arrow = torqueArrow(selected, bodyLoadState(world, selected.id).netTorque)
      if (arrow) desiredOverlays.set(`torque:${selected.id}`, arrow)
    }
    for (const [key, current] of arrowsRef.current) {
      scene.remove(current)
      disposeObject(current)
      arrowsRef.current.delete(key)
    }
    for (const [key, overlay] of desiredOverlays) {
      scene.add(overlay)
      arrowsRef.current.set(key, overlay)
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
  }, [history, overlays.components, overlays.net, overlays.torque, overlays.trails, running, selectedId, world])

  useEffect(() => {
    const renderWorld = worldStateRef.current
    const group = constraintsRef.current
    const forceGroup = forceArtifactsRef.current
    if (!group || !forceGroup) return
    for (const child of [...group.children]) { group.remove(child); disposeObject(child) }
    for (const child of [...forceGroup.children]) { forceGroup.remove(child); disposeObject(child) }
    springsRef.current.clear()
    portArtifactsRef.current.clear()
    endpointHandlesRef.current.clear()

    for (const constraint of renderWorld.tracks) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(constraint.length, constraint.thickness, 1.35), new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.75, emissive: constraint.id === selectedId ? 0x252525 : 0x000000 }))
        ramp.position.set(constraint.center.x, constraint.center.y, 0)
        ramp.rotation.z = constraint.angle
        ramp.receiveShadow = true
        ramp.userData.constraintId = constraint.id
        ramp.userData.center = constraint.center
        group.add(ramp)
        if (constraint.id === selectedId && !running) addTransformGizmos(group, constraint, constraint.center)
    }
    if (snapProposal?.kind === 'track') {
      const track = renderWorld.tracks.find((candidate) => candidate.id === snapProposal.trackId)
      if (track) {
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(track.length, track.thickness + 0.05, 1.42), new THREE.MeshBasicMaterial({ color: 0x00a965, transparent: true, opacity: 0.35, wireframe: true }))
        ghost.position.set(snapProposal.alignedCenter.x, snapProposal.alignedCenter.y, 0.02)
        ghost.rotation.z = track.angle
        group.add(ghost)
      }
    }
    const selectedBeam = renderWorld.bodies.find((body) => body.id === selectedId && body.shape === 'beam')
    if (selectedBeam && !running) addTransformGizmos(group, selectedBeam, selectedBeam.position)

    for (const force of renderWorld.connectors) {
      if (force.type === 'spring' || force.type === 'rope') {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((force.route ? 32 : 2) * 3), 3))
        const spring = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: force.type === 'rope' ? 0x555555 : 0x111111, linewidth: 2 }))
        spring.frustumCulled = false
        spring.userData.connectorId = force.id
        forceGroup.add(spring)
        springsRef.current.set(force.id, spring)
        const state = resolveEndpoint(renderWorld, force.a)
        const other = resolveEndpoint(renderWorld, force.b)
        for (const [key, endpoint] of [['a', state], ['b', other]]) if (endpoint && !running) {
          const handle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), new THREE.MeshBasicMaterial({ color: endpoint.owner ? 0x00a965 : 0xf2cf00 }))
          handle.position.set(endpoint.position.x, endpoint.position.y, 0.08)
          handle.userData = { connectorId: force.id, endpoint: key }
          forceGroup.add(handle)
          endpointHandlesRef.current.set(`${force.id}:${key}`, handle)
        }
      }
    }
    for (const force of renderWorld.forces) {
      if (force.type === 'central') {
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x009fe3, roughness: 0.35, emissive: force.id === selectedId ? 0x12475a : 0x000000 }))
        core.position.set(force.center.x, force.center.y, 0)
        core.castShadow = true
        core.userData = { forceId: force.id, center: force.center }
        forceGroup.add(core)
      }
    }
    for (const instrument of renderWorld.instruments) {
      const selected = instrument.id === selectedId
      if (instrument.type === 'ruler') {
        const center = { x: (instrument.a.x + instrument.b.x) / 2, y: (instrument.a.y + instrument.b.y) / 2 }
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(instrument.a.x, instrument.a.y, 0.2), new THREE.Vector3(instrument.b.x, instrument.b.y, 0.2)])
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: selected ? 0xf2cf00 : 0x111111 }))
        line.userData = { instrumentId: instrument.id, center }
        forceGroup.add(line)
        if (!running) for (const endpoint of ['a', 'b']) {
          const handle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 9), new THREE.MeshBasicMaterial({ color: endpoint === 'a' ? 0xf2cf00 : 0x00a965 }))
          handle.position.set(instrument[endpoint].x, instrument[endpoint].y, 0.24)
          handle.userData = { instrumentId: instrument.id, endpoint, center: instrument[endpoint] }
          forceGroup.add(handle)
        }
      } else if (instrument.type === 'photogate') {
        const tangent = { x: Math.cos(instrument.angle), y: Math.sin(instrument.angle) }
        const half = instrument.length / 2
        const points = [new THREE.Vector3(instrument.center.x - tangent.x * half, instrument.center.y - tangent.y * half, 0.2), new THREE.Vector3(instrument.center.x + tangent.x * half, instrument.center.y + tangent.y * half, 0.2)]
        const gate = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: selected ? 0xf2cf00 : 0x009d5b }))
        gate.userData = { instrumentId: instrument.id, center: instrument.center }
        forceGroup.add(gate)
        const hub = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshBasicMaterial({ color: selected ? 0xf2cf00 : 0x009d5b }))
        hub.position.set(instrument.center.x, instrument.center.y, 0.24)
        hub.userData = { instrumentId: instrument.id, center: instrument.center }
        forceGroup.add(hub)
      }
    }
    if (!running) for (const port of renderWorld.ports) {
      const isSnapSource = port.id === snapProposal?.sourcePortId
      const isSnapTarget = port.id === snapProposal?.targetPortId
      const isDragSource = Boolean(draggedPartId && port.ownerId === draggedPartId)
      const isDragTarget = Boolean(draggedPartId && port.ownerId !== draggedPartId)
      const isAcquiredSource = port.id === dragSnapCandidate?.sourcePortId
      const isAcquiredTarget = port.id === dragSnapCandidate?.targetPortId
      if (!port.custom && port.ownerId !== selectedId && port.id !== selectedId && !isSnapSource && !isSnapTarget && !isDragSource && !isDragTarget) continue
      const resolved = renderWorld.portIndex.get(port.id) && resolveEndpoint(renderWorld, { type: 'port', ownerId: port.ownerId, portId: port.id })
      if (!resolved) continue
      const emphasized = isSnapTarget || isAcquiredTarget || isAcquiredSource
      const marker = new THREE.Mesh(new THREE.SphereGeometry(emphasized ? 0.18 : port.custom ? 0.12 : 0.095, 14, 9), new THREE.MeshBasicMaterial({ color: isSnapSource || isDragSource ? 0xf2cf00 : 0x00a965 }))
      marker.position.set(resolved.position.x, resolved.position.y, 0.24)
      marker.userData.entityId = port.id
      forceGroup.add(marker)
      let halo = null
      if (isSnapTarget || isAcquiredTarget) {
        halo = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 10, 28), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
        halo.position.set(resolved.position.x, resolved.position.y, 0.22)
        forceGroup.add(halo)
      }
      portArtifactsRef.current.set(port.id, { marker, halo })
    }
  }, [assemblyRenderKey, dragSnapCandidate?.sourcePortId, dragSnapCandidate?.targetPortId, draggedPartId, running, selectedId, snapProposal])

  useEffect(() => {
    for (const force of world.connectors) {
      const spring = springsRef.current.get(force.id)
      const a = resolveEndpoint(world, force.a)
      const b = resolveEndpoint(world, force.b)
      if (!spring || !a || !b) continue
      const positions = spring.geometry.getAttribute('position')
      const route = wheelRouteGeometry(world, force, 28)
      const points = route?.points ?? [a.position, b.position]
      points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, 0))
      spring.geometry.setDrawRange(0, points.length)
      positions.needsUpdate = true
      spring.geometry.computeBoundingSphere()
      for (const [key, endpoint] of [['a', a], ['b', b]]) {
        const handle = endpointHandlesRef.current.get(`${force.id}:${key}`)
        if (handle) handle.position.set(endpoint.position.x, endpoint.position.y, 0.08)
      }
    }
    for (const port of world.ports) {
      const artifact = portArtifactsRef.current.get(port.id)
      const resolved = artifact && resolveEndpoint(world, { type: 'port', ownerId: port.ownerId, portId: port.id })
      if (!artifact || !resolved) continue
      artifact.marker.position.set(resolved.position.x, resolved.position.y, 0.24)
      artifact.halo?.position.set(resolved.position.x, resolved.position.y, 0.22)
    }
  }, [world.bodies, world.connectors, world])

  const onKeyDown = (event) => {
    if (event.code === 'Space') { event.preventDefault(); onToggle(); return }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete(); return }
    if ((event.key === 'd' || event.key === 'D') && !running) { event.preventDefault(); onDisconnect(); return }
    const transformable = world.tracks.find((item) => item.id === selectedId) ?? world.bodies.find((item) => item.id === selectedId && item.shape === 'beam')
    if (transformable && !running && ['[', ']', '-', '='].includes(event.key)) {
      event.preventDefault()
      if (event.key === '[' || event.key === ']') onTransform(selectedId, { angle: transformable.angle + (event.key === '[' ? -1 : 1) * Math.PI / 36 })
      else onTransform(selectedId, { length: Math.max(0.25, transformable.length + (event.key === '-' ? -0.2 : 0.2)) })
      return
    }
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
      aria-label="Three-dimensional physics world. Drag empty space to orbit. While paused, arrows translate; brackets rotate; minus and equals resize; D disconnects; Delete removes."
      onKeyDown={onKeyDown}
    >
      <div className="scene-hint" aria-hidden="true"><span>Drag to orbit</span><span>Scroll to zoom</span></div>
      <div className="visually-hidden" role="group" aria-label="Attachment ports">
        {world.ports.map((port) => {
          const owner = [...world.bodies, ...world.tracks].find((candidate) => candidate.id === port.ownerId)
          return <button key={port.id} type="button" onClick={() => onSelect(port.id)}>{owner?.name ?? port.ownerId} {port.name} port</button>
        })}
      </div>
      <div className="visually-hidden" role="group" aria-label="Measurement instruments">
        {world.instruments.map((instrument) => <button key={instrument.id} type="button" onClick={() => onSelect(instrument.id)}>{instrument.name}</button>)}
      </div>
      <div className="scene-status" aria-live="polite">
        {world.bodies.find((body) => body.id === selectedId)?.name ?? 'No selection'} · {world.time.toFixed(2)} s · {world.constraints.some((constraint) => constraint.type === 'ground') ? 'ground on' : 'reference grid only'}
      </div>
    </div>
  )
}
