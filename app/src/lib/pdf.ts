import * as Path from 'path'

/** The data URI media type we tag PDF documents with. */
export const PdfMediaType = 'application/pdf'

/** Whether the given file extension (including the dot) belongs to a PDF. */
export function isPdfExtension(extension: string) {
  return extension.toLowerCase() === '.pdf'
}

/** Whether the given path points to a PDF document, based on its extension. */
export function isPdfPath(path: string) {
  return isPdfExtension(Path.extname(path))
}
