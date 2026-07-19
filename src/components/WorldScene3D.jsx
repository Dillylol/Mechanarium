import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { connectorLoads, resolveEndpoint } from '../physics/assembly.js'
import { netWorldForce } from '../physics/forces.js'

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

export default function WorldScene3D({ world, selectedId, onSelect, onMove, onMoveConstraint, onTransform, onMoveConnectorEndpoint, onDisconnect, onNudge, onDelete, onToggle, running, history, overlays }) {
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
  const handlersRef = useRef({ onSelect, onMove, onMoveConstraint, onTransform, onMoveConnectorEndpoint, running })
  const worldStateRef = useRef(world)
  const assemblyRenderKey = useMemo(() => JSON.stringify({
    running,
    selectedId,
    tracks: world.tracks,
    connectors: world.connectors.map((connector) => ({ id: connector.id, name: connector.name, type: connector.type, a: connector.a, b: connector.b, length: connector.length, restLength: connector.restLength, stiffness: connector.stiffness, damping: connector.damping })),
    forces: world.forces,
    ports: world.ports,
    selectedBeam: running ? null : world.bodies.find((body) => body.id === selectedId && body.shape === 'beam'),
  }), [running, selectedId, world.bodies, world.connectors, world.forces, world.ports, world.tracks])

  useEffect(() => {
    handlersRef.current = { onSelect, onMove, onMoveConstraint, onTransform, onMoveConnectorEndpoint, running }
  }, [onMove, onMoveConnectorEndpoint, onMoveConstraint, onSelect, onTransform, running])

  useEffect(() => { worldStateRef.current = world }, [world])

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
    let draggingGizmo = null
    let draggingEndpoint = null
    let lastPointerPosition = null

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
      const hits = raycaster.intersectObjects([...bodiesRef.current.values(), ...constraintsRef.current.children, ...forceArtifactsRef.current.children], false)
      const bodyId = hits[0]?.object?.userData?.bodyId
      const constraintId = hits[0]?.object?.userData?.constraintId ?? hits[0]?.object?.userData?.entityId
      const connectorId = hits[0]?.object?.userData?.connectorId
      if (bodyId || constraintId || connectorId) handlersRef.current.onSelect(bodyId ?? constraintId ?? connectorId)
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
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (constraintId && hits[0].object.userData.center && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const center = hits[0].object.userData.center
        draggingConstraint = { id: constraintId, offset: { x: intersection.x - center.x, y: intersection.y - center.y } }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
    }

    const pointerMove = (event) => {
      if ((!draggingId && !draggingConstraint && !draggingGizmo && !draggingEndpoint) || handlersRef.current.running) return
      setPointer(event)
      if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
        lastPointerPosition = { x: intersection.x, y: intersection.y }
        if (draggingId) handlersRef.current.onMove(draggingId, { x: intersection.x, y: intersection.y })
        if (draggingConstraint) handlersRef.current.onMoveConstraint(draggingConstraint.id, { x: intersection.x - draggingConstraint.offset.x, y: intersection.y - draggingConstraint.offset.y }, snapRadius())
        if (draggingEndpoint) handlersRef.current.onMoveConnectorEndpoint(draggingEndpoint.connectorId, draggingEndpoint.endpoint, { x: intersection.x, y: intersection.y }, false)
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
      if (draggingEndpoint && lastPointerPosition) handlersRef.current.onMoveConnectorEndpoint(draggingEndpoint.connectorId, draggingEndpoint.endpoint, lastPointerPosition, true, snapRadius())
      draggingId = null
      draggingConstraint = null
      draggingGizmo = null
      draggingEndpoint = null
      lastPointerPosition = null
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
      if (body.shape === 'beam' && mesh.userData.length !== body.length) {
        mesh.geometry.dispose()
        mesh.geometry = bodyGeometry(body)
        mesh.userData.length = body.length
      }
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
      const loads = connectorLoads(world)
      for (const body of world.bodies) {
        const force = netWorldForce(world, body, loads.get(body.id)?.force)
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
  }, [history, overlays.trails, overlays.vectors, running, selectedId, world])

  useEffect(() => {
    const renderWorld = worldStateRef.current
    const group = constraintsRef.current
    const forceGroup = forceArtifactsRef.current
    if (!group || !forceGroup) return
    for (const child of [...group.children]) { group.remove(child); disposeObject(child) }
    for (const child of [...forceGroup.children]) { forceGroup.remove(child); disposeObject(child) }
    springsRef.current.clear()

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
    const selectedBeam = renderWorld.bodies.find((body) => body.id === selectedId && body.shape === 'beam')
    if (selectedBeam && !running) addTransformGizmos(group, selectedBeam, selectedBeam.position)

    for (const force of renderWorld.connectors) {
      if (force.type === 'spring' || force.type === 'rope') {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
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
        }
      }
    }
    for (const force of renderWorld.forces) {
      if (force.type === 'central') {
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0x009fe3, roughness: 0.35 }))
        core.position.set(force.center.x, force.center.y, 0)
        core.castShadow = true
        forceGroup.add(core)
      }
    }
    if (!running) for (const port of renderWorld.ports) {
      if (!port.custom && port.ownerId !== selectedId && port.id !== selectedId) continue
      const resolved = renderWorld.portIndex.get(port.id) && resolveEndpoint(renderWorld, { type: 'port', ownerId: port.ownerId, portId: port.id })
      if (!resolved) continue
      const marker = new THREE.Mesh(new THREE.SphereGeometry(port.custom ? 0.12 : 0.085, 14, 9), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
      marker.position.set(resolved.position.x, resolved.position.y, 0.24)
      marker.userData.entityId = port.id
      forceGroup.add(marker)
    }
  }, [assemblyRenderKey, running, selectedId])

  useEffect(() => {
    for (const force of world.connectors) {
      const spring = springsRef.current.get(force.id)
      const a = resolveEndpoint(world, force.a)
      const b = resolveEndpoint(world, force.b)
      if (!spring || !a || !b) continue
      const positions = spring.geometry.getAttribute('position')
      positions.setXYZ(0, a.position.x, a.position.y, 0)
      positions.setXYZ(1, b.position.x, b.position.y, 0)
      positions.needsUpdate = true
      spring.geometry.computeBoundingSphere()
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
      <div className="scene-status" aria-live="polite">
        {world.bodies.find((body) => body.id === selectedId)?.name ?? 'No selection'} · {world.time.toFixed(2)} s · {world.constraints.some((constraint) => constraint.type === 'ground') ? 'ground on' : 'reference grid only'}
      </div>
    </div>
  )
}
