/* eslint-disable no-sync */

/**
 * E2E tests for per-feature AI settings and the commit message button,
 * against the packaged app in `dist/`. Messages are written by the local
 * `claude` CLI (haiku, to keep it quick); the tests are skipped without it.
 */

import { execFile, execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { _electron as electron } from 'playwright'
import { getDistPath, getExecutableName } from '../../../script/dist-info'
import { guardRealGitConfig, isolatedEnvironment } from './isolated-environment'

const root = path.join(os.tmpdir(), 'github-desktop-e2e-ai-commit-message')
const repository = path.join(root, 'shop')
const executable = path.join(getDistPath(), getExecutableName())
const cliScript = path.join(getDistPath(), 'resources', 'app', 'cli.js')

const env = isolatedEnvironment(root)

const hasClaude = (() => {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

let app: ElectronApplication
let page: Page

const git = (...args: ReadonlyArray<string>) =>
  execFileSync('git', args, { cwd: repository, encoding: 'utf8', env }).trim()

function cli(...args: ReadonlyArray<string>) {
  return new Promise<void>((resolve, reject) =>
    execFile(
      executable,
      [cliScript, ...args],
      { env: { ...env, ELECTRON_RUN_AS_NODE: '1' } },
      error => (error ? reject(error) : resolve())
    )
  )
}

const summary = () => page.getByRole('combobox', { name: 'Commit summary' })
const description = () =>
  page.getByRole('combobox', { name: 'Commit description' })
const aiButton = () => page.locator('.ai-commit-message-button')

async function openAIOptions() {
  await app.evaluate(({ Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('preferences')
    if (item === null || item === undefined) {
      throw new Error('No preferences menu item')
    }
    item.click()
  })
  const dialog = page.locator('#preferences')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('tab', { name: 'AI' }).click()
  return dialog
}

async function closeOptions() {
  // The AI tab saves as it goes, so cancelling keeps the changes
  await page
    .locator('#preferences')
    .getByRole('button', { name: 'Cancel' })
    .click()
  await page.locator('#preferences').waitFor({ state: 'hidden' })
}

test.describe.configure({ mode: 'serial' })
guardRealGitConfig()
test.skip(!hasClaude, 'The claude CLI is not installed')

test.beforeAll(async () => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(repository, { recursive: true })
  git('init', '-b', 'main')
  git('config', 'user.name', 'E2E')
  git('config', 'user.email', 'e2e@example.com')
  fs.writeFileSync(
    path.join(repository, 'cart.js'),
    `export function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}
`
  )
  git('add', '.')
  git('commit', '-m', 'Sepet toplamı')
  // The change to describe: quantities and a free shipping threshold
  fs.writeFileSync(
    path.join(repository, 'cart.js'),
    `const FreeShippingThreshold = 500
const ShippingFee = 49

export function total(items) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0
  )
  return subtotal >= FreeShippingThreshold ? subtotal : subtotal + ShippingFee
}
`
  )

  app = await electron.launch({ executablePath: executable, env })
  page = await app.firstWindow()
  await page.locator('a.skip-button').click()
  await page.locator('input[placeholder="Your Name"]').fill('E2E')
  await page
    .locator('input[placeholder="your-email@example.com"]')
    .fill('e2e@example.com')
  await page.locator('button:has-text("Finish")').click()
  await page.waitForSelector('#welcome', { state: 'hidden' })
  // The setting from before per-feature providers: one provider for all
  await page.evaluate(() => localStorage.setItem('ai-provider', 'claude'))
  await page.reload()
  await cli('add', repository)
  await cli('open', repository)
  await page.locator('.file', { hasText: 'cart.js' }).first().waitFor()
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
})

test('without a provider the button opens the AI options', async () => {
  await expect(aiButton()).toBeEnabled()
  await aiButton().click()
  const dialog = page.locator('#preferences')
  await dialog.waitFor({ state: 'visible' })
  await expect(dialog.getByRole('tab', { name: 'AI' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await closeOptions()
})

test('each feature has its own provider; the old setting goes to translation', async () => {
  const dialog = await openAIOptions()
  const translation = dialog.locator('section.ai-task', {
    has: page.locator('h3', { hasText: 'Translation' }),
  })
  const commit = dialog.locator('section.ai-task', {
    has: page.locator('h3', { hasText: 'Commit messages' }),
  })

  await expect(translation.getByLabel('Provider')).toHaveValue('claude')
  await expect(commit.getByLabel('Provider')).toHaveValue('none')
  // Language and style can be set before a provider is picked
  await expect(commit.getByLabel('Language')).toHaveValue('turkish')
  await expect(commit.getByLabel('Style')).toHaveValue('repository')

  await commit.getByLabel('Provider').selectOption('deepseek')
  await expect(commit.getByLabel('Model')).toHaveValue('deepseek-flash')
  await commit.getByLabel('Provider').selectOption('claude')
  await commit.locator('.ai-model-suggestion', { hasText: 'haiku' }).click()
  await expect(commit.getByLabel('Model')).toHaveValue('haiku')
  await expect(commit.getByLabel('Language')).toHaveValue('turkish')
  await expect(commit.getByLabel('Style')).toHaveValue('repository')

  // Translation kept its own choice
  await expect(translation.getByLabel('Provider')).toHaveValue('claude')
  await expect(translation.getByLabel('Model')).toHaveValue('sonnet')

  await commit.getByRole('button', { name: 'Test' }).click()
  await expect(commit.locator('.ai-test-result.ok')).toBeVisible({
    timeout: 120_000,
  })
  await closeOptions()

  const stored = await page.evaluate(() => ({
    translation: localStorage.getItem('ai-task-translation-provider'),
    legacy: localStorage.getItem('ai-provider'),
    commit: localStorage.getItem('ai-task-commit-message-provider'),
    commitModel: localStorage.getItem('ai-task-commit-message-model'),
  }))
  expect(stored).toEqual({
    translation: null,
    legacy: 'claude',
    commit: 'claude',
    commitModel: 'haiku',
  })
})

test('the button writes a Turkish title and description without committing', async () => {
  test.setTimeout(180_000)
  const commitsBefore = git('rev-list', '--count', 'HEAD')

  await expect(aiButton()).toHaveAttribute('aria-label', /Claude · haiku/)
  await aiButton().click()
  await expect(summary()).not.toHaveValue('', { timeout: 150_000 })

  const title = await summary().inputValue()
  const body = await description().inputValue()
  console.log(`[e2e] generated: ${title}\n${body}`)

  expect(title.length).toBeLessThanOrEqual(72)
  expect(title).not.toMatch(/\.$/)
  expect(title).not.toMatch(/^(feat|fix|chore)\b/i)
  expect(`${title} ${body}`).toMatch(/[çğıİöşü]/)
  expect(git('rev-list', '--count', 'HEAD')).toBe(commitsBefore)
  await expect(page.locator('.commit-button')).toBeEnabled()
})

async function setCommitSettings(settings: {
  readonly language?: string
  readonly otherLanguage?: string
  readonly style?: string
  readonly customStyle?: string
  readonly description?: string
  readonly customDescription?: string
}) {
  const dialog = await openAIOptions()
  const commit = dialog.locator('section.ai-task', {
    has: page.locator('h3', { hasText: 'Commit messages' }),
  })
  if (settings.language !== undefined) {
    await commit
      .getByLabel('Language', { exact: true })
      .selectOption(settings.language)
  }
  if (settings.otherLanguage !== undefined) {
    await commit.getByLabel('Language name').fill(settings.otherLanguage)
  }
  if (settings.style !== undefined) {
    await commit.getByLabel('Style').selectOption(settings.style)
  }
  if (settings.customStyle !== undefined) {
    await commit.getByLabel('Your rules').fill(settings.customStyle)
  }
  if (settings.description !== undefined) {
    await commit
      .getByLabel('Description', { exact: true })
      .selectOption(settings.description)
  }
  if (settings.customDescription !== undefined) {
    await commit
      .getByLabel('How to write the description')
      .fill(settings.customDescription)
  }
  await closeOptions()
}

async function generate() {
  await summary().fill('')
  await description().fill('')
  await aiButton().click()
  await expect(summary()).not.toHaveValue('', { timeout: 150_000 })
  const title = await summary().inputValue()
  const body = await description().inputValue()
  console.log(`[e2e] ${title}\n${body}\n`)
  return { title, body }
}

test('Conventional Commits keeps the type in English', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({ style: 'conventional' })
  const { title } = await generate()
  expect(title).toMatch(
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: \S/
  )
  expect(title.length).toBeLessThanOrEqual(72)
})

test('Gitmoji starts with an emoji', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({ style: 'gitmoji' })
  const { title } = await generate()
  expect(title).toMatch(/^\p{Extended_Pictographic}/u)
})

test("the repository's style follows its history", async () => {
  test.setTimeout(180_000)
  // A history in an unusual shape: bracketed area, upper case, dash
  for (const [file, message] of [
    ['a.txt', '[DOCS] - README GÜNCELLENDİ'],
    ['b.txt', '[CART] - İNDİRİM KODU EKLENDİ'],
    ['c.txt', '[CART] - KDV HESABI DÜZELTİLDİ'],
  ]) {
    fs.writeFileSync(path.join(repository, file), message)
    git('add', file)
    git('commit', '-m', message)
  }
  await setCommitSettings({ style: 'repository' })
  const { title } = await generate()
  expect(title).toMatch(/^\[[A-ZÇĞİÖŞÜ]+\] - /)
})

test('custom rules are followed', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({
    style: 'custom',
    customStyle:
      'Start every title with "SHOP-42: ". Leave the description empty.',
  })
  const { title, body } = await generate()
  expect(title).toMatch(/^SHOP-42: /)
  expect(body).toBe('')
})

test('another language is written in that language', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({
    language: 'other',
    otherLanguage: 'Deutsch',
    style: 'plain',
  })
  const { title, body } = await generate()
  // German words, no Turkish letters
  expect(`${title} ${body}`).not.toMatch(/[ğışİ]/)
  expect(`${title} ${body}`).toMatch(
    /\b(der|die|das|und|für|mit|Versand|Menge|Gesamt\w*|hinzufügen|berechnen|berücksichtigen)\b/i
  )
})

test('an unknown language falls back to English', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({ otherLanguage: 'Blorbish' })
  const { title, body } = await generate()
  expect(`${title} ${body}`).toMatch(/^[\x20-\x7E\n]+$/)
  expect(`${title} ${body}`).toMatch(
    /\b(the|and|to|for|with|add|calculate|shipping)\b/i
  )
  await setCommitSettings({ language: 'turkish' })
})

test('a typed message is only replaced after confirming', async () => {
  await summary().fill('Benim başlığım')
  await aiButton().click()
  const warning = page.locator(
    'dialog#generate-commit-message-override-warning'
  )
  await warning.waitFor({ state: 'visible' })
  await expect(warning).not.toContainText('Copilot')
  await warning.getByRole('button', { name: 'Cancel' }).click()
  await warning.waitFor({ state: 'hidden' })
  await expect(summary()).toHaveValue('Benim başlığım')
})

test('clicking again while writing stops it', async () => {
  await summary().fill('')
  await description().fill('')
  await aiButton().click()
  await expect(aiButton()).toHaveAttribute('aria-label', /^Stop writing/)
  await aiButton().click()
  await expect(aiButton()).toHaveAttribute('aria-label', /^Write the commit/, {
    timeout: 15_000,
  })
  // Give a late answer the chance to arrive; it must not fill the box
  await page.waitForTimeout(3000)
  await expect(summary()).toHaveValue('')
  await expect(page.locator('#app-error')).toHaveCount(0)
})

test('the AI tab fits a short window and scrolls', async () => {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1000, 700)
  })
  await page.waitForTimeout(500)
  const dialog = await openAIOptions()

  const viewport = await page.evaluate(() => window.innerHeight)
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport)
  await expect(
    dialog.getByRole('button', { name: 'Save', exact: true })
  ).toBeInViewport()

  const tab = dialog.locator('.dialog-content.ai-tab')
  const { scrollHeight, clientHeight } = await tab.evaluate(el => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))
  expect(scrollHeight).toBeGreaterThan(clientHeight)
  const style = dialog.getByLabel('Style')
  await style.scrollIntoViewIfNeeded()
  await expect(style).toBeInViewport()
  await closeOptions()
})

test('the example commit follows the language and style', async () => {
  const dialog = await openAIOptions()
  const commit = dialog.locator('section.ai-task', {
    has: page.locator('h3', { hasText: 'Commit messages' }),
  })
  const example = commit.locator('.commit-preview-example')
  const titles = () =>
    example.locator('.commit-preview-title').allTextContents()

  await commit.getByLabel('Language', { exact: true }).selectOption('turkish')
  await commit.getByLabel('Style').selectOption('plain')
  await expect(example.locator('figcaption')).toHaveText('Örnek')
  expect(await titles()).toEqual(['Sepete ücretsiz kargo sınırı ekle'])
  await expect(example.locator('.commit-preview-description')).toContainText(
    'siparişlerde'
  )

  await commit.getByLabel('Style').selectOption('conventional')
  expect(await titles()).toEqual(['feat(sepet): ücretsiz kargo sınırı ekle'])
  await commit.getByLabel('Style').selectOption('gitmoji')
  expect(await titles()).toEqual(['✨ Sepete ücretsiz kargo sınırı ekle'])
  await commit.getByLabel('Style').selectOption('repository')
  expect(await titles()).toEqual([
    '[SEPET] Kupon kodu desteği ekle',
    '[SEPET] Ücretsiz kargo sınırı ekle',
  ])

  await commit.getByLabel('Language', { exact: true }).selectOption('english')
  await expect(example.locator('figcaption')).toHaveText('Example')
  expect(await titles()).toEqual([
    '[CART] Support coupon codes',
    '[CART] Add a free shipping threshold',
  ])
  await commit.getByLabel('Style').selectOption('plain')
  expect(await titles()).toEqual(['Add a free shipping threshold to the cart'])

  await commit.getByLabel('Language', { exact: true }).selectOption('other')
  await commit.getByLabel('Language name').fill('Deutsch')
  await expect(example.locator('.commit-preview-note')).toHaveText(
    'Shown in English; messages are written in Deutsch.'
  )

  await commit.getByLabel('Style').selectOption('custom')
  await expect(example).toHaveCount(0)

  await commit.getByLabel('Language', { exact: true }).selectOption('turkish')
  await commit.getByLabel('Style').selectOption('plain')
  await closeOptions()
})

test('the description can be left out', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({ style: 'plain', description: 'never' })
  const dialog = await openAIOptions()
  await expect(
    dialog.locator('.commit-preview-example .commit-preview-description')
  ).toHaveCount(0)
  await closeOptions()

  const { title, body } = await generate()
  expect(title).not.toBe('')
  expect(body).toBe('')
})

test('the description follows custom rules', async () => {
  test.setTimeout(180_000)
  await setCommitSettings({
    description: 'custom',
    customDescription:
      'Write the description as two to four bullet lines, each starting with "- ".',
  })
  const { body } = await generate()
  const lines = body.split('\n').filter(l => l.trim() !== '')
  expect(lines.length).toBeGreaterThanOrEqual(2)
  expect(lines.every(l => l.startsWith('- '))).toBe(true)
  await setCommitSettings({ description: 'auto', style: 'repository' })
})
