import { ILocalRepositoryState } from '../../models/repository'
import { IFilterListGroup } from '../lib/filter-list'
import { caseInsensitiveCompare } from '../../lib/compare'
import {
  IRepositoryGroupsLayout,
  RepositorySection,
  findGroupOf,
  isCollapsed,
  isHidden,
} from '../../lib/repository-groups'
import {
  IRepositoryListItem,
  RepositoryListGroup,
  Repositoryish,
  groupRepositories,
} from './group-repositories'

/** A section of the repository list as the header draws it. */
export interface IRepositorySectionHeader {
  readonly section: RepositorySection
  readonly label: string
  readonly collapsed: boolean
  /** Repositories in the section, shown while it's collapsed. */
  readonly count: number
}

export type RepositoryListSection = IFilterListGroup<
  IRepositoryListItem,
  IRepositorySectionHeader
>

function toSection(group: RepositoryListGroup): RepositorySection {
  switch (group.kind) {
    case 'dotcom':
      return { kind: 'owner', login: group.owner.login }
    case 'enterprise':
      return { kind: 'enterprise', host: group.host }
    default:
      return { kind: group.kind }
  }
}

function getSectionLabel(section: RepositorySection) {
  switch (section.kind) {
    case 'custom':
      return section.name
    case 'owner':
      return section.login
    case 'enterprise':
      return section.host
    case 'recent':
      return 'Recent'
    case 'hidden':
      return 'Hidden'
    case 'other':
      return 'Other'
  }
}

const byTitle = (x: IRepositoryListItem, y: IRepositoryListItem) =>
  caseInsensitiveCompare(x.text[0], y.text[0])

/**
 * Upstream's grouping (Recent, then by owner) with the user's layout on top:
 * their groups come right after Recent in their order, repositories they
 * haven't placed stay in the owner groups, hidden ones go to a Hidden section
 * at the bottom. Collapsed sections keep their header and drop their rows,
 * except while filtering, so a search still finds everything.
 */
export function arrangeRepositories(
  repositories: ReadonlyArray<Repositoryish>,
  localRepositoryStateLookup: ReadonlyMap<number, ILocalRepositoryState>,
  recentRepositories: ReadonlyArray<number>,
  layout: IRepositoryGroupsLayout,
  filtering: boolean
): ReadonlyArray<RepositoryListSection> {
  const groups = groupRepositories(
    repositories,
    localRepositoryStateLookup,
    layout.showRecent ? recentRepositories : []
  )

  const custom = new Map(
    layout.groups.map(g => [g.name, new Array<IRepositoryListItem>()])
  )
  const hidden = new Array<IRepositoryListItem>()
  const placed = new Set<string>()

  for (const { identifier, items } of groups) {
    if (identifier.kind === 'recent') {
      continue
    }
    for (const item of items) {
      const path = item.repository.path
      if (isHidden(layout, path)) {
        hidden.push(item)
        placed.add(item.id)
      } else {
        const group = findGroupOf(layout, path)
        if (group !== undefined) {
          custom.get(group.name)?.push(item)
          placed.add(item.id)
        }
      }
    }
  }

  const sections = new Array<{
    section: RepositorySection
    items: ReadonlyArray<IRepositoryListItem>
    showWhenEmpty: boolean
  }>()

  const recent = groups.find(g => g.identifier.kind === 'recent')
  if (recent !== undefined) {
    sections.push({
      section: { kind: 'recent' },
      items: recent.items.filter(i => !isHidden(layout, i.repository.path)),
      showWhenEmpty: false,
    })
  }
  for (const [name, items] of custom) {
    sections.push({
      section: { kind: 'custom', name },
      items: items.sort(byTitle),
      // An empty group still shows, so a new one can be seen and filled
      showWhenEmpty: true,
    })
  }
  for (const { identifier, items } of groups) {
    if (identifier.kind !== 'recent') {
      sections.push({
        section: toSection(identifier),
        items: items.filter(i => !placed.has(i.id)),
        showWhenEmpty: false,
      })
    }
  }
  if (hidden.length > 0) {
    sections.push({
      section: { kind: 'hidden' },
      items: hidden.sort(byTitle),
      showWhenEmpty: false,
    })
  }

  return sections
    .filter(s => s.items.length > 0 || s.showWhenEmpty)
    .map(({ section, items, showWhenEmpty }) => {
      const collapsed = !filtering && isCollapsed(layout, section)
      return {
        identifier: {
          section,
          label: getSectionLabel(section),
          collapsed,
          count: items.length,
        },
        items: collapsed ? [] : items,
        showWhenEmpty: !filtering && (collapsed || showWhenEmpty),
      }
    })
}
