# Backlog

Work for later, in priority order. Move an item to `ARCHITECTURE.md` (and its
reasoning to `DECISIONS.md`) once it's done, then delete it here.

## 1. PDF preview follow-ups

- Password protected PDFs show a message; they could ask for the password.
- Highlight what changed between two versions of a page (a difference or
  onion-skin mode like the image diff).
- Keep the two columns aligned when a page was inserted in the middle (page
  matching) instead of pairing pages by number.

## 2. Locale independent tests

`git/remote` and `git/for-each-ref` ("directory without a .git directory")
fail when git prints its messages in another language, for example on a
Turkish system. Forcing `LC_ALL=C` for git in the test environment would fix it; better
done upstream so the fork doesn't carry the change.

## 3. Linux release artifacts

The fork is installed from source with `script/linux-kur.sh`. If anyone else
should use it, publish AppImage/deb builds from CI as GitHub releases
(`shiftkey/desktop` has packaging scripts to borrow).
