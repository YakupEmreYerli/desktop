import * as path from 'path'
import { readdirSync, readFileSync } from 'fs'
import webpack from 'webpack'

/**
 * The pdf.js runtime files (worker script, character maps, standard fonts
 * and image decoders) are loaded from disk at runtime rather than bundled,
 * see `app/src/ui/diff/pdf-diffs/pdf-loader.ts`.
 */
const pdfjsRoot = path.dirname(
  require.resolve('pdfjs-dist/package.json', { paths: [__dirname] })
)

/** Source path inside the pdfjs-dist package mapped to its output path. */
const runtimeFiles: ReadonlyArray<[string, string]> = [
  ['build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ...['cmaps', 'standard_fonts', 'wasm'].flatMap(dir =>
    readdirSync(path.join(pdfjsRoot, dir)).map((f): [string, string] => [
      `${dir}/${f}`,
      `${dir}/${f}`,
    ])
  ),
]

/** Emits the pdf.js runtime files into the `pdfjs` output directory. */
export class PdfjsRuntimePlugin {
  public apply(compiler: webpack.Compiler) {
    compiler.hooks.thisCompilation.tap('PdfjsRuntimePlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'PdfjsRuntimePlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          for (const [source, output] of runtimeFiles) {
            compilation.emitAsset(
              `pdfjs/${output}`,
              new webpack.sources.RawSource(
                readFileSync(path.join(pdfjsRoot, source))
              )
            )
          }
        }
      )
    })
  }
}
