import * as Path from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'

interface IBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The subset of electron-window-state's saved file that we look at */
export interface ISavedWindowState extends Partial<IBounds> {
  readonly displayBounds?: IBounds
  readonly [key: string]: unknown
}

/**
 * Move a saved window position back onto the display it was saved on.
 *
 * Under Wayland an application can't read (or set) its window position, so
 * electron-window-state saves every window at 0,0. When the display doesn't
 * start at 0,0, e.g. with several monitors, that position is off screen and
 * electron-window-state throws the whole state away on the next launch,
 * size included. Placing the window at the display's origin (and within its
 * size) keeps the saved size; the compositor decides the position anyway.
 *
 * Returns null when the state needs no change.
 */
export function fixSavedWindowPosition(
  state: ISavedWindowState
): ISavedWindowState | null {
  const { x, y, width, height, displayBounds: display } = state
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    display === undefined
  ) {
    return null
  }

  const inside =
    x >= display.x &&
    y >= display.y &&
    x + width <= display.x + display.width &&
    y + height <= display.y + display.height
  if (inside) {
    return null
  }

  return {
    ...state,
    x: display.x,
    y: display.y,
    width: Math.min(width, display.width),
    height: Math.min(height, display.height),
  }
}

/**
 * Repair the window state file before electron-window-state reads it. Only
 * needed on Linux, where Wayland doesn't report window positions.
 */
export function repairWindowStateFile(file = 'window-state.json') {
  if (!__LINUX__) {
    return
  }

  const path = Path.join(app.getPath('userData'), file)
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'))
    const fixed = fixSavedWindowPosition(state)
    if (fixed !== null) {
      writeFileSync(path, JSON.stringify(fixed))
    }
  } catch {
    // No saved state yet, or it's unreadable; electron-window-state copes.
  }
}
