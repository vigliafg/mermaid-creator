# Changelog

## 0.20.0 — 2026-10-25

### Lavagna Excalidraw

- Ogni diagramma ha una seconda superficie **Lavagna**: switch `Diagramma | Lavagna`
  nella testata, senza perdere il sorgente Mermaid come fonte di verità.
- Conversione nativa in elementi Excalidraw con il fork
  `@excalidraw/mermaid-to-excalidraw` 2.4.0 (22/22 tipi coperti dall'harness).
- Primo avvio a tre percorsi: **Crea lavagna modificabile**, **Disegna da zero**,
  **Inserisci come immagine** (SVG del render corrente, per la massima fedeltà).
- Messaggi onesti sulla qualità della conversione (`semantica`, `generica`,
  `immagine`) con banner e azione **Riprova**.
- Editor Excalidraw completo: forme, testo, frecce, immagini, frame, laser,
  libreria, undo/redo, zoom/pan, proprietà e scorciatoie native.
- Font Excalidraw **self-hosted** (`public/excalidraw-assets`) e
  `EXCALIDRAW_ASSET_PATH`: nessuna richiesta al CDN, lavagna utilizzabile offline.
- Link esterni aperti nel browser di sistema con il plugin Tauri `opener`;
  embed iframe disabilitati.
- Export app-level: PNG 1x/2x/3x con/senza sfondo, SVG con/senza sfondo,
  `.excalidraw` e copia PNG/SVG negli appunti, con i dialoghi Tauri dell'app.
- In modalità Lavagna la toolbar Mermaid e la fascia destra scompaiono; le
  azioni secondarie passano nel menu `…`.
- Scorciatoie dell'app isolate: `V`, `H`, `Delete`, undo/redo Mermaid ed `Esc`
  non intercettano Excalidraw; `Ctrl/Cmd + S` salva la versione.

### Libreria Excalidraw e librerie della comunità

- La finestra **Library** dell'editor è attiva: salvataggio degli elementi
  selezionati, inserimento nella lavagna, rinomina, eliminazione e reset.
- Gli elementi della libreria sono **globali** e persistono in SQLite tra
  sessioni e riavvii (tabella `excalidraw_library`, migrazione `user_version = 3`).
  Nel browser di sviluppo è attivo un fallback `localStorage`.
- Il pulsante **Sfoglia librerie** apre un catalogo integrato con le librerie
  pubbliche di `libraries.excalidraw.com` (oltre 200): ricerca, ordinamento,
  anteprime, download e installazione con un clic.
- Catalogo e contatori sono memorizzati in `excalidraw_library_catalog`, così
  la finestra si riapre anche senza rete; le librerie installate restano
  sempre disponibili offline.
- Importazione di file `.excalidrawlib` locali. Nessuna richiesta oltre al
  dominio ufficiale delle librerie (CSP `connect-src`/`img-src` dedicata).

### Prompt Mermaid v4 e grounding

- Nuovo prompt predefinito v4: analisi strutturata di entità, attributi,
  relazioni, processi, dati e lacune; lista di viste consigliate; regole
  Mermaid 12.1+; citazioni e «non verificato»; nessuna invenzione di dati.
- Grounding planner-only e gratuito: Wikipedia, Wikidata, OpenAlex, Bing RSS e
  URL diretti, con budget (3 query, 2 URL, 8 fonti, 20s) e deduplica.
- I payload non attendibili (`<web_sources>`, `<selected_diagram>`,
  `<document>`) viaggiano in messaggi `user` separati, mai nel system message.
- Il backend aggiunge sempre `## Fonti consultate` quando c'è ricerca e segnala
  eventuali citazioni `[Sx]` non valide.
- SSRF hardening: `.no_proxy()`, DNS pinning, redirect manuali, blocco di reti
  private/IPv6 speciali, limiti di body e content-type.
- Stato «Analisi e pianificazione…» / «Ricerca fonti…» / «Generazione…» nella
  bolla di streaming; cancellation e usage coprono planner, ricerca e stream.
- Bing RSS è pensato per uso personale/non commerciale; per uso commerciale va
  sostituito con SearXNG/Brave. Vedi `docs/ai-grounding.md`.

### Qualità dei diagrammi

- **Auto-repair Mermaid**: dopo la risposta l'app valida i blocchi con Pele e, se
  serve, con Mermaid; i diagrammi non validi vengono corretti dal modello (max 2
  tentativi) e il testo aggiornato viene salvato. Se la correzione fallisce,
  l'utente viene avvisato e può intervenire dall'editor.
- **Feedback sulle viste**: ogni card diagramma in chat ha pollice su/giù,
  persistito in SQLite (`diagrams.feedback`, migrazione `user_version = 4`).
- **Few-shot mirati**: il prompt aggiunge un esempio compatto del tipo richiesto
  (flowchart, sequence, class, ER, state, mindmap, gantt, xychart, journey,
  quadrant, timeline, pie).
- **Valutazione su testi reali**: `eval/prompts/cases.json` con 60 casi e
  harness `npm run eval:prompt` / `npm run eval:prompt:check` per misurare
  top-1, coerenza top/generato, validità Mermaid raw e finale, termini chiave e
  latenza. Modello di riferimento: `openai/gpt-4o-mini`.
- **Prompt compatto opzionale** per modelli free/piccoli, attivabile dalle
  impostazioni (circa 1/3 del full, meno preciso sulla scelta della vista);
  ignora il prompt personalizzato solo quando il campo è vuoto.
- **Esito eval attuale**: 60/60 PASS, top-1 100%, coerenza 100%, sintassi raw
  93%, sintassi finale 100%. **Holdout indipendente (15 casi)**: 15/15 PASS,
  top-1 100%, coerenza 100%, sintassi raw 93%, sintassi finale 100%.
- **Modelli reasoning**: planner con budget 1200 token, fallback sul testo di
  reasoning se `content` è vuoto; generazione principale senza `max_tokens`
  basso per non troncare il contenuto.

### Onboarding

- L'onboarding iniziale è in **due passi**: prima la API key OpenRouter, poi la
  scelta del modello predefinito dal catalogo completo (ricerca, filtri
  Vision/Gratis, prezzi e contesto).
- Dopo la verifica della key il selettore si apre automaticamente; il modello
  consigliato resta preselezionato e **Inizia** conferma la scelta.
- Se il catalogo non è raggiungibile si può riprovare o continuare e configurare
  il modello dalle impostazioni.
- Se disponibile, l'onboarding preseleziona **`openai/gpt-4o-mini`** come modello
  predefinito; l'utente può cambiarlo subito dal selettore.

### Autosave, versioni e sincronizzazione

- Autosave single-flight con debounce di 600 ms, revisione monotona e flush
  prima di cambiare modalità, diagramma, conversazione o creare una versione.
- Stato visibile: `Salvato`, `Modifiche non salvate`, `Salvataggio…`,
  `Errore di salvataggio`; nessun loop di retry, errore azionabile.
- La firma di salvataggio ignora selezione, hover, scroll e zoom; persiste solo
  elementi, `files`, sfondo e griglia.
- Limite di 25 MB per scena con messaggio esplicito.
- Sorgente cambiato → la lavagna è marcata **Da aggiornare** e non viene
  sovrascritta. Azioni **Aggiorna** e **Salva e aggiorna** (snapshot di
  sicurezza prima della rigenerazione).
- Lavagna manuale mai stale; `base_source` esatto per quelle derivate.
- Versioni con **snapshot della lavagna** e badge `Lavagna`; il ripristino
  riporta sorgente e lavagna insieme (o lascia la lavagna e la marca da
  aggiornare se la versione non ha snapshot).
- Persistenza separata `diagram_boards` e colonna `board_snapshot` in
  `diagram_versions`; migrazione `user_version = 2` in transazione.
- Delete di diagramma e conversazione pulisce lavagna e snapshot.
- La card diagramma in chat ha anche **Lavagna**; **Modifica con l'AI** riporta
  al diagramma e prepara la chat senza inviare nulla.

### Catalogo diagrammi

- I 12 tipi storici restano, ma ognuno ha ora **10 varianti** (120 sorgenti
  totali, 3 storiche + 7 nuove per tipo).
- Varianti in una **fascia laterale** dentro ogni card, numerate e selezionabili:
  il clic aggiorna l'anteprima senza aprire il dettaglio.
- Anteprime **autofit** reali: proporzioni preservate, niente diagrammi
  schiacciati o tagliati.
- Il dettaglio usa la stessa fascia laterale accanto all'anteprima grande.
- Ricerca estesa a nomi e descrizioni delle varianti.

### UI e workspace

- Header del workspace su **una sola riga**: titolo, switch
  `Diagramma | Lavagna`, salva, esporta e menu `…`.
- Toolbar Mermaid compatta su **una riga da 32 px**, con selettore freccia
  visibile solo durante la connessione dei nodi.
- Barra di stato della lavagna su **una riga da 30 px**: origine, stato
  autosave e azioni contestuali.
- Titolo del diagramma più leggibile e azioni secondarie raccolte nel menu `…`
  anche in modalità Diagramma.
- Risparmio verticale di circa 90-100 px a favore del canvas.

### Affidabilità e infrastruttura

- Coda Mermaid condivisa fra app e fork: il fallback Mermaid dell'app usa
  `runMermaidTaskSequentially`, evitando race su `initialize`/`render`.
- Tarball del fork versionato in `vendor/` (sha256 documentato) per un
  `npm ci` riproducibile anche in CI, senza pubblicazione npm.
- Workflow del fork per pubblicare il tarball su tag `fork-v*`.
- Test: app **87**, Rust **11**, fork **103**, harness **22/22**, visual
  **145 + 1 skip** senza aggiornare gli snapshot.
- Verifica reale in WebKitGTK: font locali, disegno, `onChange`,
  `updateScene`, `serializeAsJSON`, export PNG/SVG, clipboard con gesto utente
  e CSP di produzione che blocca le richieste remote.

### Limiti dichiarati

- Nessun round-trip Excalidraw → Mermaid: la lavagna è una copia derivata.
- Nessun documento «solo lavagna»: la lavagna nasce da un diagramma.
- Tema della lavagna congelato alla creazione; per riallinearlo serve
  **Aggiorna** dal sorgente.
- Il convertitore del fork è consumato dal tarball in `vendor/`; la Release
  GitHub `fork-v2.4.0` può sostituirlo quando si autorizza il push del fork.
