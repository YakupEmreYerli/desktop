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

const root = path.join(os.tmpdir(), 'github-desktop-e2e-ai-commit-message')
const configHome = path.join(root, 'config')
const repository = path.join(root, 'shop')
const executable = path.join(getDistPath(), getExecutableName())
const cliScript = path.join(getDistPath(), 'resources', 'app', 'cli.js')

const env = {
  ...process.env,
  XDG_CONFIG_HOME: configHome,
  GIT_CONFIG_GLOBAL: path.join(root, '.gitconfig'),
  GIT_CONFIG_SYSTEM: path.join(root, '.gitconfig-system'),
}

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
  await expect(commit.getByLabel('Language')).toHaveValue('turkish')

  await commit.getByLabel('Provider').selectOption('deepseek')
  await expect(commit.getByLabel('Model')).toHaveValue('deepseek-flash')
  await commit.getByLabel('Provider').selectOption('claude')
  await commit.locator('.ai-model-suggestion', { hasText: 'haiku' }).click()
  await expect(commit.getByLabel('Model')).toHaveValue('haiku')

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
