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

Decided 2026-09-23: ship it to other people. Today the only way in is a source
build with `script/linux-kur.sh`.

- CI (GitHub Actions) builds AppImage, deb and rpm on a version tag and
  attaches them to a GitHub release. `shiftkey/desktop` has packaging scripts
  to borrow.
- An AUR package (`-bin`, from the release AppImage or deb). Needs an AUR
  account; Yakup creates it.
- Own OAuth app instead of upstream's dev app, so the sign-in consent screen
  names the fork. Client ID and secret go in as `DESKTOP_OAUTH_CLIENT_ID` /
  `DESKTOP_OAUTH_CLIENT_SECRET` repository secrets, used only by the release
  job. With a secret the build uses `x-github-desktop-auth`; the installer
  already registers both schemes.
- `.github/README.md` install section: download first, source build second.
