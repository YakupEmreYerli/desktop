import * as React from 'react'
import * as Path from 'path'
import classNames from 'classnames'

import { AppFileStatusKind } from '../../../models/status'
import { getOldPathOrDefault } from '../../../lib/get-old-path'
import { buildHtmlPreview, PreviewAssetReader } from '../../../lib/html'
import { getBoolean, setBoolean } from '../../../lib/local-storage'
import * as OcticonSymbol from '../../octicons/octicons.generated'
import { IViewSwitchOption, ViewSwitch } from '../view-switch'
import { IFileContents } from '../syntax-highlighting'
import { HtmlFrame } from './html-frame'

/** Remembers whether HTML files open in the code view instead of the preview */
const ShowCodeKey = 'html-diff-show-code'

type HtmlView = 'preview' | 'code'

const ViewOptions: ReadonlyArray<IViewSwitchOption<HtmlView>> = [
  { value: 'preview', label: 'Preview', icon: OcticonSymbol.eye },
  { value: 'code', label: 'Code', icon: OcticonSymbol.code },
]

/** Padding of the page area and height of a column label, see _html-diff.scss */
const PagesPadding = 16
const LabelHeight = 28

interface IHtmlDiffProps {
  /** The repository's working directory */
  readonly repositoryPath: string

  /** The old and new contents of the file */
  readonly fileContents: IFileContents

  /** The regular text diff, shown in the code view */
  readonly code: JSX.Element
}

interface IHtmlDiffState {
  readonly showCode: boolean

  /** The documents ready for the preview frames, null while loading */
  readonly previous: string | null
  readonly current: string | null

  /** The height of the scrollable page area */
  readonly viewportHeight: number
}

/**
 * Shows an HTML file either as its text diff or as rendered pages, the old
 * version next to the new one when the file was modified.
 */
export class HtmlDiff extends React.Component<IHtmlDiffProps, IHtmlDiffState> {
  /** Incremented for every load so that stale loads can bail out */
  private generation = 0

  private readonly resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const viewportHeight = entry.target.clientHeight
      if (viewportHeight !== this.state.viewportHeight) {
        this.setState({ viewportHeight })
      }
    }
  })

  public constructor(props: IHtmlDiffProps) {
    super(props)
    this.state = {
      showCode: getBoolean(ShowCodeKey, false),
      previous: null,
      current: null,
      viewportHeight: 0,
    }
  }

  public componentDidMount() {
    if (!this.state.showCode) {
      this.loadPreviews()
    }
  }

  public componentDidUpdate(
    prevProps: IHtmlDiffProps,
    prevState: IHtmlDiffState
  ) {
    const contentsChanged = prevProps.fileContents !== this.props.fileContents
    const previewShown = prevState.showCode && !this.state.showCode
    if (!this.state.showCode && (contentsChanged || previewShown)) {
      this.loadPreviews()
    }
  }

  public componentWillUnmount() {
    this.generation++
    this.resizeObserver.disconnect()
  }

  private onPagesRef = (element: HTMLDivElement | null) => {
    this.resizeObserver.disconnect()
    if (element !== null) {
      this.resizeObserver.observe(element)
    }
  }

  private get isModified() {
    return this.hasPrevious && this.hasCurrent
  }

  private get hasPrevious() {
    const { kind } = this.props.fileContents.file.status
    return (
      kind !== AppFileStatusKind.New && kind !== AppFileStatusKind.Untracked
    )
  }

  private get hasCurrent() {
    const { kind } = this.props.fileContents.file.status
    return kind !== AppFileStatusKind.Deleted
  }

  private async loadPreviews() {
    const generation = ++this.generation
    const { repositoryPath, fileContents } = this.props
    const { file, oldContents, newContents } = fileContents
    const oldPath = getOldPathOrDefault(file)

    this.setState({ previous: null, current: null })

    const reader = new PreviewAssetReader(repositoryPath)
    const build = (lines: ReadonlyArray<string>, path: string) =>
      buildHtmlPreview(
        lines.join('\n'),
        Path.join(repositoryPath, path),
        repositoryPath,
        reader
      ).catch(e => {
        log.error('Unable to prepare HTML preview', e)
        return lines.join('\n')
      })

    const [previous, current] = await Promise.all([
      this.hasPrevious ? build(oldContents, oldPath) : null,
      this.hasCurrent ? build(newContents, file.path) : null,
    ])

    if (generation === this.generation) {
      this.setState({ previous, current })
    }
  }

  private onSelectView = (view: HtmlView) => {
    const showCode = view === 'code'
    setBoolean(ShowCodeKey, showCode)
    this.setState({ showCode })
  }

  public render() {
    const { showCode } = this.state

    return (
      <div className="html-diff">
        <div className="html-diff-toolbar">
          <ViewSwitch
            options={ViewOptions}
            selected={showCode ? 'code' : 'preview'}
            ariaLabel="Show the file as"
            onSelect={this.onSelectView}
          />
        </div>
        {showCode ? this.props.code : this.renderPreview()}
      </div>
    )
  }

  private renderPreview() {
    const className = classNames('html-diff-pages', {
      modified: this.isModified,
    })

    return (
      <div className={className} ref={this.onPagesRef}>
        {this.hasPrevious &&
          this.renderPage('previous', 'Deleted', this.state.previous)}
        {this.hasCurrent &&
          this.renderPage('current', 'Added', this.state.current)}
      </div>
    )
  }

  private renderPage(
    side: 'previous' | 'current',
    title: string,
    document: string | null
  ) {
    const minHeight = Math.max(
      0,
      this.state.viewportHeight -
        2 * PagesPadding -
        (this.isModified ? LabelHeight : 0)
    )

    return (
      <div className={classNames('html-diff-column', side)}>
        {this.isModified && <div className="html-diff-label">{title}</div>}
        {document === null ? (
          <div className="html-diff-page loading">Loading preview…</div>
        ) : (
          <HtmlFrame
            title={`${title} version of the page`}
            document={document}
            minHeight={minHeight}
          />
        )}
      </div>
    )
  }
}
