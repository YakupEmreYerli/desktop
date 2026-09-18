# Decisions

Why the fork is built the way it is. Newest first. How things work today is in
`ARCHITECTURE.md`.

## 2026-09-18: Fork docs next to upstream's, README in `.github/`

GitHub shows `.github/README.md` in place of the root `README.md`, so the fork
gets its own front page without editing upstream's README. Fork docs are new
root files (`AGENTS.md`, `ARCHITECTURE.md`, …) that upstream doesn't have.
English is the main language so the fork reads like upstream; the README also
has a Turkish version.

## 2026-09-18: Filter popover stays open

Closing after every toggle made picking two filters take two trips. With the
popover open the live counts also show what each extra filter would leave.

## 2026-09-18: Per-user install instead of a system package

A per-user install in `~/.local` needs no sudo to update, so the app can be
rebuilt and reinstalled after each change. A production build keeps the "GitHub Desktop"
product name, so the existing settings and sign-in carry over.

## 2026-09-18: PDF previews on pdf.js, as an image diff

- **pdf.js (`pdfjs-dist` 6)** is the standard renderer, runs in a worker, and
  has no native parts in the browser build.
- **Reusing `DiffType.Image`** instead of adding a diff type: a new type would
  touch every exhaustive switch in upstream code. The UI branches on
  `Image.mediaType`.
- **Worker from a blob URL:** the renderer page is a `file://` URL in
  production and talks to a dev server origin in development; a plain script
  URL isn't accepted as a worker in either.
- **Runtime files read from disk:** `fetch` doesn't work for `file://` in
  Electron. Webpack's dev server keeps assets in memory, but `yarn build:dev`
  writes them to `out/`, so reading from `__dirname` works in both modes.
- **Lazy pages with released canvases:** keeps a 300-page document responsive
  and its memory bounded.
- **PDFs are previewed even when Git considers them text:** uncompressed PDFs
  have no NUL bytes, and a text diff of PDF syntax is useless.
