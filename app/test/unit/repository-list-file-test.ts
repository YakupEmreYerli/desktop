import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  IRepositoryListEntry,
  findRepositoryListEntry,
  formatRepositoryList,
  toRepositoryListEntries,
} from '../../src/lib/repository-list-file'
import { Repository } from '../../src/models/repository'
import { CloningRepository } from '../../src/models/cloning-repository'
import { gitHubRepoFixture } from '../helpers/github-repo-builder'

const entry = (path: string, name = path.split('/').at(-1)!) =>
  ({ name, path, gitHub: null, url: null, missing: false } as const)

describe('toRepositoryListEntries', () => {
  it('lists repositories by name, skipping clones in progress', () => {
    const gitHubRepository = gitHubRepoFixture({
      owner: 'octo',
      name: 'zeta',
    })
    const entries = toRepositoryListEntries([
      new Repository('/src/zeta', 1, gitHubRepository, false),
      new Repository('/src/Alpha', 2, null, true, 'alias'),
      new CloningRepository('/src/cloning', 'https://github.com/o/r'),
    ])

    assert.deepStrictEqual(
      entries.map(e => [e.name, e.path, e.gitHub, e.missing]),
      [
        ['alias', '/src/Alpha', null, true],
        ['zeta', '/src/zeta', 'octo/zeta', false],
      ]
    )
  })
})

describe('findRepositoryListEntry', () => {
  const entries: ReadonlyArray<IRepositoryListEntry> = [
    entry('/src/app'),
    entry('/src/app/vendor/lib'),
    entry('/src/application'),
  ]

  it('matches the path itself, ignoring a trailing slash', () => {
    assert.equal(
      findRepositoryListEntry(entries, '/src/app/')?.path,
      '/src/app'
    )
  })

  it('matches the deepest repository containing the path', () => {
    assert.equal(
      findRepositoryListEntry(entries, '/src/app/vendor/lib/x')?.path,
      '/src/app/vendor/lib'
    )
    assert.equal(
      findRepositoryListEntry(entries, '/src/app/docs')?.path,
      '/src/app'
    )
  })

  it("doesn't match a sibling sharing a prefix", () => {
    assert.equal(findRepositoryListEntry(entries, '/src/ap'), undefined)
    assert.equal(
      findRepositoryListEntry(entries, '/src/application/x')?.path,
      '/src/application'
    )
  })
})

describe('formatRepositoryList', () => {
  it('aligns columns and marks missing repositories', () => {
    assert.equal(
      formatRepositoryList([
        { ...entry('/a/desktop'), gitHub: 'o/desktop' },
        { ...entry('/b/x'), missing: true },
      ]),
      'desktop  /a/desktop  o/desktop\n' + 'x        /b/x        (missing)\n'
    )
  })
})
