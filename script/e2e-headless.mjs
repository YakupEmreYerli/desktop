#!/usr/bin/env node

/**
 * Runs an e2e command inside a nested, invisible KWin compositor so the app
 * windows the tests open don't land on top of what you're doing and take the
 * keyboard and mouse with them.
 *
 * Falls back to running the command as-is when KWin isn't around, and
 * DESKTOP_E2E_VISIBLE=1 shows the windows on purpose.
 */

import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

const command = process.argv.slice(2)

if (command.length === 0) {
  console.error('Usage: node script/e2e-headless.mjs <command> [args…]')
  process.exit(2)
}

const run = (...args) =>
  spawnSync(args[0], args.slice(1), { stdio: 'inherit' }).status ?? 1

const has = binary =>
  spawnSync('sh', ['-c', `command -v ${binary}`], { stdio: 'ignore' }).status === 0

const hasKWin = has('kwin_wayland')

if (process.env.DESKTOP_E2E_VISIBLE === '1' || !hasKWin) {
  process.exit(run(...command))
}

const quote = arg => `'${arg.replace(/'/g, `'\\''`)}'`
const dir = mkdtempSync(path.join(os.tmpdir(), 'desktop-e2e-headless-'))
const statusFile = path.join(dir, 'status')
const session = path.join(dir, 'session.sh')

// The app follows WAYLAND_DISPLAY, which the nested compositor sets for us.
// DISPLAY has to go, otherwise Electron picks XWayland and the window shows
// up on the real screen after all.
writeFileSync(
  session,
  [
    '#!/bin/sh',
    'unset DISPLAY',
    command.map(quote).join(' '),
    `echo $? > ${quote(statusFile)}`,
    '',
  ].join('\n'),
  { mode: 0o755 }
)

// The nested compositor must not touch the real session bus. Left alone it
// registers the "kwin" global-shortcut component over the running desktop's,
// and when it exits every shortcut (Alt+Tab, Meta+D, …) is dead until logout.
// A private bus is the fix; --no-global-shortcuts alone is not enough, because
// KWin scripts loaded inside the nested instance still reach the real bus.
// DESKTOP_E2E_SHARE_BUS=1 opts out when a test genuinely needs the real bus.
const isolateBus = process.env.DESKTOP_E2E_SHARE_BUS !== '1' && has('dbus-run-session')

const compositor = [
  'kwin_wayland',
  '--virtual',
  '--no-global-shortcuts',
  '--width',
  '1600',
  '--height',
  '1000',
  `--exit-with-session=${session}`,
]

// KWin exits with the session, but with its own status, so the command's
// status comes back through the file the session script writes.
run(...(isolateBus ? ['dbus-run-session', '--', ...compositor] : compositor))

let status = 1

try {
  status = parseInt(readFileSync(statusFile, 'utf8').trim(), 10)
} catch {
  console.error('The e2e session did not report a status')
}

rmSync(dir, { recursive: true, force: true })

process.exit(isNaN(status) ? 1 : status)
