# Lavagna Excalidraw e convertitore Mermaid-to-Excalidraw — Piano di integrazione

> **Stato**: piano approvato con modifiche dai critici; branch e baseline preparati. Pronto per l'esecuzione in una sessione build pulita. Nessun codice è stato modificato.
>
> **Piano canonico**: `/home/vigliafg/.opencode/plan/2026-10-25-excalidraw-board.md`.
>
> **Lancio**: vedi il Runbook di lancio qui sotto; il Passo 1a è un gate bloccante.

- **Richiesta**: «dovete redarre un piano di integrazione del convertitore mermaid-to-excalidrw e didell'editor excalidraw al massimo delle loro funzionalità nella app. tutto deve integrarsi nella ui e nel workflow ideale dell'utente in maniera semplice e efficace. ogni aspetto della UI va curato in modo da renderla completa ma non confusionaria. l'intera app dve essere un esempio di potenza e semplicità. L'utente deve essere supportato con ogni tipo di supporto utile in ogni fase del workflow.» (verbatim)
- **Obiettivo**: aggiungere a ogni diagramma una seconda superficie, la **Lavagna**, dove il diagramma Mermaid viene convertito in elementi Excalidraw nativi e può essere modificato con l'editor Excalidraw completo, senza perdere il ruolo del sorgente Mermaid come fonte di verità.
- **Criteri di successo**:
  1. Da un diagramma si crea una lavagna con un flusso chiaro (massimo due click), con conversione nativa per i 22 tipi già coperti dal fork e messaggio esplicito quando il risultato è generico o immagine.
  2. La lavagna offre l'editor Excalidraw completo — forme, testo, frecce, immagini, frame, laser, libreria, undo/redo, zoom/pan, proprietà, scorciatoie — offline e in WebKitGTK.
  3. La lavagna si salva automaticamente (scena + `files`) e si riapre al riavvio; il salvataggio è visibile, non perde dati in caso di errore e viene completato prima di cambiare diagramma o conversazione.
  4. Se il sorgente Mermaid cambia (AI o editor), la lavagna non viene sovrascritta: viene marcata «Da aggiornare» e l'utente decide se rigenerarla, con conferma e snapshot di sicurezza.
  5. Le versioni includono, quando presente, anche la lavagna; il ripristino riporta entrambe, oppure lascia la lavagna e la marca da aggiornare.
  6. Export PNG/SVG/.excalidraw e copia appunti dalla lavagna, con i dialoghi di salvataggio dell'app.
  7. UI coerente e non sovraccarica: switch Diagramma/Lavagna, stato, errori, onboarding inline, focus/ARIA, nessuna scorciatoia dell'app che interferisca con Excalidraw.
  8. `npm test`, `npm run typecheck`, `npm run build`, harness del fork 22/22 e smoke Tauri/WebKitGTK verdi; nessuna regressione su chat, libreria, versioni ed export Mermaid.

- **Non-obiettivi**:
  - Round-trip Excalidraw → Mermaid o layout libero dentro Mermaid.
  - Sostituire il viewer Mermaid/Pele o il suo editing strutturato.
  - Documenti «solo lavagna» senza diagramma: la lavagna nasce da un diagramma; «Disegna da zero» è una lavagna manuale dentro un diagramma esistente.
  - Collaborazione realtime, cloud, AI che legge o modifica il JSON Excalidraw.
  - Iframe/embeddable remoti e integrazione Excalidraw+ AI.
  - Nuovi adapter semantici per i tipi oggi generici; questa integrazione usa il fork così com'è.
  - Mobile e ridisegno completo dell'app.

- **Assunzioni**:
  - Il fork viene consumato dall'app come **tarball versionato di una GitHub Release**; non si pubblica sul registry npm.
  - La lavagna è una copia derivata e modificabile; il sorgente Mermaid resta la fonte di verità.
  - Excalidraw è pinnato esattamente a `0.18.0-a9ca16e`, la stessa versione usata dal fork.
  - Le versioni della lavagna sono snapshot espliciti, non una storia separata con diff visuale.
  - Le modifiche alla lavagna non vengono inviate all'AI.

## Runbook di lancio (sessione build pulita)

Questa sezione è operativa: serve a lanciare l'implementazione in una sessione nuova senza dipendere dal contesto della chat in cui il piano è stato discusso.

### 0. Percorsi e fonti

- **Piano canonico**: `/home/vigliafg/.opencode/plan/2026-10-25-excalidraw-board.md`.
- **App**: `/mnt/KINGSTON/mermaid-creator/repo`.
- **Fork**: `/mnt/KINGSTON/mermaid-creator/mermaid-to-excalidraw`.
- La copia in `repo/docs/plans/2026-10-25-excalidraw-board.md` è una copia di lavoro; la sessione build legge il piano canonico qui sopra.
- Se vuoi versionare il piano nel repo, copia il canonico in `repo/docs/plans/2026-10-25-excalidraw-board.md` e committa. Non è necessario per la build, che usa il percorso assoluto.
- Non toccare `repo/src-tauri/modifiche-bus-fiera-dei-morti-1x.png`: è lavoro utente non correlato.

### 1. Pre-flight (già eseguito; ri-verifica rapida)

La preparazione è già stata fatta prima di aprire la sessione build:

- branch app `feat/excalidraw-board`;
- branch fork `feat/board-api`;
- baseline app verde (`npm test`: 73, typecheck, build);
- baseline fork verde (`pnpm test`: 100, harness 22/22, visual 145 + 1 skip).

La sessione build può ri-eseguire i comandi per conferma, ma **non deve ricreare i branch**. Verifica solo di essere sul branch giusto:

```bash
cd /mnt/KINGSTON/mermaid-creator/repo
git branch --show-current   # feat/excalidraw-board

cd /mnt/KINGSTON/mermaid-creator/mermaid-to-excalidraw
git branch --show-current   # feat/board-api
```

Ri-verifica completa, se serve:

```bash
cd /mnt/KINGSTON/mermaid-creator/repo
source scripts/env.sh
npm test && npm run typecheck && npm run build
```

```bash
cd /mnt/KINGSTON/mermaid-creator/mermaid-to-excalidraw
source /mnt/KINGSTON/mermaid-creator/repo/scripts/env.sh
pnpm test && pnpm harness:strict && pnpm test:visual
```

Se una baseline è rossa, fermarsi: non è il momento di iniziare l'integrazione. Non aggiornare snapshot o baseline per far passare i test.

Verificare l'accesso GitHub per il fork e per la Release:

```bash
gh auth status
ssh -T git@github.com
```

Se `gh` non è disponibile o non è autenticato, la sessione build può produrre il tarball in locale e chiedere istruzioni; non deve sostituire in silenzio il tarball con una dipendenza `file:` diversa dal piano.

### 2. Aprire la sessione

- Working directory: `/mnt/KINGSTON/mermaid-creator/repo`.
- Agente: **build**, non Plan.
- Non serve ripetere il piano nella chat: basta il percorso canonico.

### 3. Prompt da incollare nella sessione build

```text
Leggi per intero:
/home/vigliafg/.opencode/plan/2026-10-25-excalidraw-board.md

Sei in modalità build. Implementa il piano in ordine.

Contesto:
- App: /mnt/KINGSTON/mermaid-creator/repo
- Fork: /mnt/KINGSTON/mermaid-creator/mermaid-to-excalidraw
- Branch già pronti: feat/excalidraw-board (app) e feat/board-api (fork).
- Baseline già verde; ri-eseguila solo se sospetti modifiche o se il Runbook §1 lo richiede.

Regole:
- Parti dal Passo 1: spike Excalidraw in Tauri + fork consumabile.
- Il Passo 1a è un gate bloccante: verifica WebKitGTK, font offline, CSP, disegno, onChange, updateScene ed export PNG/SVG. Se fallisce, fermati e riporta, non passare al resto.
- Rispetta i limiti del piano: nessun round-trip Excalidraw→Mermaid, fork via tarball GitHub Release, embed iframe disabilitati, export nativo Excalidraw disabilitato in favore dell'export app-level, nessun documento solo-lavagna, tema della lavagna congelato alla creazione, azioni secondarie dell'header nel menu.
- Non toccare src-tauri/modifiche-bus-fiera-dei-morti-1x.png: è lavoro utente non correlato.
- Esegui i test indicati nel piano dopo ogni passo.
- Commit atomici. Non fare push, tag o release GitHub senza chiedermelo.
- Non modificare il piano in autonomia: se serve un cambio, proponilo e attendi.
- Dopo il Passo 1 riporta: esito dello spike, modifiche fatte al fork, test eseguiti, rischi residui. Poi attendi il mio OK per il Passo 2.
```

### 4. Gate e checkpoint

- **Passo 1a**: se Excalidraw non funziona in WebKitGTK con font locali, CSP e export, fermarsi e riprogettare. Non costruire persistenza e UI sopra una base non verificata.
- **Passo 1 completo**: riportare esito spike, modifiche fork, tarball/Release, test eseguiti e rischi residui. Attendere OK.
- **Passi 2-5**: un checkpoint per passo; MVP a fine Passo 5.
- **Passo 6**: hardening, export, documentazione e verifica finale.

### 5. Permessi e pubblicazione

Policy predefinita: **niente push, tag o release GitHub senza autorizzazione esplicita**. Se si autorizza l'automazione, la sequenza è:

1. fork: commit, merge su `main`, tag `fork-v2.4.0`, workflow che produce e allega il tarball `npm pack` alla Release;
2. app: aggiornamento della dipendenza al tarball esatto e `package-lock.json`;
3. app: commit/push del branch `feat/excalidraw-board`.

Senza autorizzazione, la sessione build si ferma prima di push/tag/Release e chiede il via.

### 6. Condizioni da confermare prima del via

1. La lavagna è una copia derivata; nessun round-trip verso Mermaid.
2. Il fork si consuma come tarball di una GitHub Release (`fork-v2.4.0`), non da npm.
3. Embed iframe disabilitati ed export/save nativi di Excalidraw nascosti in favore dell'export app-level.
4. Nessun documento «solo lavagna» in v1; «Disegna da zero» esiste solo dentro un diagramma.
5. Il tema della lavagna è congelato alla creazione; per riallinearlo serve «Aggiorna da Mermaid» con snapshot.
6. In modalità Lavagna le azioni secondarie dell'header passano nel menu `…`.

Se una di queste condizioni non va bene, va cambiato il piano prima di lanciare la sessione build.

## Vincoli dal repository

- Nessun `AGENTS.md`: le regole operative sono in README e script. Test app: `npm test`, `npm run typecheck`, `npm run build` (`package.json:6-14`); non c'è lint.
- App Tauri 2 + React 19 + Mermaid 12.2.0 (`package.json:17-31`). `renderDiagram` usa Pele come renderer primario e Mermaid lazy come fallback (`src/lib/diagram.ts:231-268`); il tema Mermaid è `mermaidThemeVariables` (`src/lib/diagram/theme.ts:510-546`).
- Workspace attuale: header, toolbar, stage e fascia destra con tab Elemento/Tema/Versioni/Sorgente (`src/components/WorkspacePane.tsx:777-1211`); `DiagramStage` gestisce selezione e viewport (`src/components/workspace/DiagramStage.tsx:84-543`).
- Guardie sorgente: invio AI bloccato se `diagramDirty` (`src/store.ts:271-286`); cambio diagramma bloccato se dirty (`:538-550`); versioni create solo se il sorgente cambia (`src-tauri/src/db.rs:736-760`); restore (`:817-835`).
- DB v1 senza lavagna (`src-tauri/src/db.rs:85-170`); `diagram_versions` ha solo source/origin (`:149-160`); la cancellazione di una conversazione elimina i diagrammi non in libreria (`:254-268`).
- CSP Tauri: `default-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src` solo IPC/dev (`src-tauri/tauri.conf.json:27`). Excalidraw di default scarica i font dal CDN (`node_modules/@excalidraw/excalidraw/README.md:118-124`): senza self-hosting la lavagna è rotta offline.
- Fork: 22/22 tipi nativi (`mermaid-to-excalidraw/FORK.md:59-72`), Mermaid 12.2.0 e Excalidraw `0.18.0-a9ca16e` (`package.json:33,41`). Excalidraw 0.18 dichiara peer React `^17.0.2 || ^18.2.0 || ^19.0.0` (`mermaid-to-excalidraw/node_modules/@excalidraw/excalidraw/package.json`), quindi React 19 è dichiarato compatibile; la verifica reale in WebKitGTK resta nello spike. Gli import di Excalidraw nel fork sono **solo di tipo** (`src/converter/transformToExcalidrawSkeleton.ts:1-6`, `src/converter/types/flowchart.ts:2-6`, `src/converter/types/state.ts:2-6`), ma il pacchetto non dichiara Excalidraw come peer: le dichiarazioni `.d.ts` pubblicate non si compilano in un consumer senza quella dipendenza.
- API fork: `parseMermaidToExcalidraw(definition, config)` con `themeVariables` tipate solo `fontSize` (`src/index.ts:5-61`); il fork renderizza Mermaid internamente (`src/parseMermaid.ts:102-210`), usa `GraphImage` come fallback (`:207-210`) e serializza le chiamate Mermaid con una coda interna (`src/mermaidExecutionQueue.ts:18`).
- `dist` del fork non è committato (`mermaid-to-excalidraw/.gitignore:2`) e non c'è `prepare`: un git dependency non è affidabile senza build.
- Header workspace denso di azioni secondarie (`WorkspacePane.tsx:796-836`), toolbar (`:839-1014`), fascia destra (`:1074-1211`). La chat mostra card diagramma con «Apri» (`src/components/ChatPane.tsx:157-175`).

## Stato attuale

Il workspace è già un editor Mermaid bidirezionale con tema, stili, versioni, export e libreria. Non esiste alcuna nozione di lavagna né una tabella per scene Excalidraw; Excalidraw non è una dipendenza dell'app. Il fork è pronto come convertitore (22/22) ma non è impacchettato per il consumo npm e non espone metadati di qualità né il tema completo.

## Approccio proposto

### 1. Due superfici, una fonte di verità

Ogni diagramma ha due viste:

- **Diagramma**: Mermaid/Pele, editing strutturato, target dell'AI.
- **Lavagna**: Excalidraw, editing libero.

Lo switch è nel header. La lavagna è una copia derivata con `origin: "diagram"` e `baseSource` esatto; oppure `origin: "manual"` se l'utente sceglie «Disegna da zero». Le modifiche alla lavagna non riscrivono mai il sorgente. La lavagna può essere aggiornata dal diagramma solo con un'azione esplicita, conferma e snapshot di sicurezza.

### 2. Persistenza separata

Nuova tabella `diagram_boards(diagram_id PK, scene_json, origin, base_source, created_at, updated_at)`. `scene_json` è il documento Excalidraw completo (elements + appState + files), perché le immagini e le icone prodotte dal fork vivono in `files`. Una sola colonna nullable `board_snapshot` in `diagram_versions` conserva lo snapshot della lavagna dentro le versioni esistenti; non si crea una seconda storia separata. Migrazione additiva `user_version=2`, eseguita in transazione.

Autosave: debounce ~600 ms, scritture **single-flight** con revisione monotona, flush prima di cambio diagramma/conversazione/modalità, stato visibile e limite di dimensione (25 MB) con errore esplicito. Niente loop di retry: un errore resta visibile e viene ritentato al successivo cambiamento o flush. La firma di salvataggio ignora selezione, hover, scroll e zoom: salva solo variazioni di elementi, `files`, sfondo e griglia, usando `serializeAsJSON` per non persistere stato effimero. L'autosave non modifica `base_source` né `origin`: li impostano solo creazione e rigenerazione.

### 3. Conversione

`src/lib/board/conversion.ts` chiama il fork con `theme: "base"`, `fontFamily`, `themeVariables` dell'app (stessi colori del diagramma) e `flowchart.curve`, poi `convertToExcalidrawElements`. Il fork restituisce anche `type` e `quality` (`semantic | generic | image`) per messaggi onesti.

Le chiamate Mermaid dell'app e del fork passano dalla stessa coda (`runMermaidTaskSequentially`, riesportata dal package index), per evitare race su `mermaid.initialize`/render. Timeout semplice; nessuna sovrascrittura della lavagna esistente se la conversione fallisce. I testi della lavagna usano i font Excalidraw, non il font del tema Mermaid: è una scelta deliberata per mantenere l'identità dell'editor, non un tentativo di parità tipografica.

L'opzione «Inserisci come immagine» usa l'SVG **del render corrente dell'app** (Pele o Mermaid), non il `GraphImage` interno del fork: è l'unico modo per promettere fedeltà all'anteprima. Il fallback immagine del fork viene invece etichettato come «immagine Mermaid».

### 4. UI e workflow

- **Header**: switch segmentato `Diagramma | Lavagna`, titolo + tipo, stato salvataggio, «Salva versione», «Esporta», «Espandi». In modalità Lavagna le azioni secondarie (libreria, preferito, rinomina, elimina) passano in un menu `…`; la toolbar Mermaid e la fascia destra spariscono, lasciando spazio ai pannelli nativi di Excalidraw.
- **Prima apertura senza lavagna**: card inline con «Crea lavagna modificabile» (primaria) e «Disegna da zero» (secondaria). «Inserisci come immagine» resta un'azione secondaria nel menu, non una terza scelta paritaria. Due righe spiegano che il diagramma resta la fonte di verità.
- **Conversione**: spinner con stato testuale e timeout, nessuna finta pipeline a fasi e nessun cancel. A fine `scrollToContent`. Se il fork ricade su immagine o generic, banner con spiegazione e «Riprova».
- **Lavagna esistente**: barra sottile con stato «Generata dal diagramma», «Lavagna libera» o «Da aggiornare». Se da aggiornare: «Aggiorna» con conferma e «Salva e aggiorna»; il ripristino passa dalla tab Versioni, non da un undo di sessione.
- **AI**: la chat resta visibile; un aggiornamento AI del sorgente marca la lavagna da aggiornare, non la tocca. La card diagramma in chat ha anche «Lavagna». In lavagna «Apri diagramma» riporta al sorgente e «Modifica con l'AI» riporta al Diagramma mettendo a fuoco la chat con quel diagramma come target, senza inviare nulla automaticamente. Una nota dice che l'AI modifica il diagramma, non il disegno.
- **Errori**: sorgente non renderizzabile, conversione fallita, autosave fallito, scena troppo grande: card azionabili (Riprova, Apri sorgente, Lavagna vuota, Inserisci immagine).
- **Tastiera**: in modalità Lavagna le scorciatoie dell'app sono disattivate (`V`, `H`, `Delete`, undo Mermaid); `Ctrl/Cmd+S` salva la versione; `Esc` non chiude la lavagna. Excalidraw gestisce undo/redo, tool e zoom.
- **Onboarding**: nessuna modale aggiuntiva; card inline, tooltip e documentazione `docs/board.md`.

### 5. Sincronizzazione, versioni, AI

- `baseSource` esatto: `stale = origin === "diagram" && board.baseSource !== source`. Una lavagna manuale (`baseSource = null`) non è mai stale. Nessun auto-merge.
- Restore senza snapshot: si ripristina il sorgente, la lavagna resta; se è derivata e il sorgente ripristinato differisce da `baseSource` diventa stale, se è manuale resta invariata. Restore con snapshot: si ripristinano entrambi in una transazione.
- «Salva versione» salva sorgente + snapshot lavagna; crea una versione se cambia il sorgente **o** la scena. Prima dello snapshot si esegue il flush dell'autosave. Le versioni mostrano un badge «Lavagna».
- `diagrams_sync`/AI non toccano la lavagna. `deleteDiagram` e la cancellazione di una conversazione rimuovono board e snapshot.
- Passaggio a Lavagna con sorgente dirty: si salva prima; se il salvataggio fallisce, si resta su Diagramma.

### 6. Export, offline, sicurezza

- Export app-level: PNG 1x/2x/3x con/senza sfondo, SVG con/senza sfondo, `.excalidraw`, copia PNG/SVG. Si riusa il menu e il dialogo Tauri già presenti per il diagramma; gli export/save nativi di Excalidraw vengono disabilitati per evitare download browser incoerenti.
- Font self-hosted: script che copia `node_modules/@excalidraw/excalidraw/dist/prod/fonts` in `public/excalidraw-assets/fonts`, `window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/"` prima dell'import lazy; nessuna richiesta CDN.
- Link esterni aperti nel browser di sistema (plugin opener), non nella webview; embeddable iframe disabilitati per policy offline/sicurezza.
- Scena validata prima del load; nessuno script; limite dimensione; migrazione solo additiva.

## Passi

### 1. Fondamenta: spike Excalidraw e fork consumabile — S/M

File: `package.json`, `src/main.tsx`, `src/components/board/BoardSpike.tsx` (temporaneo), `scripts/copy-excalidraw-assets.mjs`, `src-tauri/tauri.conf.json`, fork `src/index.ts`, `src/parseMermaid.ts`, `package.json`, `.github/workflows/release.yml`.

- **1a. Spike Tauri** (gate bloccante): dipendenza esatta Excalidraw, import CSS, font self-hosted, `EXCALIDRAW_ASSET_PATH`, scena statica, disegno, undo/zoom, `onChange`, `updateScene`, export PNG/SVG, clipboard, link, warning peer React 19, prova offline con CSP reale. Se WebKitGTK/canvas/font non reggono, ci si ferma e si riprogetta.
- **1b. Fork pronto al consumo**: riesportare `runMermaidTaskSequentially` dal package index; ampliare solo i **tipi** di `MermaidConfig` (`theme`, `fontFamily`, `themeVariables` generiche), senza cambiare i default; restituire `type` e `quality`; dichiarare `@excalidraw/excalidraw` come peer dependency (serve per le `.d.ts`); pubblicare `fork-v2.4.0` e il tarball `npm pack` su GitHub Release.
- **1c. App**: dipendenza dal tarball esatto con `package-lock.json` aggiornato, stessa versione Excalidraw del fork, una sola copia Mermaid, fallback Mermaid dell'app dentro `runMermaidTaskSequentially`.
- Verifica: fork `pnpm build`, `pnpm test` (100), `pnpm harness:strict` (22/22), `pnpm test:visual` **senza** aggiornare gli snapshot; app `npm ci`, `npm run build`, `npm ls mermaid`; spike in Tauri. Rischio: WebKitGTK, font, peer/tarball. **S/M**

### 2. Modello e persistenza — M

File: `src-tauri/src/db.rs`, `src-tauri/src/models.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/types.ts`, `src/lib/ipc.ts`, `src/lib/board/scene.ts` (nuovo), test.

- Migrazione v2 in transazione con `user_version` impostato solo a commit; tabella `diagram_boards`, colonna `board_snapshot` su `diagram_versions`, comandi get/save/delete, cleanup su delete diagramma e conversazione.
- Helper puri per scena: parse/validate/serialize, `origin`, `baseSource`, stale, conteggio elementi/files, size guard.
- Test: migrazione da DB v1, rollback su errore intenzionale, CRUD, cascade, round-trip scena, limite dimensione; test Rust in-memory + Vitest. Rischio: migrazione e perdita dati. **M**

### 3. Conversione e shell Lavagna — M

File: `src/lib/board/conversion.ts` (nuovo), `src/lib/diagram.ts`, `src/components/WorkspacePane.tsx`, `src/components/board/BoardCanvas.tsx` (nuovo), `BoardFirstRun.tsx`, `BoardStatusBar.tsx`, `src/styles.css`, `src/store.ts`.

- Wrapper fork con tema, `quality`, statistiche, errori tipizzati, timeout; nessuna scrittura DB.
- Switch Diagramma/Lavagna; caricamento lazy di Excalidraw; first-run a due scelte (+ immagine secondaria); spinner/errori; hide toolbar e fascia; layout a tutta altezza; espansione; isolamento CSS; focus/ARIA; blocco delle scorciatoie app in board.
- Verifica: 900/1280/fullscreen; tre percorsi first-run; nessuna interferenza di `V/H/Delete/undo`; conversione dei 4 tipi rappresentativi (flowchart, sequence, ER, gantt/pie) in Tauri; harness fork per gli altri. Rischio: CSS/WebKit, spazio ridotto. **M**

### 4. Autosave, versioni e navigazione — M

File: `src/lib/board/useBoardAutosave.ts` (nuovo), `src/store.ts`, `WorkspacePane.tsx`, comandi Rust, test.

- Autosave single-flight con revisione, debounce, flush su cambio modalità/diagramma/conversazione/visibilità; stato «Salvato/Salvataggio/Errore»; nessun retry loop.
- «Salva versione» con snapshot lavagna; restore che ricarica la board; badge «Lavagna»; delete pulito; guardie di navigazione che attendono il flush.
- Verifica: edit → riavvio → scena identica; edit rapidi; errore DB simulato; versione con/senza lavagna; restore derivata/manuale; delete. Rischio: perdita ultime modifiche. **M**

### 5. Sincronizzazione, AI e supporto al workflow — M

File: `WorkspacePane.tsx`, `BoardStatusBar.tsx`, `src/store.ts`, `src/components/ChatPane.tsx`, `src/lib/board/scene.ts`.

- Stale indipendente dall'origine come definito sopra; banner «Da aggiornare»; «Aggiorna» con conferma e snapshot pre-rigenerazione; ripristino dalla tab Versioni; lavagna manuale.
- AI che cambia il sorgente → stale, mai sovrascritta; card chat «Lavagna»; «Modifica con l'AI» che riporta al Diagramma e mette a fuoco la chat senza inviare; dirty-save prima dello switch; conversione disabilitata durante lo streaming.
- Verifica: AI cambia sorgente → stale; aggiorna → snapshot + ripristino; manuale → nessuno stale; chat → board; errore conversione non tocca la lavagna. Rischio: lavoro manuale. **M**

### 6. Export, sicurezza, rifinitura e documentazione — M/L

File: `src/lib/board/export.ts` (nuovo), `WorkspacePane.tsx`, `src-tauri` (opener), `src-tauri/tauri.conf.json`, `README.md`, `docs/board.md`, `docs/viewer-editor.md`, test.

- Export PNG 1x/2x/3x con/senza sfondo, SVG con/senza sfondo, `.excalidraw`, copia PNG/SVG; disabilitare export/save nativi Excalidraw dopo lo spike; link esterni con opener; embed off; validazione scena.
- Rifinitura: menu azioni secondarie in board, copy italiana, tooltip, badge qualità/stato, prima esperienza, performance su un flowchart da 150 nodi, budget bundle/startup, accessibilità, documentazione.
- Verifica: PNG/SVG/.excalidraw riaperti, immagini incluse, nessuna richiesta remota, link nel browser, clipboard fallback, smoke WebKit, tutti i gate. Rischio: font/clipboard/export. **M/L**

**Totale: L.** MVP utilizzabile a fine **passo 5**; il passo 6 è hardening, export e documentazione.

## Alternative considerate (e perché scartate)

- **Sostituire il viewer con Excalidraw**: perde editing strutturato, tema e fonte di verità; scartato.
- **Auto-sync a ogni modifica AI**: distrugge il lavoro manuale; scartato in favore dello stale esplicito.
- **Board nel record `diagrams`**: gonfia le liste e le query; scartata la colonna, si usa una tabella separata.
- **Solo immagine SVG**: perde l'editabilità nativa; resta un'opzione secondaria per la fedeltà all'anteprima.
- **Convertire l'SVG corrente invece di ri-renderizzare Mermaid**: gli adapter semantici usano il DB Mermaid; l'immagine resta il fallback fedele.
- **Iframe/webview Excalidraw remoto**: offline/CSP/privacy; scartato.
- **Publish npm del fork**: scartato in favore del tarball GitHub Release, più semplice e versionato per un solo consumer.
- **Export nativo Excalidraw**: scartato in Tauri per download incoerenti; export app-level.
- **Rimappare i colori Excalidraw lato app dopo la conversione**: duplica la logica del tema, perde sfumature e richiede di riscrivere ogni elemento; scartato in favore del passaggio `themeVariables` al render Mermaid del fork (i default del fork restano invariati, quindi nessun re-baseline visual).

## Riconciliazione del Concilio

| # | Rilievo | Chi | Severità | Decisione | Motivo |
|---|---|---|---|---|---|
| 1 | Le versioni salvano solo se cambia il sorgente; la sola lavagna non verrebbe salvata | Luna | MAJOR | Accettato | La versione viene creata se cambia sorgente **o** scena, in transazione |
| 2 | Autosave senza ordine/flush: rischio scritture fuori ordine e perdita su navigazione | Luna | MAJOR | Accettato | Single-flight con revisione, flush atteso prima di navigazione/delete, errore visibile |
| 3 | Stale/restore incoerente per lavagne manuali | Luna | MAJOR | Accettato | `baseSource` esatto; manuale = mai stale; restore senza snapshot lascia la board e la rende stale solo se derivata |
| 4 | Migrazione v2 non crash-safe (v1 imposta `user_version` prima dello schema) | Luna | MAJOR | Accettato | Migrazioni in transazione, `user_version` a commit, test di rollback |
| 5 | «Inserisci come immagine» non è fedele se usa il `GraphImage` del fork | Luna | MAJOR | Accettato | L'immagine usa l'SVG del render corrente dell'app; il fallback del fork ha un'etichetta diversa |
| 6 | Il cambio tema non è rappresentato nello stato stale | Luna | MINOR | Accettato come limite | Il tema è congelato alla creazione; la barra lo spiega e «Aggiorna» è l'unico riallineamento |
| 7 | Gli import Excalidraw nel fork sono type-only; la motivazione peer era imprecisa | Luna | MINOR | Accettato | Peer dependency serve per le `.d.ts`; test del tarball con typecheck consumer |
| 8 | React 19/WebKit/API Excalidraw non verificati | Luna/GLM | MAJOR | Accettato come gate | Spike bloccante con checklist estesa a `onChange`/`updateScene`/export/font |
| 9 | Piano troppo grande (9 passi, L) | GLM | BLOCKER | Accettato in parte | Ridotto a 6 passi; tagliati retry, fasi/cancel, undo di sessione, matrice manuale 22, refactor completo header; restano i requisiti utente |
| 10 | Pipeline GitHub Release del fork: cerimonia per un consumer | GLM | MAJOR | Accettato in parte | Si tiene il tarball perché `npm ci` in CI non ha il fork; niente npm publish, workflow minimo |
| 11 | L'espansione `themeVariables` cambia 146 snapshot visual | GLM | MAJOR | **Rifiutato** | Si ampliano solo i tipi, i default del fork restano identici; `pnpm test:visual` senza update è il test. Il remap app-side è più complesso e perde il tema Mermaid |
| 12 | Snapshot lavagna nelle versioni è YAGNI | GLM | MAJOR | Accettato in parte | Una sola colonna nullable, nessuna storia separata; badge solo nella lista versioni. Serve a non perdere lavoro manuale su restore/rigenerazione |
| 13 | Retry autosave su SQLite locale è over-engineering | GLM | MAJOR | Accettato | Rimosso il loop; resta un errore visibile e il ritentativo al prossimo cambiamento/flush |
| 14 | «Inserisci come immagine» duplica l'anteprima | GLM | MINOR | Accettato in parte | Non è una terza scelta paritaria: è un'azione secondaria per la fedeltà |
| 15 | Fasi di progresso e cancel sono UI immaginata | GLM | MINOR | Accettato | Spinner, stato testuale, timeout; niente cancel |
| 16 | Matrice export 8 varianti è troppo | GLM | MINOR | Accettato in parte | Si riusa il menu export esistente; test automatici su 3 percorsi, smoke su 1 |
| 17 | Undo di sessione ridondante con lo snapshot | GLM | MINOR | Accettato | Rimosso; si ripristina dalla tab Versioni |
| 18 | Documentazione e matrice 22 manuale gonfiano il passo finale | GLM | MINOR | Accettato | Un solo `docs/board.md` + README; harness fork + smoke di 4 tipi rappresentativi |
| 19 | La coda Mermaid è già esportata | GLM | MINOR | Accettato | È esportata dal modulo, non dal package index: si aggiunge il re-export e si usa nel chiamante |
| 20 | React 19 data per scontata | GLM | MINOR | Accettato | Dichiarata come ipotesi da confermare nello spike |

Nessun BLOCKER resta aperto. Restano un rifiuto motivato (#11) e alcune accettazioni parziali (#6, #9, #10, #12, #14, #16); tutte le altre sono accettazioni piene.

## Verdetto dei critici

- **Luna**: `APPROVE_WITH_CHANGES` — «direzione valida, ma restano lacune concrete su persistenza/versioni e alcuni requisiti tecnici sono ancora da verificare». 0 BLOCKER, 5 MAJOR, 2 MINOR; dopo la riconciliazione i MAJOR sono chiusi, la compatibilità WebKit/React resta da dimostrare nello spike.
- **GLM**: `APPROVE_WITH_CHANGES` — «architettura e guardie giuste, ma la v1 è gonfia: via la pipeline di release del fork, gli snapshot lavagna nelle versioni, il retry autosave, l'undo di sessione, la matrice export e le fasi di progresso; il piano scende da 9 passi M/L a circa 7 passi S/M senza perdere nessun criterio utente». 1 BLOCKER, 3 MAJOR, 8 MINOR; il BLOCKER è risolto riducendo a 6 passi e tagliando le raffinatezze non richieste.

**Stato dell'assenso**: piano approvato **con modifiche** da entrambi i critici al primo giro; la tabella di riconciliazione chiude i rilievi e non lascia BLOCKER aperti. I verdetti citati sono quelli scritti dai critici, non un secondo verdetto dopo i tagli. Restano da accettare esplicitamente i limiti dichiarati e l'OK dell'utente prima dell'implementazione. Confidenza: media-alta, subordinata allo spike Tauri/WebKitGTK.

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Excalidraw non funziona bene in WebKitGTK (canvas, font, pointer, clipboard) | Lavagna inutilizzabile | Spike bloccante al passo 1; font locali; smoke reale; se fallisce, stop e riprogettazione |
| Perdita della lavagna su rigenerazione/restore | Lavoro manuale perso | Conferma, snapshot pre-rigenerazione, ripristino dalla tab Versioni, nessuna sovrascrittura su errore |
| Race Mermaid tra app e fork | Render instabili o layout sbagliato | Coda condivisa riesportata dal fork e usata nel fallback Mermaid dell'app |
| Scene con `files` grandi | DB gonfio, autosave lento | Limite 25 MB, messaggio, nessun auto-delete, misura del payload |
| Migrazione DB | Diagrammi/versioni illeggibili | Transazione, `user_version` a commit, test da v1 e rollback |
| Doppia copia Mermaid/Excalidraw | Bug di versione e bundle duplicato | Versioni exact, peer dependency, `npm ls`, dedupe |
| UI confusionaria con due superfici | L'utente non capisce dove lavorare | First-run a due scelte, una sola barra, toolbar Mermaid nascosta in board, copy esplicita, docs |
| Fedeltà Pele vs Mermaid | La lavagna non è identica all'anteprima | Tema passato al fork, nota esplicita, opzione immagine dal render corrente |
| Conflitto tastiera | Undo/Delete sbagliati | Handler app disattivato in board; test manuale di V/H/Delete/Ctrl+S |
| CDN/CSP | Font mancanti offline | Font self-hosted, prova offline, nessun embed remoto |
| Restore senza snapshot | Lavagna non coerente col sorgente | Board lasciata e marcata stale se derivata; manuale invariata; documentato |

## Test e verifica

**Fork**
- `pnpm build`, `pnpm test` (100 test), `pnpm harness:strict` (22/22), `pnpm test:visual` **senza** `--update-snapshots` per dimostrare che i default non cambiano.
- Test del tarball: installazione in un progetto consumer minimo con typecheck delle `.d.ts`.
- Verifica che l'API restituisca `type`/`quality` e che `runMermaidTaskSequentially` sia importabile dal package index.

**App**
- `npm test`, `npm run typecheck`, `npm run build`.
- Nuovi test: scena round-trip, stale derivata/manuale, restore con/senza snapshot, size guard, mapping quality/errori, revisione autosave.
- Test Rust in-memory: migrazione v1→v2, rollback, CRUD board, cascade delete, versione con sola board, restore.
- Smoke Tauri/WebKitGTK offline: font, disegno, testo, immagini, undo/redo, zoom, pan, tastiera, autosave/riavvio, export PNG/SVG/.excalidraw, link esterno, clipboard.
- 4 tipi rappresentativi in Tauri (flowchart, sequence, ER, gantt/pie); i 22 tipi restano coperti dall'harness del fork.
- Performance: flowchart da 150 nodi, misura di conversione, pan/zoom e payload autosave; nessun freeze percepibile.

**Manuale**
- 22 tipi dal catalogo/chat: verifica a campione con harness, non 22 smoke ripetuti.
- Errore intenzionale del sorgente, conversione fallita, AI che cambia il sorgente, restore versione con/senza lavagna, delete diagramma/conversazione, cambio tema, corsia stretta 900 px.

## Criteri di accettazione

1. Da un diagramma si crea una lavagna in ≤2 click; i 22 tipi producono elementi; qualità/immagine spiegata.
2. Editor Excalidraw completo e offline; font locali; nessun errore CSP; scorciatoie isolate.
3. Autosave, riapertura e flush prima della navigazione; errore visibile; nessuna perdita.
4. AI/sorgente cambia → lavagna stale, mai sovrascritta; aggiorna con snapshot e ripristino da Versioni.
5. Versioni con lavagna; restore coerente; delete pulito; migrazione v1→v2 testata.
6. Export PNG/SVG/.excalidraw/copia funzionanti dai dialoghi dell'app.
7. UI coerente, accessibile, non confusionaria; README e `docs/board.md` aggiornati.
8. Tutti i gate verdi e nessuna regressione su chat, libreria, versioni ed export Mermaid.

## Domande aperte / condizioni per l'assenso

1. **Nessun round-trip**: accettare che la lavagna sia una copia derivata e che le modifiche Excalidraw non tornino nel sorgente Mermaid.
2. **Distribuzione fork**: accettare il tarball di una GitHub Release (`fork-v2.4.0`) come dipendenza dell'app, invece della pubblicazione npm.
3. **Funzioni disabilitate**: accettare embed iframe off e export/save nativi di Excalidraw nascosti in favore dell'export app-level.
4. **Nessun documento solo-lavagna**: «Disegna da zero» esiste solo dentro un diagramma; una lavagna bianca svincolata è un lavoro futuro.
5. **Tema congelato**: la lavagna conserva i colori della creazione; per riallinearla serve «Aggiorna da Mermaid» (con snapshot).
6. **Header**: in modalità Lavagna le azioni secondarie passano nel menu `…`; confermare che è il compromesso giusto tra completezza e pulizia.
