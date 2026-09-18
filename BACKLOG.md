# Backlog

Work for later, in priority order. Move an item to `ARCHITECTURE.md` (and its
reasoning to `DECISIONS.md`) once it's done, then delete it here.

## 1. Claude generated commit title and description

Upstream already generates commit messages with Copilot:
`app/src/lib/copilot-commit-message.ts`, the "Generate commit message" menu in
`app/src/ui/changes/commit-message.tsx`, and BYOK providers in
`app/src/lib/copilot/byok.ts`. Goal: the same button generates a title and a
description with **Claude**.

- Use `completeWithAI` from `app/src/lib/ai/providers.ts` (DeepSeek,
  OpenRouter or the local `claude` CLI, set up in Options → AI): pass the
  diff, get JSON `{title, description}` back and reuse the existing parser.
- Not set up yet: the button opens Options → AI (`openAISettings()`).
- Message language is a setting, Turkish by default.
- No other AI feature (explanations, conflicts, side panel) starts before this
  is done. Document translation came first at the maintainer's request and
  laid down the provider layer this item uses.

## 2. PDF preview follow-ups

- Password protected PDFs show a message; they could ask for the password.
- Highlight what changed between two versions of a page (a difference or
  onion-skin mode like the image diff).
- Keep the two columns aligned when a page was inserted in the middle (page
  matching) instead of pairing pages by number.

## 3. Locale independent tests

`git/remote` and `git/for-each-ref` ("directory without a .git directory")
fail when git prints its messages in another language, for example on a
Turkish system. Forcing `LC_ALL=C` for git in the test environment would fix it; better
done upstream so the fork doesn't carry the change.

## 4. Linux release artifacts

The fork is installed from source with `script/linux-kur.sh`. If anyone else
should use it, publish AppImage/deb builds from CI as GitHub releases
(`shiftkey/desktop` has packaging scripts to borrow).
