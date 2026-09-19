import * as Path from 'path'
import { Image } from '../models/diff'

export const SvgMediaType = 'image/svg+xml'

/** Whether the path is an SVG image, which git sees as text */
export function isSvgPath(path: string) {
  return Path.extname(path).toLowerCase() === '.svg'
}

/**
 * An image of an SVG document's source, for the image diff views. They draw
 * it with an `<img>` data URI, where scripts don't run and nothing outside
 * the document is loaded.
 */
export function svgImageFromLines(lines: ReadonlyArray<string>): Image {
  const bytes = Buffer.from(lines.join('\n'), 'utf8')
  return new Image(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    bytes.toString('base64'),
    SvgMediaType,
    bytes.byteLength
  )
}
