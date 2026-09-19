import * as React from 'react'
import { Repository } from '../../models/repository'
import { WorkingDirectoryFileChange } from '../../models/status'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { getRegisteredDispatcher } from '../../lib/ai/settings-link'
import {
  AIProviders,
  getTaskModel,
  getTaskProvider,
  onAISettingsChanged,
} from '../../lib/ai/providers'

interface IAICommitMessageButtonProps {
  readonly repository: Repository
  readonly filesSelected: ReadonlyArray<WorkingDirectoryFileChange>
  /** Amending can describe the amended commit with no files selected */
  readonly isAmending: boolean
  readonly isCommitting: boolean
  readonly isGeneratingCommitMessage: boolean
  /** A title or description has been typed and would be replaced */
  readonly hasMessage: boolean
  /** Draw the separator before the button rather than after it */
  readonly separatorBefore: boolean
}

/**
 * Writes the commit title and description with the provider picked for
 * commit messages in Options → AI. While a message is being written the
 * button cancels it.
 */
export class AICommitMessageButton extends React.Component<IAICommitMessageButtonProps> {
  private unsubscribe: (() => void) | null = null

  public componentDidMount() {
    // The tooltip names the provider and model
    this.unsubscribe = onAISettingsChanged(() => this.forceUpdate())
  }

  public componentWillUnmount() {
    this.unsubscribe?.()
  }

  private onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const dispatcher = getRegisteredDispatcher()
    const { repository, filesSelected, hasMessage } = this.props
    if (dispatcher === null) {
      return
    }
    if (this.props.isGeneratingCommitMessage) {
      dispatcher.cancelGenerateCommitMessage(repository)
    } else {
      dispatcher.generateAICommitMessage(repository, filesSelected, hasMessage)
    }
  }

  private getLabel() {
    const { isGeneratingCommitMessage, filesSelected, isAmending } = this.props
    if (isGeneratingCommitMessage) {
      return 'Stop writing the commit message'
    }
    const kind = getTaskProvider('commit-message')
    const using =
      kind === null
        ? ' (pick a provider in Options → AI)'
        : ` with ${AIProviders[kind].name} · ${getTaskModel('commit-message')}`
    const label = `Write the commit message${using}`
    return filesSelected.length === 0 && !isAmending
      ? `${label}. Select files to describe first.`
      : label
  }

  public render() {
    const {
      filesSelected,
      isAmending,
      isCommitting,
      isGeneratingCommitMessage,
      separatorBefore,
    } = this.props
    const label = this.getLabel()
    const noChanges = filesSelected.length === 0 && !isAmending

    return (
      <>
        {separatorBefore && <div className="separator" />}
        <Button
          className="ai-commit-message-button"
          onClick={this.onClick}
          ariaLabel={label}
          tooltip={label}
          disabled={isCommitting || (!isGeneratingCommitMessage && noChanges)}
        >
          <Octicon
            symbol={
              isGeneratingCommitMessage
                ? octicons.squareCircle
                : octicons.sparkle
            }
          />
        </Button>
        {!separatorBefore && <div className="separator" />}
      </>
    )
  }
}
