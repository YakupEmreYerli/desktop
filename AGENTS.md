# AGENTS.md

Rules for every contributor and coding agent working in this repository.

## What this is

A fork of [desktop/desktop](https://github.com/desktop/desktop) (GitHub
Desktop) at `YakupEmreYerli/desktop`, used on Linux. It adds features on top of
upstream (PDF and HTML previews in diffs, Turkish translation of documents, a restyled changes filter, a per-user Linux
installer) and follows upstream closely.

Code, comments and docs are in English.

## Running

```sh
source ~/.nvm/nvm.sh && nvm use     # Node from .nvmrc
yarn                                # install
yarn build:dev && yarn start        # development app
yarn lint                           # prettier + eslint
yarn test:unit                      # all unit tests (node:test)
node script/test.mjs <file>         # a single test file
npx playwright test --config app/test/e2e/playwright.config.ts <name>
                                    # e2e against the packaged app in dist/
script/linux-kur.sh                 # production build + install for this user
script/linux-kur.sh --hizli         # compile only, refresh the install (~5s)
```

Linux system requirements: `docs/contributing/setup-linux.md` (upstream).

## Working with upstream

- Branches and remotes: work on `development`. `origin` is the fork,
  `upstream` is desktop/desktop, `shiftkey` is the old Linux fork (reference only).
- Sync regularly: `git fetch upstream && git merge upstream/development`.
- **Keep the conflict surface small.** Fork features live in their own files;
  edits to upstream files stay at hook level (an import plus a few lines). The
  current touch points are listed in `ARCHITECTURE.md`; update that list when
  you add or remove one.
- Don't edit upstream workflows, templates or the root `README.md`. The fork's
  README is `.github/README.md`, which GitHub shows instead of the root one.

## Commits and pushing

- Commit messages in Turkish, imperative, saying what changed; the body says why.
  No tool signatures or co-author lines.
- Public repository: commits accumulate locally and are pushed once when a
  piece of work is finished. Never force push.

## E2E tests and the developer's machine

`yarn test:e2e:run` runs the specs inside a nested, invisible KWin session
(`script/e2e-headless.mjs`), so the windows they open don't land on top of
whatever you're doing and take the keyboard and mouse with them. Set
`DESKTOP_E2E_VISIBLE=1` to watch them, and note that calling `npx playwright
test` yourself skips all of this.

Anything that launches the app for a test, a spec or a one-off script,
takes its environment from `isolatedEnvironment()` in
`app/test/e2e/isolated-environment.ts` and calls `guardRealGitConfig()`.
The welcome flow writes the name and email typed into it to the global git
config; without an isolated `GIT_CONFIG_GLOBAL` that is the developer's real
`~/.gitconfig`, and every later commit on the machine carries the test
identity.

## Before calling something done

- `yarn lint` and the unit tests for the touched area pass, and new behaviour has
  tests. Two upstream tests (`git/remote`, `git/for-each-ref`, "directory
  without a .git directory") fail on machines with a non-English git locale;
  that's known, see `BACKLOG.md`.
- UI changes are checked in the real app and approved by the maintainer.

## Documentation rule

**Each piece of information lives in one place.** Link, don't copy.

| Kind of information | Where |
|---|---|
| How the fork works today | `ARCHITECTURE.md` |
| Why a choice was made | `DECISIONS.md` |
| Work for later | `BACKLOG.md` |
| Rules for all contributors and agents | `AGENTS.md` |
| User-facing changes | `CHANGELOG.md` |
| Project overview | `.github/README.md` (+ `.github/README.tr.md`) |

Before adding a new `.md`, check whether it fits one of these. Finished plans,
dated handoffs and status reports aren't kept: move what's worth keeping to its
canonical place and delete the file. Git keeps the history.

Agent-specific notes and session handoffs (`CLAUDE.md`, `CLAUDE_HANDOFF.md`)
are kept out of the repository.

Upstream's own docs (`docs/`, `.github/CONTRIBUTING.md`, `SECURITY.md`) describe
the base app and stay untouched.

## Safety

- No credentials, tokens or `.env` contents in docs, code or logs.
- Ask the maintainer before anything outward facing or hard to undo: deleting remote
  branches, changing repository settings, publishing releases.
