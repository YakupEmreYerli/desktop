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
  `.md`, `.txt` and `.rst` files shows the same diff with its text translated
  line for line. Documents already in Turkish get no switch. Uses DeepSeek, OpenRouter or the local Claude CLI,
  set up in the new Options → AI tab.
- Repository groups: arrange the repository list into your own groups
  (right click a repository → Move to group), reorder and rename them from
  the group header's menu, collapse any section by clicking its header, hide
  repositories into a Hidden section, and turn the Recent group off.
  Everything can also be done with `github group …`, `github hide` and
  `github recent`, which work while the app is closed. Repositories you
  don't group stay grouped by owner.
- `github list [--json]`, `github add <path>` and `github remove <path>` on the
  command line: list the app's repositories, add one without the dialog, or
  take one out of the app (the folder stays on disk). Useful for scripts and
  coding agents. The `github` command now works on Linux and is installed by
  `script/linux-kur.sh`.
- `script/linux-kur.sh` builds and installs the fork for the current user on
  Linux, keeping existing GitHub Desktop settings and sign-in.
- Linux CI for the fork (lint, unit tests, production build).

### Fixed

- The window's size is remembered on Linux under Wayland with several
  monitors; before, it opened at the default size every time.

### Changed

- Changes filter popover: count badges, full-width rows, grouped options,
  and it stays open while toggling filters.
