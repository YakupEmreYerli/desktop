import * as React from 'react'

import { AppFileStatusKind } from '../../../models/status'
import {
  DiffHunk,
  DiffLine,
  DiffLineType,
  DiffType,
  ILargeTextDiff,
  ITextDiff,
} from '../../../models/diff'
import { getBoolean, setBoolean } from '../../../lib/local-storage'
import {
  AIProviders,
  getProviderModel,
  getSelectedProvider,
  isAIConfigured,
  onAISettingsChanged,
} from '../../../lib/ai/providers'
import {
  isMostlyTurkish,
  splitIntoBlocks,
  translateBlocks,
  translateLines,
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

  /** The file's diff */
  readonly diff: ITextDiff | ILargeTextDiff

  /** The regular text diff, shown in the code view */
  readonly code: JSX.Element

  /** Renders a diff the same way as the code view, without discarding */
  readonly renderDiff: (
    diff: ITextDiff,
    fileContents: IFileContents
  ) => JSX.Element
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
  /** Bumped when the cache fills so the diff is rebuilt with translations */
  readonly revision: number
}

interface ITranslatedDiff {
  readonly revision: number
  readonly diff: ITextDiff | ILargeTextDiff
  readonly fileContents: IFileContents
  readonly translatedDiff: ITextDiff
  readonly translatedContents: IFileContents
}

/**
 * Shows a text document's diff either as is or with its text translated into
 * Turkish, line for line, in the same diff view.
 */
export class TranslationDiff extends React.Component<
  ITranslationDiffProps,
  ITranslationDiffState
> {
  private abortController: AbortController | null = null
  private unsubscribeSettings: (() => void) | null = null

  /** Documents already in Turkish are shown as plain code, no switch */
  private isTurkishCache: {
    readonly contents: IFileContents
    readonly value: boolean
  } | null = null

  private translated: ITranslatedDiff | null = null

  public constructor(props: ITranslationDiffProps) {
    super(props)
    this.state = {
      showTranslation: getBoolean(ShowTranslationKey, false),
      status: { kind: 'checking' },
      revision: 0,
    }
  }

  public componentDidMount() {
    this.unsubscribeSettings = onAISettingsChanged(this.onSettingsChanged)
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
    this.unsubscribeSettings?.()
    this.abortController?.abort()
  }

  /** A provider set up (or changed) while this view waits: try again */
  private onSettingsChanged = () => {
    const { showTranslation, status } = this.state
    if (
      showTranslation &&
      (status.kind === 'not-configured' || status.kind === 'error')
    ) {
      this.translate()
    }
  }

  private get isAlreadyTurkish() {
    const { fileContents } = this.props
    if (this.isTurkishCache?.contents !== fileContents) {
      const deleted =
        fileContents.file.status.kind === AppFileStatusKind.Deleted
      this.isTurkishCache = {
        contents: fileContents,
        value: isMostlyTurkish(
          deleted ? fileContents.oldContents : fileContents.newContents
        ),
      }
    }
    return this.isTurkishCache.value
  }

  private async translate(force = false) {
    if (this.isAlreadyTurkish) {
      return
    }
    this.abortController?.abort()
    const controller = new AbortController()
    this.abortController = controller

    if (!(await isAIConfigured())) {
      if (!controller.signal.aborted) {
        this.setState({ status: { kind: 'not-configured' } })
      }
      return
    }

    const { oldContents, newContents } = this.props.fileContents
    const blocks = [
      ...splitIntoBlocks(oldContents),
      ...splitIntoBlocks(newContents),
    ]

    try {
      await translateBlocks(blocks, {
        force,
        signal: controller.signal,
        onProgress: (done, total) => {
          // Everything cached: go straight to done, no "Translating…" flash
          if (!controller.signal.aborted && total > 0) {
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
      this.setState(state => ({
        status: {
          kind: 'error',
          message:
            e instanceof Error && e.name === 'AIProviderError'
              ? e.message
              : 'The translation failed.',
        },
        revision: state.revision + 1,
      }))
    }
  }

  /**
   * The diff and file contents with every line whose block has been
   * translated replaced by its translation. Rebuilt only when the diff or
   * the cache changed.
   */
  private getTranslatedDiff(): ITranslatedDiff {
    const { diff, fileContents } = this.props
    const { revision } = this.state
    const cached = this.translated
    if (
      cached !== null &&
      cached.revision === revision &&
      cached.diff === diff &&
      cached.fileContents === fileContents
    ) {
      return cached
    }

    const oldLines = translateLines(fileContents.oldContents)
    const newLines = translateLines(fileContents.newContents)

    const hunks = diff.hunks.map(
      hunk =>
        new DiffHunk(
          hunk.header,
          hunk.lines.map(line => translateLine(line, oldLines, newLines)),
          hunk.unifiedDiffStart,
          hunk.unifiedDiffEnd,
          hunk.expansionType
        )
    )

    this.translated = {
      revision,
      diff,
      fileContents,
      translatedDiff: {
        kind: DiffType.Text,
        text: diff.text,
        hunks,
        lineEndingsChange: diff.lineEndingsChange,
        maxLineNumber: diff.maxLineNumber,
        hasHiddenBidiChars: diff.hasHiddenBidiChars,
      },
      translatedContents: {
        ...fileContents,
        oldContents: oldLines,
        newContents: newLines,
      },
    }
    return this.translated
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
    if (this.isAlreadyTurkish) {
      return this.props.code
    }

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

    const { translatedDiff, translatedContents } = this.getTranslatedDiff()

    return (
      <>
        {status.kind === 'error' && (
          <div className="translation-diff-error" role="alert">
            <Octicon symbol={OcticonSymbol.alert} />
            <span>{status.message}</span>
            <Button onClick={this.onRetry}>Try again</Button>
            <Button onClick={openAISettings}>AI settings</Button>
          </div>
        )}
        {this.props.renderDiff(translatedDiff, translatedContents)}
      </>
    )
  }
}

/** A diff line with its text replaced by the translated line, if any */
function translateLine(
  line: DiffLine,
  oldLines: ReadonlyArray<string>,
  newLines: ReadonlyArray<string>
) {
  let translated: string | undefined
  if (line.type === DiffLineType.Delete && line.oldLineNumber !== null) {
    translated = oldLines[line.oldLineNumber - 1]
  } else if (
    (line.type === DiffLineType.Add || line.type === DiffLineType.Context) &&
    line.newLineNumber !== null
  ) {
    translated = newLines[line.newLineNumber - 1]
  }

  if (translated === undefined || translated === line.content) {
    return line
  }

  return new DiffLine(
    line.text.charAt(0) + translated,
    line.type,
    line.originalLineNumber,
    line.oldLineNumber,
    line.newLineNumber,
    line.noTrailingNewLine
  )
}
