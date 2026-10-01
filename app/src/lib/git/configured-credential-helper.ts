import { exec as git } from 'dugite'
import { formatCredential, parseCredential } from './credential'

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
