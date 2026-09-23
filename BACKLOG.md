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

## 3. Release packages (Linux + Windows)

Decided 2026-09-23. Built: `script/fork-builder.yml`, `script/fork-package.sh`,
`.github/workflows/fork-release.yml` (tag `v<app version>-<n>` → draft release
with AppImage, deb, rpm, Windows installer, SHA256SUMS) and
`packaging/aur/PKGBUILD`. AppImage, deb and the AUR package were built and
checked locally; rpm and Windows only build in CI.

Left:
- Own OAuth app: repository secrets `DESKTOP_OAUTH_CLIENT_ID` /
  `DESKTOP_OAUTH_CLIENT_SECRET`, set by Yakup.
- First tag and publishing the draft (outward-facing, confirm first).
- AUR account and first push of `packaging/aur` (Yakup's account).
- Windows is untested on a real machine. macOS is out: unsigned apps don't
  open there and signing costs money.
- The fork doesn't update itself; a "new release on GitHub" notice would help.
