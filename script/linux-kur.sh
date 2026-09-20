#!/usr/bin/env bash
# Çatalı bu kullanıcıya kurar ya da günceller (sudo gerekmez).
#
#   script/linux-kur.sh            derle + kur
#   script/linux-kur.sh --derleme  derlemeyi atla, dist/ içindekini kur
#   script/linux-kur.sh --hizli    sadece kodu derle, kurulu uygulamanın
#                                  üstüne yaz (Electron'u paketlemez)
#
# Uygulama adı "GitHub Desktop" kaldığı için ayarlar, depo listesi ve oturum
# ~/.config/GitHub Desktop içinden aynen devam eder.
set -euo pipefail

kok="$(cd "$(dirname "$0")/.." && pwd)"
kaynak="$kok/dist/desktop-linux-x64"
hedef="$HOME/.local/opt/github-desktop"
bin="$HOME/.local/bin/github-desktop"
cli="$HOME/.local/bin/github"
masaustu="$HOME/.local/share/applications/github-desktop.desktop"

kip="${1:-}"

# Hızlı kip: kod değiştiğinde Electron'u yeniden paketlemenin anlamı yok,
# kurulu uygulamanın içindeki derleme çıktısını tazelemek yeter. Electron
# sürümü ya da bağımlılıklar değiştiyse tam kurulum gerekir.
if [[ "$kip" == "--hizli" ]]; then
  if [[ ! -x "$hedef/desktop" ]]; then
    echo "Önce tam kurulum gerekiyor: script/linux-kur.sh" >&2
    exit 1
  fi

  if pgrep -f "^$hedef/desktop" >/dev/null; then
    echo "GitHub Desktop açık; kapatıp yeniden çalıştır." >&2
    exit 1
  fi

  cd "$kok"
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
  yarn compile:prod

  for dosya in "$kok"/out/*.js "$kok"/out/*.css "$kok"/out/*.map "$kok"/out/*.html; do
    [[ -e "$dosya" ]] || continue
    cp -a "$dosya" "$hedef/resources/app/"
  done

  echo "Tazelendi: $(git -C "$kok" rev-parse --short HEAD) → $hedef"
  exit 0
fi

if [[ "$kip" != "--derleme" ]]; then
  cd "$kok"
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh" && nvm use >/dev/null
  yarn build:prod
fi

if [[ ! -x "$kaynak/desktop" ]]; then
  echo "Derleme bulunamadı: $kaynak" >&2
  exit 1
fi

if pgrep -f "^$hedef/desktop" >/dev/null; then
  echo "GitHub Desktop açık; kapatıp yeniden çalıştır." >&2
  exit 1
fi

# Yeni sürümü yanına kopyala, sonra tek hamlede yer değiştir
mkdir -p "$(dirname "$hedef")"
rm -rf "$hedef.yeni"
cp -a "$kaynak" "$hedef.yeni"
rm -rf "$hedef"
mv "$hedef.yeni" "$hedef"

mkdir -p "$(dirname "$bin")"
cat >"$bin" <<EOF
#!/bin/sh
exec "$hedef/desktop" "\$@"
EOF
chmod +x "$bin"

# Komut satırı aracı: github list / add / remove / open / clone
cat >"$cli" <<EOF
#!/bin/sh
ELECTRON_RUN_AS_NODE=1 exec "$hedef/desktop" "$hedef/resources/app/cli.js" "\$@"
EOF
chmod +x "$cli"

simge="$hedef/github-desktop.png"
cp "$kok/app/static/linux/icon-logo.png" "$simge"

# Sistemdeki github-desktop.desktop ile aynı ad: onu gölgeler, bağlantı
# işleyicileri (GitHub girişi, "Open with GitHub Desktop") bize gelir.
mkdir -p "$(dirname "$masaustu")"
cat >"$masaustu" <<EOF
[Desktop Entry]
Name=GitHub Desktop
Comment=Extend your GitHub workflow beyond your browser with GitHub Desktop
Exec=$bin %U
Terminal=false
Type=Application
Icon=$simge
StartupWMClass=GitHub Desktop
Categories=Development;RevisionControl;
MimeType=x-scheme-handler/x-github-client;x-scheme-handler/x-github-desktop-auth;
EOF

update-desktop-database "$(dirname "$masaustu")" 2>/dev/null || true
xdg-mime default github-desktop.desktop x-scheme-handler/x-github-client 2>/dev/null
xdg-mime default github-desktop.desktop x-scheme-handler/x-github-desktop-auth 2>/dev/null

surum="$(python3 -c "import json;print(json.load(open('$hedef/resources/app/package.json'))['version'])")"
echo "Kuruldu: GitHub Desktop $surum ($(git -C "$kok" rev-parse --short HEAD)) → $hedef"
