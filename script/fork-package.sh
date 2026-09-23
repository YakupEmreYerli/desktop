#!/usr/bin/env bash
# Packages the app in dist/ into the fork's release files: AppImage, deb and
# rpm on Linux, an NSIS installer on Windows. Run `yarn build:prod` first.
#
#   script/fork-package.sh            every target for this OS
#   script/fork-package.sh AppImage   only the given Linux targets
#
# FORK_VERSION (e.g. 3.6.6-2) sets the package version; defaults to the app's.
#
# Output goes to dist/packages/. electron-builder isn't a dependency of the
# repo (keeps package.json equal to upstream); npx fetches a pinned version.
set -euo pipefail

kok="$(builtin cd "$(dirname "$0")/.." && pwd)"
builder="electron-builder@26.15.3"
electron="$(node -p "require('$kok/package.json').devDependencies.electron")"

case "$(uname -s)" in
  Linux)
    dizin="$kok/dist/desktop-linux-x64"
    platform=(--linux "${@:-AppImage deb rpm}")
    ;;
  MINGW* | MSYS* | CYGWIN*)
    dizin="$kok/dist/GitHubDesktop-win32-x64"
    platform=(--win nsis)
    ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

if [[ ! -d "$dizin" ]]; then
  echo "No build at $dizin; run yarn build:prod first." >&2
  exit 1
fi

# Upstream names the Linux binary `desktop`, which would land in /usr/bin as
# a meaningless command. Package a hard-linked copy with a clearer name.
if [[ "$(uname -s)" == Linux ]]; then
  sahne="$kok/dist/fork-stage"
  rm -rf "$sahne"
  cp -al "$dizin" "$sahne"
  mv "$sahne/desktop" "$sahne/github-desktop"
  dizin="$sahne"
fi

rm -rf "$kok/dist/packages"
# shellcheck disable=SC2068
npx --yes "$builder" \
  --projectDir "$kok/app" \
  --config "$kok/script/fork-builder.yml" \
  --prepackaged "$dizin" \
  --x64 \
  -c.electronVersion="$electron" \
  ${FORK_VERSION:+-c.extraMetadata.version="$FORK_VERSION"} \
  ${platform[@]}

rm -rf "$kok/dist/fork-stage"
ls -la "$kok/dist/packages"
