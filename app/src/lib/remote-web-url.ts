/**
 * Turns a git remote URL into the address of the repository's web page, for
 * hosts other than GitHub (Forgejo, Gitea, GitLab, Bitbucket and similar all
 * serve the repository at https://<host>/<owner>/<name>).
 *
 * Supports https://, http://, ssh:// and scp-like (git@host:owner/name) URLs.
 * Credentials in the URL are dropped. Returns null for anything else, such as
 * local paths.
 */
export function getRemoteWebUrl(remoteUrl: string): string | null {
  const url = remoteUrl.trim()

  const scpLike = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/.exec(url)
  if (scpLike && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return toWebUrl('https:', scpLike[1], scpLike[2])
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  switch (parsed.protocol) {
    case 'https:':
    case 'http:':
      return toWebUrl(parsed.protocol, parsed.host, parsed.pathname)
    case 'ssh:':
    case 'git+ssh:':
      return toWebUrl('https:', parsed.hostname, parsed.pathname)
    default:
      return null
  }
}

function toWebUrl(protocol: string, host: string, path: string) {
  const cleanPath = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
  return cleanPath.length > 0 ? `${protocol}//${host}/${cleanPath}` : null
}
