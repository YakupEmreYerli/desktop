import { ipcRenderer } from 'electron'
import { ISystemHeaderColors } from '../../lib/system-header-colors'
import { invokeProxy } from '../main-process-proxy'

const getSystemHeaderColors = invokeProxy('get-system-header-colors', 0)

/**
 * Hand the desktop environment's header colours to the stylesheets, or take
 * them away again when there are none.
 *
 * They go on the body, where the themes declare their own variables: an
 * inline style there wins over the theme without replacing it, so removing
 * them puts the theme's colours back. The class says the colours are there,
 * which keeps the rules that need both of them out of the way otherwise.
 */
export function applySystemHeaderColors(colors: ISystemHeaderColors | null) {
  const { style, classList } = document.body

  if (colors === null) {
    classList.remove('system-header-colors')
    style.removeProperty('--system-header-background-color')
    style.removeProperty('--system-header-text-color')
    return
  }

  style.setProperty('--system-header-background-color', colors.background)
  style.setProperty('--system-header-text-color', colors.foreground)
  classList.add('system-header-colors')
}

/**
 * Take the header colours from the desktop environment and keep them in step
 * with it for as long as the app is running.
 */
export async function initializeSystemHeaderColors() {
  ipcRenderer.on('system-header-colors-changed', (_, colors) =>
    applySystemHeaderColors(colors)
  )

  applySystemHeaderColors(await getSystemHeaderColors())
}
