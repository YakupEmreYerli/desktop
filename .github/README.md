# GitHub Desktop for Linux (fork)

**English** · [Türkçe](README.tr.md)

[![Fork CI](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml/badge.svg)](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)
[![Upstream](https://img.shields.io/badge/upstream-desktop%2Fdesktop-24292f?logo=github)](https://github.com/desktop/desktop)
![Electron](https://img.shields.io/badge/Electron-44-47848f?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)

A fork of [GitHub Desktop](https://github.com/desktop/desktop) for daily use
on Linux. It adds a few features on top of upstream and keeps
merging upstream changes.

This is not an official GitHub product. For the official app see
[desktop.github.com](https://desktop.github.com).

## Contents

- [What's different](#whats-different)
- [Install on Linux](#install-on-linux)
- [Development](#development)
- [Project layout](#project-layout)
- [Documentation](#documentation)
- [License](#license)

## What's different

| Feature | Details |
|---|---|
| **PDF previews in diffs** | Added and deleted PDFs show their pages; modified PDFs show old and new pages side by side, with page navigation. Long documents are drawn page by page as you scroll. Works in the changes and history views. |
| **HTML previews in diffs** | HTML files open as rendered pages, old and new side by side when modified, with a Preview/Code switch. Local stylesheets, images and scripts load; scripts run sandboxed. |
| **Turkish translation of documents** | Markdown and text files get a Code / Türkçe switch that shows the file translated into Turkish, changed paragraphs highlighted. Works with DeepSeek, OpenRouter or your Claude subscription (Options → AI). |
| **Tidier changes filter** | Filter options have count badges and full-width rows, and the popover stays open while you pick several filters. |
| **Per-user Linux install** | One script builds and installs the app into your home directory, no sudo, keeping existing GitHub Desktop settings and sign-in. |

Full list: [CHANGELOG.md](../CHANGELOG.md).

## Install on Linux

Requirements: git, [nvm](https://github.com/nvm-sh/nvm) (Node version from
`.nvmrc`), Yarn 1, and `libsecret` (see
[setup-linux.md](../docs/contributing/setup-linux.md)).

```sh
git clone --recurse-submodules https://github.com/YakupEmreYerli/desktop.git
cd desktop
source ~/.nvm/nvm.sh && nvm install && nvm use
yarn
script/linux-kur.sh
```

The script installs to `~/.local/opt/github-desktop` and adds a menu entry and
a `github-desktop` command. Run it again to update. Close the app first; it
refuses to overwrite a running copy. If a GitHub Desktop package is installed
system-wide, this install takes precedence; you can remove the package
afterwards.

## Development

| Command | What it does |
|---|---|
| `yarn build:dev && yarn start` | Development build with a live-reloading renderer |
| `yarn lint` | Prettier and ESLint |
| `yarn test:unit` | Unit tests (`node:test`) |
| `node script/test.mjs <file>` | A single test file |
| `yarn build:prod` | Production build into `dist/` |
| `script/linux-kur.sh [--derleme]` | Build (or reuse `dist/`) and install for this user |

Upstream's contributor guide applies to the base app:
[.github/CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](../docs).

## Project layout

Fork additions live in their own files so upstream merges stay clean:

```
app/src/lib/pdf.ts                    PDF detection
app/src/ui/diff/pdf-diffs/            PDF diff viewer (pdf.js)
app/webpack.pdfjs.ts                  ships pdf.js runtime files
app/styles/ui/_pdf-diff.scss          PDF viewer styles
app/src/lib/html.ts                   HTML detection, asset inlining
app/src/ui/diff/html-diffs/           HTML preview
app/styles/ui/_html-diff.scss         HTML preview styles
app/src/lib/ai/                       AI providers, translation
app/src/ui/diff/translation-diffs/    Turkish translation view
app/src/ui/preferences/ai.tsx         Options → AI
app/styles/ui/changes/_filter-popover.scss
script/linux-kur.sh                   Linux installer
.github/workflows/fork-ci.yml         fork CI
```

Where the fork hooks into upstream files is listed in
[ARCHITECTURE.md](../ARCHITECTURE.md#upstream-touch-points).

## Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | How the fork's features work |
| [DECISIONS.md](../DECISIONS.md) | Why they're built that way |
| [BACKLOG.md](../BACKLOG.md) | What's next |
| [AGENTS.md](../AGENTS.md) | Working rules for contributors and coding agents |
| [CHANGELOG.md](../CHANGELOG.md) | Changes on top of upstream |

## License

[MIT](../LICENSE), same as upstream. GitHub Desktop is © GitHub, Inc.; the
GitHub name and logos aren't covered by the license.
