import { describe, it } from 'node:test'
import assert from 'node:assert'
import { forEachParallel } from '../../src/lib/for-each-parallel'

describe('forEachParallel', () => {
  it('processes every item', async () => {
    const seen = new Array<number>()

    await forEachParallel([1, 2, 3, 4, 5], 2, async item => {
      seen.push(item)
    })

    assert.deepStrictEqual(seen.sort(), [1, 2, 3, 4, 5])
  })

  it('never runs more than maxConcurrency operations at a time', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    let inFlight = 0
    let maxInFlight = 0

    await forEachParallel(items, 3, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 1))
      inFlight--
    })

    assert.equal(maxInFlight, 3)
  })

  it('runs items in parallel rather than one after the other', async () => {
    const items = [1, 2, 3, 4]
    let concurrent = 0
    let sawConcurrency = false

    await forEachParallel(items, 4, async () => {
      concurrent++
      await new Promise(resolve => setTimeout(resolve, 5))
      sawConcurrency = sawConcurrency || concurrent > 1
      concurrent--
    })

    assert.equal(sawConcurrency, true)
  })

  it('does nothing when there are no items', async () => {
    await forEachParallel([], 4, async () => {
      assert.fail('should not have been called')
    })
  })

  it('rejects when an operation rejects', async () => {
    await assert.rejects(
      forEachParallel([1, 2, 3], 2, async item => {
        if (item === 2) {
          throw new Error('boom')
        }
      }),
      /boom/
    )
  })

  it('rejects an invalid concurrency', async () => {
    await assert.rejects(
      forEachParallel([1], 0, async () => {}),
      /maxConcurrency/
    )
  })
})
