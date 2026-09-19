import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert'

import {
  getTaskModel,
  getTaskProvider,
  setTaskModel,
  setTaskProvider,
} from '../../src/lib/ai/providers'
import {
  CommitMessageStyles,
  ICommitMessageSettings,
  buildCommitMessageInstructions,
  getCommitMessageSettings,
  prepareDiff,
  setCommitMessageSettings,
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
  const settings = (change: Partial<ICommitMessageSettings> = {}) => ({
    ...getCommitMessageSettings(),
    ...change,
  })

  it("defaults to Turkish in the repository's style and keeps what is picked", () => {
    assert.deepStrictEqual(getCommitMessageSettings(), {
      language: 'turkish',
      otherLanguage: '',
      style: 'repository',
      customStyle: '',
      description: 'auto',
      customDescription: '',
    })
    setCommitMessageSettings({ language: 'other', otherLanguage: 'Deutsch' })
    setCommitMessageSettings({ style: 'gitmoji' })
    assert.deepStrictEqual(getCommitMessageSettings(), {
      language: 'other',
      otherLanguage: 'Deutsch',
      style: 'gitmoji',
      customStyle: '',
      description: 'auto',
      customDescription: '',
    })
  })

  it('ignores unknown stored values', () => {
    localStorage.setItem('ai-commit-message-language', 'klingon')
    localStorage.setItem('ai-commit-message-style', 'haiku')
    const { language, style } = getCommitMessageSettings()
    assert.equal(language, 'turkish')
    assert.equal(style, 'repository')
  })

  it('names the language, with English as the fallback', () => {
    assert.match(
      buildCommitMessageInstructions(settings({ style: 'plain' })),
      /Write in Turkish/
    )
    assert.match(
      buildCommitMessageInstructions(settings({ language: 'english' })),
      /Write in English/
    )
    const german = buildCommitMessageInstructions(
      settings({ language: 'other', otherLanguage: ' Deutsch ' })
    )
    assert.match(german, /the user named: "Deutsch"/)
    assert.match(german, /don't recognize it as a language, write in English/)
    // Other without a name is English
    assert.match(
      buildCommitMessageInstructions(settings({ language: 'other' })),
      /Write in English/
    )
  })

  it('describes each style and always asks for JSON', () => {
    const rules = (
      change: Partial<ICommitMessageSettings>,
      history?: string[]
    ) => buildCommitMessageInstructions(settings(change), history)

    assert.match(
      rules({ style: 'plain' }),
      /without\s+a trailing period, a type prefix/
    )
    assert.match(rules({ style: 'conventional' }), /"type\(scope\): summary"/)
    assert.match(rules({ style: 'gitmoji' }), /✨ new feature/)
    for (const style of CommitMessageStyles) {
      assert.match(
        rules({ style }),
        /\{"title": "\.\.\.", "description": "\.\.\."\}$/
      )
    }
  })

  it('shows the history for the repository style, plain without one', () => {
    const withHistory = buildCommitMessageInstructions(
      settings({ style: 'repository' }),
      ['🐛 Fix the cart', '✨ Add coupons\n\nWhy coupons.']
    )
    assert.match(withHistory, /<history>\n🐛 Fix the cart\n---\n✨ Add coupons/)
    assert.doesNotMatch(
      buildCommitMessageInstructions(settings({ style: 'repository' }), []),
      /<history>/
    )
  })

  it('lets the history decide the form, length and description', () => {
    const history = ['belgeler: rapor güncellendi', 'C: sayfalar eklendi']
    const following = buildCommitMessageInstructions(
      settings({ style: 'repository' }),
      history
    )
    assert.match(following, /Write in Turkish/)
    assert.doesNotMatch(following, /imperative mood, like "Depo/)
    assert.doesNotMatch(following, /at most 72 characters/)
    assert.match(following, /description only if the history's messages/)
    assert.match(following, /grammatical\s+form/)

    // Without history it's the plain style, imperative included
    const plain = buildCommitMessageInstructions(
      settings({ style: 'repository' }),
      []
    )
    assert.match(plain, /imperative mood, like "Depo/)
    assert.match(plain, /at most 72 characters/)
  })

  it('adds custom rules, plain when there are none', () => {
    const custom = buildCommitMessageInstructions(
      settings({ style: 'custom', customStyle: 'Prefix with PRJ-12.' })
    )
    assert.match(custom, /<rules>\nPrefix with PRJ-12\.\n<\/rules>/)
    assert.doesNotMatch(
      buildCommitMessageInstructions(settings({ style: 'custom' })),
      /<rules>/
    )
  })

  it('writes the description as picked', () => {
    const rules = (
      change: Partial<ICommitMessageSettings>,
      history?: string[]
    ) => buildCommitMessageInstructions(settings(change), history)
    const plain = { style: 'plain' as const }

    assert.match(rules(plain), /Leave it empty for a trivial change/)
    assert.match(
      rules({ ...plain, description: 'never' }),
      /Write no description/
    )
    assert.match(
      rules({ ...plain, description: 'always' }),
      /Always write a description: the description says why/
    )
    assert.match(
      rules({ style: 'repository', description: 'always' }, ['C: x']),
      /shaped like the history's descriptions/
    )
    const custom = rules({
      ...plain,
      description: 'custom',
      customDescription: 'List the parts as bullets.',
    })
    assert.match(
      custom,
      /<description-rules>\nList the parts as bullets\.\n<\/description-rules>/
    )
    // The user's rules come after the general ones, so they win
    assert(
      custom.indexOf("Don't list every file") <
        custom.indexOf('<description-rules>')
    )
    // Custom without rules is automatic
    assert.match(
      rules({ ...plain, description: 'custom' }),
      /Leave it empty for a trivial change/
    )
  })

  it('cuts a long diff at a line and says so', () => {
    const line = 'x'.repeat(99) + '\n'
    const prepared = prepareDiff(line.repeat(1000))
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
