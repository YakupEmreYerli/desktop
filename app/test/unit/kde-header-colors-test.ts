import { describe, it, TestContext } from 'node:test'
import assert from 'node:assert'
import { writeFile } from 'fs/promises'
import * as Path from 'path'
import { getKDEHeaderColors } from '../../src/main-process/kde-header-colors'
import { createTempDirectory } from '../helpers/temp'

/**
 * Point the app at a colour scheme of our own for the duration of a test,
 * without a kdeglobals file when there are no contents.
 */
async function setupColorScheme(
  t: TestContext,
  desktop: string,
  contents?: string
) {
  const directory = await createTempDirectory(t)
  const previous = {
    desktop: process.env.XDG_CURRENT_DESKTOP,
    configHome: process.env.XDG_CONFIG_HOME,
  }

  t.after(() => {
    process.env.XDG_CURRENT_DESKTOP = previous.desktop
    process.env.XDG_CONFIG_HOME = previous.configHome
  })

  process.env.XDG_CURRENT_DESKTOP = desktop
  process.env.XDG_CONFIG_HOME = directory

  if (contents !== undefined) {
    await writeFile(Path.join(directory, 'kdeglobals'), contents, 'utf8')
  }
}

describe('getKDEHeaderColors', () => {
  it('reads the header colours written as hex', async t => {
    await setupColorScheme(
      t,
      'KDE',
      [
        '[Colors:Header]',
        'BackgroundNormal=#05182f',
        'ForegroundNormal=#95acd2',
        '',
        '[Colors:Header][Inactive]',
        'BackgroundNormal=#111111',
        'ForegroundNormal=#222222',
      ].join('\n')
    )

    assert.deepStrictEqual(await getKDEHeaderColors(), {
      background: '#05182f',
      foreground: '#95acd2',
    })
  })

  it('reads the header colours written as components', async t => {
    await setupColorScheme(
      t,
      'KDE',
      [
        '# A comment',
        '[Colors:Header]',
        'BackgroundNormal=35,38,41',
        'ForegroundNormal=252,252,252,128',
      ].join('\n')
    )

    assert.deepStrictEqual(await getKDEHeaderColors(), {
      background: 'rgb(35, 38, 41)',
      foreground: 'rgba(252, 252, 252, 0.502)',
    })
  })

  it('falls back to the window colours without a header group', async t => {
    await setupColorScheme(
      t,
      'KDE',
      [
        '[Colors:Window]',
        'BackgroundNormal=35,38,41',
        'ForegroundNormal=252,252,252',
      ].join('\n')
    )

    assert.deepStrictEqual(await getKDEHeaderColors(), {
      background: 'rgb(35, 38, 41)',
      foreground: 'rgb(252, 252, 252)',
    })
  })

  it('finds KDE in a list of desktops', async t => {
    await setupColorScheme(
      t,
      'KDE:X-Cinnamon',
      [
        '[Colors:Header]',
        'BackgroundNormal=#05182f',
        'ForegroundNormal=#95acd2',
      ].join('\n')
    )

    assert.notEqual(await getKDEHeaderColors(), null)
  })

  it('returns null when the colours make no sense', async t => {
    await setupColorScheme(
      t,
      'KDE',
      ['[Colors:Header]', 'BackgroundNormal=lilac'].join('\n')
    )

    assert.equal(await getKDEHeaderColors(), null)
  })

  it('returns null when there is no colour scheme file', async t => {
    await setupColorScheme(t, 'KDE')

    assert.equal(await getKDEHeaderColors(), null)
  })

  it('returns null outside a KDE session', async t => {
    await setupColorScheme(
      t,
      'GNOME',
      [
        '[Colors:Header]',
        'BackgroundNormal=#05182f',
        'ForegroundNormal=#95acd2',
      ].join('\n')
    )

    assert.equal(await getKDEHeaderColors(), null)
  })
})
