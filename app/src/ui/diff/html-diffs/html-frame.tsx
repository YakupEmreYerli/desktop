import * as React from 'react'

/**
 * The viewport width pages are laid out at. Narrower columns show the page
 * scaled down, the way a PDF page is, rather than triggering the page's
 * mobile layout.
 */
const DesktopWidth = 1280

interface IHtmlFrameProps {
  /** The prepared document, see buildHtmlPreview */
  readonly document: string

  /** Accessible title of the frame */
  readonly title: string
}

interface IHtmlFrameState {
  /** The size of the space the frame has, in CSS pixels */
  readonly width: number
  readonly height: number
}

/** A sandboxed frame that renders a page at desktop width, scaled to fit */
export class HtmlFrame extends React.Component<
  IHtmlFrameProps,
  IHtmlFrameState
> {
  private readonly resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      this.setState({ width, height })
    }
  })

  public constructor(props: IHtmlFrameProps) {
    super(props)
    this.state = { width: 0, height: 0 }
  }

  public componentWillUnmount() {
    this.resizeObserver.disconnect()
  }

  private onContainerRef = (element: HTMLDivElement | null) => {
    this.resizeObserver.disconnect()
    if (element !== null) {
      this.resizeObserver.observe(element)
    }
  }

  public render() {
    const { width, height } = this.state
    const scale = width > 0 ? Math.min(1, width / DesktopWidth) : 1
    const style: React.CSSProperties = {
      width: `${width / scale}px`,
      height: `${height / scale}px`,
      transform: scale < 1 ? `scale(${scale})` : undefined,
    }

    return (
      <div className="html-diff-page" ref={this.onContainerRef}>
        {width > 0 && (
          <iframe
            title={this.props.title}
            // Scripts run, but in an opaque origin: no access to the app,
            // its Node APIs or local files, and no popups or navigation of
            // the app window.
            sandbox="allow-scripts"
            srcDoc={this.props.document}
            style={style}
          />
        )}
      </div>
    )
  }
}
