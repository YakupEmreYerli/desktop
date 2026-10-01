import { Repository } from '../models/repository'
import { getRemotes } from './git'
import { getRemoteWebUrl } from './remote-web-url'

/**
 * The web page of a repository whose remote is not on GitHub (Forgejo,
 * Gitea, GitLab…), preferring `origin`. Null when there is no usable remote.
 */
export async function getRemoteWebPage(
  repository: Repository
): Promise<string | null> {
  const remotes = await getRemotes(repository)
  const remote = remotes.find(r => r.name === 'origin') ?? remotes.at(0)
  return remote ? getRemoteWebUrl(remote.url) : null
}
