import * as React from 'react'
import { PreviewHeightMessage } from '../../../lib/html'

/**
 * The viewport width pages are laid out at. Narrower columns show the page
 * scaled down, the way a PDF page is, rather than triggering the page's
 * mobile layout.
 */
const DesktopWidth = 1280

/** Frames never grow taller than this, in CSS pixels before scaling */
const MaxLayoutHeight = 50000

/**
 * How many times a frame may grow for one document. A page sized by the
 * viewport (`min-height: 100vh` plus padding) grows every time the frame does;
 * this stops that loop.
 */
const MaxGrowths = 10

interface IHtmlFrameProps {
  /** The prepared document, see buildHtmlPreview */
  readonly document: string

  /** Accessible title of the frame */
  readonly title: string

  /** The height of the visible diff area; frames are at least this tall */
  readonly minHeight: number
}

interface IHtmlFrameState {
  /** The width of the frame's box, in CSS pixels */
  readonly width: number

  /** The page's height as reported by the frame, before scaling */
  readonly contentHeight: number
}

/**
 * A sandboxed frame that renders a page at desktop width, scaled to fit its
 * column, and as tall as the page so the surrounding view does the scrolling.
 */
export class HtmlFrame extends React.Component<
  IHtmlFrameProps,
  IHtmlFrameState
> {
  private frame: HTMLIFrameElement | null = null
  private growths = 0

  private readonly resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width } = entry.contentRect
      if (width !== this.state.width) {
        this.setState({ width })
      }
    }
  })

  public constructor(props: IHtmlFrameProps) {
    super(props)
    this.state = { width: 0, contentHeight: 0 }
  }

  public componentDidMount() {
    window.addEventListener('message', this.onMessage)
  }

  public componentDidUpdate(prevProps: IHtmlFrameProps) {
    if (prevProps.document !== this.props.document) {
      this.growths = 0
      this.setState({ contentHeight: 0 })
    }
  }

  public componentWillUnmount() {
    window.removeEventListener('message', this.onMessage)
    this.resizeObserver.disconnect()
  }

  private onMessage = (event: MessageEvent) => {
    const { data } = event
    if (
      this.frame === null ||
      event.source !== this.frame.contentWindow ||
      typeof data !== 'object' ||
      data === null ||
      data.type !== PreviewHeightMessage ||
      typeof data.height !== 'number'
    ) {
      return
    }

    const height = Math.min(MaxLayoutHeight, Math.ceil(data.height))
    if (height > this.state.contentHeight) {
      if (this.growths >= MaxGrowths) {
        return
      }
      this.growths++
    }

    if (height !== this.state.contentHeight) {
      this.setState({ contentHeight: height })
    }
  }

  private onContainerRef = (element: HTMLDivElement | null) => {
    this.resizeObserver.disconnect()
    if (element !== null) {
      this.resizeObserver.observe(element)
    }
  }

  private onFrameRef = (element: HTMLIFrameElement | null) => {
    this.frame = element
  }

  public render() {
    const { width, contentHeight } = this.state
    const scale = width > 0 ? Math.min(1, width / DesktopWidth) : 1
    const layoutHeight = Math.max(this.props.minHeight / scale, contentHeight)
    const frameStyle: React.CSSProperties = {
      width: `${width / scale}px`,
      height: `${layoutHeight}px`,
      transform: scale < 1 ? `scale(${scale})` : undefined,
    }

    return (
      <div
        className="html-diff-page"
        ref={this.onContainerRef}
        style={{ height: `${layoutHeight * scale}px` }}
      >
        {width > 0 && (
          <iframe
            ref={this.onFrameRef}
            title={this.props.title}
            // Scripts run, but in an opaque origin: no access to the app,
            // its Node APIs or local files, and no popups or navigation of
            // the app window.
            sandbox="allow-scripts"
            srcDoc={this.props.document}
            style={frameStyle}
          />
        )}
      </div>
    )
  }
}
