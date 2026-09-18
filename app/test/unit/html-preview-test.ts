import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as Path from 'path'
import { mkdir, symlink, writeFile } from 'fs/promises'

import { buildHtmlPreview, isHtmlPath } from '../../src/lib/html'
import { createTempDirectory } from '../helpers/temp'

const dataUri = (mediaType: string, contents: string) =>
  `data:${mediaType};base64,${Buffer.from(contents).toString('base64')}`

describe('isHtmlPath', () => {
  it('matches .html and .htm in any case', () => {
    assert(isHtmlPath('site/index.html'))
    assert(isHtmlPath('PAGE.HTM'))
    assert(!isHtmlPath('notes.md'))
    assert(!isHtmlPath('html'))
  })
})

describe('buildHtmlPreview', () => {
  it('inlines local stylesheets, scripts and images', async t => {
    const root = await createTempDirectory(t)
    await mkdir(Path.join(root, 'site', 'css'), { recursive: true })
    await writeFile(
      Path.join(root, 'site', 'css', 'main.css'),
      'body { background: url("../bg.png") }'
    )
    await writeFile(Path.join(root, 'site', 'bg.png'), 'png')
    await writeFile(Path.join(root, 'site', 'app.js'), 'window.ok = 1')
    await writeFile(Path.join(root, 'logo.svg'), '<svg/>')

    const html = await buildHtmlPreview(
      `<!DOCTYPE html><html><head>
        <link rel="stylesheet" href="css/main.css">
        <script src="app.js"></script>
      </head><body>
        <img src="/logo.svg">
        <img src="https://example.com/remote.png">
      </body></html>`,
      Path.join(root, 'site', 'index.html'),
      root
    )

    assert(html.startsWith('<!DOCTYPE html>'))
    assert(html.includes(`url("${dataUri('image/png', 'png')}")`))
    assert(!html.includes('<link'))
    assert(
      html.includes(`src="${dataUri('text/javascript', 'window.ok = 1')}"`)
    )
    assert(html.includes(`src="${dataUri('image/svg+xml', '<svg/>')}"`))
    assert(html.includes('src="https://example.com/remote.png"'))
    assert(html.includes('<base target="_blank">'))
  })

  it('leaves missing files as they are', async t => {
    const root = await createTempDirectory(t)
    const html = await buildHtmlPreview(
      '<img src="missing.png">',
      Path.join(root, 'index.html'),
      root
    )
    assert(html.includes('src="missing.png"'))
  })

  it('does not read files outside the repository', async t => {
    const outside = await createTempDirectory(t)
    const root = Path.join(outside, 'repo')
    await mkdir(root)
    await writeFile(Path.join(outside, 'secret.txt'), 'secret')
    await symlink(Path.join(outside, 'secret.txt'), Path.join(root, 'link.txt'))

    const html = await buildHtmlPreview(
      '<img src="../secret.txt"><img src="link.txt">',
      Path.join(root, 'index.html'),
      root
    )

    assert(!html.includes(Buffer.from('secret').toString('base64')))
    assert(html.includes('src="../secret.txt"'))
    assert(html.includes('src="link.txt"'))
  })
})
