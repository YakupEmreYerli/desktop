import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  DiffHunk,
  DiffHunkExpansionType,
  DiffHunkHeader,
  DiffLine,
  DiffLineType,
} from '../../src/models/diff'
import {
  getDocumentBlocks,
  isMostlyTurkish,
  isTranslatableDocument,
  parseTranslationReply,
  splitIntoBlocks,
} from '../../src/lib/ai/translate'

/**
 * A hunk from `[type, oldLine, newLine]` triples; context lines have both
 * numbers, additions only the new one, deletions only the old one.
 */
function hunk(
  newStart: number,
  lines: ReadonlyArray<[DiffLineType, number | null, number | null]>
) {
  return new DiffHunk(
    new DiffHunkHeader(newStart, 0, newStart, 0),
    lines.map(([type, oldLine, newLine], i) => {
      return new DiffLine('', type, i, oldLine, newLine)
    }),
    0,
    0,
    DiffHunkExpansionType.None
  )
}

describe('isTranslatableDocument', () => {
  it('accepts text documents only', () => {
    assert(isTranslatableDocument('README.md'))
    assert(isTranslatableDocument('docs/NOTES.TXT'))
    assert(isTranslatableDocument('guide.rst'))
    assert(!isTranslatableDocument('index.html'))
    assert(!isTranslatableDocument('main.ts'))
  })
})

describe('splitIntoBlocks', () => {
  it('splits on blank lines and keeps fenced code whole', () => {
    const blocks = splitIntoBlocks([
      '# Title',
      '',
      'First line',
      'second line',
      '',
      '```sh',
      'echo one',
      '',
      'echo two',
      '```',
      'After',
    ])

    assert.deepStrictEqual(
      blocks.map(b => [b.start, b.end, b.isCode]),
      [
        [1, 1, false],
        [3, 4, false],
        [6, 10, true],
        [11, 11, false],
      ]
    )
    assert.equal(blocks[1].source, 'First line\nsecond line')
    assert.equal(blocks[2].source, '```sh\necho one\n\necho two\n```')
  })
})

describe('getDocumentBlocks', () => {
  const lines = ['# Title', '', 'Intro', '', 'Changed', 'text', '', 'End']

  it('marks blocks that contain added lines', () => {
    const blocks = getDocumentBlocks(lines, [
      hunk(4, [
        [DiffLineType.Context, 4, 4],
        [DiffLineType.Delete, 5, null],
        [DiffLineType.Add, null, 5],
        [DiffLineType.Context, 6, 6],
      ]),
    ])

    assert.deepStrictEqual(
      blocks.map(b => b.changed),
      [false, false, true, false]
    )
  })

  it('counts removed lines after the block they followed', () => {
    const blocks = getDocumentBlocks(lines, [
      hunk(3, [
        [DiffLineType.Context, 3, 3],
        [DiffLineType.Delete, 4, null],
        [DiffLineType.Delete, 5, null],
        [DiffLineType.Context, 6, 4],
      ]),
    ])

    assert.deepStrictEqual(
      blocks.map(b => b.removedAfter),
      [0, 2, 0, 0]
    )
  })

  it('keeps removals at the top of the file', () => {
    const blocks = getDocumentBlocks(lines, [
      hunk(1, [
        [DiffLineType.Delete, 1, null],
        [DiffLineType.Context, 2, 1],
      ]),
    ])

    assert.equal(blocks[0].source, '')
    assert.equal(blocks[0].removedAfter, 1)
    assert.equal(blocks.length, 5)
  })

  it('marks nothing without hunks', () => {
    const blocks = getDocumentBlocks(lines, null)
    assert(blocks.every(b => !b.changed && b.removedAfter === 0))
  })
})

describe('parseTranslationReply', () => {
  it('reads the blocks, also inside code fences', () => {
    assert.deepStrictEqual(
      parseTranslationReply('```json\n{"blocks": ["bir", "iki"]}\n```', 2),
      ['bir', 'iki']
    )
  })

  it('rejects a reply with the wrong number of blocks', () => {
    assert.throws(
      () => parseTranslationReply('{"blocks": ["bir"]}', 2),
      /unexpected shape/
    )
    assert.throws(() => parseTranslationReply('not json', 1))
  })
})

describe('isMostlyTurkish', () => {
  it('recognises Turkish documents with English terms and code', () => {
    assert(
      isMostlyTurkish([
        "Yakup'un kendi artifact sistemi. Claude'un `Artifact` aracının yerini tutar.",
        '',
        '- **Dil Türkçe.** Değişken, fonksiyon, dosya, commit mesajı, çıktı.',
        '',
        '```sh',
        'echo the quick brown fox and the lazy dog',
        '```',
      ])
    )
  })

  it('leaves English documents to translate', () => {
    assert(
      !isMostlyTurkish([
        '# Security',
        '',
        'Please do not open a public issue for a security problem. Use the',
        'private vulnerability reporting on this repository instead.',
      ])
    )
  })

  it('treats a document without words as not Turkish', () => {
    assert(!isMostlyTurkish(['```', 'x = 1', '```']))
  })
})
