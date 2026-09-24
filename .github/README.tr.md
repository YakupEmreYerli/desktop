<div align="center">

<img src="../app/static/linux/icon-logo.png" alt="" width="96">

# GitHub Desktop (çatal)

**PDF'te, SVG'de, web sayfasında neyin değiştiğini görün. Commit mesajını Claude yazsın.**<br>
GitHub Desktop'ın Windows ve Linux için topluluk çatalı.

[![Son sürüm](https://img.shields.io/github/v/release/YakupEmreYerli/desktop?label=s%C3%BCr%C3%BCm&color=8250df)](https://github.com/YakupEmreYerli/desktop/releases/latest)
[![İndirme](https://img.shields.io/github/downloads/YakupEmreYerli/desktop/total?label=indirme&color=8250df)](https://github.com/YakupEmreYerli/desktop/releases)
![Windows ve Linux](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-24292f)
[![Fork CI](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml/badge.svg)](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](../LICENSE)

[**Windows için indir**](https://github.com/YakupEmreYerli/desktop/releases/latest) ·
[**Linux için indir**](#kurulum) ·
[Neler var](#özellikler) ·
[English](README.md)

<br>

<img src="assets/hero.png" alt="Eski ve yeni PDF sayfalarını yan yana gösteren GitHub Desktop çatalı" width="100%">

</div>

## Neden bu çatal

GitHub Desktop değişen bir PDF'i, görseli ya da web sayfasını "ikili dosya
değişti" diye geçer, commit mesajını da size bırakır. Bu çatal değişikliğin
kendisini gösterir ve mesajı yazabilir. Gerisi GitHub Desktop'ın kendisi,
düzenli olarak güncellenir; ayarlarınız, depolarınız ve GitHub girişiniz
resmî uygulamayla ortaktır.

Resmî bir GitHub ürünü değildir. Resmî uygulama için
[desktop.github.com](https://desktop.github.com).

## Özellikler

<table>
<tr>
<td width="50%" valign="top">
<img src="assets/01-pdf-diff.png" alt="Eski ve yeni PDF sayfaları yan yana">
<h3>PDF karşılaştırma</h3>
Eski ve yeni sayfalar yan yana, sayfa gezintisiyle. Uzun belgeler kaydırdıkça
sayfa sayfa çizilir; değişiklikler ve geçmiş görünümünde çalışır.
</td>
<td width="50%" valign="top">
<img src="assets/02-svg-diff.png" alt="Görsel olarak gösterilen SVG karşılaştırması">
<h3>SVG karşılaştırma</h3>
Görsel olarak açılır; kaydırma, üst üste ve fark kipleri, Önizleme/Kod
düğmesiyle.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="assets/03-html-diff.png" alt="Web sayfası olarak açılan HTML karşılaştırması">
<h3>HTML önizleme</h3>
Sayfalar kendi stil dosyaları, görselleri ve betikleriyle açılır; betikler
yalıtılmış çalışır. İstediğiniz an koda dönebilirsiniz.
</td>
<td width="50%" valign="top">
<img src="assets/05-ai-commit-message.png" alt="Claude'un yazdığı commit başlığı ve açıklaması">
<h3>Yapay zekâyla commit mesajı</h3>
Tek düğme, değişikliklerinizden başlığı ve açıklamayı seçtiğiniz dilde ve
biçimde yazar: sade, Conventional Commits, Gitmoji ya da deponun kendi üslubu.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="assets/04-translation.png" alt="Türkçe gösterilen bir README">
<h3>Belgeler Türkçe</h3>
Markdown ve metin dosyalarında Kod / Türkçe düğmesi, değişikliği çevrilmiş
gösterir; değişen paragraflar işaretlidir.
</td>
<td width="50%" valign="top">
<img src="assets/06-repository-groups-cli.png" alt="Komut satırından düzenlenen depo grupları">
<h3>Depo grupları</h3>
Depoları gruplayın, sıralayın, katlayın, gizleyin: uygulamadan ya da
terminalde <code>github group</code> ile. Betikler ve kod ajanları da listeyi
düzenleyebilir.
</td>
</tr>
</table>

Ayrıca: değişiklik filtresinde sayılar var ve birkaç filtre seçerken açık
kalıyor. Tam liste (İngilizce): [CHANGELOG.md](../CHANGELOG.md).

<details>
<summary><b>28 saniyelik turu izleyin</b></summary>
<br>
<img src="assets/demo.gif" alt="Çatalın özelliklerini gösteren 28 saniyelik tur" width="100%">
<p><a href="assets/demo.mp4">MP4 olarak indir</a></p>
</details>

## Kurulum

Sisteminize uygun dosyayı
[son sürümden](https://github.com/YakupEmreYerli/desktop/releases/latest)
indirin. Dosyalar 64 bittir (x64).

| Sistem | Dosya | Nasıl |
|---|---|---|
| **Windows 10/11** | `GitHubDesktop-…-win-x64.exe` | Çalıştırın. Dosya imzasız olduğu için Windows "bilinmeyen yayıncı" uyarısı verir: **Ek bilgi → Yine de çalıştır**. |
| **Ubuntu, Debian, Mint** | `…-linux-amd64.deb` | `sudo apt install ./GitHubDesktop-…-linux-amd64.deb` |
| **Fedora, openSUSE** | `…-linux-x86_64.rpm` | `sudo dnf install ./GitHubDesktop-…-linux-x86_64.rpm` |
| **Her Linux, Arch dahil** | `…-linux-x86_64.AppImage` | Dosyaya `chmod +x` verip çalıştırın. |

Özet değerleri dosyaların yanındaki `SHA256SUMS.txt` içinde.

### Yapay zekâ özellikleri

**Options → AI**'da sağlayıcı seçene kadar yapay zekâ kapalıdır. Her
özellik (commit mesajı, çeviri) kendi sağlayıcısını seçer:

- **Claude**: Claude aboneliğinizi yerel
  [Claude Code](https://docs.claude.com/en/docs/claude-code/setup) aracıyla
  kullanır, API anahtarı gerekmez.
- **DeepSeek** ya da **OpenRouter**: API anahtarı girilir.

## Sık sorulanlar

<details>
<summary><b>Ayarlarım ve depolarım gelir mi?</b></summary>
<br>
Evet. Çatal GitHub Desktop'la aynı ayar klasörünü kullanır; depolarınız,
tercihleriniz ve GitHub girişiniz zaten oradadır.
</details>

<details>
<summary><b>Nasıl güncellerim?</b></summary>
<br>
Yeni sürümü eskisinin üstüne kurun. Çatal kendini güncellemez: GitHub
Desktop'ın kendi güncelleyicisi onu resmî uygulamayla değiştirirdi, bu yüzden
kapalı.
</details>

<details>
<summary><b>macOS sürümü neden yok?</b></summary>
<br>
macOS imzasız uygulamaları açmaz, imza da ücretli Apple geliştirici hesabı
ister. Asıl deponun derleme adımları Mac'te çalışmalı, ama çatal orada
denenmedi.
</details>

<details>
<summary><b>Resmî uygulamaya nasıl dönerim?</b></summary>
<br>
Çatalı kaldırıp GitHub Desktop'ı
<a href="https://desktop.github.com">desktop.github.com</a> adresinden kurun.
Ayarlarınız kalır.
</details>

## Kaynaktan derleme

<details>
<summary><b>Linux: kullanıcıya kurulum, sudo gerekmez</b></summary>
<br>

Gerekenler: git, [nvm](https://github.com/nvm-sh/nvm) (Node sürümü `.nvmrc`
dosyasında), Yarn 1 ve `libsecret`
([setup-linux.md](../docs/contributing/setup-linux.md)).

```sh
git clone --recurse-submodules https://github.com/YakupEmreYerli/desktop.git
cd desktop
source ~/.nvm/nvm.sh && nvm install && nvm use
yarn
script/linux-kur.sh
```

Uygulama `~/.local/opt/github-desktop` klasörüne kurulur; menüye eklenir,
`github-desktop` ve `github` komutları gelir (`github --help`). Güncellemek
için tekrar çalıştırın, önce uygulamayı kapatın. `github` komutu yalnız bu
kurulumla gelir, sürüm paketlerinde yoktur.

</details>

<details>
<summary><b>Geliştirme komutları</b></summary>
<br>

| Komut | Ne yapar |
|---|---|
| `yarn build:dev && yarn start` | Canlı yenilenen geliştirme derlemesi |
| `yarn lint` | Prettier ve ESLint |
| `yarn test:unit` | Birim testleri (`node:test`) |
| `node script/test.mjs <dosya>` | Tek test dosyası |
| `yarn build:prod` | `dist/` içine üretim derlemesi |
| `script/linux-kur.sh [--derleme]` | Derle (ya da `dist/`i kullan) ve bu kullanıcıya kur |
| `script/fork-package.sh` | `dist/`i sürüm dosyalarına paketle (`dist/packages/`) |

Sürüm: `v3.6.6-2` gibi bir etiket gönderilince CI bütün paketleri derler
([fork-release.yml](workflows/fork-release.yml)) ve taslak sürüm açar.

Çatalın eklemeleri kendi dosyalarında durur, asıl depodan güncelleme almak
kolay kalır; asıl dosyalara dokunduğu birkaç yer
[ARCHITECTURE.md](../ARCHITECTURE.md#upstream-touch-points) içinde.

</details>

| Belge | İçerik |
|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Özellikler nasıl çalışır |
| [DECISIONS.md](../DECISIONS.md) | Neden böyle yapıldı |
| [BACKLOG.md](../BACKLOG.md) | Sırada ne var |
| [AGENTS.md](../AGENTS.md) | Katkı verenler ve kod ajanları için kurallar |
| [CHANGELOG.md](../CHANGELOG.md) | Asıl depoya göre değişiklikler |

Belgeler İngilizcedir.

## Lisans

Asıl depoyla aynı, [MIT](../LICENSE). GitHub Desktop © GitHub, Inc.; GitHub
adı ve logoları lisansa dahil değildir.
