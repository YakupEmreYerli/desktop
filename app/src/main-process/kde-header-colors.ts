import { readFile } from 'fs/promises'
import { watch } from 'fs'
import { homedir } from 'os'
import * as Path from 'path'
import { ISystemHeaderColors } from '../lib/system-header-colors'

/** How long to wait for the writes to settle before reading the file again */
const ReloadDelay = 250

/** Is the app running in a KDE Plasma session? */
export function isKDESession() {
  return (process.env.XDG_CURRENT_DESKTOP ?? '')
    .split(':')
    .some(name => name.toUpperCase() === 'KDE')
}

function configDirectory() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME

  return xdgConfigHome !== undefined && xdgConfigHome.length > 0
    ? xdgConfigHome
    : Path.join(homedir(), '.config')
}

/**
 * A colour in kdeglobals is either `r,g,b`, `r,g,b,a` or a hex string,
 * depending on which version of KDE wrote it.
 */
function parseColor(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  const text = value.trim()

  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i.test(text)) {
    return text
  }

  const parts = text.split(',').map(x => x.trim())

  if (parts.length < 3 || parts.length > 4) {
    return null
  }

  const numbers = parts.map(x => (/^\d+$/.test(x) ? parseInt(x, 10) : NaN))

  if (numbers.some(x => isNaN(x) || x < 0 || x > 255)) {
    return null
  }

  const [r, g, b, a] = numbers

  return a === undefined
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

/**
 * Read the groups of a KDE config file. Keys are kept per group, later
 * entries win, and groups we don't know about are kept as they are so that
 * `[Colors:Header][Inactive]` doesn't overwrite `[Colors:Header]`.
 */
function parseGroups(contents: string) {
  const groups = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null

  for (const line of contents.split(/\r?\n/)) {
    const text = line.trim()

    if (text.length === 0 || text.startsWith('#')) {
      continue
    }

    if (text.startsWith('[')) {
      current = groups.get(text) ?? new Map<string, string>()
      groups.set(text, current)
      continue
    }

    const separator = text.indexOf('=')

    if (current === null || separator === -1) {
      continue
    }

    current.set(
      text.substring(0, separator).trim(),
      text.substring(separator + 1)
    )
  }

  return groups
}

/**
 * The colours of the current KDE colour scheme's header, or null when this
 * isn't a KDE session or the scheme doesn't say. KDE falls back to the window
 * colours for schemes made before the header group existed, and so do we.
 */
export async function getKDEHeaderColors(): Promise<ISystemHeaderColors | null> {
  if (!isKDESession()) {
    return null
  }

  let contents: string

  try {
    contents = await readFile(kdeglobalsPath(), 'utf8')
  } catch (e) {
    log.debug(`Could not read the KDE colour scheme: ${e}`)
    return null
  }

  const groups = parseGroups(contents)

  for (const name of ['[Colors:Header]', '[Colors:Window]']) {
    const group = groups.get(name)
    const background = parseColor(group?.get('BackgroundNormal'))
    const foreground = parseColor(group?.get('ForegroundNormal'))

    if (background !== null && foreground !== null) {
      return { background, foreground }
    }
  }

  return null
}

/** The path of the file KDE keeps the current colour scheme in */
export function kdeglobalsPath() {
  return Path.join(configDirectory(), 'kdeglobals')
}

/**
 * Call `onChange` whenever the KDE colour scheme changes. Returns a function
 * that stops watching.
 *
 * The directory is watched rather than the file itself because KDE replaces
 * kdeglobals instead of writing over it, which leaves a watcher on the file
 * looking at something nobody reads any more.
 */
export function watchKDEHeaderColors(onChange: () => void): () => void {
  if (!isKDESession()) {
    return () => {}
  }

  const path = kdeglobalsPath()
  let timeoutId: NodeJS.Timeout | null = null

  try {
    const watcher = watch(configDirectory(), (_, fileName) => {
      if (fileName !== Path.basename(path)) {
        return
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(onChange, ReloadDelay)
    })

    watcher.on('error', e =>
      log.debug(`Stopped watching the KDE colour scheme: ${e}`)
    )

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      watcher.close()
    }
  } catch (e) {
    log.debug(`Could not watch the KDE colour scheme: ${e}`)
    return () => {}
  }
}
