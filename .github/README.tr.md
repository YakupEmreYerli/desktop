# Linux için GitHub Desktop (çatal)

[English](README.md) · **Türkçe**

[![Fork CI](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml/badge.svg)](https://github.com/YakupEmreYerli/desktop/actions/workflows/fork-ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](../LICENSE)
[![Üst depo](https://img.shields.io/badge/%C3%BCst%20depo-desktop%2Fdesktop-24292f?logo=github)](https://github.com/desktop/desktop)

[GitHub Desktop](https://github.com/desktop/desktop)'un Linux'ta günlük
kullanım için tutulan çatalı. Üst deponun üzerine birkaç özellik
ekler ve üst depodaki değişiklikleri almaya devam eder.

Resmî bir GitHub ürünü değildir. Resmî uygulama için
[desktop.github.com](https://desktop.github.com).

## Neler farklı

| Özellik | Ayrıntı |
|---|---|
| **Diff'te PDF önizleme** | Eklenen ve silinen PDF'lerin sayfaları görünür; değişen PDF'te eski ve yeni sayfalar yan yana durur, sayfalar arasında gezinilir. Uzun belgeler kaydırdıkça sayfa sayfa çizilir. Değişiklikler ve geçmiş görünümlerinde çalışır. |
| **Diff'te HTML önizleme** | HTML dosyaları sayfa olarak açılır; değişen dosyada eski ve yeni hâl yan yana durur, Önizleme/Kod düğmesiyle kod farkına geçilir. Yerel CSS, resim ve script'ler yüklenir; script'ler kafeste çalışır. |
| **Derli toplu değişiklik filtresi** | Filtre seçeneklerinde sayı rozetleri ve tam genişlik satırlar var; birden fazla filtre seçerken pencere açık kalır. |
| **Kullanıcıya Linux kurulumu** | Tek betik uygulamayı derleyip ev klasörüne kurar, sudo istemez, mevcut GitHub Desktop ayarlarını ve oturumu korur. |

Tam liste (İngilizce): [CHANGELOG.md](../CHANGELOG.md).

## Linux'a kurulum

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

Betik uygulamayı `~/.local/opt/github-desktop` klasörüne kurar, menüye ekler
ve `github-desktop` komutunu oluşturur. Güncellemek için tekrar çalıştırın.
Uygulama açıkken çalışmaz, önce kapatın. Sistemde kurulu bir GitHub Desktop
paketi varsa bu kurulum onun önüne geçer; paketi sonra kaldırabilirsiniz.

## Geliştirme

| Komut | Ne yapar |
|---|---|
| `yarn build:dev && yarn start` | Geliştirme derlemesi, arayüz canlı yenilenir |
| `yarn lint` | Prettier ve ESLint |
| `yarn test:unit` | Birim testler (`node:test`) |
| `node script/test.mjs <dosya>` | Tek test dosyası |
| `yarn build:prod` | Üretim derlemesi (`dist/`) |
| `script/linux-kur.sh [--derleme]` | Derle (ya da `dist/`i kullan) ve bu kullanıcıya kur |

## Belgeler

Belgeler İngilizcedir: [ARCHITECTURE.md](../ARCHITECTURE.md) (nasıl çalışıyor),
[DECISIONS.md](../DECISIONS.md) (neden böyle), [BACKLOG.md](../BACKLOG.md)
(sıradaki işler), [AGENTS.md](../AGENTS.md) (katkı ve ajan kuralları).

## Lisans

Üst depoyla aynı: [MIT](../LICENSE). GitHub Desktop © GitHub, Inc.; GitHub adı
ve logoları lisansa dahil değildir.
