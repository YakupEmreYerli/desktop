import * as Path from 'path'
import { readFile } from 'fs/promises'
import { getDocument, PDFWorker } from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Image } from '../../../models/diff'

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

/** Where the build puts the pdf.js runtime files, see webpack.pdfjs.ts */
const runtimeDir = Path.join(__dirname, 'pdfjs')

let sharedWorker: Promise<PDFWorker> | null = null

/**
 * Start the worker all documents share. The worker is passed explicitly to
 * each document so that closing one document doesn't tear it down for the
 * others.
 *
 * It's created from a blob URL since the renderer page is loaded from a
 * file:// URL (and from a dev server origin during development) where a
 * plain script URL won't be accepted.
 */
function getSharedWorker(): Promise<PDFWorker> {
  if (sharedWorker === null) {
    sharedWorker = readFile(Path.join(runtimeDir, 'pdf.worker.min.mjs')).then(
      source => {
        const blob = new Blob([source], { type: 'text/javascript' })
        const url = URL.createObjectURL(blob)
        const port = new Worker(url, { type: 'module' })
        return PDFWorker.create({ port })
      }
    )
    sharedWorker.catch(() => (sharedWorker = null))
  }
  return sharedWorker
}

type BinaryDataKind = 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl'

/**
 * Serves character maps, standard fonts and image decoders to pdf.js from
 * disk. It takes the place of pdf.js' own factory which would use `fetch`,
 * something that isn't available for file:// URLs.
 */
class DiskBinaryDataFactory {
  private readonly directories: Record<BinaryDataKind, string | null>

  public constructor(options: Partial<Record<BinaryDataKind, string>>) {
    this.directories = {
      cMapUrl: options.cMapUrl ?? null,
      standardFontDataUrl: options.standardFontDataUrl ?? null,
      wasmUrl: options.wasmUrl ?? null,
    }
  }

  public async fetch({
    kind,
    filename,
  }: {
    kind: BinaryDataKind
    filename: string
  }): Promise<Uint8Array> {
    const directory = this.directories[kind]
    if (!directory) {
      throw new Error(`No directory configured for ${kind}`)
    }
    return new Uint8Array(await readFile(Path.join(directory, filename)))
  }
}

/**
 * Parse the given PDF document. Parsing happens in the pdf.js worker so large
 * documents don't block the UI thread.
 */
export async function loadPdfDocument(image: Image): Promise<PDFDocumentProxy> {
  const worker = await getSharedWorker()

  // pdf.js transfers the buffer to the worker, so hand it a copy of its own
  const data = new Uint8Array(Buffer.from(image.contents, 'base64'))

  const task = getDocument({
    data,
    worker,
    // pdf.js insists on a trailing slash, these are directories on disk
    cMapUrl: Path.join(runtimeDir, 'cmaps') + '/',
    standardFontDataUrl: Path.join(runtimeDir, 'standard_fonts') + '/',
    wasmUrl: Path.join(runtimeDir, 'wasm') + '/',
    BinaryDataFactory: DiskBinaryDataFactory,
    useWorkerFetch: false,
    enableXfa: false,
  })

  try {
    const document = await task.promise
    loadingTasks.set(document, task)
    return document
  } catch (e) {
    task.destroy().catch(() => undefined)
    throw e
  }
}

/** The loading task of each open document, needed to close them again */
const loadingTasks = new WeakMap<PDFDocumentProxy, PDFDocumentLoadingTask>()

/** Close a document loaded by `loadPdfDocument` and free its resources */
export function closePdfDocument(document: PDFDocumentProxy): Promise<void> {
  const task = loadingTasks.get(document)
  loadingTasks.delete(document)
  return task?.destroy() ?? Promise.resolve()
}
