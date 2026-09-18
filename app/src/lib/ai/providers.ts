import { spawn } from 'child_process'
import { access, constants } from 'fs/promises'
import * as Path from 'path'
import * as Os from 'os'
import { TokenStore } from '../stores/token-store'

/**
 * The AI providers the fork's features (translation, later commit messages)
 * can use. Two are HTTP APIs with a key; `claude` runs the locally installed
 * Claude Code CLI, so it uses the user's Claude subscription.
 */
export type AIProviderKind = 'deepseek' | 'openrouter' | 'claude'

export const AIProviderKinds: ReadonlyArray<AIProviderKind> = [
  'deepseek',
  'openrouter',
  'claude',
]

interface IAIProviderInfo {
  readonly name: string
  /** Model used when the user hasn't picked one */
  readonly defaultModel: string
  /** Models offered in the settings; any other ID can be typed in */
  readonly suggestedModels: ReadonlyArray<string>
  /** Whether requests need an API key */
  readonly needsKey: boolean
  /** Where the user gets a key or the CLI */
  readonly setupUrl: string
}

export const AIProviders: Record<AIProviderKind, IAIProviderInfo> = {
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-flash',
    suggestedModels: ['deepseek-flash', 'deepseek-v4-pro'],
    needsKey: true,
    setupUrl: 'https://platform.deepseek.com/api_keys',
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'google/gemini-2.5-flash',
    suggestedModels: [
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat',
      'anthropic/claude-sonnet-4.5',
    ],
    needsKey: true,
    setupUrl: 'https://openrouter.ai/settings/keys',
  },
  claude: {
    name: 'Claude',
    defaultModel: 'sonnet',
    suggestedModels: ['sonnet', 'haiku', 'opus'],
    needsKey: false,
    setupUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
  },
}

const ProviderKey = 'ai-provider'
const modelKey = (kind: AIProviderKind) => `ai-model-${kind}`
const SecretKey = `${
  __DEV__ ? 'GitHub Desktop Dev' : 'GitHub Desktop'
} - AI provider`

/** The provider the user picked, or null if none has been set up */
export function getSelectedProvider(): AIProviderKind | null {
  const value = localStorage.getItem(ProviderKey)
  return AIProviderKinds.find(k => k === value) ?? null
}

export function setSelectedProvider(kind: AIProviderKind | null) {
  if (kind === null) {
    localStorage.removeItem(ProviderKey)
  } else {
    localStorage.setItem(ProviderKey, kind)
  }
}

export function getProviderModel(kind: AIProviderKind) {
  const value = localStorage.getItem(modelKey(kind))?.trim()
  return value ? value : AIProviders[kind].defaultModel
}

export function setProviderModel(kind: AIProviderKind, model: string) {
  const trimmed = model.trim()
  if (trimmed === '' || trimmed === AIProviders[kind].defaultModel) {
    localStorage.removeItem(modelKey(kind))
  } else {
    localStorage.setItem(modelKey(kind), trimmed)
  }
}

/** The API key stored in the OS keychain for a provider */
export function getProviderKey(kind: AIProviderKind) {
  return TokenStore.getItem(SecretKey, kind)
}

export function setProviderKey(kind: AIProviderKind, key: string) {
  return TokenStore.setItem(SecretKey, kind, key.trim())
}

export function deleteProviderKey(kind: AIProviderKind) {
  return TokenStore.deleteItem(SecretKey, kind)
}

/** An error meant to be shown to the user as is */
export class AIProviderError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'AIProviderError'
  }
}

/**
 * Whether AI features can run: a provider is picked and it has what it needs
 * (a key, or the claude CLI on this machine).
 */
export async function isAIConfigured(): Promise<boolean> {
  const kind = getSelectedProvider()
  if (kind === null) {
    return false
  }
  if (kind === 'claude') {
    return (await findClaudeExecutable()) !== null
  }
  return !!(await getProviderKey(kind))
}

export interface IAIRequest {
  /** Instructions for the model */
  readonly system: string
  /** The input to work on */
  readonly prompt: string
  /** Ask OpenAI-compatible APIs for a JSON object */
  readonly json?: boolean
  readonly signal?: AbortSignal
}

/** Run a single prompt against the selected provider and return its text */
export async function completeWithAI(request: IAIRequest): Promise<string> {
  const kind = getSelectedProvider()
  if (kind === null) {
    throw new AIProviderError('No AI provider is set up.')
  }
  return completeWith(kind, getProviderModel(kind), request)
}

/** Run a prompt against a specific provider and model */
export async function completeWith(
  kind: AIProviderKind,
  model: string,
  request: IAIRequest,
  key?: string
): Promise<string> {
  if (kind === 'claude') {
    return completeWithClaudeCli(model, request)
  }

  const apiKey = key ?? (await getProviderKey(kind))
  if (!apiKey) {
    throw new AIProviderError(
      `No API key for ${AIProviders[kind].name}. Add one in Options → AI.`
    )
  }

  const url =
    kind === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions'

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    stream: false,
  }
  if (request.json) {
    body.response_format = { type: 'json_object' }
  }
  if (kind === 'deepseek') {
    // Reasoning slows translation down and adds nothing to it
    body.thinking = { type: 'disabled' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (kind === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/YakupEmreYerli/desktop'
    headers['X-Title'] = 'GitHub Desktop'
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e
    }
    throw new AIProviderError(
      `Couldn't reach ${AIProviders[kind].name}. Check your connection.`
    )
  }

  const text = await response.text()
  if (!response.ok) {
    throw new AIProviderError(describeHttpError(kind, response.status, text))
  }

  let content: unknown
  try {
    content = JSON.parse(text).choices?.[0]?.message?.content
  } catch {
    content = undefined
  }
  if (typeof content !== 'string' || content.trim() === '') {
    throw new AIProviderError(
      `${AIProviders[kind].name} returned an empty answer.`
    )
  }
  return content
}

function describeHttpError(kind: AIProviderKind, status: number, body: string) {
  const name = AIProviders[kind].name
  let detail = ''
  try {
    const message = JSON.parse(body).error?.message
    if (typeof message === 'string') {
      detail = ` (${message})`
    }
  } catch {
    // Not JSON, no detail
  }

  switch (status) {
    case 401:
    case 403:
      return `${name} rejected the API key${detail}.`
    case 402:
      return `${name} says the account has no balance left${detail}.`
    case 404:
      return `${name} doesn't know this model${detail}.`
    case 429:
      return `${name} is rate limiting requests; try again shortly${detail}.`
    default:
      return `${name} returned an error: ${status}${detail}.`
  }
}

/** Where the claude CLI is looked for when it isn't on PATH */
function claudeCandidates() {
  const home = Os.homedir()
  const onPath = (process.env.PATH ?? '')
    .split(Path.delimiter)
    .filter(p => p.length > 0)
    .map(p => Path.join(p, 'claude'))

  return [
    ...onPath,
    Path.join(home, '.local', 'bin', 'claude'),
    Path.join(home, '.claude', 'local', 'claude'),
    Path.join(home, '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ]
}

/** The path of the claude CLI, or null if it isn't installed */
export async function findClaudeExecutable(): Promise<string | null> {
  for (const candidate of claudeCandidates()) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next one
    }
  }
  return null
}

/** How long a CLI request may take before it's abandoned */
const ClaudeTimeout = 5 * 60 * 1000

async function completeWithClaudeCli(
  model: string,
  request: IAIRequest
): Promise<string> {
  const executable = await findClaudeExecutable()
  if (executable === null) {
    throw new AIProviderError(
      'The claude command was not found. Install Claude Code and sign in, or pick another provider in Options → AI.'
    )
  }

  const args = [
    '--print',
    '--model',
    model,
    '--output-format',
    'json',
    '--system-prompt',
    request.system,
    // No tools, and none of the user's settings, hooks or project files:
    // this is a one-shot text request, not a coding session.
    '--tools',
    '',
    '--setting-sources',
    '',
    '--no-session-persistence',
  ]

  const env = { ...process.env }
  // Started from inside a Claude Code session the CLI would refuse to nest
  delete env.CLAUDECODE

  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: Os.tmpdir(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))

    const timer = setTimeout(() => {
      child.kill()
      reject(new AIProviderError('Claude took too long to answer.'))
    }, ClaudeTimeout)

    const onAbort = () => {
      child.kill()
      const error = new Error('Aborted')
      error.name = 'AbortError'
      reject(error)
    }
    request.signal?.addEventListener('abort', onAbort, { once: true })

    child.on('error', e => {
      clearTimeout(timer)
      reject(new AIProviderError(`Couldn't start claude: ${e.message}`))
    })

    child.on('close', code => {
      clearTimeout(timer)
      request.signal?.removeEventListener('abort', onAbort)

      let result: { result?: unknown; is_error?: boolean } | null = null
      try {
        result = JSON.parse(stdout)
      } catch {
        result = null
      }

      if (result !== null && typeof result.result === 'string') {
        if (result.is_error) {
          reject(new AIProviderError(`Claude: ${result.result}`))
        } else {
          resolve(result.result)
        }
        return
      }

      const message = (stderr || stdout).trim().split('\n').pop()
      reject(
        new AIProviderError(
          code === 0
            ? 'Claude returned an unexpected answer.'
            : `Claude failed${message ? `: ${message}` : ''}. Is it signed in?`
        )
      )
    })

    child.stdin.end(request.prompt)
  })
}

/** A quick request to check that a provider, model and key work */
export async function testProvider(
  kind: AIProviderKind,
  model: string,
  key?: string
): Promise<void> {
  await completeWith(
    kind,
    model,
    {
      system: 'Reply with the single word OK.',
      prompt: 'Are you there?',
    },
    key
  )
}
