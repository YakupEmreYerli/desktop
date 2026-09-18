import { describe, it } from 'node:test'
import assert from 'node:assert'
import { fixSavedWindowPosition } from '../../../src/main-process/window-state-position'

const display = { x: 0, y: 144, width: 1920, height: 1080 }

describe('fixSavedWindowPosition', () => {
  it('moves a Wayland 0,0 position onto its display and keeps the size', () => {
    const fixed = fixSavedWindowPosition({
      width: 1159,
      height: 758,
      x: 0,
      y: 0,
      displayBounds: display,
      isMaximized: false,
    })

    assert.deepEqual(fixed, {
      width: 1159,
      height: 758,
      x: 0,
      y: 144,
      displayBounds: display,
      isMaximized: false,
    })
  })

  it('shrinks a window larger than its display', () => {
    const fixed = fixSavedWindowPosition({
      width: 2500,
      height: 1500,
      x: 0,
      y: 0,
      displayBounds: display,
    })

    assert.equal(fixed?.width, 1920)
    assert.equal(fixed?.height, 1080)
  })

  it('leaves a position that is on screen alone', () => {
    assert.equal(
      fixSavedWindowPosition({
        width: 1000,
        height: 700,
        x: 100,
        y: 200,
        displayBounds: display,
      }),
      null
    )
  })

  it('leaves incomplete state alone', () => {
    assert.equal(fixSavedWindowPosition({ isMaximized: true }), null)
  })
})
