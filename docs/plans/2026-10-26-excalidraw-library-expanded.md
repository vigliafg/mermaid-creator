# Fix apertura libreria Excalidraw con viewer espanso

- **Richiesta**: «nessuno dei tre modi legati all'apertura della libreria con il viewport è espando ha effetto. per aiutarti a trovare il fix tipasso in modalita "Council"»
- **Obiettivo**: far aprire il pannello libreria Excalidraw, al primo click, dall'icona nativa, dal pulsante nella testata e dalla voce nel menu `…` anche quando `viewerExpanded` è true.
- **Criteri di successo**:
  1. In modalità espansa i tre accessi aprono il pannello al primo click.
  2. Espandere/collassare non perde scena, undo/redo, selezione, zoom o autosave.
  3. In modalità standard il comportamento resta identico.
  4. `npm test`, `npm run typecheck`, `npm run build` verdi; smoke Tauri/WebKitGTK superato.
- **Non-obiettivi**: ridisegnare la libreria Excalidraw, cambiare il catalogo community, aggiornare `@excalidraw/excalidraw`, modificare la persistenza SQLite.
- **Assunzioni**: l'utente esegue `./scripts/run.sh` con HMR; il pulsante e la voce di menu aggiunti nella sessione precedente restano come accessi espliciti; il comportamento corretto in modalità standard è il riferimento.

## Vincoli dal repository

- Avvio di sviluppo: `./scripts/run.sh` → `npm run tauri:dev` (`scripts/run.sh:1-16`).
- Gate richiesti dal README: `npm test`, `npm run typecheck`, `npm run build` (`README.md:118-121`).
- Nessuna dipendenza nuova: il repo non ha `jsdom`/Testing Library; i test sono logici (`package.json:6-14`).
- Documentazione della lavagna in `docs/board.md`; un fix che cambia il comportamento va allineato lì.

## Stato attuale

Fatti verificati:

- `src/store.ts:770`: `toggleViewerExpanded` inverte `viewerExpanded`.
- `src/App.tsx:42`: la classe `viewer-expanded` è applicata a `.app-shell`.
- `src/components/WorkspacePane.tsx:1122-1124` e `1132-1134`: quando `viewerExpanded` è true, `<RestoreRail>` viene inserita **prima** di `<div className="workspace-core">`; entrambi i rami sono senza `key`.
- `src/styles.css:2629-2666`: in expanded `.app-shell` diventa flex, sidebar/app-main spariscono, `.workspace-pane.is-expanded` diventa row e la rail è larga 32px.
- `src/components/WorkspacePane.tsx:1578-1581`: `onReady` assegna `boardHandleRef.current = handle` senza verificare che `handle.api` sia valorizzata.
- `src/components/board/BoardCanvas.tsx:237-256`: `onExcalidrawAPI` chiama `onReady?.({ api, ... })`; alla smontaggio Excalidraw richiama lo stesso callback con `null`, quindi il parent può ricevere un handle con `api: null`.
- `src/components/WorkspacePane.tsx:707-723`: `openBoardLibrary` legge `boardHandleRef.current?.api`, controlla `isDestroyed` e chiama `api.updateScene({ appState: { openSidebar: { name: "default", tab: "library" } } })` dentro `setTimeout(0)`.
- `src/components/WorkspacePane.tsx:1292-1300` e `1344-1349`: pulsante testata e voce menu chiamano `openBoardLibrary`.
- `src/components/board/BoardCanvas.tsx:144-151`: guard `pointerdown` in capture su `.sidebar-trigger__label-element` con `stopPropagation`.
- `src/components/board/BoardCanvas.tsx:117-134`: interceptor del link «Sfoglia librerie».
- `src/components/board/BoardCanvas.tsx:261-277`: `onChange` ignora `openSidebar` nella firma, quindi non osserva lo stato del pannello.
- `src/components/board/CommunityLibraryDialog.tsx:146-152` e `166-172`: il repo usa già `api.updateLibrary({ openLibraryMenu: true })` per aprire la libreria dopo un'installazione. È un percorso alternativo provato.

Osservazioni runtime (non riproducibili dal solo repo):

- In modalità standard l'icona nativa apre il pannello e il link «Sfoglia librerie» compare.
- In modalità espansa l'hit-testing su icona libreria e toolbar restituisce elementi Excalidraw corretti, ma il pannello non compare.
- Il test su Wayland nativo non è affidabile: la finestra era coperta da Konsole e WebKit può sospendere il rendering per occlusione.

## Diagnosi

**Causa principale (alta confidenza, da confermare con il passo 0)**: l'inserimento condizionale della rail cambia gli indici dei figli non-keyed di `<aside>`. React riconcilia per indice e tipo: quando `viewerExpanded` passa da false a true, il vecchio fiber di `.workspace-core` viene riusato per la rail e `.workspace-core`/`BoardCanvas` vengono smontati e rimontati. Il remount spiega perché falliscono **tutti e tre** gli accessi:

1. l'Excalidraw nativo viene distrutto e ricreato durante l'espansione;
2. il vecchio editor chiama `onExcalidrawAPI(null)` e può azzerare `boardHandleRef` dopo che il nuovo editor ha pubblicato la sua API;
3. la nuova istanza nasce con layout/`canFitSidebar` non ancora assestato e la sidebar può essere chiusa dall'outside-click handler.

In modalità standard l'albero non cambia, quindi il percorso nativo funziona. La correzione minima è rendere stabile l'identità di `.workspace-core` con una `key`, non collassare il viewer.

## Approccio proposto

1. **Confermare il remount** con una strumentazione temporanea (identità dell'istanza, non conteggio assoluto: React StrictMode può ripetere il mount iniziale).
2. **Stabilizzare l'albero**: `key` fisse su rail e workspace-core in entrambi i rami, così `BoardCanvas` resta montato attraverso espansione/collasso.
3. **Blindare il ref**: ignorare gli handle con `api` null/destroyed; non sovrascrivere un'API viva con un callback di unmount tardivo.
4. **Smoke matrix**; solo se dopo i passi 1-2 l'icona nativa o `updateScene` continuano a fallire in expanded:
   - instradare il click nativo su `.sidebar-trigger__label-element` verso un helper esplicito (risolvendo l'input fratello con `label.querySelector('input[aria-label="Libreria"]')`);
   - in ultima istanza usare `api.updateLibrary({ openLibraryMenu: true })`, già usato dal repo.
5. **Pulizia**: rimuovere il guard `pointerdown` se non più necessario; tenere pulsante e voce di menu come accessi espliciti.

Niente fallback «collassa il viewer»: nasconde il remount, perde lo stato espanso e usa un toggle non idempotente.

## Passi

0. **Confermare il remount (strumentazione temporanea)** — file: `src/components/board/BoardCanvas.tsx`, `src/components/WorkspacePane.tsx`
   - Assegnare un id incrementale all'istanza Excalidraw in dev e loggarlo in `onExcalidrawAPI`; registrare l'identità dopo il replay iniziale di StrictMode.
   - Verifica: standard→expanded→standard deve mostrare **la stessa identità**, non un nuovo mount. Rimuovere la strumentazione prima del commit.
   - Rischio: S. Stima: S.

1. **Stabilizzare l'identità React** — file: `src/components/WorkspacePane.tsx:1122-1134`
   - Aggiungere `key="viewer-rail"` a `<RestoreRail>` e `key="workspace-core"` al div `.workspace-core` in entrambi i rami.
   - Verifica: il passo 0 mostra identità stabile; undo/redo, selezione e zoom sopravvivono a espansione/collasso; l'editor non viene ricreato.
   - Rischio: S. Stima: S.

2. **Blindare il ref API** — file: `src/components/WorkspacePane.tsx:1578-1581`
   - `onReady` deve ignorare `handle.api` null o destroyed; non azzerare un ref già valido con un callback di unmount tardivo.
   - Verifica: in expanded il pulsante non mostra «La lavagna non è ancora pronta»; l'API usata è quella dell'editor visibile.
   - Rischio: S. Stima: S.

3. **Smoke matrix e fix condizionali** — file: `src/components/board/BoardCanvas.tsx`, `src/components/WorkspacePane.tsx`
   - Matrice: standard/expanded × icona nativa/pulsante testata/voce menu; primo click, chiusura, riapertura, cambio tab, ritorno alla lavagna.
   - Prima della matrice: modificare la scena, selezionare un elemento e creare un'operazione annullabile; dopo espansione/collasso verificare undo, selezione e autosave.
   - Se l'icona nativa fallisce ancora: intercettare solo il trigger libreria in expanded, risolvere l'input fratello e chiamare l'helper; in standard lasciare il comportamento nativo.
   - Se `updateScene({ openSidebar })` fallisce ancora: passare a `api.updateLibrary({ openLibraryMenu: true })`.
   - Rivalutare il guard `pointerdown` (`BoardCanvas.tsx:144-151`): se il remount era la causa, rimuoverlo; mantenerlo solo se lo smoke mostra ancora chiusure immediate.
   - Rischio: M. Stima: M.

4. **Gate e documentazione** — file: `docs/board.md`, `CHANGELOG.md`
   - Aggiornare la nota della libreria con il comportamento in expanded e l'eventuale piano B adottato.
   - Eseguire `npm test`, `npm run typecheck`, `npm run build` e smoke con `./scripts/run.sh`.
   - Rischio: S. Stima: S.

**Totale: S/M**

## Alternative considerate (e perché scartate)

- **Collassa il viewer e apri in standard**: deterministico, ma perde lo stato espanso a ogni apertura, usa `toggleViewerExpanded` non idempotente e non corregge il remount. Scartato.
- **Slot rail sempre presente con CSS**: mantiene stabile l'albero ma aggiunge CSS e un elemento inerte; le `key` risolvono con due righe. Scartato.
- **Modale custom per la libreria personale**: duplica la UI Excalidraw e perde drag&drop/inserimento nativo. Scartato.
- **Aggiornare Excalidraw**: fuori scope e rischio di regressioni ampie.

## Riconciliazione del Concilio

| # | rilievo | chi | severità | decisione | motivo |
|---|---------|-----|----------|-----------|--------|
| 1 | Il fallback collapse-first lascia il viewer collassato e usa un toggle non idempotente | Luna | MAJOR | Accettato | Rimosso dal piano; il root cause è il remount, non il layout espanso |
| 2 | L'intercettazione nativa non spiega come risalire dall'input fratello alla label | Luna | MAJOR | Accettato | Il piano ora specifica `closest('.sidebar-trigger__label-element')` + `querySelector('input[aria-label="Libreria"]')`, solo se il test post-fix fallisce |
| 3 | I test non verificano scena, undo, selezione e autosave | Luna | MAJOR | Accettato | Aggiunto l'obbligo di modificare scena, selezionare e creare un'azione undoable prima della matrice |
| 4 | L'ordine «null tardivo dopo nuova API» non è dimostrato | Luna | MINOR | Accettato | Il passo 0 misura l'identità; la guardia è formulata come protezione da handle null, non come causa assunta |
| 5 | Il contatore assoluto dei mount è fuorviante con StrictMode | Luna | MINOR | Accettato | Si usa l'identità dell'istanza dopo il replay iniziale, non il conteggio |
| 6 | Lo slot sempre-presente è doppio lavoro; bastano le key | GLM | MAJOR | Accettato | Passo 1 ridotto a due `key`, nessuna modifica CSS |
| 7 | Orchestrazione rAF×2 + fallback collapse è YAGNI | GLM | MAJOR | Accettato | Tagliata; si aggiunge solo se la matrice smoke fallisce |
| 8 | Estrarre una funzione pura + fake timers è sproporzionato | GLM | MAJOR | Accettato | Nessun modulo di test nuovo; gate esistenti + smoke |
| 9 | Il routing dell'icona nativa va reso condizionale | GLM | MINOR | Accettato | Passo 3 condizionale all'esito della matrice |
| 10 | La guardia del ref è una riga in un solo file | GLM | MINOR | Accettato | Passo 2 limitato a `WorkspacePane.tsx` |
| 11 | Esiste già `updateLibrary({ openLibraryMenu: true })` come piano B | GLM | MINOR | Accettato | Inserito come fallback una riga, non come percorso primario |
| 12 | La verifica del remount deve essere il passo 0 | GLM | MINOR | Accettato | Spostata prima di ogni modifica |

## Verdetto dei critici

- **Luna**: `APPROVE_WITH_CHANGES` — «la correzione React è ben motivata; toglierei il fallback collapse-first e renderei verificabili routing nativo e preservazione dello stato.»
- **GLM**: `APPROVE_WITH_CHANGES` — «la diagnosi è giusta e il root-cause fix va difeso, ma il piano avvolge 6 righe di key+guardia in 5 passi con orchestrazione, fallback collapse, slot CSS e un modulo di test; si taglia l'80%.»

## Rischi e mitigazioni

- **Remount non confermato**: il passo 0 lo prova prima di toccare il codice; se l'identità è stabile, il piano si ferma e si passa al piano B (`updateLibrary`).
- **Perdita di stato durante l'espansione**: la smoke matrix verifica undo, selezione, zoom e autosave, non solo l'apertura del pannello.
- **Doppio toggle della sidebar**: il piano non intercetta l'icona nativa in standard; l'intercettazione è solo expanded e solo se necessaria.
- **Guard pointerdown troppo ampio**: viene rimosso se non serve dopo il fix; resta confinato a `.sidebar-trigger__label-element`.
- **Callback API fuori ordine**: la guardia ignora `api` null/destroyed, ma l'ordine reale viene misurato al passo 0.

## Test e verifica

- `npm test`
- `npm run typecheck`
- `npm run build`
- `./scripts/run.sh` e smoke manuale:
  1. aprire un diagramma con lavagna, portarla in standard;
  2. aprire la libreria dai tre accessi;
  3. chiudere, riaprire, cambiare tab, tornare alla lavagna;
  4. espandere il viewer e ripetere i tre accessi;
  5. modificare la scena, selezionare un elemento, creare un'azione undoable, espandere/collassare, verificare undo/selezione/autosave;
  6. riavviare l'app e verificare che la libreria persista.

## Criteri di accettazione

- Tutti e tre gli accessi aprono il pannello in expanded al primo click.
- `BoardCanvas` non viene rimontato passando standard↔expanded (identità stabile).
- Undo/redo, selezione, zoom e autosave sopravvivono alla transizione.
- Modalità standard invariata.
- Gate verdi e nessuna nuova dipendenza.

## Domande aperte / condizioni per l'assenso

- Il passo 0 conferma il remount? Se no, il piano si ferma e si applica il piano B a una riga (`updateLibrary({ openLibraryMenu: true })`), senza i passi 1-3.
- Dopo il fix delle key, il guard `pointerdown` è ancora necessario? Se no, va rimosso.
- L'eventuale intercettazione dell'icona nativa in expanded è accettabile solo se la matrice smoke dimostra che il fix delle key non basta.

## Esito implementazione (2026-10-26)

- Applicate `key="viewer-restore-rail"` e `key="workspace-core"` in entrambi i rami di `WorkspacePane`.
- `onReady` ignora gli handle con `api` null, evitando che l'unmount di Excalidraw cancelli l'API viva.
- Rimosso il guard `pointerdown` sperimentale: non era la causa e non serve dopo il fix del remount.
- Verifica con harness su `WorkspacePane` reale: `__boardMounts` resta stabile (2 per il replay di StrictMode) attraverso standard→expanded→standard; l'id dell'API Excalidraw non cambia; icona nativa e pulsante testata aprono il pannello e mostrano «Sfoglia librerie» anche in expanded.
- Gate: `npm run typecheck`, `npm test` (110/110), `npm run build` verdi.
- Resta da fare lo smoke finale dell'utente con `./scripts/run.sh` sul proprio ambiente Tauri/WebKitGTK.

## Deviazione: pannello libreria dell'app (2026-10-26)

L'utente ha confermato che il bug era immutato anche dopo il fix del remount.
Per non dipendere più dalla sidebar nativa di Excalidraw, la libreria personale
è stata spostata in un overlay dell'app (`BoardLibraryDialog`):

- l'icona nativa, il pulsante testata e la voce menu aprono il pannello
  dell'app; il click sull'icona nativa viene intercettato e non apre la sidebar
  Excalidraw;
- il pannello legge/scrive la stessa libreria globale tramite
  `api.updateLibrary`/`loadBoardLibraryItems`, quindi la persistenza SQLite e
  il formato `.excalidrawlib` restano invariati;
- sono disponibili salvataggio selezione, inserimento, rinomina, eliminazione,
  svuotamento, import e passaggio al catalogo community;
- è un overlay `position: fixed`, quindi non risente del layout espanso.

Verifiche: harness su `WorkspacePane` reale in expanded; click reale sull'icona
nativa e pulsante testata aprono il pannello; anteprima SVG e inserimento
funzionano; `npm test` 113/113, `typecheck` e `build` verdi.
