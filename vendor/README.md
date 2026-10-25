# Vendor

`excalidraw-mermaid-to-excalidraw-2.4.0.tgz` è il pacchetto prodotto con
`npm pack` dal fork locale:

- repo: `git@github.com:vigliafg/mermaid-to-excalidraw.git`
- commit: `291c693` (branch `feat/board-api`, poi `b691112` per il workflow di release)
- versione pacchetto: `2.4.0`
- comando: `pnpm build && npm pack`
- sha256: `103bf6b48904ed08a74b53a6af4a8be290f71d5143f477083894f74dd0a74550`

Il tarball è versionato qui per rendere `npm ci` riproducibile su qualunque
checkout (la CI non ha il repository fork accanto all'app) e per evitare una
pubblicazione npm. Quando sarà autorizzata la Release GitHub `fork-v2.4.0`, si
può sostituire la dipendenza con l'URL dell'asset:

```json
"@excalidraw/mermaid-to-excalidraw": "https://github.com/vigliafg/mermaid-to-excalidraw/releases/download/fork-v2.4.0/excalidraw-mermaid-to-excalidraw-2.4.0.tgz"
```

In quel caso va aggiornato anche `overrides` (stesso URL o
`"$@excalidraw/mermaid-to-excalidraw"`) e rigenerato `package-lock.json`.

Per rigenerare il tarball dopo una modifica al fork:

```bash
cd ../mermaid-to-excalidraw
pnpm build
npm pack
cp excalidraw-mermaid-to-excalidraw-2.4.0.tgz ../repo/vendor/
cd ../repo
npm install
```

Aggiornare anche lo sha256 indicato sopra.
