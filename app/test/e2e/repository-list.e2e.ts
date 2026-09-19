/* eslint-disable no-sync */

/**
 * E2E tests for the fork's repository list features: the `github list / add
 * / remove` commands and repository groups (from the CLI and from the app's
 * menus), against the packaged app in `dist/`.
 *
 * The app runs with its own XDG_CONFIG_HOME so the CLI and the app agree on
 * the user data directory, and nothing touches the real installation.
 * Context menus are native, so the main process's `Menu.popup` is replaced
 * with a recorder and the tests click the recorded items.
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

const root = path.join(os.tmpdir(), 'github-desktop-e2e-repository-list')
const configHome = path.join(root, 'config')
const userData = path.join(configHome, 'GitHub Desktop')
const reposDir = path.join(root, 'repositories')
const notARepo = path.join(root, 'not-a-repository')
const executable = path.join(getDistPath(), getExecutableName())
const cliScript = path.join(getDistPath(), 'resources', 'app', 'cli.js')
const groupsFile = path.join(userData, 'repository-groups.json')

const names = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
]
const repo = (name: string) => path.join(reposDir, name)

const env = {
  ...isolatedEnvironment(root),
  SSH_AUTH_SOCK: '',
  GIT_SSH_COMMAND: 'false',
}

interface ICliResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

function cli(...args: ReadonlyArray<string>): Promise<ICliResult> {
  return new Promise(resolve => {
    execFile(
      executable,
      [cliScript, ...args],
      { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 60_000 },
      (error, stdout, stderr) =>
        resolve({
          code:
            error === null
              ? 0
              : typeof error.code === 'number'
              ? error.code
              : 1,
          stdout,
          stderr,
        })
    )
  })
}

async function cliOk(...args: ReadonlyArray<string>) {
  const result = await cli(...args)
  expect(result.stderr, `github ${args.join(' ')}`).toBe('')
  expect(result.code, `github ${args.join(' ')}`).toBe(0)
  return result.stdout
}

function readGroupsFile() {
  return JSON.parse(fs.readFileSync(groupsFile, 'utf8'))
}

function createRepositories() {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(notARepo, { recursive: true })
  for (const name of names) {
    const dir = repo(name)
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
    const git = (...args: ReadonlyArray<string>) =>
      execFileSync('git', args, { cwd: dir, stdio: 'ignore', env })
    git('init', '-b', 'main')
    git('config', 'user.name', 'E2E')
    git('config', 'user.email', 'e2e@example.com')
    fs.writeFileSync(path.join(dir, 'README.md'), `# ${name}\n`)
    git('add', '.')
    git('commit', '-m', 'Initial commit')
  }
}

/** Headers and repositories of the open repository list, in order. */
function readList(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '.repository-list .repository-section-header, .repository-list .repository-list-item'
      ),
      el =>
        el.classList.contains('repository-section-header')
          ? `# ${
              el.querySelector('.repository-section-label')?.textContent ?? ''
            }${
              el.querySelector('.repository-section-count')
                ? ` (${
                    el.querySelector('.repository-section-count')?.textContent
                  })`
                : ''
            }`
          : el.querySelector('.name')?.textContent?.trim() ?? ''
    )
  )
}

async function openRepositoryList(page: Page) {
  if (!(await page.locator('.repository-list').isVisible())) {
    await page.getByRole('button', { name: /^Current repository/ }).click()
  }
  await page.locator('.repository-list').waitFor({ state: 'visible' })
}

async function closeRepositoryList(page: Page) {
  if (await page.locator('.repository-list').isVisible()) {
    await page.getByRole('button', { name: /^Current repository/ }).click()
  }
  await page.locator('.repository-list').waitFor({ state: 'hidden' })
}

async function expectList(page: Page, expected: ReadonlyArray<string>) {
  await openRepositoryList(page)
  await expect.poll(() => readList(page), { timeout: 10_000 }).toEqual(expected)
}

async function recordMenus(app: ElectronApplication) {
  await app.evaluate(({ Menu }) => {
    const g = globalThis as unknown as { __menus: Array<unknown> }
    g.__menus = []
    Menu.prototype.popup = function (this: unknown) {
      g.__menus.push(this)
    }
  })
}

/** Labels of the last recorded context menu. */
function menuLabels(
  app: ElectronApplication,
  labels: ReadonlyArray<string> = []
) {
  return app.evaluate(({}, path) => {
    type Item = {
      label: string
      enabled: boolean
      checked: boolean
      submenu?: { items: Item[] }
    }
    const g = globalThis as unknown as { __menus: Array<{ items: Item[] }> }
    let items = g.__menus[g.__menus.length - 1].items
    for (const label of path) {
      items = items.find(i => i.label === label)?.submenu?.items ?? []
    }
    return items
      .filter(i => i.label !== '')
      .map(
        i =>
          `${i.label}${i.enabled ? '' : ' (disabled)'}${i.checked ? ' ✓' : ''}`
      )
  }, labels)
}

async function clickMenu(
  app: ElectronApplication,
  labels: ReadonlyArray<string>
) {
  await app.evaluate(({}, path) => {
    type Item = {
      label: string
      click: () => void
      submenu?: { items: Item[] }
    }
    const g = globalThis as unknown as { __menus: Array<{ items: Item[] }> }
    let items = g.__menus[g.__menus.length - 1].items
    let item: Item | undefined
    for (const label of path) {
      item = items.find(i => i.label === label)
      if (item === undefined) {
        throw new Error(`No "${label}" in ${items.map(i => i.label)}`)
      }
      items = item.submenu?.items ?? []
    }
    item!.click()
  }, labels)
}

async function repositoryMenu(page: Page, name: string) {
  await openRepositoryList(page)
  await page
    .locator('.repository-list .repository-list-item', {
      has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }),
    })
    .click({ button: 'right' })
}

async function headerMenu(page: Page, label: string) {
  await openRepositoryList(page)
  await page
    .locator('.repository-section-header', {
      has: page.locator('.repository-section-label', {
        hasText: new RegExp(`^${label}$`),
      }),
    })
    .click({ button: 'right' })
}

async function nameDialog(page: Page, name: string) {
  const dialog = page.locator('dialog#repository-group-name')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('input').fill(name)
  return dialog
}

async function launch() {
  const app = await electron.launch({
    executablePath: executable,
    env,
    timeout: 30_000,
  })
  const page = await app.firstWindow()
  page.on('pageerror', e => pageErrors.push(e.stack ?? e.message))
  await page.waitForFunction(
    () =>
      (document.getElementById('desktop-app-container')?.innerHTML.length ??
        0) > 100,
    null,
    { timeout: 30_000 }
  )
  await recordMenus(app)
  return { app, page }
}

const pageErrors = new Array<string>()
let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })
guardRealGitConfig()

test.beforeAll(async () => {
  expect(fs.existsSync(executable), `${executable} missing`).toBe(true)
  createRepositories()
  ;({ app, page } = await launch())
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
})

test.describe('Repository list from the command line', () => {
  test('before the app has a list, list explains what to do', async () => {
    const result = await cli('list')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('open the app once')
  })

  test('completes the welcome flow', async () => {
    await page.locator('a.skip-button').click()
    const nameInput = page.locator('input[placeholder="Your Name"]')
    await nameInput.fill('E2E')
    await page
      .locator('input[placeholder="your-email@example.com"]')
      .fill('e2e@example.com')
    await page.locator('button:has-text("Finish")').click()
    await page.waitForSelector('#welcome', { state: 'hidden' })
  })

  test('adds repositories without a dialog', async () => {
    for (const name of names) {
      expect(await cliOk('add', repo(name))).toContain(`Added: ${name}`)
    }
    // A folder inside a repository adds the repository
    expect(await cliOk('add', path.join(repo('alpha'), 'src'))).toContain(
      'Already in GitHub Desktop'
    )
    const entries = JSON.parse(await cliOk('list', '--json'))
    expect(entries.map((e: { name: string }) => e.name)).toEqual(
      [...names].sort()
    )
    await expect(page.locator('dialog')).toHaveCount(0)
  })

  test('refuses a folder that is not a repository', async () => {
    const result = await cli('add', notARepo)
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Not a git repository')
  })

  test('removes a repository and leaves its folder', async () => {
    expect(await cliOk('remove', repo('iota'))).toContain('Removed: iota')
    expect(fs.existsSync(path.join(repo('iota'), '.git'))).toBe(true)
    expect(await cliOk('list')).not.toContain('iota')
    const again = await cli('remove', repo('iota'))
    expect(again.code).toBe(1)
    expect(again.stderr).toContain('Not in GitHub Desktop')
    await expectList(page, [
      '# Other',
      'alpha',
      'beta',
      'delta',
      'epsilon',
      'eta',
      'gamma',
      'theta',
      'zeta',
    ])
  })
})

test.describe('Repository groups', () => {
  test('a group made from the CLI shows up in the open app', async () => {
    await cliOk('group', 'add', 'Müşteri işleri', repo('beta'), repo('alpha'))
    await expectList(page, [
      '# Müşteri işleri',
      'alpha',
      'beta',
      '# Other',
      'delta',
      'epsilon',
      'eta',
      'gamma',
      'theta',
      'zeta',
    ])
  })

  test('clicking a header collapses it and saves that', async () => {
    await page
      .locator('.repository-section-header', { hasText: 'Müşteri işleri' })
      .click()
    await expectList(page, [
      '# Müşteri işleri (2)',
      '# Other',
      'delta',
      'epsilon',
      'eta',
      'gamma',
      'theta',
      'zeta',
    ])
    expect(readGroupsFile().collapsed).toContain('group:Müşteri işleri')
  })

  test('filtering finds repositories in collapsed groups', async () => {
    await openRepositoryList(page)
    const filter = page.locator(
      '.repository-list .filter-list-filter-field input'
    )
    await filter.fill('alp')
    await expect
      .poll(() => readList(page))
      .toEqual(['# Müşteri işleri', 'alpha'])
    await filter.fill('')
    await expect.poll(() => readList(page)).toContain('# Müşteri işleri (2)')
  })

  test('the repository menu moves a repository into a group', async () => {
    await repositoryMenu(page, 'gamma')
    expect(await menuLabels(app, ['Move to group'])).toEqual([
      'Müşteri işleri',
      'New group…',
    ])
    await clickMenu(app, ['Move to group', 'Müşteri işleri'])
    await expectList(page, [
      '# Müşteri işleri (3)',
      '# Other',
      'delta',
      'epsilon',
      'eta',
      'theta',
      'zeta',
    ])
  })

  test('New group… from a repository creates the group with it', async () => {
    await repositoryMenu(page, 'delta')
    await clickMenu(app, ['Move to group', 'New group…'])
    const dialog = await nameDialog(page, 'müşteri İŞLERİ')
    await expect(dialog.locator('.dialog-error')).toContainText(
      'already exists'
    )
    await expect(dialog.locator('button[type="submit"]')).toBeDisabled()
    await dialog.locator('input').fill('Kişisel')
    await dialog.locator('button[type="submit"]').click()
    await dialog.waitFor({ state: 'hidden' })
    await expectList(page, [
      '# Müşteri işleri (3)',
      '# Kişisel',
      'delta',
      '# Other',
      'epsilon',
      'eta',
      'theta',
      'zeta',
    ])
  })

  test('a repository shows its current group as checked', async () => {
    await repositoryMenu(page, 'delta')
    expect(await menuLabels(app, ['Move to group'])).toEqual([
      'Müşteri işleri',
      'Kişisel ✓',
      'New group…',
      'Remove from group',
    ])
  })

  test('the header menu moves, renames and deletes groups', async () => {
    await headerMenu(page, 'Kişisel')
    expect(await menuLabels(app)).toEqual([
      'Collapse',
      'Rename…',
      'Move up',
      'Move down (disabled)',
      'Delete group',
      'New group…',
      'Show recent group ✓',
    ])
    await clickMenu(app, ['Move up'])
    await expect
      .poll(() => readList(page))
      .toEqual([
        '# Kişisel',
        'delta',
        '# Müşteri işleri (3)',
        '# Other',
        'epsilon',
        'eta',
        'theta',
        'zeta',
      ])

    await headerMenu(page, 'Kişisel')
    await clickMenu(app, ['Rename…'])
    const dialog = await nameDialog(page, 'Kişisel projeler')
    await dialog.locator('button[type="submit"]').click()
    await dialog.waitFor({ state: 'hidden' })
    await expect.poll(() => readList(page)).toContain('# Kişisel projeler')

    await headerMenu(page, 'Kişisel projeler')
    await clickMenu(app, ['Delete group'])
    await expectList(page, [
      '# Müşteri işleri (3)',
      '# Other',
      'delta',
      'epsilon',
      'eta',
      'theta',
      'zeta',
    ])
    expect(
      readGroupsFile().groups.map((g: { name: string }) => g.name)
    ).toEqual(['Müşteri işleri'])
  })

  test('an empty group made in the app stays visible', async () => {
    await headerMenu(page, 'Other')
    expect(await menuLabels(app)).toEqual([
      'Collapse',
      'New group…',
      'Show recent group ✓',
    ])
    await clickMenu(app, ['New group…'])
    const dialog = await nameDialog(page, 'Boş')
    await dialog.locator('button[type="submit"]').click()
    await dialog.waitFor({ state: 'hidden' })
    await expect.poll(() => readList(page)).toContain('# Boş')
  })

  test('hiding moves a repository to a collapsed Hidden section', async () => {
    await repositoryMenu(page, 'epsilon')
    await clickMenu(app, ['Hide'])
    await expectList(page, [
      '# Müşteri işleri (3)',
      '# Boş',
      '# Other',
      'delta',
      'eta',
      'theta',
      'zeta',
      '# Hidden (1)',
    ])
    await cliOk('unhide', repo('epsilon'))
    await expect.poll(() => readList(page)).toContain('epsilon')
    await expect.poll(() => readList(page)).not.toContain('# Hidden (1)')
  })

  test('the Recent group follows the switch', async () => {
    // Recent appears with more than seven repositories once some are opened
    for (const name of ['zeta', 'eta']) {
      await openRepositoryList(page)
      await page
        .locator('.repository-list .repository-list-item', {
          has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }),
        })
        .click()
      await page.locator('.repository-list').waitFor({ state: 'hidden' })
    }
    await openRepositoryList(page)
    await expect.poll(() => readList(page)).toContain('# Recent')

    await cliOk('recent', 'off')
    await expect.poll(() => readList(page)).not.toContain('# Recent')

    await headerMenu(page, 'Other')
    await clickMenu(app, ['Show recent group'])
    await expect.poll(() => readList(page)).toContain('# Recent')
    expect(readGroupsFile().showRecent).toBe(true)
  })

  test('a broken file falls back to the default list', async () => {
    const good = fs.readFileSync(groupsFile, 'utf8')
    fs.writeFileSync(groupsFile, '{ this is not json')
    await expect
      .poll(() => readList(page))
      .not.toContain('# Müşteri işleri (3)')
    await expect.poll(() => readList(page)).toContain('gamma')
    fs.writeFileSync(groupsFile, good)
    await expect.poll(() => readList(page)).toContain('# Müşteri işleri (3)')
  })

  test('a burst of CLI changes ends in the same state in the app', async () => {
    await cliOk('group', 'delete', 'Boş')
    for (let i = 1; i <= 6; i++) {
      await cliOk('group', 'create', `Grup ${i}`)
    }
    await cliOk('group', 'add', 'Grup 3', repo('delta'), repo('eta'))
    await cliOk('group', 'move', 'Grup 3', '1')
    await cliOk('group', 'rename', 'Grup 5', '2025')
    await cliOk('group', 'delete', 'Grup 2')
    await cliOk('group', 'collapse', 'Grup 3')
    await cliOk('hide', repo('theta'))
    await cliOk('group', 'remove', repo('gamma'))
    await cliOk('group', 'expand', 'Müşteri işleri')

    const layout = JSON.parse(await cliOk('group', 'list', '--json'))
    expect(layout.groups.map((g: { name: string }) => g.name)).toEqual([
      'Grup 3',
      'Müşteri işleri',
      'Grup 1',
      'Grup 4',
      '2025',
      'Grup 6',
    ])
    await closeRepositoryList(page)
    await expectList(page, [
      // The current repository (eta) isn't listed under Recent
      '# Recent',
      'alpha',
      'zeta',
      '# Grup 3 (2)',
      '# Müşteri işleri',
      'alpha',
      'beta',
      '# Grup 1',
      '# Grup 4',
      '# 2025',
      '# Grup 6',
      '# Other',
      'epsilon',
      'gamma',
      'zeta',
      '# Hidden (1)',
    ])
  })

  test('removing a grouped repository from the app drops it from the list', async () => {
    await cliOk('remove', repo('beta'))
    await expect.poll(() => readList(page)).not.toContain('beta')
    expect(await cliOk('group', 'list')).toContain('beta')
    await cliOk('add', repo('beta'))
    await expect.poll(() => readList(page)).toContain('beta')
  })

  test('the layout survives a restart', async () => {
    await app.close()
    ;({ app, page } = await launch())
    await expectList(page, [
      // The current repository (eta) isn't listed under Recent
      '# Recent',
      'alpha',
      'zeta',
      '# Grup 3 (2)',
      '# Müşteri işleri',
      'alpha',
      'beta',
      '# Grup 1',
      '# Grup 4',
      '# 2025',
      '# Grup 6',
      '# Other',
      'epsilon',
      'gamma',
      'zeta',
      '# Hidden (1)',
    ])
  })

  test('no errors in the app', () => {
    expect(pageErrors).toEqual([])
  })
})
