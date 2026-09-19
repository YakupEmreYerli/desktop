import * as Path from 'path'
import { rename, writeFile } from 'fs/promises'
import type { AppStore } from '../../lib/stores/app-store'
import type { Dispatcher } from '../dispatcher'
import type { CLIAction } from '../../lib/cli-action'
import type { Repository } from '../../models/repository'
import type { CloningRepository } from '../../models/cloning-repository'
import { getPath } from '../main-process-proxy'
import { matchExistingRepository } from '../../lib/repository-matching'
import {
  RepositoryListFileName,
  toRepositoryListEntries,
} from '../../lib/repository-list-file'

/**
 * Keeps `repositories.json` in the user data directory in step with the
 * repository list, for `github list` and for `github add/remove` to see their
 * result.
 */
export function syncRepositoryListFile(appStore: AppStore) {
  let written: string | null = null
  let writing = Promise.resolve()

  appStore.onDidUpdate(state => {
    // The list is empty until the database has loaded, so an empty list is
    // only trusted once a non-empty one has been written (the last one removed)
    if (written === null && state.repositories.length === 0) {
      return
    }
    const contents =
      JSON.stringify(toRepositoryListEntries(state.repositories), null, 2) +
      '\n'
    if (contents === written) {
      return
    }
    written = contents
    writing = writing
      .then(() => writeListFile(contents))
      .catch(e => {
        log.error('Could not write the repository list file', e)
      })
  })
}

async function writeListFile(contents: string) {
  const path = Path.join(await getPath('userData'), RepositoryListFileName)
  const temporary = `${path}.tmp`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, path)
}

type RepositoryListAction = Extract<
  CLIAction,
  { kind: 'add-repository' | 'remove-repository' }
>

export function isRepositoryListAction(
  action: CLIAction
): action is RepositoryListAction {
  return action.kind === 'add-repository' || action.kind === 'remove-repository'
}

/**
 * `github add` and `github remove`: change the list without a dialog. Removing
 * only takes the repository out of the app, the folder stays on disk.
 */
export async function dispatchRepositoryListAction(
  dispatcher: Dispatcher,
  repositories: ReadonlyArray<Repository | CloningRepository>,
  action: RepositoryListAction
) {
  if (action.kind === 'add-repository') {
    await dispatcher.addRepositories([action.path])
    return
  }

  const repository = matchExistingRepository(repositories, action.path)
  if (repository === undefined) {
    log.warn(`Repository to remove isn't in the list: ${action.path}`)
    return
  }
  await dispatcher.removeRepository(repository, false)
}
