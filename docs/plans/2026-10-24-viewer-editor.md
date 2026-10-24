# Viewer/Editor Mermaid di prim'ordine — Piano di implementazione

> **Stato**: implementato il 2026-10-24. Guida utente in
> [`docs/viewer-editor.md`](../viewer-editor.md). I limiti dichiarati (tema non
> versionato/.mmd, stile per elemento solo dove Mermaid lo supporta, editing
> strutturale flowchart, layout automatico) sono riportati anche nel README.
>
> **Aggiornamento layout**: il pannello inferiore è stato sostituito da una
> fascia verticale di controlli a destra del diagramma, richiudibile con
> chevron; il viewer può espandersi a tutta finestra facendo ritirare chat e
> cronologia in una barra con chevron.
>
> **Aggiornamento tema**: preset estesi a 13 (Neon, Blueprint, Sunset, Carta,
> Terminal, Candy, Mono, Oceano) e comando AI `mc-theme` per preset/palette.

- **Richiesta**: «implementare funzionalità sul viewer. al momento il viewer serve solo come visualizzatore ma è grezzo. non ci sono coamndi per fare il pan, zoom in zoom  con rotella, i colori di tutto il diagramma non sono modificabili per elemento (cornice, background e foreground dei box e di ogni latro elemento presente nei diagrammi. Tutti devono essere modificabili complessivamente (su fondo chiaro un box chairo è invisible per esempio...) e singorlamente elemento per elemento oggetto per oggetto. oltre i colori spessori, tipi di tratto ecc... devono essere implementati schemi di colori complessivi rapidi di massima visibilità. lo stesso fondo del workspace deve essere modificabile... mancaco insomma tutte le funzionalità che renderebbero completo e serio questo viever. obiettivo deve didentare oltre che visulaizzatore un potente editor.

  mettete insieme le vostre teste e datemi un piano per fare diventare questo visualizzatore un visuliazzatore e editor di primordine. ocviamente bidirezionale fra codice mermaid e visualizzazione grafica» (verbatim).
- **Obiettivo**: rendere il pannello workspace un editor visuale bidirezionale dei diagrammi Mermaid: navigazione completa, tema per diagramma (globale e per elemento), preset leggibili, sfondo del workspace modificabile, sincronizzazione sorgente↔SVG e protezione degli stili quando l'AI rigenera il diagramma.
- **Criteri di successo**:
  1. Pan con trascinamento sullo sfondo, zoom con rotella centrato sul puntatore, pinch, fit, 100%, scorciatoie; la vista non si azzera a ogni modifica del sorgente; il testo resta nitido a ogni zoom.
  2. Tema per diagramma con token (canvas, foreground, muted, line, surface, surface-alt, border, accent, font, radius, spessore e tratteggio di default), 13 preset (`auto`, `light`, `dark`, `contrast`, `colorblind`, `neon`, `blueprint`, `sunset`, `paper`, `terminal`, `candy`, `mono`, `ocean`), sfondo e griglia dell'area di lavoro modificabili e persistiti.
  3. Stili per elemento (fill, stroke, spessore, tratteggio, colore testo, opacity, radius, font-size/weight) su flowchart, class, state, ER; selezione singola, multipla e da elenco; applicazione bulk a nodi/archi/cluster; reset; controlli disabilitati con spiegazione per i tipi in cui Mermaid non li supporta.
  4. Bidirezionalità: modifica al sorgente → SVG aggiornato; modifica visuale di stile o label → sorgente aggiornato; click su un elemento → selezione, con azione esplicita "vai alla riga" che apre il sorgente; cursore su un id → elemento selezionato; nessuna modifica visuale può lasciare il sorgente non renderizzabile.
  5. Contrasto: avviso se testo/fill < 4.5:1, bordo/fill < 3:1 e box/sfondo indistinguibile; azione "correggi" con scelta testo bianco/nero e proposta del preset `contrast`; il caso "box chiaro su fondo chiaro" è rilevato.
  6. Persistenza: gli stili per elemento sono nel sorgente, quindi versionati e ripristinabili; il tema è un'impostazione per diagramma, inclusa negli export SVG/PNG ma **non** versionata e **non** inclusa nel `.mmd` (limite dichiarato); una rigenerazione AI conserva tema e stili degli elementi rimasti, con orphan segnalati.
  7. `npm test`, `npm run typecheck`, `npm run build` verdi; smoke manuale su WebKitGTK; nessuna regressione su chat, libreria, versioni.

## Non-obiettivi

- Posizionamento libero dei nodi / drag layout: Mermaid è auto-layout e la posizione non è rappresentabile nel sorgente. Non si introduce un secondo documento di layout.
- Stile per elemento per i tipi in cui Mermaid non lo supporta (sequence, pie, gantt, timeline, journey, quadrant, xychart, sankey, mindmap): solo palette globale; l'ispettore lo dice esplicitamente. Nessun override CSS proprietario non round-trip.
- Editing strutturale (aggiungi nodo, connetti, elimina, shape, direzione) nell'MVP: è la **Fase 2** del piano; nell'MVP si modificano stile e label dei flowchart, la struttura resta nel sorgente. Niente rinomina automatica degli id.
- CodeMirror / syntax highlighting nel v1: si potenzia il textarea esistente; l'editor di codice completo è nel backlog.
- Tema versionato e tema dentro `.mmd`; import `.mmd`; diff visuale tra versioni; presentazione; PDF; collaborazione; mobile; font caricati dall'utente.
- Parsing completo di tutto il linguaggio Mermaid: l'editor strutturale (Fase 2) copre un sottoinsieme dichiarato e degrada a "modifica da sorgente" quando non è confidente.

## Assunzioni

- Un diagramma = un documento: il sorgente Mermaid resta l'unica fonte di verità per struttura e stili per elemento; il tema è un'impostazione per diagramma.
- "Bidirezionale" nell'MVP significa stile e label modificabili dai due lati; la struttura flowchart è Fase 2.
- Il tema `auto` segue il tema dell'app; un tema personalizzato resta invariato al cambio tema app.
- Nessuna nuova dipendenza e nessuna modifica Rust obbligatoria: si usano `settingsAll`/`setSetting`, `pele.parse`, `react-resizable-panels` e `sanitizeSvgForExport` già presenti.
- UI in italiano, come il resto dell'app.

## Vincoli dal repository

- Non esiste `AGENTS.md`; le regole locali sono README e script. Test: `npm test`, `npm run typecheck`, `npm run build` (`README.md:95-102`, `package.json:6-14`). Non c'è script lint.
- Renderer: Pele 1.9.0 sincrono di default, Mermaid 12.2.0 lazy come fallback (`src/lib/diagram.ts:177-196`); Mermaid viene inizializzato una volta con tema dark/default (`:156-169`). Pele e Mermaid sono dipendenze già installate (`package.json:21,23`).
- Viewer attuale: zoom solo con stato React e `transform: scale()` (`src/components/WorkspacePane.tsx:106`, `:314-323`, `:382-388`); nessun pan; stage scrollabile (`src/styles.css:1109-1136`). L'editor è un `<textarea>` montato solo in modalità editing (`WorkspacePane.tsx:342-361`).
- Tema: solo dark/light app; palette Pele hardcoded; PNG con sfondo hardcoded (`src/lib/diagram.ts:200-230`; `WorkspacePane.tsx:189-194`); variabili in `src/styles.css:1-64`; cambio tema in `src/App.tsx:24-26`; blocco Aspetto in `src/components/SettingsView.tsx:86-110`.
- Metadati: `%% title` e `%% target` vengono rimossi dal sorgente salvato (`src/lib/diagram.ts:18-42`); `diagramType` ignora le righe `%%` (`:123-152`). La mappa esistente non riconosce il token reale `stateDiagram-v2` (mappa solo `stateDiagramV2`), quindi la whitelist del piano deve normalizzare gli alias (`stateDiagram-v2`, `flowchart-elk`, `block-beta`, …) e testarli.
- Persistenza: `diagrams` non ha colonne tema/stile (`src-tauri/src/db.rs:135-148`); settings key/value (`:96-99`, `:838-870`); versione creata solo se il sorgente cambia (`:736-760`); una risposta AI sul target sostituisce integralmente `source` (`:667-685`); cancellare una conversazione elimina i diagrammi non in libreria lato Rust (`:258-268`), quindi le chiavi tema per-id andrebbero incontro a orphan.
- L'AI riceve il sorgente dal DB al momento dell'invio (`src-tauri/src/commands.rs:60-70`): modifiche locali non salvate non sono nel prompt e possono essere sovrascritte.
- `settingsAll`/`settingsSet` esistono già (`src/lib/ipc.ts:29-31`); `react-resizable-panels` è già dipendenza ma non usata (`package.json:27`); `sanitizeSvgForExport` è il punto unico per l'export (`src/lib/diagram.ts:209-230`).
- `pele` esporta `parse` e `detectType` (`node_modules/pele/dist/core.d.ts:20-24`), quindi il modello elementi si legge senza scrivere un parser Mermaid completo.

## Stato attuale

Il workspace è un visualizzatore: render Pele/Mermaid con debounce 220 ms, zoom a pulsanti, editor testuale con anteprima, versioni e export. Non esiste un modello di stile, né selezione, né inspector, né persistenza del tema per diagramma. Il sorgente è già l'unico dato salvato e versionato: è il punto di innesto giusto per stili nativi e metadati, mentre il tema può vivere nelle impostazioni.

## Approccio proposto

### 1. Sorgente per struttura e stili, settings per il tema

- **Stili per elemento**: statements Mermaid nativi (`style`, `linkStyle`) raccolti in un blocco generato in coda al sorgente, delimitato da commenti:
  ```
  %% mc:styles:begin
  style A fill:#ff0000,stroke:#00ff00,stroke-width:2px
  linkStyle 0 stroke:#0000ff
  %% mc:styles:end
  ```
  Mermaid e Pele ignorano i commenti e onorano gli statements; l'ultimo `style` vince. Il blocco è normale sintassi Mermaid, quindi viaggia nelle versioni, nel ripristino e nel `.mmd`. Gli stili nativi scritti fuori dal blocco vengono letti (last-wins) ma non riscritti; l'ispettore mostra lo stile effettivo, non un sottoinsieme.
- **Tema**: una sola chiave `settings["diagram_themes"]` con un oggetto JSON `{ "<diagramId>": { preset, tokens? } }`. Assenza = `auto`. Una chiave unica evita una chiave per diagramma e rende la cancellazione una rimozione di proprietà; eventuali orphan (cascata lato Rust su conversazioni non caricate) sono innocui e vengono ignorati. Il tema non è versionato e non viaggia nel `.mmd`: è una scelta dichiarata, coerente con "impostazione di visualizzazione". Se in futuro serve il versioning del tema, l'alternativa è tornare a un commento `%% mc:theme` nel sorgente.
- **Sorgente unico**: la struttura e le label restano testo Mermaid; gli stili sono testo Mermaid; il tema è settings. Non c'è un secondo documento di layout.

### 2. Una pipeline di stile, due renderer

1. **Palette** → variabili CSS `--pele-*` per Pele; `theme:'base'` + `themeVariables` per Mermaid. La stessa funzione pura `themeVariables(theme)` alimenta entrambi.
2. **Default geometrici** (spessore, tratteggio, radius, font-size/weight) → `<style>` scoped iniettato **dopo** il markup del renderer dentro l'SVG, con selettori normali (niente `!important`): gli stili per elemento, inline, vincono sempre. Per Mermaid il selettore usa l'id dell'SVG; per Pele la classe `.pele`.
3. **Stili per elemento** → statements nativi nel blocco. Nessun override CSS proprietario: ciò che si vede è ciò che sta nel sorgente e nell'export.

### 3. Identità, selezione, rivelazione nel sorgente

- Dopo il render si annota il **DOM** (non la stringa usata per l'export): `data-mc-id`, `data-mc-kind` (node/edge/cluster/label), `data-mc-edge-index`.
- Pele espone già `data-id` su nodi, archi, edge-label e cluster. Per Mermaid i nodi si risolvono confrontando l'id DOM (`<renderId>-flowchart-<id>-<n>`, `classId-`, `state-`, `entity-`) con gli id del modello `pele.parse`; gli archi usano `data-id`/ordine.
- La selezione è `{ids, kind}` e vive fuori dal render; si riapplica per id dopo ogni ri-render. L'anello è un overlay SVG (l'export usa la stringa originale, quindi non si contamina).
- `sourceIndex` mappa id e indici arco a riga/range. Click elemento → apre il pannello editor, `setSelectionRange`, focus e scroll alla riga (sufficiente per il criterio; l'overlay mirror è solo cosmetico). Cursore nel textarea → token sotto il cursore → selezione, con debounce.

### 4. Viewport

Pan/zoom basati su **viewBox** dell'SVG, non su `transform: scale()`: testo nitido e coordinate esatte. Stato `{x, y, width, height}` in un hook; conversione puntatore→SVG con `getScreenCTM().inverse()`; wheel non passivo con zoom al puntatore; pointer events per pan e pinch; fit/100%/reset; tastiera. La vista sopravvive ai ri-render; ri-fit solo al cambio diagramma o su richiesta. `frame()` di Pele può essere riusato per la matematica del fit; `pele.enableZoom` non si monta perché `refresh()` rifà il fit e non espone un setter di pan.

### 5. Bidirezionalità e protezione del dato

- Ogni modifica visuale produce una nuova stringa con funzioni pure, la valida e solo se valida la committa. Per i tipi "capable" il validatore primario è Pele (renderer default); se Pele fallisce si prova Mermaid e si committa solo se almeno uno riesce. Per gli stili per elemento serve Pele; se il diagramma richiede Mermaid, i controlli per elemento si disabilitano con spiegazione.
- **Conflitto AI**: `diagramDirty` nello store; se c'è un target con modifiche non salvate, l'invio viene rifiutato con invito a salvare. Alla risposta, se il sorgente è cambiato durante lo streaming, l'aggiornamento non viene applicato automaticamente: conflitto esplicito. Se non c'è conflitto, si fa il merge degli stili.
- **Merge AI**: stili nodo/cluster riapplicati per id; stili arco conservati solo se la firma della lista archi (estremi, label, tipo, ordine) è identica, altrimenti scartati con toast che li elenca. Nessuna rimappatura silenziosa. Gli id scomparsi producono orphan segnalati.
- **Export**: attende un `renderDiagram(source, theme)` fresco della revisione corrente; niente SVG debounced. SVG/PNG includono tema e stili; `.mmd` include gli stili nativi ma non il tema.

### 6. Matrice delle capacità (whitelist, default deny)

| Tipo | Nodo (fill/stroke/testo/geometria) | Arco (`linkStyle`) | Cluster | Struttura visuale |
|---|---|---|---|---|
| flowchart | sì | sì | sì | Fase 2 |
| class | sì | no (parsing) | n/a | no (sorgente) |
| state | sì | sì | n/a | no (sorgente) |
| er | sì | no (parsing) | n/a | no (sorgente) |
| block | sì (Pele) | da verificare | ? | no |
| C4 e tipi non elencati | no | no | no | no |

Verificato il 2026-10-24 con Pele 1.9.0 e Mermaid 12.2.0: `style`/`linkStyle` funzionano su flowchart, class (solo nodi), state, ER (solo nodi); `style` rompe il parsing di sequence, pie, gantt, timeline, journey, quadrant, mindmap. La whitelist impedisce di emettere sintassi che rompe il renderer.

## Passi

1. **Viewport e sfondo workspace** — file: `src/lib/diagram/viewport.ts` (nuovo), `src/components/workspace/DiagramStage.tsx` (nuovo), `src/styles.css`, `src/components/SettingsView.tsx`, `src/store.ts`, `src/components/WorkspacePane.tsx`.
   - Funzioni pure: fit, zoom-at-point, pan, clamp, aspect, conversione schermo↔SVG. Hook con wheel non passivo, pointer pan/pinch, tastiera, ResizeObserver, viewBox; rimozione del `transform: scale`; `touch-action: none` sullo stage.
   - Impostazioni `workspace_bg` (hex o `auto`) e `workspace_grid`; niente `diagram_auto_fit` né `diagram_preset` globale (assenza = auto).
   - Verifica: `viewport.test.ts` (invarianza del punto sotto il puntatore, fit, clamp, resize, container nullo), `npm run typecheck`, smoke WebKitGTK con rotella, trackpad, pinch, resize; nessun salto di vista dopo un edit. Rischio: gesture WebKit; fallback pulsanti/tastiera. **M**

2. **Tema, preset, contrasto, export** — file: `src/lib/diagram/theme.ts` (nuovo, include contrasto), `src/lib/diagram.ts`, `src/lib/diagram.test.ts`, `src/components/workspace/ThemePanel.tsx` (nuovo), `WorkspacePane.tsx`, `SettingsView.tsx`, `store.ts`.
   - Token, 13 preset (`auto`, `light`, `dark`, `contrast`, `colorblind`, `neon`, `blueprint`, `sunset`, `paper`, `terminal`, `candy`, `mono`, `ocean`), risoluzione `auto`, mapping Pele CSS vars + Mermaid `themeVariables`, `<style>` scoped per i default geometrici; persistenza in `diagram_themes`; export SVG/PNG con tema e attesa render fresco; contrasto WCAG + testo b/n + proposta preset `contrast`. Il tipo esistente `DiagramTheme = "dark" | "light"` (`src/lib/diagram.ts:198`) va rinominato `ThemeMode`; il nuovo `DiagramTheme` è l'oggetto token. Il contrasto si calcola solo su hex/rgb; gli altri formati sono "non calcolabili". L'export è dell'intero diagramma, non della vista corrente.
   - Verifica: test preset completi, mapping, contrasto (coppie note), validazione valori (hex/numero/font whitelist), Pele in Vitest, parità Mermaid manuale/Chrome, SVG esportato aperto in browser. Rischio: mapping Mermaid imperfetto; si itera con fixture. **M**

3. **Modello documento, capacità, blocco stili, merge AI** — file: `src/lib/diagram/document.ts` (nuovo, include whitelist capacità), test.
   - `readModel` via `pele.parse` con fallback; parser/scrittore del blocco `%% mc:styles`; import stili esterni (last-wins); normalizzazione; firma archi; merge AI (nodi/cluster per id, archi solo se firma identica, orphan toast); dedupe blocchi. Whitelist capacità con alias normalizzati (`stateDiagram-v2`, `flowchart-elk`, `block-beta`, `c4`); default deny per tipi ignoti.
   - Verifica: fixture `pele.parse` per flowchart/class/state/ER; round-trip; JSON/commenti malformati; CRLF; virgole tra virgolette; id con `-`; ultimo-vince; id rimosso; firma archi con paralleli/self-loop; nessuno stile emesso per tipi non capable. Rischio: forma del modello Pele; spike di 1 ora prima di costruirci sopra. **M**

4. **Selezione, inspector, elenco elementi, sourceIndex** — file: `src/lib/diagram/selection.ts`, `src/lib/diagram/sourceIndex.ts`, `src/components/workspace/Inspector.tsx`, `DiagramStage.tsx`, `WorkspacePane.tsx`.
   - Layout: stage sempre visibile e fascia verticale di controlli a destra, richiudibile con chevron, con tab `Elemento | Tema | Versioni | Sorgente`; l'attuale `editing ? editor : stage` sparisce. Il viewer può occupare tutta la finestra facendo ritirare chat e cronologia in una barra con chevron. Il reveal apre la tab Sorgente senza nascondere il diagramma.
   - Annotazione DOM per Pele/Mermaid; click/shift/hover; overlay bbox; elenco elementi fuso nell'Inspector (ricerca, click); Escape; preservazione per id; reveal riga con apertura automatica della tab Sorgente, `setSelectionRange`, focus, scroll; cursore→selezione con debounce.
   - Verifica: resolver puro su id Pele/Mermaid (flowchart, class, state, ER, hyphen), sourceIndex (CRLF, commenti, catene, subgraph), smoke UI. Rischio: formati id Mermaid; fallback a sola selezione con banner. **M**

5. **Stili per elemento** — file: `src/lib/diagram/styles.ts` (nuovo), `Inspector.tsx`, `DiagramStage.tsx`, `WorkspacePane.tsx`.
   - Modello stile effettivo (tema + esterni + blocco), controlli fill/stroke/spessore/tratteggio/testo/opacity/radius/font, swatch rapidi, bulk, reset, gating, badge contrasto; scrittura `style`/`linkStyle` con validazione; dirty flag; pila undo visuale (10) attiva con stage focalizzato. `radius` si applica ai rettangoli; `opacity` mappa `fill-opacity`/`stroke-opacity`.
   - Verifica: test merge/edit/bulk/reset/idempotenza/tipi non capable; render Pele con assert; manuale; nessun sorgente non renderizzabile. Rischio: sintassi stile; normalizzazione; ultimo-vince. **M**

6. **Label editing, salvataggio, versioni, export, conflitto AI** — file: `src/lib/diagram/flowchart.ts` (nuovo, solo label in v1), `Inspector.tsx`, `WorkspacePane.tsx`, `store.ts`, `document.ts`.
   - Doppio click nodo → input inline → sostituzione label (quotate/unicode), append definizione se assente; salvataggio versione; dirty; guardia invio; `baseSource`/conflitto; merge AI; export fresco; cleanup tema su delete noto.
   - Verifica: test label (forme, quote, unicode, label con `]`), merge/conflitto, export dopo edit immediato, restore versione (stili sì, tema invariato), delete. Rischio: sintassi label; UX conflitto. **M**

7. **Fase 2 — struttura flowchart (fuori MVP)** — file: `flowchart.ts`, `Inspector.tsx`, `WorkspacePane.tsx`.
   - Parser confidence-gated (definizioni, shape, catene, `&`, label, subgraph, commenti, `;`); aggiungi nodo, modalità connetti, elimina nodo/arco con split delle catene, shape, direzione; niente rinomina; undo visuale; degradazione esplicita.
   - Verifica: fixture estese, render Pele, undo, rifiuto senza modifiche se il parser non è confidente. Rischio: corruzione sorgente; è il motivo per cui resta fuori dall'MVP. **L**

8. **Hardening, parità renderer, accessibilità, documentazione** — file: `src/styles.css`, componenti workspace, `scripts/render-parity.mjs` (nuovo), `README.md`, `docs/viewer-editor.md` (nuovo), test.
   - Focus/ARIA, navigazione da tastiera, elenco elementi come alternativa al click; performance 150 nodi/200 archi; debounce; script di parità Pele/Mermaid in Chrome headless (salta se Chrome manca); checklist WebKit; documentazione formato `%% mc:styles`, limiti tema e matrice capacità.
   - Verifica: checklist firmata, tempi misurati, `npm test`, `npm run typecheck`, `npm run build`. **M**

**Totale: M/L.** MVP utilizzabile (viewport + tema + stili per elemento + label + AI-safe) a fine **passo 6**; Fase 2 (struttura) al passo 7; hardening al passo 8.

## Alternative considerate (e perché scartate)

- **Tema nel sorgente con `%% mc:theme`**: versiona e trasporta il tema nel `.mmd`, ma aggiunge codec, merge a ogni AI e rumore nel codice; scartato in favore di `settings["diagram_themes"]`. Resta l'alternativa se il versioning del tema diventa un requisito.
- **JSON stile in una colonna DB**: due fonti di verità, migrazione, merge a ogni restore/AI; scartato. Gli stili nativi nel sorgente sono già versionati.
- **Solo CSS override sull'SVG**: non round-trip, non esportabile come codice, dipendente dal renderer; scartato.
- **`%%{init}%%`/themeVariables nel sorgente per la palette**: Pele ignora le themeVariables (verificato); scartato.
- **`pele.enableZoom`**: richiede Ctrl/Meta per la rotella, non espone il pan e `refresh()` rifà il fit; scartato. Si riusa solo la matematica (`frame`) dove utile.
- **CSS transform per lo zoom**: nitidezza e coordinate peggiori; scelto viewBox.
- **CodeMirror 6**: syntax highlighting e ricerca, ma un passo L e 5 dipendenze per un requisito non chiesto; rimandato. Il textarea potenziato copre reveal e mapping.
- **Parser Mermaid completo**: troppo grande; `pele.parse` per il modello, parser flowchart ristretto per i range e la Fase 2.
- **Drag dei nodi / layout manuale**: non rappresentabile in Mermaid; scartato.
- **Rimappatura automatica degli stili arco**: rischio di applicarli all'arco sbagliato con archi paralleli; scartato in favore del discard con avviso.

## Riconciliazione del Concilio

| # | Rilievo | Chi | Severità | Decisione | Motivo |
|---|---|---|---|---|---|
| 1 | Conflitto tra modifiche locali non salvate e rigenerazione AI | Luna | MAJOR | Accettato | `diagramDirty`, guardia sull'invio, `baseSource` e conflitto esplicito durante lo streaming |
| 2 | Export può usare l'SVG debounced precedente | Luna | MAJOR | Accettato | Export attende un render fresco della revisione corrente |
| 3 | `renderDiagram` non valida entrambi i renderer | Luna | MAJOR | Accettato | Validazione Pele-primaria, fallback Mermaid, fixture di parità fuori dal runtime; niente claim "entrambi" |
| 4 | Matrice capacità incompleta (C4, tipi ignoti) | Luna | MAJOR | Accettato | Whitelist, default deny, C4 e ignoti solo palette |
| 5 | Rimappatura archi ambigua con paralleli/self-loop | Luna | MAJOR | Accettato | Nessuna rimappatura: conserva solo se la firma della lista è identica, altrimenti scarta con toast |
| 6 | Geometria viewBox non specificata | Luna | MINOR | Accettato | `getScreenCTM().inverse()`, fit con `getBoundingClientRect`/`viewBox.baseVal`, test WebKit |
| 7 | "MVP" non è editor bidirezionale completo | Luna | MINOR | Accettato | MVP = tema/stili/label; struttura in Fase 2, criteri separati |
| 8 | Tema non versionato e non nel `.mmd` | Luna (2°) | MAJOR | Accettato come limite dichiarato | Coerente con "impostazione di visualizzazione"; se serve, si torna a `%% mc:theme` |
| 9 | Reveal riga non definito rispetto alla UI | Luna (2°) | MINOR | Accettato | Click → apre editor, `setSelectionRange`, focus, scroll; overlay solo cosmetico |
| 10 | Fingerprint archi troppo debole | Luna (2°) | MINOR | Accettato | Firma completa (estremi, label, tipo, ordine); in caso di dubbio si scarta |
| 11 | Chiavi tema orfane | Luna (2°) / GLM (2°) | MAJOR | Accettato | Unica chiave `diagram_themes`; rimozione sulle cancellazioni note; orphan ignorati |
| 12 | CodeMirror non richiesto, passo L | GLM | BLOCKER | Accettato | Rimosso; textarea potenziato con sourceIndex/reveal; CM6 nel backlog |
| 13 | `%% mc:theme` più complesso del necessario | GLM | BLOCKER | Accettato | Tema in `settings["diagram_themes"]`; niente codec/merge tema |
| 14 | Editing strutturale flowchart troppo costoso/rischioso | GLM | MAJOR | Accettato in parte | Spostato in Fase 2, fuori MVP; v1 solo label |
| 15 | Rimappatura archi nel merge AI | GLM | MAJOR | Accettato | Stessi archi → conserva; altrimenti scarta con toast |
| 16 | `useDocumentHistory` duplica undo/versioni | GLM | MAJOR | Accettato | Undo nativo del textarea + pila visuale 10 + versioni |
| 17 | 6 preset sono YAGNI | GLM | MINOR | Accettato in parte | 5 preset: `auto`, `light`, `dark`, `contrast`, `colorblind`; `print` tagliato |
| 18 | Riusare `enableZoom`/`frame` | GLM | MINOR | Accettato in parte | Riuso `frame` dove calza; `enableZoom` no (refresh/no pan setter) |
| 19 | `ElementList` è una seconda superficie | GLM | MINOR | Accettato | Fusa nell'Inspector, niente file separato |
| 20 | Leggere gli stili esterni al blocco è marginale | GLM | MINOR | **Rifiutato** | L'ispettore deve mostrare lo stile renderizzato, altrimenti mente; il parser last-wins serve comunque |
| 21 | Auto-fix contrasto troppo ambizioso | GLM | MINOR | Accettato in parte | Check WCAG + testo b/n + proposta preset; niente algoritmo di lightness |
| 22 | Troppi moduli nuovi | GLM | MINOR | Accettato | ~8 moduli, funzioni fuse per responsabilità |
| 23 | Viewport prima del modello documento | GLM | MINOR | Accettato | Passo 1 = viewport/sfondo, payoff immediato |
| 24 | `diagram_preset` globale duplica `auto` | GLM (2°) | MINOR | Accettato | Rimosso; assenza di tema = `auto` |
| 25 | `diagram_auto_fit` è YAGNI | GLM (2°) | MINOR | Accettato | Comportamento fisso: ri-fit al cambio diagramma, vista preservata |
| 26 | `enableZoom` non preserva la vista | GLM (2°) | MINOR | Accettato | Confermato; hook proprio giustificato |
| 27 | Reveal deve aprire il pannello editor | GLM (2°) | MINOR | Accettato | Stesso rimedio del #9 |

Nessun BLOCKER resta aperto dopo il secondo giro. Restano 1 rifiuto motivato (#20), 4 accettazioni parziali (#14, #17, #18, #21) e 22 accettazioni piene.

## Verdetto dei critici

- **Luna — primo giro**: `APPROVE_WITH_CHANGES` — «l'architettura di base è coerente, ma merge AI, coerenza degli export e validazione/capability gating richiedono criteri espliciti prima dell'implementazione». Nessun BLOCKER; 5 MAJOR, 2 MINOR.
- **GLM — primo giro**: `APPROVE_WITH_CHANGES` — «l'architettura (sorgente = verità, stili nativi, gating, viewBox) è corretta e ben verificata, ma il piano è più grande del problema: CodeMirror, editing strutturale, undo app-level e rimappatura archi sono ~1 passo L + ~2×M di lavoro che si taglia senza perdere nessuna esigenza dell'utente». 2 BLOCKER (CodeMirror, `mc:theme`), 3 MAJOR, 7 MINOR.
- **Luna — secondo giro**: `APPROVE_WITH_CHANGES` — «nessun BLOCKER tecnico residuo; chiarire l'accettazione del tema non versionato/non incluso nel `.mmd` e rendere esplicita la UX del reveal sorgente». 1 MAJOR (tema non versionato), 3 MINOR.
- **GLM — secondo giro**: `APPROVE_WITH_CHANGES` — «il piano revisionato non ha più BLOCKER […] resta una lacuna di ciclo di vita sul tema in settings» risolta con la chiave unica `diagram_themes`. 1 MAJOR (orphan), 4 MINOR.

**Stato dell'assenso**: il piano è approvato **con modifiche** da entrambi i critici, nessun BLOCKER aperto. Restano da accettare esplicitamente i limiti dichiarati (tema non versionato/.mmd, struttura in Fase 2, niente syntax highlighting) e l'OK dell'utente prima dell'implementazione.

## Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Corruzione del sorgente da `style`/`linkStyle` | Diagramma non renderizzabile o stile sbagliato | Blocco generato, validazione prima del commit, undo visuale, test su label/quote/catene, degradazione |
| Stili arco associati all'arco sbagliato | Colori su un collegamento errato | Nessuna rimappatura: firma completa della lista; altrimenti scarto con toast |
| AI sovrascrive stili/tema o modifiche locali | Perdita di lavoro | Tema in settings, merge nodi per id, guardia dirty, conflitto durante lo streaming, orphan report |
| Divergenza Pele/Mermaid | WYSIWYG falso | Stili nativi verificati su entrambi, mapping palette, script di parità, Pele default, banner se fallback |
| Tipi senza stile per elemento | Aspettativa delusa | Whitelist + palette globale + messaggio esplicito; nessun override non round-trip |
| `pele.parse` diverso da quanto atteso | Modello elementi errato | Spike di 1 ora e fixture per flowchart/class/state/ER prima del passo 3; fallback a sola selezione codice |
| ViewBox/getScreenCTM su WebKitGTK | Zoom/pan imprecisi | Funzioni pure testate, `getScreenCTM`, smoke reale, fallback pulsanti/tastiera |
| Textarea reveal senza focus | Riga non visibile | Apertura editor + focus + `setSelectionRange`; se WebKit non mostra la selezione, overlay mirror nel passo 6 |
| Performance con molti elementi | UI lenta | Debounce, annotazione in una pass, nessun re-render alla selezione, limite 150/200 misurato |
| Export non fedele | File sbagliato | Render fresco prima dell'export, tema inline, test SVG in browser, PNG con sfondo scelto |
| Chiavi tema orfane | Piccolo accumulo | Chiave unica JSON, cleanup sulle cancellazioni note, orphan ignorati; eventuale sweep futuro |

## Test e verifica

**Comandi**: `npm test`, `npm run typecheck`, `npm run build`; smoke `./scripts/run.sh` su WebKitGTK. Non esiste lint script.

**Nuove suite**:
- `viewport.test.ts`: fit, zoom al puntatore, pan, clamp, aspect, resize, container nullo.
- `theme.test.ts` / `contrast.test.ts`: preset completi, mapping Pele/Mermaid, validazione valori, coppie di contrasto note, auto-fix testo b/n.
- `document.test.ts`: `pele.parse` per 4 tipi, round-trip blocco stili, import esterni/last-wins, CRLF, malformati, merge AI per id, firma archi, dedupe, orphan.
- `selection.test.ts`: resolver id Pele/Mermaid (flowchart, class, state, ER, hyphen), edge order, cluster.
- `sourceIndex.test.ts`: righe/range con commenti, catene, subgraph, CRLF; reveal.
- `styles.test.ts`: merge/edit/bulk/reset/idempotenza, nessuno stile per tipi non capable, `linkStyle` per indice.
- `flowchart.test.ts`: label (forme, quote, unicode, `]`), append definizione, errori; in Fase 2 anche struttura.
- `store`/merge: dirty guard, conflitto, export fresco, cleanup tema.

**Verifiche manuali**:
- WebKitGTK: rotella al puntatore, pan, pinch, fit, 100%, resize, testo nitido; selezione con click/Shift; reveal riga; color picker; contrasto; undo visuale.
- Parità: stesso sorgente con Pele e Mermaid per flowchart, class, state, ER; script `render-parity.mjs` in Chrome headless (skip se Chrome assente) + checklist.
- Flusso AI: chat → diagramma → stile/label → AI sul target → stili conservati; modifica durante lo streaming → conflitto; AI che cambia archi → edge styles scartati con toast.
- Export: SVG in browser, PNG 2x con sfondo tema/trasparente, `.mmd` con blocco stili; restore versione.
- Performance: 150 nodi/200 archi, pan/zoom, edit stile < 300 ms.

## Criteri di accettazione

1. Dopo il passo 1, pan/zoom/fit/100% funzionano con mouse, trackpad e touch; la vista non si azzera dopo un edit; lo sfondo del workspace e la griglia cambiano e persistono al riavvio.
2. Dopo il passo 2, i preset cambiano il diagramma in modo coerente e il pannello ne mostra i colori; il tema per diagramma persiste al riavvio; SVG/PNG esportati contengono il tema; `auto` segue il tema app.
3. Dopo il passo 5, un flowchart/class/state/ER permette di modificare fill, stroke, spessore, tratteggio, testo, opacity, radius e font di un elemento e di applicarli in bulk; i tipi non capable mostrano i controlli disabilitati con spiegazione; nessuno `style` viene emesso per sequence/pie/gantt/mindmap.
4. Dopo il passo 6, click su un nodo lo seleziona; l'azione "vai alla riga" apre l'editor e seleziona la riga; modificare lo stile o la label aggiorna il sorgente; modificare il sorgente aggiorna l'SVG; il blocco `%% mc:styles` resta valido e idempotente; il contrasto box/sfondo è segnalato.
5. Una richiesta AI sul target con modifiche non salvate viene bloccata con invito a salvare; se il diagramma cambia durante lo streaming, l'aggiornamento non viene applicato in silenzio; senza conflitto, gli stili dei nodi/cluster rimasti sono conservati e gli orphan elencati.
6. Salvare una versione e ripristinarla conserva gli stili; il tema per diagramma resta invariato (limite dichiarato); cancellare un diagramma/conversazione nota rimuove le entry tema note.
7. `npm test`, `npm run typecheck`, `npm run build` verdi; smoke WebKitGTK superato; nessuna regressione su chat, libreria, versioni.

## Domande aperte / condizioni per l'assenso

1. **Limite tema**: accettare che il tema per diagramma non sia versionato e non sia incluso nel `.mmd` (SVG/PNG sì). In alternativa si torna a `%% mc:theme` nel sorgente, con codec e merge aggiuntivi.
2. **Limite capacità**: accettare che sequence, pie, gantt, timeline, journey, quadrant, xychart, sankey e mindmap abbiano solo la palette globale, perché Mermaid non consente stili per elemento.
3. **Fase 2**: accettare che aggiungi/connetti/elimina/shape/direzione restino fuori dall'MVP; se devono essere nell'MVP, il passo 7 entra e la stima sale a L pieno.
4. **Editor di codice**: accettare il textarea potenziato nel v1; CodeMirror/syntax highlighting è backlog.
5. **Spike `pele.parse`**: prima del passo 3 va confermata la forma del modello per flowchart/class/state/ER; se non è mappabile, la selezione/stile per class/state/ER si riduce e il piano va rivisto.
6. **WebKit reveal**: se `setSelectionRange` senza focus non rende visibile la riga, si aggiunge l'overlay mirror nel passo 6 (costo S).
