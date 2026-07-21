import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bodyLoadState, resolveEndpoint, wheelRouteGeometry } from '../physics/assembly.js'
import { sampleSpline } from '../domain/spline.js'
import { rulerReading } from '../domain/instruments.js'
import { bodyEnergy } from '../physics/metrics.js'
import { snapToGrid } from '../domain/gridSnap.js'

function createPlaneGridGroup(sizeX = 36, sizeY = 28, step = 0.5) {
  const group = new THREE.Group()
  const minorPositions = []
  const majorPositions = []

  const halfX = sizeX / 2
  const halfY = sizeY / 2

  const majorStep = step <= 0.25 ? 1.0 : (step <= 0.5 ? 1.0 : 2.0)

  for (let x = -halfX; x <= halfX + 1e-5; x += step) {
    const roundX = Math.round(x / step) * step
    const isMajor = Math.abs(roundX % majorStep) < 1e-4
    const target = isMajor ? majorPositions : minorPositions
    target.push(roundX, -halfY, -0.01, roundX, halfY, -0.01)
  }

  for (let y = -halfY; y <= halfY + 1e-5; y += step) {
    const roundY = Math.round(y / step) * step
    const isMajor = Math.abs(roundY % majorStep) < 1e-4
    const target = isMajor ? majorPositions : minorPositions
    target.push(-halfX, roundY, -0.01, halfX, roundY, -0.01)
  }

  if (minorPositions.length > 0) {
    const minorGeo = new THREE.BufferGeometry()
    minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorPositions, 3))
    const minorMat = new THREE.LineBasicMaterial({ color: 0x999990, transparent: true, opacity: 0.16 })
    group.add(new THREE.LineSegments(minorGeo, minorMat))
  }

  if (majorPositions.length > 0) {
    const majorGeo = new THREE.BufferGeometry()
    majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPositions, 3))
    const majorMat = new THREE.LineBasicMaterial({ color: 0x555550, transparent: true, opacity: 0.32 })
    group.add(new THREE.LineSegments(majorGeo, majorMat))
  }

  const axesPositions = [-halfX, 0, -0.008, halfX, 0, -0.008, 0, -halfY, -0.008, 0, halfY, -0.008]
  const axesGeo = new THREE.BufferGeometry()
  axesGeo.setAttribute('position', new THREE.Float32BufferAttribute(axesPositions, 3))
  const axesMat = new THREE.LineBasicMaterial({ color: 0x222220, transparent: true, opacity: 0.45 })
  group.add(new THREE.LineSegments(axesGeo, axesMat))

  return group
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
    else {
      child.material?.map?.dispose()
      child.material?.dispose()
    }
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

function textSprite(text, color = '#111111', width = 2.2, height = 0.42) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(250,250,247,0.92)'
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.strokeStyle = '#111111'
  context.lineWidth = 3
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.fillStyle = color
  context.font = '600 34px Inter, Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.scale.set(width, height, 1)
  sprite.renderOrder = 50
  sprite.raycast = () => {}
  sprite.userData = { canvas, context, texture, color }
  return sprite
}

function updateTextSprite(sprite, text, color) {
  const { canvas, context, texture, color: defaultColor } = sprite.userData ?? {}
  if (!canvas || !context || !texture) return
  const textColor = color ?? defaultColor ?? '#111111'
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(250,250,247,0.92)'
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.strokeStyle = '#111111'
  context.lineWidth = 3
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  context.fillStyle = textColor
  context.font = '600 34px Inter, Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  texture.needsUpdate = true
}

function addTransformGizmos(group, entity, center) {
  const tangent = { x: Math.cos(entity.angle), y: Math.sin(entity.angle) }
  const angleHandle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 10, 24), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
  angleHandle.position.set(center.x + tangent.x * (entity.length / 2 + 0.65), center.y + tangent.y * (entity.length / 2 + 0.65), 0.03)
  angleHandle.userData = { entityId: entity.id, id: entity.id, gizmo: 'angle', center }
  group.add(angleHandle)
  for (const sign of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.06), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
    handle.position.set(center.x + tangent.x * entity.length / 2 * sign, center.y + tangent.y * entity.length / 2 * sign, 0.03)
    handle.rotation.z = entity.angle
    handle.userData = { entityId: entity.id, id: entity.id, gizmo: 'length', center }
    group.add(handle)
  }
  const start = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 16), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
  start.position.set(center.x - tangent.x * entity.length / 2, center.y - tangent.y * entity.length / 2 + 0.35, 0.03)
  start.userData = { entityId: entity.id }
  group.add(start)
}

function addSplineGizmos(group, track) {
  for (const knot of track.knots) {
    const knotHandle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), new THREE.MeshBasicMaterial({ color: 0xf2cf00 }))
    knotHandle.position.set(knot.position.x, knot.position.y, 0.03)
    knotHandle.userData = { entityId: track.id, id: track.id, gizmo: 'spline-knot', knotId: knot.id, center: knot.position }
    group.add(knotHandle)
    const tangentPosition = { x: knot.position.x + knot.tangent.x * 0.28, y: knot.position.y + knot.tangent.y * 0.28 }
    const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(knot.position.x, knot.position.y, 0.025),
      new THREE.Vector3(tangentPosition.x, tangentPosition.y, 0.025),
    ]), new THREE.LineBasicMaterial({ color: 0xf2cf00, transparent: true, opacity: 0.65 }))
    group.add(guide)
    const tangentHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
    tangentHandle.position.set(tangentPosition.x, tangentPosition.y, 0.03)
    tangentHandle.userData = { entityId: track.id, id: track.id, gizmo: 'spline-tangent', knotId: knot.id, center: knot.position }
    group.add(tangentHandle)
  }
}

function railEndpointPosition(world, endpoint) {
  const owner = [...world.bodies, ...world.tracks].find((candidate) => candidate.id === endpoint.ownerId)
  if (!owner) return null
  if (owner.type === 'spline') return { ...(endpoint.endpoint === 'start' ? owner.knots[0].position : owner.knots.at(-1).position) }
  const center = owner.center ?? owner.position
  const tangent = { x: Math.cos(owner.angle), y: Math.sin(owner.angle) }
  const normal = { x: -tangent.y, y: tangent.x }
  const sign = endpoint.endpoint === 'start' ? -1 : 1
  return {
    x: center.x + tangent.x * owner.length / 2 * sign + normal.x * owner.thickness / 2,
    y: center.y + tangent.y * owner.length / 2 * sign + normal.y * owner.thickness / 2,
  }
}

export default function WorldScene3D({ world, selectedId, gridSettings = { snap: true, step: 0.5, planeGrid: true }, onSelect, onMove, onRequestBodySnap, onClearBodySnap, onMoveConstraint, onMoveForce, onMoveInstrument, onAlignInstrument, onRequestTrackSnap, onTransform, onMoveConnectorEndpoint, onRequestConnectorSnap, onDisconnect, onNudge, onDelete, onToggle, running, history, overlays, snapProposal, dragSnapCandidate }) {
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
  const dimensionOverlayRef = useRef(null)
  const gridRef = useRef(null)
  const planeGridRef = useRef(null)
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
    dimensions: overlays.dimensions,
    height: overlays.height,
    ports: world.ports,
    railJoins: world.railJoins,
    snapProposal,
    dragSnapCandidate,
    draggedPartId,
    selectedBeam: running ? null : world.bodies.find((body) => body.id === selectedId && body.shape === 'beam'),
  }), [draggedPartId, dragSnapCandidate, overlays.dimensions, overlays.height, running, selectedId, snapProposal, world.bodies, world.connectors, world.forces, world.instruments, world.ports, world.railJoins, world.tracks])

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
      const resolvedHits = hits.map((hit) => {
        let object = hit.object
        while (object && !['gizmo', 'endpoint', 'bodyId', 'constraintId', 'entityId', 'connectorId', 'forceId', 'instrumentId'].some((key) => object.userData?.[key])) object = object.parent
        return object ? { hit, object, data: object.userData } : null
      }).filter(Boolean)
      const picked = ['gizmo', 'endpoint', 'bodyId', 'instrumentId', 'constraintId', 'entityId', 'connectorId', 'forceId']
        .map((key) => resolvedHits.find((candidate) => candidate.data[key]))
        .find(Boolean)
      if (!picked) return
      const data = picked.data
      const bodyId = data.bodyId
      const constraintId = data.constraintId ?? data.entityId
      const connectorId = data.connectorId
      const forceId = data.forceId
      const instrumentId = data.instrumentId
      if (bodyId || constraintId || connectorId || forceId || instrumentId) handlersRef.current.onSelect(bodyId ?? constraintId ?? connectorId ?? forceId ?? instrumentId)
      else handlersRef.current.onSelect(null)
      if (data.gizmo && !handlersRef.current.running) {
        draggingGizmo = data
        controls.enabled = false
        return
      }
      if (data.endpoint && !handlersRef.current.running) {
        draggingEndpoint = data
        controls.enabled = false
        return
      }
      if (bodyId && !handlersRef.current.running) {
        draggingId = bodyId
        setDraggedPartId(bodyId)
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (constraintId && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const track = worldStateRef.current.tracks.find((candidate) => candidate.id === constraintId)
        const center = data.center ?? (track?.type === 'spline'
          ? (track._samples ?? sampleSpline(track)).reduce((sum, sample, _index, samples) => ({ x: sum.x + sample.position.x / samples.length, y: sum.y + sample.position.y / samples.length }), { x: 0, y: 0 })
          : track?.center)
        if (!center) return
        draggingConstraint = { id: constraintId, offset: { x: intersection.x - center.x, y: intersection.y - center.y }, snapEligible: track?.type === 'segment' }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (forceId && data.center && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const center = data.center
        draggingForce = { id: forceId, offset: { x: intersection.x - center.x, y: intersection.y - center.y } }
        controls.enabled = false
        renderer.domElement.setPointerCapture?.(event.pointerId)
      }
      if (instrumentId && !handlersRef.current.running && raycaster.ray.intersectPlane(dragPlane, intersection)) {
        const instrument = worldStateRef.current.instruments.find((candidate) => candidate.id === instrumentId)
        const center = data.center ?? instrument?.center ?? (instrument?.a && instrument?.b ? { x: (instrument.a.x + instrument.b.x) / 2, y: (instrument.a.y + instrument.b.y) / 2 } : intersection)
        draggingInstrument = {
          id: instrumentId,
          endpoint: data.endpoint,
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
          if (draggingGizmo.gizmo === 'spline-knot') {
            const track = worldStateRef.current.tracks.find((candidate) => candidate.id === draggingGizmo.id)
            const targetPos = gridSettings?.snap ? snapToGrid({ x: intersection.x, y: intersection.y }, gridSettings.step) : { x: intersection.x, y: intersection.y }
            if (track?.type === 'spline') handlersRef.current.onTransform(track.id, { knots: track.knots.map((knot) => knot.id === draggingGizmo.knotId ? { ...knot, position: targetPos } : knot) })
            return
          }
          if (draggingGizmo.gizmo === 'spline-tangent') {
            const track = worldStateRef.current.tracks.find((candidate) => candidate.id === draggingGizmo.id)
            if (track?.type === 'spline') handlersRef.current.onTransform(track.id, { knots: track.knots.map((knot) => knot.id === draggingGizmo.knotId ? { ...knot, tangent: { x: (intersection.x - knot.position.x) / 0.28, y: (intersection.y - knot.position.y) / 0.28 } } : knot) })
            return
          }
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
      if (draggingConstraint?.snapEligible && lastConstraintPosition) handlersRef.current.onRequestTrackSnap(draggingConstraint.id, lastConstraintPosition, snapRadius())
      if (draggingInstrument && !draggingInstrument.endpoint) handlersRef.current.onAlignInstrument(draggingInstrument.id, Math.max(0.75, snapRadius()))
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
      if (dimensionOverlayRef.current?.dimension && dimensionOverlayRef.current?.label) {
        const { dimension, label, bodyId } = dimensionOverlayRef.current
        const selectedMesh = bodiesRef.current.get(bodyId)
        if (selectedMesh) {
          const posX = selectedMesh.position.x
          const posY = selectedMesh.position.y
          const positions = dimension.geometry.attributes.position
          positions.setXYZ(0, posX, 0, 0.02)
          positions.setXYZ(1, posX, posY, 0.02)
          positions.needsUpdate = true
          dimension.computeLineDistances()
          label.position.set(posX + 1.7, posY / 2, 0.04)
          const liveBody = worldStateRef.current.bodies.find((b) => b.id === bodyId)
          if (liveBody) {
            const energy = bodyEnergy({ ...liveBody, position: { x: posX, y: posY } }, worldStateRef.current.gravity, 0)
            updateTextSprite(label, `h = ${energy.height.toFixed(3)} m`, '#006f9e')
          }
        }
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
      if (planeGridRef.current) {
        disposeObject(planeGridRef.current)
        planeGridRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!gridRef.current) return
    const ground = world.constraints.find((constraint) => constraint.type === 'ground')
    gridRef.current.visible = Boolean(ground) && (gridSettings?.showFloorGrid !== false)
    if (ground) {
      gridRef.current.position.y = ground.y
    }
    gridRef.current.material.transparent = true
    gridRef.current.material.opacity = 1
  }, [gridSettings?.showFloorGrid, world.constraints])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (planeGridRef.current) {
      scene.remove(planeGridRef.current)
      disposeObject(planeGridRef.current)
      planeGridRef.current = null
    }
    const isVisible = overlays.grid && (gridSettings?.planeGrid !== false)
    if (isVisible) {
      const step = gridSettings?.step || 0.5
      const planeGrid = createPlaneGridGroup(36, 28, step)
      scene.add(planeGrid)
      planeGridRef.current = planeGrid
    }
  }, [gridSettings?.planeGrid, gridSettings?.step, overlays.grid])

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
      if (constraint.type === 'spline') {
        const samples = constraint._samples ?? sampleSpline(constraint)
        for (let index = 1; index < samples.length; index += 1) {
          const a = samples[index - 1]
          const b = samples[index]
          const dx = b.position.x - a.position.x
          const dy = b.position.y - a.position.y
          const length = Math.hypot(dx, dy)
          if (length < 1e-9) continue
          const normal = { x: (a.normal.x + b.normal.x) / 2, y: (a.normal.y + b.normal.y) / 2 }
          const normalLength = Math.hypot(normal.x, normal.y) || 1
          normal.x /= normalLength; normal.y /= normalLength
          const rail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.012, constraint.thickness, 1.35), new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.75, emissive: constraint.id === selectedId ? 0x252525 : 0x000000 }))
          rail.position.set((a.position.x + b.position.x) / 2 - normal.x * constraint.thickness / 2, (a.position.y + b.position.y) / 2 - normal.y * constraint.thickness / 2, 0)
          rail.rotation.z = Math.atan2(dy, dx)
          rail.receiveShadow = true
          rail.userData.constraintId = constraint.id
          group.add(rail)
        }
        if (constraint.id === selectedId && !running) addSplineGizmos(group, constraint)
        continue
      }
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
    for (const join of renderWorld.railJoins) {
      const point = railEndpointPosition(renderWorld, join.a)
      if (!point) continue
      const weld = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 28), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
      weld.position.set(point.x, point.y, 0.03)
      weld.userData.entityId = join.a.ownerId
      group.add(weld)
    }

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
          handle.position.set(endpoint.position.x, endpoint.position.y, 0.03)
          handle.userData = { connectorId: force.id, endpoint: key }
          forceGroup.add(handle)
          endpointHandlesRef.current.set(`${force.id}:${key}`, handle)
        }
      }
    }
    for (const force of renderWorld.forces) {
      if (force.type === 'central') {
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0x009fe3, roughness: 0.35, emissive: force.id === selectedId ? 0x12475a : 0x000000 }))
        core.position.set(force.center.x, force.center.y, 0.02)
        core.castShadow = true
        core.userData = { forceId: force.id, center: force.center }
        forceGroup.add(core)
      }
    }
    for (const instrument of renderWorld.instruments) {
      const selected = instrument.id === selectedId
      if (instrument.type === 'ruler') {
        const center = { x: (instrument.a.x + instrument.b.x) / 2, y: (instrument.a.y + instrument.b.y) / 2 }
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(instrument.a.x, instrument.a.y, 0.02), new THREE.Vector3(instrument.b.x, instrument.b.y, 0.02)])
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: selected ? 0xf2cf00 : 0x111111 }))
        forceGroup.add(line)
        const reading = rulerReading(instrument)
        const tangentLength = reading.distance || 1
        const normal = { x: -reading.dy / tangentLength, y: reading.dx / tangentLength }
        const ticks = new THREE.Group()
        const tickCount = Math.max(2, Math.min(20, Math.round(reading.distance)))
        for (let index = 0; index <= tickCount; index += 1) {
          const fraction = index / tickCount
          const point = { x: instrument.a.x + reading.dx * fraction, y: instrument.a.y + reading.dy * fraction }
          const tick = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(point.x - normal.x * 0.08, point.y - normal.y * 0.08, 0.02),
            new THREE.Vector3(point.x + normal.x * 0.08, point.y + normal.y * 0.08, 0.02),
          ]), new THREE.LineBasicMaterial({ color: selected ? 0xf2cf00 : 0x111111 }))
          ticks.add(tick)
        }
        const label = textSprite(`${reading.distance.toFixed(3)} m`)
        label.position.set(center.x + normal.x * 0.38, center.y + normal.y * 0.38, 0.04)
        forceGroup.add(ticks, label)

        // Compact center grab handle
        const centerHandle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 9), new THREE.MeshBasicMaterial({ color: selected ? 0xf2cf00 : 0x006f9e }))
        centerHandle.position.set(center.x, center.y, 0.03)
        centerHandle.userData = { instrumentId: instrument.id, center }
        forceGroup.add(centerHandle)

        if (!running) for (const endpoint of ['a', 'b']) {
          const handle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 9), new THREE.MeshBasicMaterial({ color: endpoint === 'a' ? 0xf2cf00 : 0x00a965 }))
          handle.position.set(instrument[endpoint].x, instrument[endpoint].y, 0.03)
          handle.userData = { instrumentId: instrument.id, endpoint, center: instrument[endpoint] }
          forceGroup.add(handle)
        }
      } else if (instrument.type === 'photogate') {
        const tangent = { x: Math.cos(instrument.angle), y: Math.sin(instrument.angle) }
        const half = instrument.length / 2
        const points = [new THREE.Vector3(instrument.center.x - tangent.x * half, instrument.center.y - tangent.y * half, 0.02), new THREE.Vector3(instrument.center.x + tangent.x * half, instrument.center.y + tangent.y * half, 0.02)]
        const gate = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: selected ? 0xf2cf00 : 0x009d5b }))
        forceGroup.add(gate)
        const hub = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.12), new THREE.MeshBasicMaterial({ color: selected ? 0xf2cf00 : 0x009d5b }))
        hub.position.set(instrument.center.x, instrument.center.y, 0.03)
        hub.userData = { instrumentId: instrument.id, center: instrument.center }
        forceGroup.add(hub)
        if (instrument.pairId && instrument.pairRole === 'A') {
          const paired = renderWorld.instruments.find((candidate) => candidate.pairId === instrument.pairId && candidate.pairRole === 'B')
          if (paired) {
            const pairedTangent = { x: Math.cos(paired.angle), y: Math.sin(paired.angle) }
            const bracketPoints = [
              new THREE.Vector3(instrument.center.x - tangent.x * half, instrument.center.y - tangent.y * half, 0.02),
              new THREE.Vector3(instrument.center.x + tangent.x * half, instrument.center.y + tangent.y * half, 0.02),
              new THREE.Vector3(instrument.center.x - tangent.x * half, instrument.center.y - tangent.y * half, 0.02),
              new THREE.Vector3(paired.center.x - pairedTangent.x * paired.length / 2, paired.center.y - pairedTangent.y * paired.length / 2, 0.02),
              new THREE.Vector3(paired.center.x - pairedTangent.x * paired.length / 2, paired.center.y - pairedTangent.y * paired.length / 2, 0.02),
              new THREE.Vector3(paired.center.x + pairedTangent.x * paired.length / 2, paired.center.y + pairedTangent.y * paired.length / 2, 0.02),
            ]
            const bracket = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(bracketPoints), new THREE.LineBasicMaterial({ color: selected || paired.id === selectedId ? 0xf2cf00 : 0x444444 }))
            forceGroup.add(bracket)
            const bracketA = bracketPoints[2]
            const bracketB = bracketPoints[3]
            const bracketDx = bracketB.x - bracketA.x
            const bracketDy = bracketB.y - bracketA.y
            const bracketLength = Math.hypot(bracketDx, bracketDy)
            const grip = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, bracketLength), 0.12, 0.06), new THREE.MeshBasicMaterial({ color: selected || paired.id === selectedId ? 0xf2cf00 : 0x006f55 }))
            grip.position.set((bracketA.x + bracketB.x) / 2, (bracketA.y + bracketB.y) / 2, 0.02)
            grip.rotation.z = Math.atan2(bracketDy, bracketDx)
            forceGroup.add(grip)
            const spacing = textSprite(`${instrument.nominalSpacing.toFixed(3)} m · A→B`, '#006f55', 1.8, 0.34)
            spacing.position.set((instrument.center.x + paired.center.x) / 2, (instrument.center.y + paired.center.y) / 2 + 0.48, 0.04)
            forceGroup.add(spacing)
          }
        }
      }
    }
    dimensionOverlayRef.current = null
    if (overlays.height) {
      const selectedBody = renderWorld.bodies.find((body) => body.id === selectedId)
      if (selectedBody) {
        const datum = 0
        const dimension = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(selectedBody.position.x, datum, 0.02),
          new THREE.Vector3(selectedBody.position.x, selectedBody.position.y, 0.02),
        ]), new THREE.LineDashedMaterial({ color: 0x006f9e, dashSize: 0.16, gapSize: 0.1 }))
        dimension.computeLineDistances()
        const energy = bodyEnergy(selectedBody, renderWorld.gravity, datum)
        const label = textSprite(`h = ${energy.height.toFixed(3)} m`, '#006f9e')
        label.position.set(selectedBody.position.x + 1.7, (datum + selectedBody.position.y) / 2, 0.04)
        forceGroup.add(dimension, label)
        dimensionOverlayRef.current = { dimension, label, bodyId: selectedBody.id }
      }
    }
    if (overlays.dimensions) {
      const loopTrack = renderWorld.tracks.find((track) => track.id === 'loop-track' && track.type === 'spline')
      if (loopTrack) {
        const samples = loopTrack._samples ?? sampleSpline(loopTrack)
        const loopSamples = samples.filter((sample) => sample.position.x > -2.5)
        if (loopSamples.length) {
          const minY = Math.min(...loopSamples.map((sample) => sample.position.y))
          const maxY = Math.max(...loopSamples.map((sample) => sample.position.y))
          const centerX = loopSamples.reduce((sum, sample) => sum + sample.position.x, 0) / loopSamples.length
          const centerY = (minY + maxY) / 2
          const radius = (maxY - minY) / 2
          const radiusLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(centerX, centerY, 0.02),
            new THREE.Vector3(centerX, maxY, 0.02),
          ]), new THREE.LineBasicMaterial({ color: 0x7a3db8 }))
          const radiusLabel = textSprite(`R = ${radius.toFixed(3)} m · D = ${(2 * radius).toFixed(3)} m`, '#7a3db8')
          radiusLabel.position.set(centerX + 1.65, centerY + radius / 2, 0.04)
          forceGroup.add(radiusLine, radiusLabel)
        }
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
      marker.position.set(resolved.position.x, resolved.position.y, 0.03)
      marker.userData.entityId = port.id
      forceGroup.add(marker)
      let halo = null
      if (isSnapTarget || isAcquiredTarget) {
        halo = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 10, 28), new THREE.MeshBasicMaterial({ color: 0x00a965 }))
        halo.position.set(resolved.position.x, resolved.position.y, 0.035)
        forceGroup.add(halo)
      }
      portArtifactsRef.current.set(port.id, { marker, halo })
    }
  }, [assemblyRenderKey, dragSnapCandidate?.sourcePortId, dragSnapCandidate?.targetPortId, draggedPartId, overlays.dimensions, overlays.height, running, selectedId, snapProposal])

  useEffect(() => {
    for (const force of world.connectors) {
      const spring = springsRef.current.get(force.id)
      const a = resolveEndpoint(world, force.a)
      const b = resolveEndpoint(world, force.b)
      if (!spring || !a || !b) continue
      const positions = spring.geometry.getAttribute('position')
      let posA = a.position
      let posB = b.position
      const isUnattached = force.unattached || force.attached === false || force.mode === 'push'
      if (isUnattached && force.restLength) {
        const dx = b.position.x - a.position.x
        const dy = b.position.y - a.position.y
        const dist = Math.hypot(dx, dy)
        if (dist > force.restLength && dist > 1e-6) {
          posB = {
            x: a.position.x + (dx / dist) * force.restLength,
            y: a.position.y + (dy / dist) * force.restLength,
          }
        }
      }
      const route = wheelRouteGeometry(world, force, 28)
      const points = route?.points ?? [posA, posB]
      points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, 0))
      spring.geometry.setDrawRange(0, points.length)
      positions.needsUpdate = true
      spring.geometry.computeBoundingSphere()
      for (const [key, endpoint] of [['a', a], ['b', b]]) {
        const handle = endpointHandlesRef.current.get(`${force.id}:${key}`)
        if (handle) {
          const pos = key === 'b' ? posB : posA
          handle.position.set(pos.x, pos.y, 0.08)
        }
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
    const transformable = world.tracks.find((item) => item.id === selectedId && item.type === 'segment') ?? world.bodies.find((item) => item.id === selectedId && item.shape === 'beam')
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
