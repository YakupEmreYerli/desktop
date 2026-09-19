import { join, resolve } from 'path'
import { readFile, rename, writeFile } from 'fs/promises'
import { getUserDataPath, readRepositoryList } from './repository-list'
import {
  IRepositoryListEntry,
  findRepositoryListEntry,
  isSameRepositoryPath,
} from '../lib/repository-list-file'
import {
  DefaultRepositoryGroupsLayout,
  IRepositoryGroupsLayout,
  RepositoryGroupsError,
  RepositoryGroupsFileName,
  assignRepository,
  createGroup,
  deleteGroup,
  findGroup,
  findGroupOf,
  isCollapsed,
  isHidden,
  moveGroup,
  parseRepositoryGroups,
  renameGroup,
  serializeRepositoryGroups,
  setCollapsed,
  setHidden,
  setShowRecent,
} from '../lib/repository-groups'

export const GroupUsage =
  '  github group list [--json]        Show the groups in the repository list\n' +
  '  github group create <name>        Create an empty group\n' +
  '  github group add <name> [path…]   Put repositories in a group (creating it)\n' +
  '  github group remove [path…]       Take repositories out of their group\n' +
  '  github group rename <name> <new>  Rename a group\n' +
  '  github group delete <name>        Delete a group; its repositories go back\n' +
  '                                    to their owner group\n' +
  '  github group move <name> <n>      Move a group to position n (1 is the top)\n' +
  '  github group collapse|expand <name>\n' +
  '  github hide [path…]               Move repositories to the Hidden section\n' +
  '  github unhide [path…]             Show hidden repositories again\n' +
  '  github recent on|off              Show or hide the Recent group\n'

class UsageError extends Error {}

const filePath = () => join(getUserDataPath(), RepositoryGroupsFileName)

async function readLayout(): Promise<IRepositoryGroupsLayout> {
  try {
    return parseRepositoryGroups(await readFile(filePath(), 'utf8'))
  } catch {
    return DefaultRepositoryGroupsLayout
  }
}

async function writeLayout(layout: IRepositoryGroupsLayout) {
  const path = filePath()
  await writeFile(`${path}.tmp`, serializeRepositoryGroups(layout), 'utf8')
  await rename(`${path}.tmp`, path)
}

async function readEntries() {
  const entries = await readRepositoryList()
  if (entries === null) {
    throw new RepositoryGroupsError(
      'GitHub Desktop has not written its repository list yet; open the app once.'
    )
  }
  return entries
}

/** The repositories the paths point into; the current directory by default. */
async function resolveRepositories(paths: ReadonlyArray<string>) {
  const entries = await readEntries()
  return (paths.length > 0 ? paths : ['.']).map(p => {
    const entry = findRepositoryListEntry(entries, resolve(p))
    if (entry === undefined) {
      throw new RepositoryGroupsError(`Not in GitHub Desktop: ${resolve(p)}`)
    }
    return entry
  })
}

function requireArg(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new UsageError(`Missing ${name}.`)
  }
  return value
}

function describe(entries: ReadonlyArray<IRepositoryListEntry>, path: string) {
  const entry = entries.find(e => isSameRepositoryPath(e.path, path))
  return entry ?? { name: path, path, gitHub: null, url: null, missing: true }
}

async function list(json: boolean) {
  const layout = await readLayout()
  const entries = (await readRepositoryList()) ?? []
  const groups = layout.groups.map(g => ({
    name: g.name,
    collapsed: isCollapsed(layout, { kind: 'custom', name: g.name }),
    repositories: g.repositories.map(p => describe(entries, p)),
  }))
  const hidden = layout.hidden.map(p => describe(entries, p))
  const ungrouped = entries.filter(
    e => findGroupOf(layout, e.path) === undefined && !isHidden(layout, e.path)
  )

  if (json) {
    const result = { showRecent: layout.showRecent, groups, hidden, ungrouped }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  const lines = [`Recent group: ${layout.showRecent ? 'shown' : 'hidden'}`]
  const section = (
    title: string,
    repositories: ReadonlyArray<IRepositoryListEntry>
  ) => {
    lines.push('', title)
    for (const r of repositories) {
      lines.push(`  ${r.name}  ${r.path}${r.missing ? '  (missing)' : ''}`)
    }
    if (repositories.length === 0) {
      lines.push('  (empty)')
    }
  }
  groups.forEach(g =>
    section(g.collapsed ? `${g.name} (collapsed)` : g.name, g.repositories)
  )
  section('Hidden', hidden)
  section('Not in a group (listed by owner)', ungrouped)
  process.stdout.write(lines.join('\n') + '\n')
}

async function change(
  message: string,
  apply: (layout: IRepositoryGroupsLayout) => IRepositoryGroupsLayout
) {
  await writeLayout(apply(await readLayout()))
  process.stdout.write(`${message}\n`)
}

async function changeRepositories(
  paths: ReadonlyArray<string>,
  verb: string,
  apply: (
    layout: IRepositoryGroupsLayout,
    path: string
  ) => IRepositoryGroupsLayout
) {
  const repositories = await resolveRepositories(paths)
  let layout = await readLayout()
  for (const r of repositories) {
    layout = apply(layout, r.path)
  }
  await writeLayout(layout)
  for (const r of repositories) {
    process.stdout.write(`${verb}: ${r.name}  ${r.path}\n`)
  }
}

async function groupCommand(args: ReadonlyArray<string>, json: boolean) {
  const [command, first, second] = args
  const rest = args.slice(2)
  switch (command) {
    case undefined:
    case 'list':
      return list(json)
    case 'create': {
      const name = requireArg(first, 'group name')
      return change(`Created group: ${name.trim()}`, l => createGroup(l, name))
    }
    case 'add': {
      const name = requireArg(first, 'group name')
      return changeRepositories(rest, `In "${name.trim()}"`, (l, p) =>
        assignRepository(l, p, name)
      )
    }
    case 'remove':
      return changeRepositories(args.slice(1), 'Out of its group', (l, p) =>
        assignRepository(l, p, null)
      )
    case 'rename': {
      const name = requireArg(first, 'group name')
      const newName = requireArg(second, 'new name')
      return change(`Renamed group: ${name} → ${newName.trim()}`, l =>
        renameGroup(l, name, newName)
      )
    }
    case 'delete': {
      const name = requireArg(first, 'group name')
      return change(`Deleted group: ${name}`, l => deleteGroup(l, name))
    }
    case 'move': {
      const name = requireArg(first, 'group name')
      const position = Number(requireArg(second, 'position'))
      if (!Number.isInteger(position) || position < 1) {
        throw new UsageError('The position is a number from 1.')
      }
      return change(`Moved group: ${name} to ${position}`, l =>
        moveGroup(l, name, position - 1)
      )
    }
    case 'collapse':
    case 'expand': {
      const name = requireArg(first, 'group name')
      return change(
        `${command === 'collapse' ? 'Collapsed' : 'Expanded'}: ${name}`,
        l => {
          const group = findGroup(l, name)
          if (group === undefined) {
            throw new RepositoryGroupsError(`No group named "${name}".`)
          }
          return setCollapsed(
            l,
            { kind: 'custom', name: group.name },
            command === 'collapse'
          )
        }
      )
    }
    default:
      throw new UsageError(`Unknown group command: ${command}`)
  }
}

/**
 * `github group …`, `github hide`, `github unhide` and `github recent`. They
 * edit the layout file directly, so the app doesn't have to be running; an
 * open app picks the change up by itself. Returns false for a usage error.
 */
export async function runGroupCommand(
  command: string,
  args: ReadonlyArray<string>,
  json: boolean
): Promise<boolean> {
  try {
    if (command === 'group') {
      await groupCommand(args, json)
    } else if (command === 'hide' || command === 'unhide') {
      const hide = command === 'hide'
      await changeRepositories(args, hide ? 'Hidden' : 'Shown', (l, p) =>
        setHidden(l, p, hide)
      )
    } else if (command === 'recent') {
      if (args[0] !== 'on' && args[0] !== 'off') {
        throw new UsageError('Use "github recent on" or "github recent off".')
      }
      const show = args[0] === 'on'
      await change(`Recent group: ${show ? 'shown' : 'hidden'}`, l =>
        setShowRecent(l, show)
      )
    }
    return true
  } catch (e) {
    if (e instanceof RepositoryGroupsError) {
      process.stderr.write(`${e.message}\n`)
      process.exitCode = 1
      return true
    }
    if (e instanceof UsageError) {
      process.stderr.write(`${e.message}\n`)
      return false
    }
    throw e
  }
}
