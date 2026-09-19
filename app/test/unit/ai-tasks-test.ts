import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'

import {
  getTaskModel,
  getTaskProvider,
  setTaskModel,
  setTaskProvider,
} from '../../src/lib/ai/providers'
import {
  buildCommitMessageInstructions,
  getCommitMessageLanguage,
  prepareDiff,
  setCommitMessageLanguage,
} from '../../src/lib/ai/commit-message'

afterEach(() => localStorage.clear())

describe('AI task settings', () => {
  it('keeps a provider and model per task', () => {
    setTaskProvider('translation', 'claude')
    setTaskProvider('commit-message', 'deepseek')
    setTaskModel('translation', 'opus')

    assert.equal(getTaskProvider('translation'), 'claude')
    assert.equal(getTaskModel('translation'), 'opus')
    assert.equal(getTaskProvider('commit-message'), 'deepseek')
    // The provider's default until a model is picked
    assert.equal(getTaskModel('commit-message'), 'deepseek-flash')
  })

  it('has no provider and no model until one is picked', () => {
    assert.equal(getTaskProvider('commit-message'), null)
    assert.equal(getTaskModel('commit-message'), '')
  })

  it('carries the single-provider setting over to translation only', () => {
    localStorage.setItem('ai-provider', 'openrouter')
    localStorage.setItem('ai-model-openrouter', 'google/gemini-2.5-pro')

    assert.equal(getTaskProvider('translation'), 'openrouter')
    assert.equal(getTaskModel('translation'), 'google/gemini-2.5-pro')
    assert.equal(getTaskProvider('commit-message'), null)
  })

  it('forgets the model when the provider changes', () => {
    setTaskProvider('commit-message', 'claude')
    setTaskModel('commit-message', 'haiku')
    setTaskProvider('commit-message', 'deepseek')
    assert.equal(getTaskModel('commit-message'), 'deepseek-flash')
  })

  it('turns a task off', () => {
    localStorage.setItem('ai-provider', 'claude')
    setTaskProvider('translation', null)
    assert.equal(getTaskProvider('translation'), null)
  })

  it('stores the default model as no choice', () => {
    setTaskProvider('translation', 'claude')
    setTaskModel('translation', ' sonnet ')
    assert.equal(localStorage.getItem('ai-task-translation-model'), null)
    assert.equal(getTaskModel('translation'), 'sonnet')
  })
})

describe('commit message generation', () => {
  it('writes Turkish unless English is picked', () => {
    assert.equal(getCommitMessageLanguage(), 'turkish')
    setCommitMessageLanguage('english')
    assert.equal(getCommitMessageLanguage(), 'english')
  })

  it('asks for the language, imperative mood and JSON', () => {
    const turkish = buildCommitMessageInstructions('turkish')
    assert.match(turkish, /Write in Turkish/)
    assert.match(turkish, /imperative/)
    assert.match(turkish, /\{"title": "\.\.\.", "description": "\.\.\."\}/)
    assert.match(buildCommitMessageInstructions('english'), /Write in English/)
  })

  it('cuts a long diff at a line and says so', () => {
    const line = 'x'.repeat(99) + '\n'
    const diff = line.repeat(1000)
    const prepared = prepareDiff(diff)
    assert(prepared.length < 61_000)
    assert.match(prepared, /more characters, was cut\.\]$/)
    assert(
      prepared
        .split('\n')
        .slice(0, -1)
        .every(l => l.length === 99)
    )
    assert.equal(prepareDiff('small diff'), 'small diff')
  })
})
