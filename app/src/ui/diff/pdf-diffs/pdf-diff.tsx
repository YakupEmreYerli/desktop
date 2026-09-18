import * as React from 'react'
import classNames from 'classnames'

import { Image } from '../../../models/diff'
import { Button } from '../../lib/button'
import { Octicon } from '../../octicons'
import * as OcticonSymbol from '../../octicons/octicons.generated'
import {
  closePdfDocument,
  loadPdfDocument,
  PDFDocumentProxy,
} from './pdf-loader'
import { PdfPage } from './pdf-page'

/** Pages wider than this are hard to take in, so don't stretch past it */
const MaxPageWidth = 800

/** Horizontal space around and between the page columns, see _pdf-diff.scss */
const ColumnGap = 16
const HorizontalPadding = 2 * 16

/** The A4 portrait ratio, used until the first page has been measured */
const DefaultAspectRatio = Math.SQRT2

interface IPdfDiffProps {
  /** The document before the change, if there was one */
  readonly previous?: Image

  /** The document after the change, if there is one */
  readonly current?: Image
}

interface IPdfDiffState {
  readonly previous: PDFDocumentProxy | null
  readonly current: PDFDocumentProxy | null
  readonly loading: boolean
  readonly error: string | null

  /** Height divided by width of the first page, used for page placeholders */
  readonly aspectRatio: number

  /** The width, in CSS pixels, available to each column of pages */
  readonly columnWidth: number

  /** The 1-based number of the page at the top of the viewport */
  readonly currentPage: number
}

/**
 * A component which renders the pages of a PDF document. For a modified
 * document the pages before and after the change are shown side by side.
 */
export class PdfDiff extends React.Component<IPdfDiffProps, IPdfDiffState> {
  private scrollContainer: HTMLDivElement | null = null
  private readonly resizeObserver = new ResizeObserver(() =>
    this.updateColumnWidth()
  )
  private scrollFrame: number | null = null

  /** Incremented for every load so that stale loads can bail out */
  private generation = 0

  public constructor(props: IPdfDiffProps) {
    super(props)
    this.state = {
      previous: null,
      current: null,
      loading: true,
      error: null,
      aspectRatio: DefaultAspectRatio,
      columnWidth: 0,
      currentPage: 1,
    }
  }

  public componentDidMount() {
    this.loadDocuments()
  }

  public componentDidUpdate(prevProps: IPdfDiffProps) {
    if (
      prevProps.previous !== this.props.previous ||
      prevProps.current !== this.props.current
    ) {
      this.loadDocuments()
    }
  }

  public componentWillUnmount() {
    this.generation++
    this.resizeObserver.disconnect()
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame)
    }
    this.destroyDocuments(this.state.previous, this.state.current)
  }

  private get isModified() {
    return this.props.previous !== undefined && this.props.current !== undefined
  }

  private get pageCount() {
    const { previous, current } = this.state
    return Math.max(previous?.numPages ?? 0, current?.numPages ?? 0)
  }

  private async loadDocuments() {
    const generation = ++this.generation
    const { previous: previousImage, current: currentImage } = this.props

    this.destroyDocuments(this.state.previous, this.state.current)
    this.setState({
      previous: null,
      current: null,
      loading: true,
      error: null,
      currentPage: 1,
    })

    let previous: PDFDocumentProxy | null = null
    let current: PDFDocumentProxy | null = null
    try {
      const loaded = await Promise.allSettled([
        previousImage ? loadPdfDocument(previousImage) : null,
        currentImage ? loadPdfDocument(currentImage) : null,
      ])

      previous = loaded[0].status === 'fulfilled' ? loaded[0].value : null
      current = loaded[1].status === 'fulfilled' ? loaded[1].value : null

      const failure = loaded.find(r => r.status === 'rejected')
      if (failure !== undefined) {
        throw failure.reason
      }

      const firstDocument = current ?? previous
      const firstPage = firstDocument ? await firstDocument.getPage(1) : null
      const viewport = firstPage?.getViewport({ scale: 1 })

      if (generation !== this.generation) {
        this.destroyDocuments(previous, current)
        return
      }

      this.setState({
        previous,
        current,
        loading: false,
        aspectRatio: viewport
          ? viewport.height / viewport.width
          : DefaultAspectRatio,
      })
    } catch (e) {
      log.error('Unable to load PDF for diff', e)
      this.destroyDocuments(previous, current)

      if (generation === this.generation) {
        this.setState({
          loading: false,
          error:
            e instanceof Error && e.name === 'PasswordException'
              ? 'This PDF is password protected and cannot be previewed.'
              : 'This PDF could not be read and cannot be previewed.',
        })
      }
    }
  }

  private destroyDocuments(
    ...documents: ReadonlyArray<PDFDocumentProxy | null>
  ) {
    for (const document of documents) {
      if (document !== null) {
        closePdfDocument(document).catch(e =>
          log.error('Unable to close PDF', e)
        )
      }
    }
  }

  private onScrollContainerRef = (element: HTMLDivElement | null) => {
    this.resizeObserver.disconnect()
    this.scrollContainer = element

    if (element !== null) {
      this.resizeObserver.observe(element)
      this.updateColumnWidth()
    }
  }

  private updateColumnWidth() {
    if (this.scrollContainer === null) {
      return
    }

    const columns = this.isModified ? 2 : 1
    const available =
      this.scrollContainer.clientWidth -
      HorizontalPadding -
      ColumnGap * (columns - 1)
    const columnWidth = Math.max(
      0,
      Math.floor(Math.min(MaxPageWidth, available / columns))
    )

    if (columnWidth !== this.state.columnWidth) {
      this.setState({ columnWidth })
    }
  }

  private onScroll = () => {
    if (this.scrollFrame === null) {
      this.scrollFrame = requestAnimationFrame(this.updateCurrentPage)
    }
  }

  /** Find the page shown at the top of the viewport */
  private updateCurrentPage = () => {
    this.scrollFrame = null
    const container = this.scrollContainer
    if (container === null) {
      return
    }

    const top = container.getBoundingClientRect().top
    const rows = container.querySelectorAll<HTMLElement>('.pdf-diff-row')
    let currentPage = 1
    for (const row of rows) {
      if (row.getBoundingClientRect().bottom > top + 1) {
        currentPage = Number(row.dataset.page)
        break
      }
    }

    if (currentPage !== this.state.currentPage) {
      this.setState({ currentPage })
    }
  }

  private scrollToPage(page: number) {
    const target = Math.min(Math.max(page, 1), this.pageCount)
    this.scrollContainer
      ?.querySelector(`.pdf-diff-row[data-page="${target}"]`)
      ?.scrollIntoView({ block: 'start' })
    this.setState({ currentPage: target })
  }

  private onPreviousPage = () => this.scrollToPage(this.state.currentPage - 1)
  private onNextPage = () => this.scrollToPage(this.state.currentPage + 1)

  public render() {
    return (
      <div className="panel pdf-diff" id="diff">
        {this.renderToolbar()}
        {this.renderContent()}
      </div>
    )
  }

  private renderToolbar() {
    return (
      <div className="pdf-diff-toolbar">
        <div className="pdf-diff-labels">
          {this.props.previous &&
            this.renderLabel('previous', 'Deleted', this.state.previous)}
          {this.props.current &&
            this.renderLabel('current', 'Added', this.state.current)}
        </div>
        {this.renderNavigation()}
      </div>
    )
  }

  private renderLabel(
    side: 'previous' | 'current',
    title: string,
    document: PDFDocumentProxy | null
  ) {
    return (
      <span className={classNames('pdf-diff-label', side)}>
        {title}
        {document && (
          <span className="pdf-diff-page-count">
            {formatPageCount(document.numPages)}
          </span>
        )}
      </span>
    )
  }

  private renderNavigation() {
    const { currentPage, loading, error } = this.state
    const pageCount = this.pageCount

    if (loading || error !== null || pageCount <= 1) {
      return null
    }

    return (
      <div className="pdf-diff-navigation">
        <Button
          className="pdf-diff-nav"
          onClick={this.onPreviousPage}
          disabled={currentPage <= 1}
          ariaLabel="Previous page"
          tooltip="Previous page"
        >
          <Octicon symbol={OcticonSymbol.chevronLeft} />
        </Button>
        <span className="pdf-diff-page-indicator" aria-live="polite">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          className="pdf-diff-nav"
          onClick={this.onNextPage}
          disabled={currentPage >= pageCount}
          ariaLabel="Next page"
          tooltip="Next page"
        >
          <Octicon symbol={OcticonSymbol.chevronRight} />
        </Button>
      </div>
    )
  }

  private renderContent() {
    const { loading, error } = this.state

    if (error !== null) {
      return <div className="pdf-diff-message">{error}</div>
    }

    const rows = new Array<JSX.Element>()
    for (let page = 1; page <= this.pageCount; page++) {
      rows.push(this.renderRow(page))
    }

    return (
      <div
        className="pdf-diff-pages"
        ref={this.onScrollContainerRef}
        onScroll={this.onScroll}
      >
        {loading ? <div className="pdf-diff-message">Loading PDF…</div> : rows}
      </div>
    )
  }

  private renderRow(page: number) {
    const { previous, current, columnWidth, aspectRatio } = this.state

    return (
      <div key={page} className="pdf-diff-row" data-page={page}>
        {this.props.previous &&
          this.renderPage(previous, page, 'previous', columnWidth, aspectRatio)}
        {this.props.current &&
          this.renderPage(current, page, 'current', columnWidth, aspectRatio)}
      </div>
    )
  }

  private renderPage(
    document: PDFDocumentProxy | null,
    page: number,
    side: 'previous' | 'current',
    width: number,
    aspectRatio: number
  ) {
    const exists = document !== null && page <= document.numPages

    return (
      <div className={classNames('pdf-diff-column', side)}>
        <PdfPage
          document={exists ? document : null}
          pageNumber={page}
          width={width}
          aspectRatio={aspectRatio}
          scrollContainer={this.scrollContainer}
        />
        <div className="pdf-diff-page-number">{page}</div>
      </div>
    )
  }
}

function formatPageCount(count: number) {
  return count === 1 ? '1 page' : `${count} pages`
}
