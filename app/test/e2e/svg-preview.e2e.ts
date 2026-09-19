/* eslint-disable no-sync */

/**
 * E2E tests for SVG previews in diffs, against the packaged app in `dist/`.
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

const root = path.join(os.tmpdir(), 'github-desktop-e2e-svg-preview')
const repository = path.join(root, 'icons')
const executable = path.join(getDistPath(), getExecutableName())
const cliScript = path.join(getDistPath(), 'resources', 'app', 'cli.js')

const env = isolatedEnvironment(root)

const circle = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
  <circle cx="40" cy="40" r="30" fill="#d33"/>
</svg>
`
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
  <rect x="10" y="10" width="100" height="60" fill="#36c"/>
  <text x="60" y="48" text-anchor="middle" fill="#fff">Ağaç şişe</text>
</svg>
`
// No width or height: sized by its viewBox only
const viewBoxOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12 2 2 22h20z" fill="#2a2"/>
</svg>
`
const withScript = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
  <script>window.top.__svgScriptRan = true</script>
  <rect width="40" height="40" fill="#fa0"/>
</svg>
`

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

const write = (name: string, contents: string) =>
  fs.writeFileSync(path.join(repository, name), contents)

async function openFile(name: string) {
  await page.locator('.file', { hasText: name }).first().click()
  await page.locator('.svg-diff').waitFor()
}

/** The natural sizes of the images the preview shows */
function images() {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>('.svg-diff .panel.image img'),
      img => ({
        src: img.src.slice(0, 26),
        width: img.naturalWidth,
        height: img.naturalHeight,
        shown: img.getBoundingClientRect().width > 0,
      })
    )
  )
}

test.describe.configure({ mode: 'serial' })
guardRealGitConfig()

test.beforeAll(async () => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(repository, { recursive: true })
  git('init', '-b', 'main')
  git('config', 'user.name', 'E2E')
  git('config', 'user.email', 'e2e@example.com')
  write('logo.svg', circle)
  write('old.svg', circle)
  git('add', '.')
  git('commit', '-m', 'Icons')

  write('logo.svg', square)
  fs.rmSync(path.join(repository, 'old.svg'))
  write('triangle.svg', viewBoxOnly)
  write('script.svg', withScript)

  app = await electron.launch({ executablePath: executable, env })
  page = await app.firstWindow()
  await page.locator('a.skip-button').click()
  await page.locator('input[placeholder="Your Name"]').fill('E2E')
  await page
    .locator('input[placeholder="your-email@example.com"]')
    .fill('e2e@example.com')
  await page.locator('button:has-text("Finish")').click()
  await page.waitForSelector('#welcome', { state: 'hidden' })
  await cli('add', repository)
  await cli('open', repository)
  await page.locator('.file', { hasText: 'logo.svg' }).waitFor()
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
})

test('a modified SVG shows both versions with the image modes', async () => {
  await openFile('logo.svg')
  await expect.poll(images).toEqual([
    { src: 'data:image/svg+xml;base64,', width: 120, height: 80, shown: true },
    { src: 'data:image/svg+xml;base64,', width: 120, height: 80, shown: true },
  ])
  const modes = page.locator('.svg-diff .panel.image .tab-bar')
  for (const mode of ['2-up', 'Swipe', 'Onion Skin', 'Difference']) {
    await expect(modes).toContainText(mode)
  }
  await modes.getByText('Swipe').click()
  await expect(page.locator('.svg-diff .image-diff-swipe')).toBeVisible()
  await modes.getByText('2-up').click()
})

test('Code shows the source and the choice is remembered', async () => {
  await page
    .locator('.svg-diff .view-switch-option', { hasText: 'Code' })
    .click()
  await expect(page.locator('.svg-diff')).toContainText('Ağaç şişe')
  await expect(page.locator('.svg-diff .panel.image')).toHaveCount(0)
  // Another SVG opens in the code view too
  await openFile('triangle.svg')
  await expect(page.getByRole('radio', { name: 'Code' })).toBeChecked()
  await expect(page.locator('.svg-diff')).toContainText('viewBox')
  await page
    .locator('.svg-diff .view-switch-option', { hasText: 'Preview' })
    .click()
})

test('an added SVG sized by its viewBox is shown', async () => {
  await openFile('triangle.svg')
  const [image] = await images()
  expect(image.src).toBe('data:image/svg+xml;base64,')
  expect(image.shown).toBe(true)
  expect(image.width).toBeGreaterThan(0)
  await expect(page.locator('.svg-diff .image-diff-current')).toBeVisible()
})

test('a deleted SVG shows the old version', async () => {
  await openFile('old.svg')
  await expect(page.locator('.svg-diff .image-diff-previous')).toBeVisible()
  expect((await images()).map(i => i.width)).toEqual([120])
})

test("an SVG's scripts don't run", async () => {
  await openFile('script.svg')
  await expect.poll(async () => (await images()).length).toBe(1)
  await page.waitForTimeout(500)
  expect(
    await page.evaluate(
      () => (window as unknown as { __svgScriptRan?: boolean }).__svgScriptRan
    )
  ).toBeUndefined()
})
