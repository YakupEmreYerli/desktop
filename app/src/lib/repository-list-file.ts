import * as Path from 'path'
import type { Repository } from '../models/repository'
import type { CloningRepository } from '../models/cloning-repository'

/**
 * The repository list the app keeps in the user data directory so the `github`
 * command line tool can read it without the app's database.
 */
export const RepositoryListFileName = 'repositories.json'

export interface IRepositoryListEntry {
  /** Name shown in the app: the alias if one is set, otherwise the folder name. */
  readonly name: string
  readonly path: string
  /** `owner/name` on GitHub, when the repository is linked to one. */
  readonly gitHub: string | null
  readonly url: string | null
  /** The folder no longer exists or can't be read as a repository. */
  readonly missing: boolean
}

export function toRepositoryListEntries(
  repositories: ReadonlyArray<Repository | CloningRepository>
): ReadonlyArray<IRepositoryListEntry> {
  const entries = new Array<IRepositoryListEntry>()
  for (const repository of repositories) {
    // Clones in progress have no `missing` flag and aren't in the list yet
    if (!('missing' in repository)) {
      continue
    }
    const gitHub = repository.gitHubRepository
    entries.push({
      name: repository.alias ?? repository.name,
      path: repository.path,
      gitHub: gitHub?.fullName ?? null,
      url: gitHub?.htmlURL ?? null,
      missing: repository.missing,
    })
  }
  return entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

export function isSameRepositoryPath(a: string, b: string) {
  return normalize(a) === normalize(b)
}

/** Returns the entry for `path`, which may point inside the repository. */
export function findRepositoryListEntry(
  entries: ReadonlyArray<IRepositoryListEntry>,
  path: string
): IRepositoryListEntry | undefined {
  const needle = normalize(path)
  const exact = entries.find(e => isSameRepositoryPath(e.path, path))
  if (exact !== undefined) {
    return exact
  }
  // The deepest repository containing the path, for nested repositories
  return entries
    .filter(e => needle.startsWith(normalize(e.path) + Path.sep))
    .sort((a, b) => b.path.length - a.path.length)
    .at(0)
}

/** Aligned `name  path  owner/name` lines for a terminal. */
export function formatRepositoryList(
  entries: ReadonlyArray<IRepositoryListEntry>
): string {
  const nameWidth = Math.max(0, ...entries.map(e => e.name.length))
  const pathWidth = Math.max(0, ...entries.map(e => e.path.length))
  return entries
    .map(e => {
      const extra = [e.gitHub, e.missing ? '(missing)' : null]
        .filter(x => x !== null)
        .join(' ')
      return `${e.name.padEnd(nameWidth)}  ${e.path.padEnd(
        pathWidth
      )}  ${extra}`.trimEnd()
    })
    .map(line => `${line}\n`)
    .join('')
}

function normalize(path: string) {
  const normalized = Path.normalize(path).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}
