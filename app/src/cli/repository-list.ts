import { homedir } from 'os'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { execFile } from 'child_process'
import {
  IRepositoryListEntry,
  RepositoryListFileName,
  isSameRepositoryPath,
} from '../lib/repository-list-file'

/** Electron's `userData` directory, which the CLI can't ask the app for. */
export function getUserDataPath() {
  const name = `GitHub Desktop${__DEV__ ? '-dev' : ''}`
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', name)
  } else if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      name
    )
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), name)
}

/** The list the app last wrote, or null if it never has. */
export async function readRepositoryList(): Promise<ReadonlyArray<IRepositoryListEntry> | null> {
  try {
    const path = join(getUserDataPath(), RepositoryListFileName)
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (e) {
    return null
  }
}

/**
 * The top level of the repository containing `path`, `undefined` if it isn't
 * one, or `path` itself when git can't be run to tell.
 */
export function getRepositoryRoot(path: string): Promise<string | undefined> {
  return new Promise(resolve => {
    execFile(
      'git',
      ['-C', path, 'rev-parse', '--show-toplevel'],
      (error, stdout) => {
        if (error === null) {
          resolve(stdout.trim())
        } else {
          resolve('code' in error && error.code === 'ENOENT' ? path : undefined)
        }
      }
    )
  })
}

/**
 * Waits until the app's list says `path` is (or isn't) in it. The app may
 * have to start first, so this allows a while.
 */
export async function waitForRepositoryList(
  path: string,
  present: boolean,
  timeout = 30_000
): Promise<IRepositoryListEntry | undefined | null> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const entries = await readRepositoryList()
    const entry = entries?.find(e => isSameRepositoryPath(e.path, path))
    if (entries !== null && (entry !== undefined) === present) {
      return entry
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return null
}
