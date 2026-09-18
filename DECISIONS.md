# Decisions

Why the fork is built the way it is. Newest first. How things work today is in
`ARCHITECTURE.md`.

## 2026-09-18: Translation through three providers, one module

DeepSeek and OpenRouter are cheap, pay-per-use APIs (OpenRouter reaches
Gemini and most other models with one key); the local `claude` CLI uses a
Claude subscription the maintainer already pays for. All three sit behind
`completeWithAI` so the planned Claude commit messages reuse the same
settings. Upstream's Copilot BYOK needs the Copilot SDK and a Copilot account,
so it isn't used; only the keychain storage pattern is copied.

Settings live in Options (a new last tab) as the maintainer asked; the diff
view links there instead of carrying its own settings. The translation works
on blocks rather than the whole file so cached paragraphs are reused and the
changed ones can be highlighted in the translation itself. Code is the
default view because every translation costs a request.

## 2026-09-18: HTML previews as a view over the text diff

HTML is text, and staging single lines only works in the text diff, so the
preview is a switch on top of it rather than a new diff type like the PDF
preview. The preview is the default because that's why the feature exists.
Scripts run because many pages draw their content with them; the frame is
sandboxed without `allow-same-origin`, which is what keeps them away from the
app's Node APIs. Loading local files through `<base href="file://…">` was
tried first: Chromium refuses `file://` loads from the sandbox's opaque
origin, and allowing the same origin would hand scripts the app. Inlining the
files as data URIs keeps the frame sandboxed and needs no custom protocol in
the main process.

## 2026-09-18: Fork docs next to upstream's, README in `.github/`

GitHub shows `.github/README.md` in place of the root `README.md`, so the fork
gets its own front page without editing upstream's README. Fork docs are new
root files (`AGENTS.md`, `ARCHITECTURE.md`, …) that upstream doesn't have.
English is the main language so the fork reads like upstream; the README also
has a Turkish version.

## 2026-09-18: Repair the saved window state instead of replacing the library

The Wayland window size bug sits in electron-window-state's visibility check.
Rewriting its state file before it loads is a one-line hook in upstream's
`app-window.ts`. Patching or replacing the library would touch more upstream
code for the same result.

## 2026-09-18: Upstream workflows disabled, not deleted

Upstream CI needs macOS and Windows larger runners plus signing secrets, and
the triage workflows act on upstream's issues. Deleting or editing them would
conflict on every merge. They're disabled in the fork's Actions settings and
the fork runs its own `fork-ci.yml` on Linux.

## 2026-09-18: Upstream's feature branches removed from the fork

Forking copied about 200 upstream branches to `origin`. None held fork work
and they remain on upstream, so the fork keeps only `development`.

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
