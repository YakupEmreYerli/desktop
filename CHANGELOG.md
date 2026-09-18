# Changelog

Changes in this fork on top of upstream GitHub Desktop. Upstream's own release
notes are in `changelog.json` and on
[desktop.github.com](https://desktop.github.com/release-notes/).

## Unreleased (based on upstream 3.6.6)

### Added

- PDF previews in diffs: pages of added and deleted PDFs, old and new side by
  side for modified PDFs, with page navigation. Works in the changes and
  history views; long documents are drawn page by page as you scroll.
- HTML previews in diffs: HTML files open as rendered pages, old and new side
  by side for modified files, with a switch back to the code diff (the choice
  is remembered). Local stylesheets, scripts, images and fonts are loaded;
  scripts run sandboxed.
- Turkish translation of text documents in diffs: a Code / Türkçe switch on
  `.md`, `.txt` and `.rst` files shows the file translated, with changed
  paragraphs highlighted. Uses DeepSeek, OpenRouter or the local Claude CLI,
  set up in the new Options → AI tab.
- `script/linux-kur.sh` builds and installs the fork for the current user on
  Linux, keeping existing GitHub Desktop settings and sign-in.
- Linux CI for the fork (lint, unit tests, production build).

### Fixed

- The window's size is remembered on Linux under Wayland with several
  monitors; before, it opened at the default size every time.

### Changed

- Changes filter popover: count badges, full-width rows, grouped options,
  and it stays open while toggling filters.
