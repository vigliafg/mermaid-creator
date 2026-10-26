# Lavagna Excalidraw

Ogni diagramma ha due superfici:

- **Diagramma** — Mermaid/Pele, editing strutturato, target dell'AI.
- **Lavagna** — Excalidraw, editing libero su una copia derivata.

La lavagna **non riscrive mai** il sorgente Mermaid: il diagramma resta la fonte
di verità. Non esiste un round-trip Excalidraw → Mermaid.

## Primo utilizzo

1. Apri un diagramma e premi **Lavagna** nello switch della testata.
2. Scegli:
   - **Crea lavagna modificabile**: converte il diagramma in elementi
     Excalidraw nativi con il convertitore `@excalidraw/mermaid-to-excalidraw`.
   - **Disegna da zero**: crea una lavagna vuota, collegata al diagramma ma
     indipendente dal sorgente.
   - **Inserisci come immagine**: usa l'SVG del render corrente dell'app (Pele
     o Mermaid) per la massima fedeltà. Gli elementi non sono modificabili.

La conversione passa dalla stessa coda Mermaid dell'app, quindi non ci sono
race con il rendering del diagramma. Se il convertitore ricade su un'immagine o
su una conversione generica, un banner lo spiega e offre **Riprova**.

## Autosave

- Debounce di 600 ms, una sola scrittura alla volta, con revisione monotona.
- Lo stato è visibile nella barra sotto la testata: **Salvato**, **Modifiche non
  salvate**, **Salvataggio…**, **Errore di salvataggio**.
- Selezione, hover, scroll e zoom non fanno scattare un salvataggio: la firma
  considera solo elementi, `files`, sfondo e griglia.
- Prima di cambiare modalità, diagramma, conversazione o di salvare una
  versione l'app esegue il **flush** dell'autosave.
- In caso di errore non c'è un loop di retry: l'errore resta visibile e viene
  ritentato al prossimo cambiamento, con **Riprova salvataggio** o al flush
  successivo.
- Limite: 25 MB per scena; oltre, il salvataggio fallisce con un messaggio.

## Sorgente cambiato: «Da aggiornare»

La lavagna derivata conserva il **sorgente esatto** da cui è nata
(`base_source`). Se il sorgente cambia — per esempio dopo una modifica AI o un
ripristino — la lavagna non viene toccata e viene marcata **Da aggiornare**.

Da lì:

- **Aggiorna**: rigenera la lavagna dopo una conferma.
- **Salva e aggiorna**: crea prima una versione con lo snapshot della lavagna
  attuale, poi rigenera. È la strada consigliata per non perdere il lavoro
  manuale.
- Il ripristino passa dalla tab **Versioni**: le versioni con lavagna hanno il
  badge `Lavagna`.

Una lavagna **manuale** (`origin = "manual"`) non è mai stale.

## Versioni e ripristino

- **Salva versione** (`Ctrl/Cmd + S`) salva sorgente e snapshot della lavagna.
  La versione viene creata se cambia il sorgente **o** la scena; `Salva e
  aggiorna` forza comunque una versione di sicurezza.
- Ripristino con snapshot: sorgente e lavagna tornano insieme, in una
  transazione.
- Ripristino senza snapshot: il sorgente viene ripristinato, la lavagna resta.
  Se è derivata e il sorgente ripristinato è diverso da `base_source`, diventa
  **Da aggiornare**; se è manuale resta invariata.
- L'eliminazione del diagramma o della conversazione elimina anche lavagna e
  snapshot.

## Export

Dal menu **Esporta** della lavagna:

- PNG 1x/2x/3x, con o senza sfondo;
- SVG con o senza sfondo;
- `.excalidraw` con elementi, `appState` e `files`;
- copia PNG/SVG negli appunti (con fallback: se il binario non è disponibile
  negli appunti WebKit, viene copiato l'SVG come testo).

Gli export/save nativi di Excalidraw sono disabilitati: i download passano
sempre dal dialogo Tauri dell'app.

## Offline, font e link

- I font di Excalidraw sono copiati in `public/excalidraw-assets/fonts` dallo
  script `scripts/copy-excalidraw-assets.mjs`, eseguito prima di `dev` e
  `build`. `window.EXCALIDRAW_ASSET_PATH` punta a `/excalidraw-assets/`: nessuna
  richiesta a CDN.
- `validateEmbeddable={false}`: gli embed iframe sono disabilitati.
- I link `http/https` si aprono nel browser di sistema con il plugin Tauri
  `opener`, non nella webview.

## Libreria Excalidraw e librerie della comunità

- L'icona libreria di Excalidraw, il pulsante **Libreria** nella testata e la
  voce **Apri libreria** nel menu `…` aprono il pannello dell'app
  (`BoardLibraryDialog`), non la sidebar nativa di Excalidraw. È un overlay
  indipendente dal layout dell'editor, quindi funziona anche con il viewer
  espanso.
- Dal pannello si possono salvare gli elementi selezionati, inserirli nella
  lavagna, rinominarli, eliminarli, svuotare la libreria, importare un file
  `.excalidrawlib` e passare al catalogo delle librerie della comunità.
- La rail «Chat» usa `key` stabili su `workspace-core`: espandere il viewer non
  rimonta Excalidraw e non perde scena, undo o selezione.
- La libreria è **globale** (non per lavagna) e vive in SQLite nella tabella
  `excalidraw_library` a riga singola. L'adapter di `useHandleLibrary` carica
  gli elementi all'apertura della lavagna e salva ogni modifica.
- Nel browser di sviluppo (`vite` senza Tauri) lo stesso adapter usa
  `localStorage`, così il flusso resta utilizzabile.
- **Sfoglia librerie** non apre una nuova finestra della webview: intercetta il
  link ufficiale e apre il catalogo integrato. Il catalogo arriva da
  `https://libraries.excalidraw.com/libraries.json` (più `stats.json` per i
  download), viene convalidato e memorizzato in `excalidraw_library_catalog`.
- L'installazione scarica `<origin>/libraries/<source>` e passa il file
  `.excalidrawlib` a `updateLibrary({ merge: true })`; un file locale può
  essere importato dallo stesso dialogo.
- Previews e file sono ammessi dalla CSP solo dal dominio ufficiale. Il limite
  di sicurezza è 25 MB per la libreria e 8 MB per il catalogo.
- Al primo avvio con `user_version = 3` le tabelle vengono create in
  transazione; i DB v1/v2 esistenti migrano senza perdere lavagne o versioni.

## Tastiera

In modalità Lavagna le scorciatoie dell'app sono disattivate: `V`, `H`,
`Delete`, undo/redo Mermaid e `Esc` non intercettano Excalidraw. Restano attivi
`Ctrl/Cmd + S` (salva versione) e tutte le scorciatoie native di Excalidraw.

## Note di implementazione

- **Colori**: il fork non applica `themeVariables` agli elementi semantici e usa
  colori scuri di default. L'app riallinea **solo quei default** ai token del
  tema del diagramma (stroke, testo, riempimento delle forme). Gli stili
  espliciti del sorgente restano invariati.
- **Tema dell'editor**: Excalidraw inverte i colori della scena quando è in
  modalità scura. Poiché le scene sono già generate nei colori del diagramma
  (anche scuri), la lavagna usa sempre il tema chiaro per l'interfaccia
  dell'editor; il foglio conserva i colori congelati alla creazione.
- **Tema congelato**: cambiare il tema del diagramma non riallinea la lavagna;
  serve **Aggiorna** (con snapshot).
- **Persistenza**: tabella `diagram_boards(diagram_id PK, scene_json, origin,
  base_source, created_at, updated_at)` e colonna nullable `board_snapshot` in
  `diagram_versions`; migrazione `user_version = 2` in transazione. La libreria
  Excalidraw globale e la cache del catalogo della comunità usano
  `excalidraw_library` e `excalidraw_library_catalog` (`user_version = 3`).
- **Distribuzione del fork**: l'app consuma
  `@excalidraw/mermaid-to-excalidraw` dal tarball `npm pack` versionato in
  `vendor/` (commit sorgente e sha256 in `vendor/README.md`). È versionato nel
  repo per rendere `npm ci` riproducibile senza il checkout del fork accanto
  all'app. La Release GitHub `fork-v2.4.0` è preparata
  (`.github/workflows/release.yml`) e può sostituire il file locale con l'URL
  dell'asset quando si autorizza il push.

## File principali

- `src/lib/board/scene.ts` — parse/validate/serialize, stale, limiti.
- `src/lib/board/conversion.ts` — wrapper del fork, timeout, qualità.
- `src/lib/board/useBoardAutosave.ts` — autosave single-flight.
- `src/lib/board/export.ts` — PNG/SVG/.excalidraw e appunti.
- `src/lib/board/community.ts` — catalogo ufficiale, ricerca, URL e download.
- `src/lib/board/libraryStore.ts` — persistenza SQLite/localStorage della libreria.
- `src/components/board/` — canvas Excalidraw, primo avvio, barra di stato,
  dialogo delle librerie della comunità.
- `src-tauri/src/db.rs` — schema v4, CRUD lavagna, libreria, catalogo e feedback.
