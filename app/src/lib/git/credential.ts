import { exec as git } from 'dugite'

export const parseCredential = (value: string) => {
  const cred = new Map<string, string>()

  // The credential helper protocol is a simple key=value format but some of its
  // keys are actually arrays which are represented as multiple key[] entries.
  // Since we're currently storing credentials as a Map we need to handle this
  // and expand multiple key[] entries into a key[0], key[1]... key[n] sequence.
  // We then remove the number from the key when we're formatting the credential
  for (const line of value.split(/\r?\n/)) {
    const eqIx = line.indexOf('=')
    if (eqIx === -1) {
      continue
    }

    const k = line.slice(0, eqIx)
    const v = line.slice(eqIx + 1)

    if (k.endsWith('[]')) {
      let i = 0
      let newKey

      do {
        newKey = `${k.slice(0, -2)}[${i}]`
        i++
      } while (cred.has(newKey))

      cred.set(newKey, v)
    } else {
      cred.set(k, v)
    }
  }

  return cred
}

export const formatCredential = (credential: Map<string, string>) => {
  const lines = []
  for (const [k, v] of credential) {
    if (v.includes('\n') || v.includes('\0')) {
      throw new Error(`forbidden characters in credential value: ${k}`)
    }
    lines.push(`${k.replace(/\[\d+\]$/, '[]')}=${v}\n`)
  }

  return lines.join('')
}

// Can't use git() as that will call withTrampolineEnv which calls this method
const exec = (
  cmd: string,
  cred: Map<string, string>,
  path: string,
  env: Record<string, string | undefined> = {}
) =>
  git(
    [
      ...['-c', 'credential.helper='],
      ...['-c', `credential.helper=manager`],
      'credential',
      cmd,
    ],
    path,
    {
      stdin: formatCredential(cred),
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        TERM: 'dumb',
        ...env,
      },
    }
  ).then(({ exitCode, stderr, stdout }) => {
    if (exitCode !== 0) {
      throw new Error(stderr)
    }
    return parseCredential(stdout)
  })

export const fillCredential = exec.bind(null, 'fill')
export const approveCredential = exec.bind(null, 'approve')
export const rejectCredential = exec.bind(null, 'reject')

/**
 * Asks the credential helpers configured in the user's own git config
 * (system, global or repository) for a credential, without Desktop's
 * trampoline in between. Lets people who keep passwords for self-hosted
 * servers in pass, libsecret, a password manager CLI or a custom script
 * push from Desktop without typing the password again.
 *
 * Never prompts: terminal prompts and askpass are disabled, so a missing
 * or failing helper simply yields undefined.
 */
export const fillCredentialFromGitConfig = (
  cred: Map<string, string>,
  path: string
): Promise<Map<string, string> | undefined> =>
  git(['credential', 'fill'], path, {
    stdin: formatCredential(cred),
    env: {
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      TERM: 'dumb',
      // Make sure the trampoline's own helper override never leaks in.
      GIT_CONFIG_PARAMETERS: '',
      GIT_CONFIG_COUNT: '0',
    },
  })
    .then(({ exitCode, stdout }) => {
      if (exitCode !== 0) {
        return undefined
      }
      const filled = parseCredential(stdout)
      return filled.get('password') ? filled : undefined
    })
    .catch(() => undefined)
