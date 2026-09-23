# Changelog

Changes in this fork on top of upstream GitHub Desktop. Upstream's own release
notes are in `changelog.json` and on
[desktop.github.com](https://desktop.github.com/release-notes/).

## Unreleased (based on upstream 3.6.6)

### Added

- Release packages: AppImage, deb and rpm for Linux, an installer for
  Windows, built by CI on each version tag. An AUR recipe is ready in
  `packaging/aur/` for when AUR registration reopens.
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
- SVG previews in diffs: SVG files show as images, old and new side by side
  with the same swipe, onion skin and difference modes as pictures, with a
  switch back to the code.
- Commit messages written by AI: a sparkle button next to the commit message
  writes the title and description from the selected changes, for you to
  read before committing. Language: Turkish, English or any other you name
  (English if the model doesn't know it). Style: the repository's own
  history (the default, so new commits read like the earlier ones), plain,
  Conventional Commits, Gitmoji, or your own rules. Description:
  automatic, always, never, or written by your own rules. Options → AI now picks a
  provider and model per feature, so translation and commit messages can use
  different ones (say Claude for translation, DeepSeek Flash for commits).
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

- Signing in through the browser works on Linux: the app ignored the link the
  browser opened it with, so the sign-in dialog never finished.
- Windows builds don't offer upstream updates, which would have replaced the
  fork with the official app.
- Going full screen no longer shows the "unrecoverable error" dialog. Chromium
  reports a harmless resize notice in a way the app couldn't tell apart from a
  real crash.
- The repository list shows the uncommitted changes dot and the ahead/behind
  arrows as soon as it opens, and keeps them up to date while it's open;
  before, they turned up minutes later or only once a repository had been
  opened.
- The window's size is remembered on Linux under Wayland with several
  monitors; before, it opened at the default size every time.

### Changed

- The app draws its own menu bar on Linux instead of leaving it to Electron,
  and in a KDE Plasma session it takes the colour and font of the window's
  titlebar and follows the colour scheme when it changes, so the app's first
  row and the titlebar above it read as one. Elsewhere nothing changes.
- Changes filter popover: count badges, full-width rows, grouped options,
  and it stays open while toggling filters.
