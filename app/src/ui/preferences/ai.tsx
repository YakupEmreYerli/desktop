import * as React from 'react'
import * as Os from 'os'
import classNames from 'classnames'

import { DialogContent } from '../dialog'
import { TextBox } from '../lib/text-box'
import { PasswordTextBox } from '../lib/password-text-box'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import { LinkButton } from '../lib/link-button'
import { Loading } from '../lib/loading'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  AIProviderKind,
  AIProviderKinds,
  AIProviders,
  AITask,
  AITaskNames,
  AITasks,
  deleteProviderKey,
  findClaudeExecutable,
  getProviderKey,
  getTaskModel,
  getTaskProvider,
  setProviderKey,
  setTaskModel,
  setTaskProvider,
  testProvider,
} from '../../lib/ai/providers'
import { TextArea } from '../lib/text-area'
import { CommitMessagePreview } from './commit-message-preview'
import {
  CommitDescriptionModeNames,
  CommitDescriptionModes,
  CommitMessageLanguageNames,
  CommitMessageLanguages,
  CommitMessageStyleNames,
  CommitMessageStyles,
  ICommitMessageSettings,
  getCommitMessageSettings,
  setCommitMessageSettings,
} from '../../lib/ai/commit-message'

/** One line under each provider's name */
const ProviderSummaries: Record<AIProviderKind, string> = {
  deepseek: 'API key, pay per use. Cheap and fast.',
  openrouter: 'API key for hundreds of models, Gemini and Claude included.',
  claude: 'Your Claude subscription, through the claude command.',
}

/** What each feature does, under its name */
const TaskSummaries: Record<AITask, string> = {
  translation: 'Translates text documents into Turkish in the diff view.',
  'commit-message':
    'Writes the commit title and description from the selected changes.',
}

const NoProvider = 'none'

type TestResult =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'ok' }
  | { readonly kind: 'failed'; readonly message: string }

interface IModelSuggestionProps {
  readonly model: string
  readonly selected: boolean
  readonly onSelect: (model: string) => void
}

class ModelSuggestion extends React.Component<IModelSuggestionProps> {
  private onClick = () => this.props.onSelect(this.props.model)

  public render() {
    return (
      <button
        type="button"
        className={classNames('ai-model-suggestion', {
          selected: this.props.selected,
        })}
        onClick={this.onClick}
      >
        {this.props.model}
      </button>
    )
  }
}

function TestResultView(props: {
  readonly test: TestResult
  readonly name: string
}) {
  const { test } = props
  return (
    <span
      className={classNames('ai-test-result', test.kind)}
      aria-live="polite"
    >
      {test.kind === 'running' && (
        <>
          <Loading />
          Asking {props.name}…
        </>
      )}
      {test.kind === 'ok' && (
        <>
          <Octicon symbol={octicons.check} />
          Works.
        </>
      )}
      {test.kind === 'failed' && (
        <>
          <Octicon symbol={octicons.alert} />
          {test.message}
        </>
      )}
    </span>
  )
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e)

interface ITaskSettingsState {
  readonly provider: AIProviderKind | null
  readonly model: string
  readonly commitMessage: ICommitMessageSettings
  readonly test: TestResult
}

/** Provider, model (and language for commit messages) of one feature */
class TaskSettings extends React.Component<
  { readonly task: AITask },
  ITaskSettingsState
> {
  private unmounted = false

  public constructor(props: { readonly task: AITask }) {
    super(props)
    this.state = {
      provider: getTaskProvider(props.task),
      model: getTaskModel(props.task),
      commitMessage: getCommitMessageSettings(),
      test: { kind: 'idle' },
    }
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  private onProviderChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    const provider = AIProviderKinds.find(k => k === value) ?? null
    setTaskProvider(this.props.task, provider)
    this.setState({
      provider,
      model: getTaskModel(this.props.task),
      test: { kind: 'idle' },
    })
  }

  private onModelChanged = (model: string) => {
    setTaskModel(this.props.task, model)
    this.setState({ model, test: { kind: 'idle' } })
  }

  private updateCommitMessage(change: Partial<ICommitMessageSettings>) {
    setCommitMessageSettings(change)
    this.setState({ commitMessage: getCommitMessageSettings() })
  }

  private onLanguageChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    const language = CommitMessageLanguages.find(l => l === value)
    if (language !== undefined) {
      this.updateCommitMessage({ language })
    }
  }

  private onOtherLanguageChanged = (otherLanguage: string) => {
    this.updateCommitMessage({ otherLanguage })
  }

  private onStyleChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    const style = CommitMessageStyles.find(s => s === value)
    if (style !== undefined) {
      this.updateCommitMessage({ style })
    }
  }

  private onCustomStyleChanged = (customStyle: string) => {
    this.updateCommitMessage({ customStyle })
  }

  private onDescriptionChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const value = event.currentTarget.value
    const description = CommitDescriptionModes.find(d => d === value)
    if (description !== undefined) {
      this.updateCommitMessage({ description })
    }
  }

  private onCustomDescriptionChanged = (customDescription: string) => {
    this.updateCommitMessage({ customDescription })
  }

  private onTest = async () => {
    const { provider, model } = this.state
    if (provider === null) {
      return
    }
    this.setState({ test: { kind: 'running' } })
    try {
      await testProvider(
        provider,
        model.trim() || AIProviders[provider].defaultModel
      )
      if (!this.unmounted) {
        this.setState({ test: { kind: 'ok' } })
      }
    } catch (e) {
      if (!this.unmounted) {
        this.setState({ test: { kind: 'failed', message: errorMessage(e) } })
      }
    }
  }

  public render() {
    const { task } = this.props
    const { provider } = this.state

    return (
      <section className="ai-task" aria-labelledby={`ai-task-${task}`}>
        <div className="ai-task-heading">
          <h3 id={`ai-task-${task}`}>{AITaskNames[task]}</h3>
          <p>{TaskSummaries[task]}</p>
        </div>
        <div className="ai-task-fields">
          <Select
            label="Provider"
            value={provider ?? NoProvider}
            onChange={this.onProviderChanged}
          >
            <option value={NoProvider}>Off</option>
            {AIProviderKinds.map(k => (
              <option key={k} value={k}>
                {AIProviders[k].name}
              </option>
            ))}
          </Select>
        </div>
        {provider !== null && this.renderModel(provider)}
        {task === 'commit-message' && this.renderCommitMessageSettings()}
      </section>
    )
  }

  private renderCommitMessageSettings() {
    const {
      language,
      otherLanguage,
      style,
      customStyle,
      description,
      customDescription,
    } = this.state.commitMessage

    return (
      <>
        <div className="ai-task-fields">
          <Select
            label="Language"
            value={language}
            onChange={this.onLanguageChanged}
          >
            {CommitMessageLanguages.map(l => (
              <option key={l} value={l}>
                {CommitMessageLanguageNames[l]}
              </option>
            ))}
          </Select>
          <Select label="Style" value={style} onChange={this.onStyleChanged}>
            {CommitMessageStyles.map(s => (
              <option key={s} value={s}>
                {CommitMessageStyleNames[s]}
              </option>
            ))}
          </Select>
        </div>
        {language === 'other' && (
          <div className="ai-field">
            <TextBox
              label="Language name"
              value={otherLanguage}
              placeholder="Deutsch, Español, 日本語…"
              onValueChanged={this.onOtherLanguageChanged}
            />
            <p className="ai-preferences-hint">
              A language the model doesn't recognize falls back to English.
            </p>
          </div>
        )}
        {style === 'custom' && (
          <TextArea
            label="Your rules"
            value={customStyle}
            rows={4}
            placeholder={
              'Start the title with the ticket number, like "PRJ-12: …".\nNo description for small changes.'
            }
            onValueChanged={this.onCustomStyleChanged}
          />
        )}
        <Select
          label="Description"
          value={description}
          onChange={this.onDescriptionChanged}
        >
          {CommitDescriptionModes.map(d => (
            <option key={d} value={d}>
              {CommitDescriptionModeNames[d]}
            </option>
          ))}
        </Select>
        {description === 'custom' && (
          <TextArea
            label="How to write the description"
            value={customDescription}
            rows={3}
            placeholder={
              'List the changed parts as short bullet points.\nMention the ticket number at the end.'
            }
            onValueChanged={this.onCustomDescriptionChanged}
          />
        )}
        <CommitMessagePreview
          language={language}
          otherLanguage={otherLanguage}
          style={style}
          description={description}
        />
      </>
    )
  }

  private renderModel(provider: AIProviderKind) {
    const info = AIProviders[provider]
    return (
      <>
        <div className="ai-field">
          <TextBox
            label="Model"
            value={this.state.model}
            placeholder={info.defaultModel}
            onValueChanged={this.onModelChanged}
          />
          <div className="ai-model-suggestions">
            {info.suggestedModels.map(model => (
              <ModelSuggestion
                key={model}
                model={model}
                selected={model === this.state.model}
                onSelect={this.onModelChanged}
              />
            ))}
          </div>
        </div>
        <div className="ai-test">
          <Button
            onClick={this.onTest}
            disabled={this.state.test.kind === 'running'}
          >
            Test
          </Button>
          <TestResultView test={this.state.test} name={info.name} />
        </div>
      </>
    )
  }
}

interface IProviderSettingsState {
  /** Whether the keychain holds a key; null while looking */
  readonly hasStoredKey: boolean | null
  /** A key typed in but not saved yet */
  readonly keyDraft: string
  /** Where the claude command was found; undefined while looking */
  readonly claudePath: string | null | undefined
}

/** A provider's API key, or where the claude command is */
class ProviderSettings extends React.Component<
  { readonly kind: AIProviderKind },
  IProviderSettingsState
> {
  private unmounted = false

  public constructor(props: { readonly kind: AIProviderKind }) {
    super(props)
    this.state = { hasStoredKey: null, keyDraft: '', claudePath: undefined }
  }

  public async componentDidMount() {
    const { kind } = this.props
    if (kind === 'claude') {
      const claudePath = await findClaudeExecutable()
      if (!this.unmounted) {
        this.setState({ claudePath })
      }
    } else {
      const key = await getProviderKey(kind)
      if (!this.unmounted) {
        this.setState({ hasStoredKey: !!key })
      }
    }
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  private onKeyDraftChanged = (keyDraft: string) => {
    this.setState({ keyDraft })
  }

  private onSaveKey = async () => {
    const { keyDraft } = this.state
    if (keyDraft.trim() === '') {
      return
    }
    await setProviderKey(this.props.kind, keyDraft)
    if (!this.unmounted) {
      this.setState({ hasStoredKey: true, keyDraft: '' })
    }
  }

  private onRemoveKey = async () => {
    await deleteProviderKey(this.props.kind)
    if (!this.unmounted) {
      this.setState({ hasStoredKey: false })
    }
  }

  public render() {
    const { kind } = this.props
    const info = AIProviders[kind]
    return (
      <section className="ai-provider" aria-labelledby={`ai-provider-${kind}`}>
        <div className="ai-provider-label">
          <span className="ai-provider-name" id={`ai-provider-${kind}`}>
            {info.name}
          </span>
          <span className="ai-provider-summary">{ProviderSummaries[kind]}</span>
        </div>
        {info.needsKey ? this.renderKeyField() : this.renderClaude()}
      </section>
    )
  }

  private renderKeyField() {
    const info = AIProviders[this.props.kind]
    const { hasStoredKey, keyDraft } = this.state

    return (
      <div className="ai-field">
        <PasswordTextBox
          ariaLabel={`${info.name} API key`}
          value={keyDraft}
          placeholder={
            hasStoredKey
              ? 'Key saved in the keychain. Type to replace it.'
              : 'API key'
          }
          onValueChanged={this.onKeyDraftChanged}
        />
        <div className="ai-key-actions">
          <Button onClick={this.onSaveKey} disabled={keyDraft.trim() === ''}>
            Save key
          </Button>
          {hasStoredKey && (
            <Button onClick={this.onRemoveKey}>Remove key</Button>
          )}
          <span className="ai-key-status">
            {hasStoredKey === null ? null : hasStoredKey ? (
              <>
                <Octicon symbol={octicons.check} className="ok" />
                Key saved
              </>
            ) : (
              <>
                No key yet. <LinkButton uri={info.setupUrl}>Get one</LinkButton>
              </>
            )}
          </span>
        </div>
      </div>
    )
  }

  private renderClaude() {
    const { claudePath } = this.state

    if (claudePath === undefined) {
      return <p className="ai-preferences-hint">Looking for claude…</p>
    }

    if (claudePath === null) {
      return (
        <p className="ai-preferences-hint warning">
          <Octicon symbol={octicons.alert} />
          <span>
            The claude command wasn't found.{' '}
            <LinkButton uri={AIProviders.claude.setupUrl}>
              Install Claude Code
            </LinkButton>{' '}
            and sign in with your subscription, then come back here.
          </span>
        </p>
      )
    }

    const home = Os.homedir()
    const display = claudePath.startsWith(home)
      ? `~${claudePath.slice(home.length)}`
      : claudePath

    return (
      <p className="ai-preferences-hint">
        <Octicon symbol={octicons.check} className="ok" />
        <span>
          Using <code>{display}</code>. Requests count against your Claude
          plan's usage.
        </span>
      </p>
    )
  }
}

/**
 * Options → AI: which provider and model each AI feature uses, and the
 * providers' keys. Changes are saved as they're made; keys go to the OS
 * keychain.
 */
export class AIPreferences extends React.Component {
  public render() {
    return (
      <DialogContent className="ai-tab">
        <div className="ai-preferences">
          <h2>Features</h2>
          <p className="settings-description">
            Each feature uses its own provider and model. What it works on is
            sent to that provider.
          </p>
          <div className="ai-task-list">
            {AITasks.map(task => (
              <TaskSettings key={task} task={task} />
            ))}
          </div>

          <h2>Providers</h2>
          <div className="ai-provider-list">
            {AIProviderKinds.map(kind => (
              <ProviderSettings key={kind} kind={kind} />
            ))}
          </div>
        </div>
      </DialogContent>
    )
  }
}
