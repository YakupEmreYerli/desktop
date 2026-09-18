import { createHash } from 'crypto'
import * as Path from 'path'
import { DiffHunk, DiffLineType } from '../../models/diff'
import { AIProviderError, completeWithAI } from './providers'

/** Whether the given path is a text document that can be translated */
export function isTranslatableDocument(path: string) {
  const extension = Path.extname(path).toLowerCase()
  return (
    extension === '.md' ||
    extension === '.markdown' ||
    extension === '.mdx' ||
    extension === '.txt' ||
    extension === '.rst'
  )
}

const TurkishWords = new Set([
  've',
  'bir',
  'bu',
  'için',
  'ile',
  'da',
  'de',
  'değil',
  'olarak',
  'gibi',
  'daha',
  'ama',
  'çok',
  'ya',
  'ne',
  'her',
  'önce',
  'sonra',
  'yalnız',
  'sadece',
  'olan',
  'var',
  'yok',
  'kadar',
  'ise',
  'veya',
  'şu',
  'göre',
  'nasıl',
  'neden',
  'hem',
  'en',
  'mı',
  'mi',
  'değildir',
  'eder',
  'olur',
])

const EnglishWords = new Set([
  'the',
  'and',
  'is',
  'of',
  'to',
  'in',
  'for',
  'with',
  'that',
  'this',
  'are',
  'be',
  'on',
  'not',
  'you',
  'it',
  'as',
  'or',
  'by',
  'from',
  'can',
  'if',
  'an',
  'when',
  'will',
  'your',
  'have',
  'has',
  'was',
  'which',
  'use',
])

/** Letters that only Turkish text uses among the two languages */
const TurkishLetters = /[ğĞşŞıİ]/g

/**
 * Whether a document is written mostly in Turkish, so translating it would
 * be pointless. Code, inline code and URLs are ignored; a guess from common
 * words and letters that only Turkish uses.
 */
export function isMostlyTurkish(lines: ReadonlyArray<string>): boolean {
  const prose = splitIntoBlocks(lines)
    .filter(b => !b.isCode)
    .map(b => b.source)
    .join('\n')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\bhttps?:\/\/\S+/g, ' ')

  let turkish = (prose.match(TurkishLetters) ?? []).length
  let english = 0
  for (const word of prose.toLocaleLowerCase('tr').split(/[^\p{L}]+/u)) {
    if (TurkishWords.has(word)) {
      turkish += 2
    } else if (EnglishWords.has(word)) {
      english += 2
    }
  }

  return turkish > 0 && turkish >= english
}

/** A paragraph-sized piece of a document */
export interface IDocumentBlock {
  /** The block's source text */
  readonly source: string
  /** Fenced code is shown as is, never translated */
  readonly isCode: boolean
  /** 1-based line numbers of the block's first and last line */
  readonly startLine: number
  readonly endLine: number
  /** Whether lines in this block were added or changed */
  readonly changed: boolean
  /** How many lines were removed right after this block */
  readonly removedAfter: number
}

const FencePattern = /^\s{0,3}(```|~~~)/

/**
 * Split a document into blocks separated by blank lines. Fenced code blocks
 * stay whole even when they contain blank lines.
 */
export function splitIntoBlocks(lines: ReadonlyArray<string>): ReadonlyArray<{
  source: string
  isCode: boolean
  start: number
  end: number
}> {
  const blocks = new Array<{
    source: string
    isCode: boolean
    start: number
    end: number
  }>()
  let current = new Array<string>()
  let start = 0
  let fence: string | null = null

  const flush = (end: number, isCode: boolean) => {
    if (current.length > 0) {
      blocks.push({ source: current.join('\n'), isCode, start, end })
      current = []
    }
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const fenceMatch = FencePattern.exec(line)

    if (fence !== null) {
      current.push(line)
      if (fenceMatch !== null && fenceMatch[1] === fence) {
        flush(lineNumber, true)
        fence = null
      }
      return
    }

    if (fenceMatch !== null) {
      flush(lineNumber - 1, false)
      fence = fenceMatch[1]
      start = lineNumber
      current.push(line)
      return
    }

    if (line.trim() === '') {
      flush(lineNumber - 1, false)
      return
    }

    if (current.length === 0) {
      start = lineNumber
    }
    current.push(line)
  })

  flush(lines.length, fence !== null)
  return blocks
}

/**
 * Split a document into blocks and mark the ones the diff changed.
 *
 * @param lines     The document to show, one entry per line.
 * @param hunks     The diff's hunks, or null to mark nothing (new or deleted
 *                  files, where everything changed).
 */
export function getDocumentBlocks(
  lines: ReadonlyArray<string>,
  hunks: ReadonlyArray<DiffHunk> | null
): ReadonlyArray<IDocumentBlock> {
  const added = new Set<number>()
  /** Removed line counts, keyed by the new line they follow (0 = top) */
  const removed = new Map<number, number>()

  for (const hunk of hunks ?? []) {
    let lastNewLine = hunk.header.newStartLine - 1
    for (const line of hunk.lines) {
      if (line.type === DiffLineType.Add && line.newLineNumber !== null) {
        added.add(line.newLineNumber)
      } else if (line.type === DiffLineType.Delete) {
        removed.set(lastNewLine, (removed.get(lastNewLine) ?? 0) + 1)
      }
      if (line.newLineNumber !== null) {
        lastNewLine = line.newLineNumber
      }
    }
  }

  const raw = splitIntoBlocks(lines)
  const removedAfter = new Array<number>(raw.length).fill(0)
  let removedAtTop = 0

  for (const [afterLine, count] of removed) {
    // The last block that starts at or before the removal point
    let index = -1
    for (let i = 0; i < raw.length && raw[i].start <= afterLine; i++) {
      index = i
    }
    if (index === -1) {
      removedAtTop += count
    } else {
      removedAfter[index] += count
    }
  }

  const blocks = raw.map((block, i) => {
    let changed = false
    for (let line = block.start; line <= block.end && !changed; line++) {
      changed = added.has(line)
    }
    return {
      source: block.source,
      isCode: block.isCode,
      startLine: block.start,
      endLine: block.end,
      changed,
      removedAfter: removedAfter[i],
    }
  })

  if (removedAtTop > 0) {
    // Lines removed before the first block: attach them to an empty block
    return [
      {
        source: '',
        isCode: false,
        startLine: 0,
        endLine: 0,
        changed: false,
        removedAfter: removedAtTop,
      },
      ...blocks,
    ]
  }

  return blocks
}

const CacheStorageKey = 'ai-translation-cache'
const MaxCacheEntries = 3000

let cache: Map<string, string> | null = null
let saveTimer: number | null = null

function getCache() {
  if (cache === null) {
    cache = new Map()
    try {
      const stored = JSON.parse(localStorage.getItem(CacheStorageKey) ?? '{}')
      for (const [key, value] of Object.entries(stored)) {
        if (typeof value === 'string') {
          cache.set(key, value)
        }
      }
    } catch {
      // Start over with an empty cache
    }
  }
  return cache
}

function scheduleCacheSave() {
  if (saveTimer !== null) {
    return
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    const entries = [...getCache()].slice(-MaxCacheEntries)
    cache = new Map(entries)
    try {
      localStorage.setItem(
        CacheStorageKey,
        JSON.stringify(Object.fromEntries(entries))
      )
    } catch (e) {
      log.warn('Unable to save the translation cache', e)
    }
  }, 1000)
}

function cacheKey(source: string) {
  return createHash('sha1').update(`tr\0${source}`).digest('hex')
}

/** The cached Turkish translation of a block, if there is one */
export function getCachedTranslation(source: string): string | undefined {
  return getCache().get(cacheKey(source))
}

function setCachedTranslation(source: string, translation: string) {
  const store = getCache()
  const key = cacheKey(source)
  // Re-insert so recently used entries are kept when the cache is trimmed
  store.delete(key)
  store.set(key, translation)
  scheduleCacheSave()
}

/** Blocks are sent together until a request reaches about this many chars */
const MaxBatchLength = 8000

/** How many requests run at the same time */
const MaxParallelRequests = 3

const TranslationInstructions = `You translate documents into Turkish.

You receive a JSON object {"blocks": [...]} where every string is one block of a Markdown or plain text document. Reply with a JSON object {"blocks": [...]} that has exactly as many strings, each the Turkish translation of the block at the same position.

Rules:
- Keep Markdown syntax (headings, lists, emphasis, tables, links) as it is; translate only the human language.
- Never translate or change URLs, inline code, file names, paths, commands, environment variables, identifiers, API names or product names.
- Keep the line breaks inside a block.
- Write natural, fluent Turkish that a developer would write; keep established English technical terms where Turkish developers use them.
- A block that is already Turkish or has nothing to translate comes back unchanged.
- Reply with the JSON object only, no commentary and no code fences.`

/** Split sources into request-sized batches */
function toBatches(sources: ReadonlyArray<string>) {
  const batches = new Array<Array<string>>()
  let current = new Array<string>()
  let length = 0

  for (const source of sources) {
    if (current.length > 0 && length + source.length > MaxBatchLength) {
      batches.push(current)
      current = []
      length = 0
    }
    current.push(source)
    length += source.length
  }
  if (current.length > 0) {
    batches.push(current)
  }
  return batches
}

/** Read the blocks array out of a model's answer */
export function parseTranslationReply(
  reply: string,
  expected: number
): ReadonlyArray<string> {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  let parsed: unknown = null
  if (start !== -1 && end > start) {
    try {
      parsed = JSON.parse(reply.slice(start, end + 1))
    } catch {
      parsed = null
    }
  }

  const blocks =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { blocks?: unknown }).blocks
      : undefined

  if (
    !Array.isArray(blocks) ||
    blocks.length !== expected ||
    !blocks.every(b => typeof b === 'string')
  ) {
    throw new AIProviderError(
      'The translation came back in an unexpected shape. Try again, or pick another model.'
    )
  }
  return blocks
}

async function translateBatch(
  sources: ReadonlyArray<string>,
  signal: AbortSignal | undefined
) {
  const reply = await completeWithAI({
    system: TranslationInstructions,
    prompt: JSON.stringify({ blocks: sources }),
    json: true,
    signal,
  })
  const translations = parseTranslationReply(reply, sources.length)
  sources.forEach((source, i) => setCachedTranslation(source, translations[i]))
}

/**
 * Translate the text blocks that aren't cached yet. Each finished request
 * fills the cache and calls `onProgress` with the number of finished and
 * total requests.
 *
 * @param force  Translate every block again, ignoring the cache.
 */
export async function translateBlocks(
  blocks: ReadonlyArray<IDocumentBlock>,
  options: {
    readonly force?: boolean
    readonly signal?: AbortSignal
    readonly onProgress?: (done: number, total: number) => void
  } = {}
): Promise<void> {
  const pending = [
    ...new Set(
      blocks
        .filter(b => !b.isCode && b.source.trim() !== '')
        .map(b => b.source)
        .filter(s => options.force || getCachedTranslation(s) === undefined)
    ),
  ]

  const batches = toBatches(pending)
  let done = 0
  options.onProgress?.(done, batches.length)

  let next = 0
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++]
      await translateBatch(batch, options.signal)
      done++
      options.onProgress?.(done, batches.length)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MaxParallelRequests, batches.length) },
      worker
    )
  )
}
