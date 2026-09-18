import * as Path from 'path'
import { readFile, realpath, stat } from 'fs/promises'

/** Whether the given path points to an HTML document, based on its extension */
export function isHtmlPath(path: string) {
  const extension = Path.extname(path).toLowerCase()
  return extension === '.html' || extension === '.htm'
}

/** Assets larger than this aren't inlined into a preview */
const MaxAssetSize = 5 * 1024 * 1024

/** How deep stylesheets importing stylesheets are followed */
const MaxCssDepth = 3

const AssetMediaTypes: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
}

/**
 * Reads the files an HTML preview refers to. Only files inside the root
 * directory are returned, so a document can't pull in arbitrary files from
 * the machine (and send them elsewhere from a script).
 */
export class PreviewAssetReader {
  private readonly cache = new Map<string, Promise<Buffer | null>>()
  private readonly root: Promise<string | null>

  public constructor(root: string) {
    this.root = realpath(root).catch(() => null)
  }

  /**
   * Resolve a reference found in the document to a path on disk, or null for
   * references that aren't local files (absolute URLs, data URIs, anchors).
   */
  public resolve(reference: string, fromDirectory: string, root: string) {
    const trimmed = reference.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ) {
      return null
    }

    let path = trimmed.replace(/[?#].*$/, '')
    try {
      path = decodeURIComponent(path)
    } catch {
      // Keep the reference as written
    }

    return path.startsWith('/')
      ? Path.join(root, path)
      : Path.resolve(fromDirectory, path)
  }

  /** Read a file, or null if it's missing, too large or outside the root */
  public read(path: string): Promise<Buffer | null> {
    let result = this.cache.get(path)
    if (result === undefined) {
      result = this.readUncached(path)
      this.cache.set(path, result)
    }
    return result
  }

  private async readUncached(path: string) {
    try {
      const root = await this.root
      const real = await realpath(path)
      if (root === null || !isInside(real, root)) {
        return null
      }

      const info = await stat(real)
      if (!info.isFile() || info.size > MaxAssetSize) {
        return null
      }

      return await readFile(real)
    } catch {
      return null
    }
  }
}

function isInside(path: string, directory: string) {
  const relative = Path.relative(directory, path)
  return (
    relative !== '' && !relative.startsWith('..') && !Path.isAbsolute(relative)
  )
}

function getAssetMediaType(path: string) {
  return (
    AssetMediaTypes[Path.extname(path).toLowerCase()] ??
    'application/octet-stream'
  )
}

function toDataUri(contents: Buffer | string, mediaType: string) {
  const buffer = typeof contents === 'string' ? Buffer.from(contents) : contents
  return `data:${mediaType};base64,${buffer.toString('base64')}`
}

interface IPreviewContext {
  readonly reader: PreviewAssetReader
  /** The repository root, which `/` in a reference points to */
  readonly root: string
}

/** Turn a local reference into a data URI, or leave it unchanged */
async function inlineReference(
  reference: string,
  fromDirectory: string,
  context: IPreviewContext,
  cssDepth = 0
): Promise<string> {
  const path = context.reader.resolve(reference, fromDirectory, context.root)
  if (path === null) {
    return reference
  }

  const contents = await context.reader.read(path)
  if (contents === null) {
    return reference
  }

  const mediaType = getAssetMediaType(path)
  if (mediaType === 'text/css' && cssDepth < MaxCssDepth) {
    const css = await inlineCss(
      contents.toString('utf8'),
      Path.dirname(path),
      context,
      cssDepth + 1
    )
    return toDataUri(css, mediaType)
  }

  return toDataUri(contents, mediaType)
}

const CssUrlPattern = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g
const CssImportPattern = /@import\s+(['"])([^'"]+)\1/g

/** Inline the files a stylesheet refers to with url() and @import */
async function inlineCss(
  css: string,
  fromDirectory: string,
  context: IPreviewContext,
  cssDepth = 0
): Promise<string> {
  const replacements = new Map<string, string>()
  const references = [
    ...Array.from(css.matchAll(CssUrlPattern), m => m[2]),
    ...Array.from(css.matchAll(CssImportPattern), m => m[2]),
  ]

  await Promise.all(
    references.map(async reference => {
      if (!replacements.has(reference)) {
        replacements.set(reference, reference)
        replacements.set(
          reference,
          await inlineReference(reference, fromDirectory, context, cssDepth)
        )
      }
    })
  )

  return css
    .replace(
      CssUrlPattern,
      (_, quote, reference) =>
        `url(${quote}${replacements.get(reference) ?? reference}${quote})`
    )
    .replace(
      CssImportPattern,
      (_, quote, reference) =>
        `@import url(${quote}${
          replacements.get(reference) ?? reference
        }${quote})`
    )
}

/** Attributes whose value is a single file reference */
const ReferenceAttributes: ReadonlyArray<[string, string]> = [
  ['img[src]', 'src'],
  ['input[type="image"][src]', 'src'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['source[src]', 'src'],
  ['track[src]', 'src'],
  ['embed[src]', 'src'],
  ['object[data]', 'data'],
  ['link[rel~="icon"][href]', 'href'],
  ['link[rel="preload"][href]', 'href'],
  ['image[href]', 'href'],
  ['use[href]', 'href'],
]

/** The type of the message a preview frame posts with its content height */
export const PreviewHeightMessage = 'desktop-html-preview-height'

/**
 * Posts the document's height to the app whenever it changes, so the frame
 * can be as tall as the page and the diff view scrolls instead of the frame.
 * Pages that turn off scrolling (print layouts with `overflow: hidden`) are
 * shown in full this way too.
 */
const HeightReporter = `(() => {
  const post = () => {
    const root = document.documentElement
    const height = Math.max(
      root.scrollHeight,
      root.getBoundingClientRect().height,
      document.body ? document.body.scrollHeight : 0
    )
    parent.postMessage({ type: '${PreviewHeightMessage}', height }, '*')
  }
  const observer = new ResizeObserver(post)
  observer.observe(document.documentElement)
  if (document.body) observer.observe(document.body)
  addEventListener('load', post)
})()`

/**
 * Prepare an HTML document for a sandboxed preview frame.
 *
 * A sandboxed frame has an opaque origin and can't load `file://` URLs, so
 * the stylesheets, scripts, images and fonts the document refers to with
 * relative paths are read from disk and inlined. Remote URLs are left as
 * they are. A small script is added that reports the page's height, see
 * `HeightReporter`.
 *
 * @param html          The document's source.
 * @param documentPath  Where the document lives on disk; relative references
 *                      resolve against its directory.
 * @param root          The repository root. `/` references resolve against
 *                      it, and nothing outside it is read.
 */
export async function buildHtmlPreview(
  html: string,
  documentPath: string,
  root: string,
  reader: PreviewAssetReader = new PreviewAssetReader(root)
): Promise<string> {
  const context: IPreviewContext = { reader, root }
  const directory = Path.dirname(documentPath)
  const document = new DOMParser().parseFromString(html, 'text/html')
  const tasks = new Array<Promise<void>>()

  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel~="stylesheet"][href]'
  )) {
    tasks.push(
      (async () => {
        const href = link.getAttribute('href') ?? ''
        const path = reader.resolve(href, directory, root)
        const contents = path === null ? null : await reader.read(path)
        if (path === null || contents === null) {
          return
        }

        const style = document.createElement('style')
        const media = link.getAttribute('media')
        if (media !== null) {
          style.setAttribute('media', media)
        }
        style.textContent = await inlineCss(
          contents.toString('utf8'),
          Path.dirname(path),
          context,
          1
        )
        link.replaceWith(style)
      })()
    )
  }

  for (const script of document.querySelectorAll('script[src]')) {
    tasks.push(
      (async () => {
        const src = script.getAttribute('src') ?? ''
        script.setAttribute(
          'src',
          await inlineReference(src, directory, context)
        )
      })()
    )
  }

  for (const [selector, attribute] of ReferenceAttributes) {
    for (const element of document.querySelectorAll(selector)) {
      tasks.push(
        (async () => {
          const value = element.getAttribute(attribute) ?? ''
          element.setAttribute(
            attribute,
            await inlineReference(value, directory, context)
          )
        })()
      )
    }
  }

  for (const element of document.querySelectorAll('[srcset]')) {
    tasks.push(
      (async () => {
        const candidates = (element.getAttribute('srcset') ?? '')
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0)
        const inlined = await Promise.all(
          candidates.map(async candidate => {
            const [url, ...descriptor] = candidate.split(/\s+/)
            const data = await inlineReference(url, directory, context)
            return [data, ...descriptor].join(' ')
          })
        )
        element.setAttribute('srcset', inlined.join(', '))
      })()
    )
  }

  for (const style of document.querySelectorAll('style')) {
    tasks.push(
      (async () => {
        style.textContent = await inlineCss(
          style.textContent ?? '',
          directory,
          context
        )
      })()
    )
  }

  for (const element of document.querySelectorAll('[style]')) {
    tasks.push(
      (async () => {
        const css = element.getAttribute('style') ?? ''
        element.setAttribute('style', await inlineCss(css, directory, context))
      })()
    )
  }

  await Promise.all(tasks)

  // References are already resolved, and links open nowhere: the frame may
  // not open popups, so a link can't take the preview away from the page.
  for (const base of document.querySelectorAll('base')) {
    base.remove()
  }
  const base = document.createElement('base')
  base.setAttribute('target', '_blank')
  document.head.prepend(base)

  const reporter = document.createElement('script')
  reporter.textContent = HeightReporter
  document.body.append(reporter)

  const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : ''
  return doctype + document.documentElement.outerHTML
}
