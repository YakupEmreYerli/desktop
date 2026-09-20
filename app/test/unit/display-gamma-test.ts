import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  compensateChannelForDisplayGamma,
  displayGammaOfChannel,
} from '../../src/lib/display-gamma'

describe('display gamma compensation', () => {
  it('reproduces what the screen does to a colour', () => {
    // #05182f is drawn as #0d1e33, measured on KDE Plasma 6 on Wayland
    assert.deepStrictEqual([5, 24, 47].map(displayGammaOfChannel), [13, 30, 51])
  })

  it('gives the value that lands on screen as the one asked for', () => {
    const asked = [5, 24, 47, 149, 172, 210]
    const landed = asked
      .map(compensateChannelForDisplayGamma)
      .map(displayGammaOfChannel)

    // Near black there aren't enough steps left to hit every value, so a
    // channel can land one off; everywhere else it's exact.
    landed.forEach((value, i) =>
      assert.ok(
        Math.abs(value - asked[i]) <= 1,
        `${asked[i]} landed as ${value}`
      )
    )
  })

  it('leaves black and white where they are', () => {
    assert.equal(compensateChannelForDisplayGamma(0), 0)
    assert.equal(compensateChannelForDisplayGamma(255), 255)
  })

  it('stays inside the range', () => {
    assert.equal(compensateChannelForDisplayGamma(-10), 0)
    assert.equal(compensateChannelForDisplayGamma(300), 255)
  })
})
