import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getRemoteWebUrl } from '../../src/lib/remote-web-url'

describe('getRemoteWebUrl', () => {
  it('strips .git from https remotes', () => {
    assert.equal(
      getRemoteWebUrl('https://git.example.com/owner/repo.git'),
      'https://git.example.com/owner/repo'
    )
  })

  it('drops credentials', () => {
    assert.equal(
      getRemoteWebUrl('https://user:secret@git.example.com/owner/repo.git'),
      'https://git.example.com/owner/repo'
    )
  })

  it('keeps a port on http remotes', () => {
    assert.equal(
      getRemoteWebUrl('http://localhost:3000/owner/repo'),
      'http://localhost:3000/owner/repo'
    )
  })

  it('converts scp-like ssh remotes', () => {
    assert.equal(
      getRemoteWebUrl('git@gitlab.com:group/sub/repo.git'),
      'https://gitlab.com/group/sub/repo'
    )
  })

  it('converts ssh:// remotes and drops the ssh port', () => {
    assert.equal(
      getRemoteWebUrl('ssh://git@codeberg.org:2222/owner/repo.git'),
      'https://codeberg.org/owner/repo'
    )
  })

  it('returns null for local paths and empty paths', () => {
    assert.equal(getRemoteWebUrl('/home/me/repo.git'), null)
    assert.equal(getRemoteWebUrl('file:///home/me/repo.git'), null)
    assert.equal(getRemoteWebUrl('https://example.com/'), null)
  })
})
