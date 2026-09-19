/* eslint-disable no-sync */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { test } from '@playwright/test'

/**
 * The environment for an app launched by a fork e2e test: its own user data
 * directory and its own global and system git config under `root`.
 *
 * The welcome flow writes the name and email typed into it to the global
 * git config. Without `GIT_CONFIG_GLOBAL` that is the developer's real
 * `~/.gitconfig`, and their next commits in every repository carry the test
 * identity. Every spec that launches the app gets its environment here.
 */
export function isolatedEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    XDG_CONFIG_HOME: path.join(root, 'config'),
    GIT_CONFIG_GLOBAL: path.join(root, '.gitconfig'),
    GIT_CONFIG_SYSTEM: path.join(root, '.gitconfig-system'),
  }
}

/** The identity the specs type into the welcome flow */
export const TestIdentity = { name: 'E2E', email: 'e2e@example.com' }

const realGitConfigs = [
  path.join(os.homedir(), '.gitconfig'),
  path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    'git',
    'config'
  ),
]

function read(file: string) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * Fails the spec, and puts the file back, if the test identity ended up in
 * the developer's real git config anyway.
 */
export function guardRealGitConfig() {
  const before = new Map<string, string | null>()

  test.beforeAll(() => {
    for (const file of realGitConfigs) {
      before.set(file, read(file))
    }
  })

  test.afterAll(() => {
    for (const file of realGitConfigs) {
      const now = read(file)
      const was = before.get(file) ?? null
      if (now !== was && now?.includes(TestIdentity.email)) {
        if (was === null) {
          fs.rmSync(file)
        } else {
          fs.writeFileSync(file, was)
        }
        throw new Error(
          `An e2e test wrote its identity to ${file}; the file was put back.`
        )
      }
    }
  })
}
