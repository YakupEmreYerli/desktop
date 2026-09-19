/* eslint-disable no-sync */

/**
 * E2E test for the Turkish view of text documents, with a real provider:
 * the local `claude` CLI. Skipped when `claude` isn't installed. The document
 * has multi-line paragraphs, which models tend to return on one line; the
 * view must still show a translated line wherever the source has one.
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

const root = path.join(os.tmpdir(), 'github-desktop-e2e-translation')
const repository = path.join(root, 'docs')
const executable = path.join(getDistPath(), getExecutableName())
const cliScript = path.join(getDistPath(), 'resources', 'app', 'cli.js')

const env = isolatedEnvironment(root)

const before = `# Notes

The importer reads every file in the folder and keeps the ones that
changed since the last run. Files it can't parse are skipped with a
warning in the log, so one broken file doesn't stop the whole import.

Results are cached per file, keyed by a hash of its contents, so a
second run only does work for files that changed in between.
`

const after = `# Notes

The importer reads every file in the folder, compares each one with the
copy it saw last time and keeps only the ones whose contents changed.
Files it can't parse are skipped with a warning in the log, and the run
carries on, so one broken file never stops the whole import. At the end
it prints how many files were read, skipped and imported.

Results are cached per file, keyed by a hash of its contents, so a
second run only does work for files that changed in between.
`

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

/** The text of every line on the new (right) side of the side-by-side diff. */
function newSideLines(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll('.diff-container .row .after .content'),
      el => el.textContent ?? ''
    )
  )
}

test.describe.configure({ mode: 'serial' })
guardRealGitConfig()
test.skip(!hasClaude, 'The claude CLI is not installed')

test.beforeAll(async () => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(repository, { recursive: true })
  const git = (...args: ReadonlyArray<string>) =>
    execFileSync('git', args, { cwd: repository, stdio: 'ignore', env })
  git('init', '-b', 'main')
  git('config', 'user.name', 'E2E')
  git('config', 'user.email', 'e2e@example.com')
  fs.writeFileSync(path.join(repository, 'NOTES.md'), before)
  git('add', '.')
  git('commit', '-m', 'Notes')
  fs.writeFileSync(path.join(repository, 'NOTES.md'), after)

  app = await electron.launch({ executablePath: executable, env })
  page = await app.firstWindow()
  await page.locator('a.skip-button').click()
  await page.locator('input[placeholder="Your Name"]').fill('E2E')
  await page
    .locator('input[placeholder="your-email@example.com"]')
    .fill('e2e@example.com')
  await page.locator('button:has-text("Finish")').click()
  await page.waitForSelector('#welcome', { state: 'hidden' })
  await page.evaluate(() => {
    localStorage.setItem('ai-provider', 'claude')
    // Side by side, so each side's lines can be read on their own
    localStorage.setItem('show-side-by-side-diff', '1')
  })
  await page.reload()
  await cli('add', repository)
  await cli('open', repository)
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
})

test('the Turkish view has a translated line for every source line', async () => {
  test.setTimeout(300_000)

  await page.locator('.file', { hasText: 'NOTES.md' }).first().click()
  await page.locator('.view-switch').waitFor()
  await expect.poll(() => newSideLines(page)).not.toEqual([])
  const code = await newSideLines(page)

  await page.locator('.view-switch-option', { hasText: 'Türkçe' }).click()
  await page
    .locator('.translation-diff-source')
    .waitFor({ state: 'visible', timeout: 240_000 })
  await expect(page.locator('.translation-diff-error')).toHaveCount(0)

  const turkish = await newSideLines(page)
  expect(turkish.length).toBe(code.length)

  const problems = new Array<string>()
  code.forEach((source, i) => {
    const line = turkish[i]
    if (source.trim() !== '' && line.trim() === '') {
      problems.push(`line ${i + 1} is empty, source: ${source}`)
    }
    if (line.length > Math.max(40, source.length * 2.5)) {
      problems.push(`line ${i + 1} is too long: ${line}`)
    }
  })
  expect(problems).toEqual([])
  // It is actually Turkish
  expect(turkish.join(' ')).toMatch(/[ğşıİçöü]/)
})
