import * as React from 'react'
import { RenderingCancelledException } from 'pdfjs-dist'
import type { RenderTask } from 'pdfjs-dist'
import { PDFDocumentProxy } from './pdf-loader'

/**
 * Upper bound for the backing store of a single page canvas, keeps very large
 * or very long pages from exhausting memory.
 */
const MaxCanvasPixels = 4096 * 4096

interface IPdfPageProps {
  /**
   * The document to render the page from, or null when the page doesn't exist
   * on this side of the diff.
   */
  readonly document: PDFDocumentProxy | null

  /** The 1-based page number */
  readonly pageNumber: number

  /** The width, in CSS pixels, to render the page at */
  readonly width: number

  /** Height divided by width, used until the page itself has been measured */
  readonly aspectRatio: number

  /** The scrolling element, pages are only drawn when close to its viewport */
  readonly scrollContainer: HTMLElement | null
}

interface IPdfPageState {
  /** The measured height divided by width of the page, if known */
  readonly aspectRatio: number | null
}

/**
 * A single PDF page. The page is drawn onto a canvas once it's scrolled close
 * to the viewport and the canvas is released again when it's scrolled away,
 * so documents with many pages stay responsive.
 */
export class PdfPage extends React.Component<IPdfPageProps, IPdfPageState> {
  private element: HTMLDivElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private observer: IntersectionObserver | null = null
  private renderTask: RenderTask | null = null
  private isVisible = false

  /** Incremented for every draw so that stale draws can bail out */
  private generation = 0

  public constructor(props: IPdfPageProps) {
    super(props)
    this.state = { aspectRatio: null }
  }

  public componentDidMount() {
    this.observe()
  }

  public componentDidUpdate(prevProps: IPdfPageProps) {
    if (prevProps.scrollContainer !== this.props.scrollContainer) {
      this.observe()
    }

    if (prevProps.document !== this.props.document) {
      this.setState({ aspectRatio: null })
    }

    if (
      this.isVisible &&
      (prevProps.document !== this.props.document ||
        prevProps.width !== this.props.width)
    ) {
      this.drawPage()
    }
  }

  public componentWillUnmount() {
    this.observer?.disconnect()
    this.releaseCanvas()
  }

  private observe() {
    this.observer?.disconnect()
    this.observer = null

    if (this.element === null || this.props.scrollContainer === null) {
      return
    }

    this.observer = new IntersectionObserver(this.onIntersectionChanged, {
      root: this.props.scrollContainer,
      // Start drawing a screen ahead of the viewport
      rootMargin: '100% 0px',
    })
    this.observer.observe(this.element)
  }

  private onIntersectionChanged = (entries: IntersectionObserverEntry[]) => {
    const entry = entries.at(-1)
    if (entry === undefined || entry.isIntersecting === this.isVisible) {
      return
    }

    this.isVisible = entry.isIntersecting
    if (this.isVisible) {
      this.drawPage()
    } else {
      this.releaseCanvas()
    }
  }

  private async drawPage() {
    const { document, pageNumber, width } = this.props
    const canvas = this.canvas
    const generation = ++this.generation

    // pdf.js refuses to draw onto a canvas that's still in use by a
    // previous draw, so wait for that one to wind down first.
    const previousTask = this.renderTask
    this.renderTask = null
    if (previousTask !== null) {
      previousTask.cancel()
      await previousTask.promise.catch(() => undefined)
    }

    if (
      document === null ||
      canvas === null ||
      width <= 0 ||
      generation !== this.generation
    ) {
      return
    }

    try {
      const page = await document.getPage(pageNumber)
      if (generation !== this.generation) {
        return
      }

      const unscaled = page.getViewport({ scale: 1 })
      const aspectRatio = unscaled.height / unscaled.width
      if (aspectRatio !== this.state.aspectRatio) {
        this.setState({ aspectRatio })
      }

      const scale = Math.min(
        (width / unscaled.width) * (window.devicePixelRatio || 1),
        Math.sqrt(MaxCanvasPixels / (unscaled.width * unscaled.height))
      )
      const viewport = page.getViewport({ scale })

      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      const renderTask = page.render({ canvas, viewport })
      this.renderTask = renderTask
      await renderTask.promise
    } catch (e) {
      if (!(e instanceof RenderingCancelledException)) {
        log.error(`Unable to draw page ${pageNumber} of PDF`, e)
      }
    } finally {
      if (generation === this.generation) {
        this.renderTask = null
      }
    }
  }

  /** Stop any pending draw and free the memory held by the canvas */
  private releaseCanvas() {
    this.generation++
    // The cancelled task is kept around so that the next draw can wait for it
    this.renderTask?.cancel()

    if (this.canvas !== null) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
  }

  private onElementRef = (element: HTMLDivElement | null) => {
    this.element = element
    this.observe()
  }

  private onCanvasRef = (canvas: HTMLCanvasElement | null) => {
    this.canvas = canvas
  }

  public render() {
    const { document, width } = this.props
    const aspectRatio = this.state.aspectRatio ?? this.props.aspectRatio
    const style = { width, height: Math.round(width * aspectRatio) }

    if (document === null) {
      return (
        <div className="pdf-page missing" style={style}>
          No page
        </div>
      )
    }

    return (
      <div className="pdf-page" style={style} ref={this.onElementRef}>
        <canvas ref={this.onCanvasRef} />
      </div>
    )
  }
}
