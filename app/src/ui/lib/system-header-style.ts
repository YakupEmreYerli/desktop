import { ipcRenderer } from 'electron'
import { ISystemHeaderStyle } from '../../lib/system-header-style'
import { invokeProxy } from '../main-process-proxy'

const getSystemHeaderStyle = invokeProxy('get-system-header-style', 0)

/**
 * Hand the desktop environment's header colours to the stylesheets, or take
 * them away again when there are none.
 *
 * They go on the body, where the themes declare their own variables: an
 * inline style there wins over the theme without replacing it, so removing
 * them puts the theme's colours back. The class says the colours are there,
 * which keeps the rules that need both of them out of the way otherwise.
 */
export function applySystemHeaderStyle(header: ISystemHeaderStyle | null) {
  const { style, classList } = document.body

  const properties = {
    '--system-header-background-color': header?.background,
    '--system-header-text-color': header?.foreground,
    '--system-menu-background-color': header?.menuBackground,
    '--system-menu-text-color': header?.menuForeground,
    '--system-header-font-family': header?.fontFamily,
    '--system-header-font-size': header?.fontSize,
  }

  for (const [name, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      style.removeProperty(name)
    } else {
      style.setProperty(name, value)
    }
  }

  classList.toggle('system-header-style', header !== null)
}

/**
 * Take the header colours from the desktop environment and keep them in step
 * with it for as long as the app is running.
 */
export async function initializeSystemHeaderStyle() {
  ipcRenderer.on('system-header-style-changed', (_, colors) =>
    applySystemHeaderStyle(colors)
  )

  applySystemHeaderStyle(await getSystemHeaderStyle())
}
