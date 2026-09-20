/**
 * Run an asynchronous operation over every item in an array while keeping at
 * most `maxConcurrency` operations in flight at a time.
 *
 * Items are handed out in order but may finish in any order. The returned
 * promise resolves once every item has been processed; if `fn` rejects for an
 * item the returned promise rejects with that error and no further items are
 * started.
 */
export async function forEachParallel<T>(
  items: ReadonlyArray<T>,
  maxConcurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (maxConcurrency < 1) {
    throw new Error('maxConcurrency must be at least 1')
  }

  let next = 0

  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }

  const workerCount = Math.min(maxConcurrency, items.length)
  const workers = new Array<Promise<void>>(workerCount)

  for (let i = 0; i < workerCount; i++) {
    workers[i] = worker()
  }

  await Promise.all(workers)
}
