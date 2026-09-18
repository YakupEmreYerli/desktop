# Changelog

Changes in this fork on top of upstream GitHub Desktop. Upstream's own release
notes are in `changelog.json` and on
[desktop.github.com](https://desktop.github.com/release-notes/).

## Unreleased (based on upstream 3.6.6)

### Added

- PDF previews in diffs: pages of added and deleted PDFs, old and new side by
  side for modified PDFs, with page navigation. Works in the changes and
  history views; long documents are drawn page by page as you scroll.
- `script/linux-kur.sh` builds and installs the fork for the current user on
  Linux, keeping existing GitHub Desktop settings and sign-in.
- Linux CI for the fork (lint, unit tests, production build).

### Changed

- Changes filter popover: count badges, full-width rows, grouped options,
  and it stays open while toggling filters.
