import * as React from 'react'
import classNames from 'classnames'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { AppFileStatusKind } from '../../../models/status'
import { DiffHunk } from '../../../models/diff'
import { getBoolean, setBoolean } from '../../../lib/local-storage'
import { shell } from '../../../lib/app-shell'
import {
  AIProviders,
  getProviderModel,
  getSelectedProvider,
  isAIConfigured,
} from '../../../lib/ai/providers'
import {
  getCachedTranslation,
  getDocumentBlocks,
  IDocumentBlock,
  translateBlocks,
} from '../../../lib/ai/translate'
import { openAISettings } from '../../../lib/ai/settings-link'
import { Button } from '../../lib/button'
import { Loading } from '../../lib/loading'
import { Octicon } from '../../octicons'
import * as OcticonSymbol from '../../octicons/octicons.generated'
import { IFileContents } from '../syntax-highlighting'
import { IViewSwitchOption, ViewSwitch } from '../view-switch'

/** Remembers whether documents open translated */
const ShowTranslationKey = 'translation-diff-show-translation'

type DocumentView = 'code' | 'turkish'

const ViewOptions: ReadonlyArray<IViewSwitchOption<DocumentView>> = [
  { value: 'code', label: 'Code', icon: OcticonSymbol.code },
  { value: 'turkish', label: 'Türkçe', icon: OcticonSymbol.globe },
]

interface ITranslationDiffProps {
  /** The old and new contents of the file */
  readonly fileContents: IFileContents

  /** The diff's hunks, used to mark changed paragraphs */
  readonly hunks: ReadonlyArray<DiffHunk>

  /** The regular text diff, shown in the code view */
  readonly code: JSX.Element
}

type TranslationStatus =
  | { readonly kind: 'checking' }
  | { readonly kind: 'not-configured' }
  | {
      readonly kind: 'translating'
      readonly done: number
      readonly total: number
    }
  | { readonly kind: 'done' }
  | { readonly kind: 'error'; readonly message: string }

interface ITranslationDiffState {
  readonly showTranslation: boolean
  readonly status: TranslationStatus
  /** Bumped when the cache fills so blocks re-render with their translation */
  readonly revision: number
}

/**
 * Shows a text document either as its diff or translated into Turkish, with
 * the paragraphs the change touched highlighted.
 */
export class TranslationDiff extends React.Component<
  ITranslationDiffProps,
  ITranslationDiffState
> {
  private abortController: AbortController | null = null
  private documentElement: HTMLDivElement | null = null

  public constructor(props: ITranslationDiffProps) {
    super(props)
    this.state = {
      showTranslation: getBoolean(ShowTranslationKey, false),
      status: { kind: 'checking' },
      revision: 0,
    }
  }

  public componentDidMount() {
    if (this.state.showTranslation) {
      this.translate()
    }
  }

  public componentDidUpdate(
    prevProps: ITranslationDiffProps,
    prevState: ITranslationDiffState
  ) {
    const contentsChanged = prevProps.fileContents !== this.props.fileContents
    const opened = !prevState.showTranslation && this.state.showTranslation
    if (this.state.showTranslation && (contentsChanged || opened)) {
      this.translate()
    }
  }

  public componentWillUnmount() {
    this.abortController?.abort()
  }

  private get isDeleted() {
    return (
      this.props.fileContents.file.status.kind === AppFileStatusKind.Deleted
    )
  }

  private get isModified() {
    const { kind } = this.props.fileContents.file.status
    return (
      kind !== AppFileStatusKind.New &&
      kind !== AppFileStatusKind.Untracked &&
      kind !== AppFileStatusKind.Deleted
    )
  }

  private getBlocks(): ReadonlyArray<IDocumentBlock> {
    const { oldContents, newContents } = this.props.fileContents
    return getDocumentBlocks(
      this.isDeleted ? oldContents : newContents,
      this.isModified ? this.props.hunks : null
    )
  }

  private async translate(force = false) {
    this.abortController?.abort()
    const controller = new AbortController()
    this.abortController = controller

    this.setState({ status: { kind: 'checking' } })
    if (!(await isAIConfigured())) {
      if (!controller.signal.aborted) {
        this.setState({ status: { kind: 'not-configured' } })
      }
      return
    }

    try {
      await translateBlocks(this.getBlocks(), {
        force,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted) {
            this.setState(state => ({
              status: { kind: 'translating', done, total },
              revision: state.revision + 1,
            }))
          }
        },
      })
      if (!controller.signal.aborted) {
        this.setState(state => ({
          status: { kind: 'done' },
          revision: state.revision + 1,
        }))
      }
    } catch (e) {
      if (controller.signal.aborted) {
        return
      }
      log.error('Unable to translate document', e)
      this.setState({
        status: {
          kind: 'error',
          message:
            e instanceof Error && e.name === 'AIProviderError'
              ? e.message
              : 'The translation failed.',
        },
      })
    }
  }

  private onSelectView = (view: DocumentView) => {
    const showTranslation = view === 'turkish'
    setBoolean(ShowTranslationKey, showTranslation)
    if (!showTranslation) {
      this.abortController?.abort()
    }
    this.setState({ showTranslation })
  }

  private onRetranslate = () => this.translate(true)
  private onRetry = () => this.translate()

  public render() {
    const { showTranslation } = this.state

    return (
      <div className="translation-diff">
        <div className="translation-diff-toolbar">
          <ViewSwitch
            options={ViewOptions}
            selected={showTranslation ? 'turkish' : 'code'}
            ariaLabel="Show the file as"
            onSelect={this.onSelectView}
          />
          {showTranslation && this.renderStatus()}
        </div>
        {showTranslation ? this.renderTranslation() : this.props.code}
      </div>
    )
  }

  private renderStatus() {
    const { status } = this.state
    const kind = getSelectedProvider()

    if (status.kind === 'translating') {
      return (
        <div className="translation-diff-status" aria-live="polite">
          <Loading />
          {status.total > 1
            ? `Translating… ${status.done} of ${status.total}`
            : 'Translating…'}
        </div>
      )
    }

    if (status.kind === 'done' && kind !== null) {
      return (
        <div className="translation-diff-status">
          <span className="translation-diff-source">
            {AIProviders[kind].name} · {getProviderModel(kind)}
          </span>
          <Button
            className="translation-diff-retranslate"
            onClick={this.onRetranslate}
            tooltip="Translate the whole document again"
          >
            <Octicon symbol={OcticonSymbol.sync} />
            Translate again
          </Button>
        </div>
      )
    }

    return null
  }

  private renderTranslation() {
    const { status } = this.state

    if (status.kind === 'not-configured') {
      return (
        <div className="translation-diff-message">
          <Octicon symbol={OcticonSymbol.globe} className="message-icon" />
          <h2>Pick an AI provider to translate</h2>
          <p>
            DeepSeek, OpenRouter or your Claude subscription can translate
            documents into Turkish. Set one up once in Options.
          </p>
          <Button type="submit" onClick={openAISettings}>
            Open AI settings
          </Button>
        </div>
      )
    }

    return (
      <div className="translation-diff-document" ref={this.onDocumentRef}>
        {status.kind === 'error' && (
          <div className="translation-diff-error" role="alert">
            <Octicon symbol={OcticonSymbol.alert} />
            <span>{status.message}</span>
            <Button onClick={this.onRetry}>Try again</Button>
            <Button onClick={openAISettings}>AI settings</Button>
          </div>
        )}
        <article className="translation-diff-article">
          {this.getBlocks().map((block, index) =>
            this.renderBlock(block, index)
          )}
        </article>
      </div>
    )
  }

  private renderBlock(block: IDocumentBlock, index: number) {
    const translated = block.isCode
      ? block.source
      : getCachedTranslation(block.source)
    const pending = translated === undefined
    const text = translated ?? block.source

    return (
      <React.Fragment key={`${index}:${block.startLine}`}>
        {text.trim() !== '' && (
          <div
            className={classNames('translation-block', {
              changed: block.changed,
              pending,
            })}
            // Markdown from the repository and from the model, sanitized
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
        )}
        {block.removedAfter > 0 && (
          <div className="translation-removed">
            <Octicon symbol={OcticonSymbol.dash} />
            {block.removedAfter === 1
              ? '1 line removed'
              : `${block.removedAfter} lines removed`}
          </div>
        )}
      </React.Fragment>
    )
  }

  private onDocumentRef = (element: HTMLDivElement | null) => {
    this.documentElement?.removeEventListener('click', this.onDocumentClick)
    this.documentElement = element
    element?.addEventListener('click', this.onDocumentClick)
  }

  /** Links open in the browser instead of navigating the app */
  private onDocumentClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const anchor = target.closest('a')
    if (anchor === null) {
      return
    }
    event.preventDefault()
    const href = anchor.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(href)) {
      shell.openExternal(href)
    }
  }
}

function renderMarkdown(text: string) {
  return DOMPurify.sanitize(marked(text, { gfm: true, breaks: false }))
}
