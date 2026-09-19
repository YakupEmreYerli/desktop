import { isSameRepositoryPath } from './repository-list-file'

/**
 * How the user arranged the repository list: their own groups, hidden
 * repositories and collapsed sections. Kept in the user data directory so the
 * `github group` commands can change it while the app watches the file.
 * Repositories are identified by path, which the app and the CLI both know.
 */
export const RepositoryGroupsFileName = 'repository-groups.json'

export interface IRepositoryGroup {
  readonly name: string
  readonly repositories: ReadonlyArray<string>
}

export interface IRepositoryGroupsLayout {
  /** The user's groups, in display order. */
  readonly groups: ReadonlyArray<IRepositoryGroup>
  /** Repositories shown only in the Hidden section at the bottom. */
  readonly hidden: ReadonlyArray<string>
  /** Collapsed sections, by `getSectionKey`. */
  readonly collapsed: ReadonlyArray<string>
  readonly showRecent: boolean
}

export const DefaultRepositoryGroupsLayout: IRepositoryGroupsLayout = {
  groups: [],
  hidden: [],
  // Hidden repositories stay out of the way until asked for
  collapsed: ['hidden'],
  showRecent: true,
}

/** Identifies a section of the list for `collapsed`. */
export type RepositorySection =
  | { readonly kind: 'custom'; readonly name: string }
  | { readonly kind: 'hidden' | 'recent' | 'other' }
  | { readonly kind: 'owner'; readonly login: string }
  | { readonly kind: 'enterprise'; readonly host: string }

export function getSectionKey(section: RepositorySection): string {
  switch (section.kind) {
    case 'custom':
      return `group:${section.name}`
    case 'owner':
      return `owner:${section.login}`
    case 'enterprise':
      return `enterprise:${section.host}`
    default:
      return section.kind
  }
}

export class RepositoryGroupsError extends Error {}

const sameName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0

export function findGroup(
  layout: IRepositoryGroupsLayout,
  name: string
): IRepositoryGroup | undefined {
  return layout.groups.find(g => sameName(g.name, name))
}

/** The group `path` belongs to, if any. */
export function findGroupOf(
  layout: IRepositoryGroupsLayout,
  path: string
): IRepositoryGroup | undefined {
  return layout.groups.find(g =>
    g.repositories.some(p => isSameRepositoryPath(p, path))
  )
}

export function isHidden(layout: IRepositoryGroupsLayout, path: string) {
  return layout.hidden.some(p => isSameRepositoryPath(p, path))
}

export function isCollapsed(
  layout: IRepositoryGroupsLayout,
  section: RepositorySection
) {
  return layout.collapsed.includes(getSectionKey(section))
}

function requireGroup(layout: IRepositoryGroupsLayout, name: string) {
  const group = findGroup(layout, name)
  if (group === undefined) {
    throw new RepositoryGroupsError(`No group named "${name}".`)
  }
  return group
}

function validName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    throw new RepositoryGroupsError('A group needs a name.')
  }
  return trimmed
}

function withoutPath(paths: ReadonlyArray<string>, path: string) {
  return paths.filter(p => !isSameRepositoryPath(p, path))
}

export function createGroup(
  layout: IRepositoryGroupsLayout,
  name: string
): IRepositoryGroupsLayout {
  const groupName = validName(name)
  if (findGroup(layout, groupName) !== undefined) {
    throw new RepositoryGroupsError(`A group named "${groupName}" exists.`)
  }
  return {
    ...layout,
    groups: [...layout.groups, { name: groupName, repositories: [] }],
  }
}

export function renameGroup(
  layout: IRepositoryGroupsLayout,
  name: string,
  newName: string
): IRepositoryGroupsLayout {
  const group = requireGroup(layout, name)
  const groupName = validName(newName)
  const clash = findGroup(layout, groupName)
  if (clash !== undefined && clash !== group) {
    throw new RepositoryGroupsError(`A group named "${groupName}" exists.`)
  }
  const oldKey = getSectionKey({ kind: 'custom', name: group.name })
  const newKey = getSectionKey({ kind: 'custom', name: groupName })
  return {
    ...layout,
    groups: layout.groups.map(g =>
      g === group ? { ...g, name: groupName } : g
    ),
    collapsed: layout.collapsed.map(k => (k === oldKey ? newKey : k)),
  }
}

/** Removes the group; its repositories go back to their default section. */
export function deleteGroup(
  layout: IRepositoryGroupsLayout,
  name: string
): IRepositoryGroupsLayout {
  const group = requireGroup(layout, name)
  const key = getSectionKey({ kind: 'custom', name: group.name })
  return {
    ...layout,
    groups: layout.groups.filter(g => g !== group),
    collapsed: layout.collapsed.filter(k => k !== key),
  }
}

/** Moves the group to `index` (0 is the top), clamped to the list. */
export function moveGroup(
  layout: IRepositoryGroupsLayout,
  name: string,
  index: number
): IRepositoryGroupsLayout {
  const group = requireGroup(layout, name)
  const groups = layout.groups.filter(g => g !== group)
  const at = Math.max(0, Math.min(groups.length, Math.trunc(index)))
  groups.splice(at, 0, group)
  return { ...layout, groups }
}

/**
 * Puts the repository in the named group, creating the group if needed, or
 * takes it out of its group when `name` is null. Either way it's no longer
 * hidden.
 */
export function assignRepository(
  layout: IRepositoryGroupsLayout,
  path: string,
  name: string | null
): IRepositoryGroupsLayout {
  let next = layout
  if (name !== null && findGroup(next, name) === undefined) {
    next = createGroup(next, name)
  }
  const target = name === null ? undefined : findGroup(next, name)
  return {
    ...next,
    hidden: withoutPath(next.hidden, path),
    groups: next.groups.map(g => {
      const repositories = withoutPath(g.repositories, path)
      return g === target
        ? { ...g, repositories: [...repositories, path] }
        : repositories.length === g.repositories.length
        ? g
        : { ...g, repositories }
    }),
  }
}

/** Hiding takes the repository out of its group; showing it doesn't put it back. */
export function setHidden(
  layout: IRepositoryGroupsLayout,
  path: string,
  hidden: boolean
): IRepositoryGroupsLayout {
  const next = assignRepository(layout, path, null)
  return hidden ? { ...next, hidden: [...next.hidden, path] } : next
}

export function setCollapsed(
  layout: IRepositoryGroupsLayout,
  section: RepositorySection,
  collapsed: boolean
): IRepositoryGroupsLayout {
  const key = getSectionKey(section)
  const rest = layout.collapsed.filter(k => k !== key)
  return { ...layout, collapsed: collapsed ? [...rest, key] : rest }
}

export function setShowRecent(
  layout: IRepositoryGroupsLayout,
  showRecent: boolean
): IRepositoryGroupsLayout {
  return { ...layout, showRecent }
}

const isStringArray = (x: unknown): x is ReadonlyArray<string> =>
  Array.isArray(x) && x.every(s => typeof s === 'string')

/**
 * Reads the file's contents, dropping anything malformed rather than failing,
 * since people and agents edit it by hand too.
 */
export function parseRepositoryGroups(text: string): IRepositoryGroupsLayout {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return DefaultRepositoryGroupsLayout
  }
  if (typeof data !== 'object' || data === null) {
    return DefaultRepositoryGroupsLayout
  }
  const raw = data as Record<string, unknown>
  const groups = new Array<IRepositoryGroup>()
  for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
    if (
      typeof g === 'object' &&
      g !== null &&
      typeof g.name === 'string' &&
      g.name.trim().length > 0 &&
      groups.every(x => !sameName(x.name, g.name))
    ) {
      groups.push({
        name: g.name.trim(),
        repositories: isStringArray(g.repositories) ? g.repositories : [],
      })
    }
  }
  return {
    groups,
    hidden: isStringArray(raw.hidden) ? raw.hidden : [],
    collapsed: isStringArray(raw.collapsed)
      ? raw.collapsed
      : DefaultRepositoryGroupsLayout.collapsed,
    showRecent: typeof raw.showRecent === 'boolean' ? raw.showRecent : true,
  }
}

export function serializeRepositoryGroups(layout: IRepositoryGroupsLayout) {
  return JSON.stringify(layout, null, 2) + '\n'
}
