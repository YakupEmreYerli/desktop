import { join, resolve } from 'path'
import parse from 'minimist'
import { execFile, spawn } from 'child_process'
import {
  getRepositoryRoot,
  readRepositoryList,
  waitForRepositoryList,
} from './repository-list'
import { GroupUsage, runGroupCommand } from './repository-groups'
import {
  findRepositoryListEntry,
  formatRepositoryList,
  isSameRepositoryPath,
} from '../lib/repository-list-file'

const run = (...args: Array<string>) => {
  function cb(e: unknown | null, stderr?: string) {
    if (e) {
      console.error(`Error running command ${args}`)
      console.error(stderr ?? `${e}`)
      process.exit(
        typeof e === 'object' && 'code' in e && typeof e.code === 'number'
          ? e.code
          : 1
      )
    }
  }

  if (process.platform === 'darwin') {
    execFile('open', ['-n', join(__dirname, '../../..'), '--args', ...args], cb)
  } else if (process.platform === 'win32' || process.platform === 'linux') {
    const exeName = `GitHubDesktop${__DEV__ ? '-dev' : ''}.exe`
    const executable =
      process.platform === 'linux'
        ? process.execPath
        : join(__dirname, `../../${exeName}`)
    spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
    })
      .on('error', cb)
      .on('exit', code => (process.exitCode = code ?? process.exitCode))
      .unref()
  } else {
    throw new Error('Unsupported platform')
  }
}

const args = parse(process.argv.slice(2), {
  alias: { help: 'h', branch: 'b' },
  boolean: ['help', 'json'],
  string: ['_'],
})

const usage = (exitCode = 1): never => {
  process.stderr.write(
    'GitHub Desktop CLI usage: \n' +
      '  github                            Open the current directory\n' +
      '  github open [path]                Open the provided path\n' +
      '  github clone [-b branch] <url>    Clone the repository by url or name/owner\n' +
      '                                    (ex torvalds/linux), optionally checking out\n' +
      '                                    the branch\n' +
      '  github list [--json]              List the repositories in the app\n' +
      '  github add [path]                 Add a repository without a dialog\n' +
      '  github remove [path]              Remove a repository from the app;\n' +
      '                                    its folder stays on disk\n' +
      GroupUsage
  )
  process.exit(exitCode)
}

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const noList =
  'GitHub Desktop has not written its repository list yet; open the app once.'

async function listRepositories(json: boolean) {
  const entries = (await readRepositoryList()) ?? fail(noList)
  process.stdout.write(
    json
      ? JSON.stringify(entries, null, 2) + '\n'
      : formatRepositoryList(entries)
  )
}

async function addRepository(path: string) {
  const root =
    (await getRepositoryRoot(path)) ?? fail(`Not a git repository: ${path}`)
  const existing = ((await readRepositoryList()) ?? []).find(e =>
    isSameRepositoryPath(e.path, root)
  )
  if (existing !== undefined) {
    process.stdout.write(`Already in GitHub Desktop: ${existing.path}\n`)
    return
  }
  run(`--cli-add=${root}`)
  const added =
    (await waitForRepositoryList(root, true)) ??
    fail(`GitHub Desktop didn't add ${root}; check the app for an error.`)
  process.stdout.write(`Added: ${added.name}  ${added.path}\n`)
}

async function removeRepository(path: string) {
  const entries = (await readRepositoryList()) ?? fail(noList)
  const entry =
    findRepositoryListEntry(entries, path) ??
    fail(`Not in GitHub Desktop: ${path}`)
  run(`--cli-remove=${entry.path}`)
  if ((await waitForRepositoryList(entry.path, false)) === null) {
    fail(`GitHub Desktop didn't remove ${entry.path}; check the app.`)
  }
  process.stdout.write(`Removed: ${entry.name}  ${entry.path}\n`)
}

delete process.env.ELECTRON_RUN_AS_NODE

if (args.help || args._.at(0) === 'help') {
  usage(0)
} else if (args._.at(0) === 'list') {
  listRepositories(args.json)
} else if (args._.at(0) === 'add') {
  addRepository(resolve(args._.at(1) ?? '.'))
} else if (args._.at(0) === 'remove') {
  removeRepository(resolve(args._.at(1) ?? '.'))
} else if (['group', 'hide', 'unhide', 'recent'].includes(args._.at(0) ?? '')) {
  runGroupCommand(args._[0], args._.slice(1), args.json).then(ok => {
    if (!ok) {
      usage(1)
    }
  })
} else if (args._.at(0) === 'clone') {
  const urlArg = args._.at(1)
  // Assume name with owner slug if it looks like it
  const url =
    urlArg && /^[^\/]+\/[^\/]+$/.test(urlArg)
      ? `https://github.com/${urlArg}`
      : urlArg

  if (!url) {
    usage(1)
  } else if (typeof args.branch === 'string') {
    run(`--cli-clone=${url}`, `--cli-branch=${args.branch}`)
  } else {
    run(`--cli-clone=${url}`)
  }
} else {
  const [firstArg, secondArg] = args._
  const pathArg = firstArg === 'open' ? secondArg : firstArg
  const path = resolve(pathArg ?? '.')
  run(`--cli-open=${path}`)
}
