import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  DefaultRepositoryGroupsLayout,
  RepositoryGroupsError,
  assignRepository,
  createGroup,
  deleteGroup,
  findGroupOf,
  isCollapsed,
  isHidden,
  moveGroup,
  parseRepositoryGroups,
  renameGroup,
  serializeRepositoryGroups,
  setCollapsed,
  setHidden,
} from '../../src/lib/repository-groups'
import { arrangeRepositories } from '../../src/ui/repositories-list/arrange-repositories'
import { Repository } from '../../src/models/repository'
import { gitHubRepoFixture } from '../helpers/github-repo-builder'

const empty = DefaultRepositoryGroupsLayout

describe('repository groups', () => {
  it('creates groups in order and refuses duplicate names', () => {
    const layout = createGroup(createGroup(empty, 'Clients'), ' Mine ')
    assert.deepStrictEqual(
      layout.groups.map(g => g.name),
      ['Clients', 'Mine']
    )
    assert.throws(() => createGroup(layout, 'clients'), RepositoryGroupsError)
    assert.throws(() => createGroup(layout, '  '), RepositoryGroupsError)
  })

  it('puts a repository in one group at a time, creating the group', () => {
    let layout = assignRepository(empty, '/src/a', 'Clients')
    layout = assignRepository(layout, '/src/a/', 'Mine')
    assert.equal(findGroupOf(layout, '/src/a')?.name, 'Mine')
    assert.deepStrictEqual(layout.groups[0].repositories, [])

    layout = assignRepository(layout, '/src/a', null)
    assert.equal(findGroupOf(layout, '/src/a'), undefined)
  })

  it('hiding takes a repository out of its group', () => {
    let layout = assignRepository(empty, '/src/a', 'Clients')
    layout = setHidden(layout, '/src/a', true)
    assert(isHidden(layout, '/src/a'))
    assert.equal(findGroupOf(layout, '/src/a'), undefined)

    layout = assignRepository(layout, '/src/a', 'Clients')
    assert(!isHidden(layout, '/src/a'))
  })

  it('renames, moves and deletes groups, keeping collapsed state', () => {
    let layout = createGroup(createGroup(empty, 'A'), 'B')
    layout = createGroup(layout, 'C')
    layout = setCollapsed(layout, { kind: 'custom', name: 'A' }, true)
    layout = renameGroup(layout, 'a', 'Alpha')
    assert(isCollapsed(layout, { kind: 'custom', name: 'Alpha' }))
    assert.throws(() => renameGroup(layout, 'B', 'alpha'))

    layout = moveGroup(layout, 'C', 0)
    assert.deepStrictEqual(
      layout.groups.map(g => g.name),
      ['C', 'Alpha', 'B']
    )
    layout = moveGroup(layout, 'C', 99)
    assert.deepStrictEqual(
      layout.groups.map(g => g.name),
      ['Alpha', 'B', 'C']
    )

    layout = deleteGroup(layout, 'Alpha')
    assert.deepStrictEqual(
      layout.groups.map(g => g.name),
      ['B', 'C']
    )
    assert(!layout.collapsed.includes('group:Alpha'))
    assert.throws(() => deleteGroup(layout, 'nope'), RepositoryGroupsError)
  })

  it('round-trips through the file and drops malformed parts', () => {
    const layout = setHidden(assignRepository(empty, '/a', 'G'), '/b', true)
    assert.deepStrictEqual(
      parseRepositoryGroups(serializeRepositoryGroups(layout)),
      layout
    )
    assert.deepStrictEqual(parseRepositoryGroups('not json'), empty)
    assert.deepStrictEqual(
      parseRepositoryGroups(
        '{"groups":[{"name":"G"},{"name":"g"},{"x":1}],"hidden":[3]}'
      ),
      { ...empty, groups: [{ name: 'G', repositories: [] }] }
    )
  })
})

describe('arrangeRepositories', () => {
  const owned = (id: number, name: string) =>
    new Repository(
      `/src/${name}`,
      id,
      gitHubRepoFixture({ owner: 'octo', name }),
      false
    )
  const repositories = [
    owned(1, 'app'),
    owned(2, 'site'),
    new Repository('/src/notes', 3, null, false),
    owned(4, 'old'),
  ]
  const arrange = (layout = empty, filtering = false) =>
    arrangeRepositories(repositories, new Map(), [], layout, filtering).map(
      s => [
        s.identifier.label,
        s.identifier.collapsed,
        s.items.map(i => i.repository.path),
      ]
    )

  it('keeps upstream grouping without a layout', () => {
    assert.deepStrictEqual(arrange(), [
      ['octo', false, ['/src/app', '/src/old', '/src/site']],
      ['Other', false, ['/src/notes']],
    ])
  })

  it('puts groups first, hidden last, and leaves the rest by owner', () => {
    let layout = assignRepository(empty, '/src/site', 'Clients')
    layout = assignRepository(layout, '/src/notes', 'Clients')
    layout = createGroup(layout, 'Empty')
    layout = setHidden(layout, '/src/old', true)
    assert.deepStrictEqual(arrange(layout), [
      ['Clients', false, ['/src/notes', '/src/site']],
      ['Empty', false, []],
      ['octo', false, ['/src/app']],
      ['Hidden', true, []],
    ])
  })

  it('shows collapsed sections while filtering', () => {
    const layout = setHidden(empty, '/src/old', true)
    assert.deepStrictEqual(arrange(layout, true).at(-1), [
      'Hidden',
      false,
      ['/src/old'],
    ])
  })
})
