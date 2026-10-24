# Mermaid Creator

Desktop app per creare diagrammi Mermaid con l'AI, organizzarli in un workspace affiancato alla chat e conservarne le versioni.

Prima versione utilizzabile (0.1.0):

- chat con streaming via OpenRouter;
- scelta del modello dal catalogo OpenRouter, con ricerca, filtri vision/gratis e preferiti locali;
- API key validata e salvata nel keyring di sistema;
- allegati: testo, PDF testuale, DOCX, immagini, clipboard e drag&drop;
- estrazione automatica dei blocchi Mermaid dalle risposte;
- rendering Pele con fallback Mermaid.js;
- workspace con zoom, editor del sorgente, versioni, ripristino;
- libreria con ricerca, preferiti ed export SVG/PNG/.mmd;
- SQLite locale per conversazioni, diagrammi, versioni e allegati.

## Requisiti

- Node.js 24+
- Rust stable
- Linux: WebKitGTK 4.1 e dipendenze Tauri (vedi sotto)

Su Ubuntu 26.04:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libxdo-dev libssl-dev build-essential webkitgtk-webdriver
```

## Toolchain su Kingston

Questo checkout è configurato per non consumare il disco di root:

- `RUSTUP_HOME` → `/mnt/KINGSTON/mermaid-creator/toolchain/rustup`
- `CARGO_HOME` → `/mnt/KINGSTON/mermaid-creator/toolchain/cargo`
- `CARGO_TARGET_DIR` → `/mnt/KINGSTON/mermaid-creator/build/target`
- cache npm, browser Playwright e `TMPDIR` → `/mnt/KINGSTON/mermaid-creator/build`
- data dir app → `/mnt/KINGSTON/mermaid-creator/data`

Carica l'ambiente prima di ogni comando:

```bash
source scripts/env.sh
```

Oppure usa lo wrapper:

```bash
bash scripts/with-env.sh cargo check --manifest-path src-tauri/Cargo.toml
```

Il guard verifica mount, UUID e directory; se Kingston non è montato, si ferma.

## Avvio rapido

Dalla root del repository:

```bash
./scripts/run.sh
```

Lo script carica l'ambiente Kingston, installa `node_modules` se manca e avvia
`tauri dev`. In alternativa:

```bash
source scripts/env.sh
npm install
npm run tauri:dev
```

La prima compilazione Rust può richiedere 15-25 minuti. Le successive sono incrementali.

## Release

La versione `0.1.0` è taggata `v0.1.0`. Il workflow
`.github/workflows/release.yml` produce e pubblica:

- Linux: `.deb`, `.rpm`, `.AppImage`
- Windows: installer NSIS `.exe`
- macOS: `.dmg` Intel e Apple Silicon

I pacchetti non sono firmati.

## Build pacchetti

```bash
source scripts/env.sh
npm run tauri:build
```

I bundle vengono prodotti sotto `CARGO_TARGET_DIR` (quindi su Kingston).

## Test

```bash
source scripts/env.sh
npm test
npm run typecheck
npm run build
```

## Dati e privacy

- La API key OpenRouter sta nel keyring di sistema; se il keyring non è disponibile viene tenuta solo in memoria per la sessione.
- Il database SQLite, gli allegati e i backup tecnici stanno nella data dir indicata in Impostazioni.
- Nessuna telemetria.
- I testi e gli allegati vengono inviati a OpenRouter e ai provider del modello scelto.

## Limiti noti della 0.1

- OCR PDF non incluso: i PDF scansionati senza testo non sono supportati.
- Nessun tag o ricerca full-text dei messaggi.
- Nessun confronto visuale tra versioni.
- Export PDF/presentazione rimandati.
- La release è verificata su Linux (Ubuntu 26.04).

## Struttura

```
src/                 React/TypeScript
src-tauri/           backend Rust, SQLite, OpenRouter, keyring
scripts/             ambiente Kingston e guard
docs/                materiale di progetto
```
