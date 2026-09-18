import * as React from 'react'
import * as Os from 'os'
import classNames from 'classnames'

import { DialogContent } from '../dialog'
import { RadioGroup } from '../lib/radio-group'
import { TextBox } from '../lib/text-box'
import { PasswordTextBox } from '../lib/password-text-box'
import { Button } from '../lib/button'
import { LinkButton } from '../lib/link-button'
import { Loading } from '../lib/loading'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  AIProviderKind,
  AIProviderKinds,
  AIProviders,
  deleteProviderKey,
  findClaudeExecutable,
  getProviderKey,
  getProviderModel,
  getSelectedProvider,
  setProviderKey,
  setProviderModel,
  setSelectedProvider,
  testProvider,
} from '../../lib/ai/providers'

/** One line under each provider's name */
const ProviderSummaries: Record<AIProviderKind, string> = {
  deepseek: 'API key, pay per use. Cheap and fast.',
  openrouter: 'API key for hundreds of models, Gemini and Claude included.',
  claude: 'Your Claude subscription, through the claude command.',
}

type TestResult =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'ok' }
  | { readonly kind: 'failed'; readonly message: string }

interface IAIPreferencesState {
  readonly provider: AIProviderKind
  readonly model: string

  /** Whether the keychain holds a key for the selected provider */
  readonly hasStoredKey: boolean | null
  /** A key typed in but not saved yet */
  readonly keyDraft: string

  /** Where the claude command was found; undefined while looking */
  readonly claudePath: string | null | undefined

  readonly test: TestResult
}

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

/**
 * Options → AI: which provider the fork's AI features use. Changes are saved
 * as they're made; keys go to the OS keychain.
 */
export class AIPreferences extends React.Component<{}, IAIPreferencesState> {
  private unmounted = false

  public constructor(props: {}) {
    super(props)
    // Opening the tab picks the first provider; it isn't usable until it has
    // a key (or the claude command), so this doesn't turn anything on
    const provider = getSelectedProvider() ?? AIProviderKinds[0]
    setSelectedProvider(provider)
    this.state = {
      provider,
      model: getProviderModel(provider),
      hasStoredKey: null,
      keyDraft: '',
      claudePath: undefined,
      test: { kind: 'idle' },
    }
  }

  public componentDidMount() {
    this.loadProviderDetails(this.state.provider)
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  private async loadProviderDetails(provider: AIProviderKind) {
    if (provider === 'claude') {
      const claudePath = await findClaudeExecutable()
      if (!this.unmounted && this.state.provider === provider) {
        this.setState({ claudePath })
      }
    } else {
      const key = await getProviderKey(provider)
      if (!this.unmounted && this.state.provider === provider) {
        this.setState({ hasStoredKey: !!key })
      }
    }
  }

  private onProviderChanged = (provider: AIProviderKind) => {
    setSelectedProvider(provider)
    this.setState({
      provider,
      model: getProviderModel(provider),
      hasStoredKey: null,
      keyDraft: '',
      claudePath: undefined,
      test: { kind: 'idle' },
    })
    this.loadProviderDetails(provider)
  }

  private onModelChanged = (model: string) => {
    setProviderModel(this.state.provider, model)
    this.setState({ model, test: { kind: 'idle' } })
  }

  private onKeyDraftChanged = (keyDraft: string) => {
    this.setState({ keyDraft, test: { kind: 'idle' } })
  }

  private onSaveKey = async () => {
    const { provider, keyDraft } = this.state
    if (keyDraft.trim() === '') {
      return
    }
    await setProviderKey(provider, keyDraft)
    if (!this.unmounted) {
      this.setState({ hasStoredKey: true, keyDraft: '' })
    }
  }

  private onRemoveKey = async () => {
    await deleteProviderKey(this.state.provider)
    if (!this.unmounted) {
      this.setState({ hasStoredKey: false, test: { kind: 'idle' } })
    }
  }

  private onTest = async () => {
    const { provider, model, keyDraft } = this.state
    this.setState({ test: { kind: 'running' } })
    try {
      await testProvider(
        provider,
        model.trim() || AIProviders[provider].defaultModel,
        keyDraft.trim() || undefined
      )
      if (!this.unmounted) {
        this.setState({ test: { kind: 'ok' } })
      }
    } catch (e) {
      if (!this.unmounted) {
        this.setState({
          test: {
            kind: 'failed',
            message: e instanceof Error ? e.message : String(e),
          },
        })
      }
    }
  }

  public render() {
    const { provider } = this.state

    return (
      <DialogContent>
        <div className="ai-preferences">
          <h2 id="ai-provider-heading">AI provider</h2>
          <p className="settings-description">
            Used to translate text documents into Turkish in the diff view.
            Documents are sent to the provider you pick.
          </p>

          <RadioGroup<AIProviderKind>
            ariaLabelledBy="ai-provider-heading"
            className="ai-provider-list"
            selectedKey={provider}
            radioButtonKeys={AIProviderKinds}
            onSelectionChanged={this.onProviderChanged}
            renderRadioButtonLabelContents={this.renderProviderLabel}
          />

          {this.renderProviderSettings(provider)}
        </div>
      </DialogContent>
    )
  }

  private renderProviderLabel = (kind: AIProviderKind) => {
    return (
      <span className="ai-provider-label">
        <span className="ai-provider-name">{AIProviders[kind].name}</span>
        <span className="ai-provider-summary">{ProviderSummaries[kind]}</span>
      </span>
    )
  }

  private renderProviderSettings(provider: AIProviderKind) {
    const info = AIProviders[provider]

    return (
      <div className="ai-provider-settings">
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

        {info.needsKey ? this.renderKeyField(provider) : this.renderClaude()}

        {this.renderTest(provider)}
      </div>
    )
  }

  private renderKeyField(provider: AIProviderKind) {
    const info = AIProviders[provider]
    const { hasStoredKey, keyDraft } = this.state

    return (
      <div className="ai-field">
        <PasswordTextBox
          label="API key"
          value={keyDraft}
          placeholder={
            hasStoredKey ? 'Saved in the keychain. Type to replace it.' : ''
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

  private renderTest(provider: AIProviderKind) {
    const { test, hasStoredKey, keyDraft, claudePath } = this.state
    const ready = AIProviders[provider].needsKey
      ? hasStoredKey === true || keyDraft.trim() !== ''
      : typeof claudePath === 'string'

    return (
      <div className="ai-test">
        <Button
          onClick={this.onTest}
          disabled={!ready || test.kind === 'running'}
        >
          Test connection
        </Button>
        <span
          className={classNames('ai-test-result', test.kind)}
          aria-live="polite"
        >
          {test.kind === 'running' && (
            <>
              <Loading />
              Asking {AIProviders[provider].name}…
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
      </div>
    )
  }
}
