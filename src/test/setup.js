import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

const gradient = { addColorStop() {} }
HTMLCanvasElement.prototype.getContext = () => ({
  setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, save() {}, restore() {}, translate() {}, rotate() {}, closePath() {}, fillText() {}, setLineDash() {},
  createRadialGradient: () => gradient,
})

if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:test'
if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {}
HTMLAnchorElement.prototype.click = () => {}
