import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { writeFile, rm } from 'fs/promises'
import { exec } from 'dugite'

import { Repository } from '../../../src/models/repository'
import {
  AppFileStatusKind,
  CommittedFileChange,
} from '../../../src/models/status'
import { DiffType, IImageDiff } from '../../../src/models/diff'
import {
  getCommitDiff,
  getWorkingDirectoryDiff,
  getBlobImage,
} from '../../../src/lib/git'
import { isPdfPath, PdfMediaType } from '../../../src/lib/pdf'
import { setupEmptyRepository } from '../../helpers/repositories'
import { getStatusOrThrow } from '../../helpers/status'

/**
 * Build a minimal PDF with one page per entry in `pages`, each showing its
 * text. With `binary` a comment containing a NUL byte is added so Git
 * treats the file as binary, otherwise the file is plain ASCII.
 */
function makePdf(pages: ReadonlyArray<string>, binary = false): Buffer {
  const objects = new Array<string>()
  const pageIds = pages.map((_, i) => 3 + i * 2)
  const fontId = 3 + pages.length * 2

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds
    .map(id => `${id} 0 R`)
    .join(' ')}] /Count ${pages.length} >>`
  pages.forEach((text, i) => {
    const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> ` +
      `/Contents ${pageIds[i] + 1} 0 R >>`
    objects[
      pageIds[i] + 1
    ] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  let pdf = binary ? '%PDF-1.4\n%\0\n' : '%PDF-1.4\n'
  const offsets = new Array<number>()
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }

  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`
  pdf += `startxref\n${xref}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

async function getOnlyFileDiff(repo: Repository): Promise<IImageDiff> {
  const status = await getStatusOrThrow(repo)
  const files = status.workingDirectory.files
  assert.equal(files.length, 1)

  const diff = await getWorkingDirectoryDiff(repo, files[0])
  assert.equal(diff.kind, DiffType.Image)
  return diff as IImageDiff
}

async function commitAll(repo: Repository, message: string) {
  await exec(['add', '-A'], repo.path)
  await exec(['commit', '-m', message], repo.path)
}

describe('PDF diffs', () => {
  it('recognizes PDF paths regardless of case', () => {
    assert(isPdfPath('docs/report.pdf'))
    assert(isPdfPath('REPORT.PDF'))
    assert(!isPdfPath('report.pdf.txt'))
    assert(!isPdfPath('pdf'))
  })

  it('previews a new PDF that Git considers text', async t => {
    const repo = await setupEmptyRepository(t)
    await writeFile(path.join(repo.path, 'new.pdf'), makePdf(['Hello']))

    const diff = await getOnlyFileDiff(repo)

    assert.equal(diff.previous, undefined)
    assert(diff.current !== undefined)
    assert.equal(diff.current.mediaType, PdfMediaType)
    assert(
      Buffer.from(diff.current.contents, 'base64')
        .toString('latin1')
        .startsWith('%PDF-1.4')
    )
  })

  it('previews both versions of a modified binary PDF', async t => {
    const repo = await setupEmptyRepository(t)
    const file = path.join(repo.path, 'doc.pdf')
    await writeFile(file, makePdf(['One'], true))
    await commitAll(repo, 'Add PDF')
    await writeFile(file, makePdf(['One', 'Two'], true))

    const diff = await getOnlyFileDiff(repo)

    assert(diff.previous !== undefined)
    assert(diff.current !== undefined)
    assert.equal(diff.previous.mediaType, PdfMediaType)
    assert.equal(diff.current.mediaType, PdfMediaType)
    assert(diff.current.bytes > diff.previous.bytes)
  })

  it('previews a deleted PDF', async t => {
    const repo = await setupEmptyRepository(t)
    const file = path.join(repo.path, 'Old.PDF')
    await writeFile(file, makePdf(['Gone']))
    await commitAll(repo, 'Add PDF')
    await rm(file)

    const diff = await getOnlyFileDiff(repo)

    assert.equal(diff.current, undefined)
    assert(diff.previous !== undefined)
    assert.equal(diff.previous.mediaType, PdfMediaType)
  })

  it('previews a PDF changed in a commit', async t => {
    const repo = await setupEmptyRepository(t)
    const file = path.join(repo.path, 'doc.pdf')
    await writeFile(file, makePdf(['One']))
    await commitAll(repo, 'Add PDF')
    await writeFile(file, makePdf(['One', 'Two']))
    await commitAll(repo, 'Change PDF')

    const sha = (await exec(['rev-parse', 'HEAD'], repo.path)).stdout.trim()
    const change = new CommittedFileChange(
      'doc.pdf',
      { kind: AppFileStatusKind.Modified },
      sha,
      `${sha}^`
    )
    const diff = await getCommitDiff(repo, change, sha)

    assert.equal(diff.kind, DiffType.Image)
    const { previous, current } = diff as IImageDiff
    assert.equal(previous?.mediaType, PdfMediaType)
    assert.equal(current?.mediaType, PdfMediaType)
  })

  it('tags PDF blobs with the PDF media type', async t => {
    const repo = await setupEmptyRepository(t)
    await writeFile(path.join(repo.path, 'a.pdf'), makePdf(['A']))
    await commitAll(repo, 'Add PDF')

    const image = await getBlobImage(repo, 'a.pdf', 'HEAD')
    assert.equal(image.mediaType, PdfMediaType)
  })
})
