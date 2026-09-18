import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  fitToLineCount,
  isMostlyTurkish,
  isTranslatableDocument,
  parseTranslationReply,
  splitIntoBlocks,
} from '../../src/lib/ai/translate'

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

describe('fitToLineCount', () => {
  it('keeps a translation with the right number of lines', () => {
    assert.deepStrictEqual(fitToLineCount('bir\niki', 2), ['bir', 'iki'])
  })

  it('joins extra lines onto the last one', () => {
    assert.deepStrictEqual(fitToLineCount('bir\niki\nüç', 2), ['bir', 'iki üç'])
  })

  it('pads missing lines', () => {
    assert.deepStrictEqual(fitToLineCount('bir', 3), ['bir', '', ''])
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
