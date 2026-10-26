# Prompt Mermaid v4 e grounding

Questa pagina descrive il comportamento dell'AI della chat: analisi del materiale,
scelta delle viste, generazione Mermaid e ricerca di fonti esterne.

## Prompt v4

Il prompt predefinito vive in `src-tauri/src/prompts.rs` (`DEFAULT_SYSTEM_PROMPT`,
`PROMPT_VERSION = "4"`). Impostazioni → **System prompt** può ancora sostituirlo
con un prompt personalizzato; il campo vuoto usa il predefinito.

Il prompt impone:

1. analisi di entità, attributi, relazioni, processi, dati e lacune;
2. una lista di 2-4 viste consigliate prima del diagramma;
3. sintassi Mermaid 12.1+ compatibile con Pele/Mermaid.js;
4. citazioni `[S1]…[Sn]` solo per fonti lette;
5. «non verificato» quando non c'è conferma;
6. nessuna invenzione di numeri, date, nomi o relazioni.

## Come funziona la ricerca

Il grounding è **planner-only**:

1. `shouldPlan` decide se vale la pena chiamare il planner. Salta modifiche pure,
   richieste creative e analisi di materiali già allegati.
2. Il planner (stesso modello, `temperature=0`, `max_tokens≈180`) restituisce
   `research`, `queries` (max 3) e `urls` (max 2).
3. Se serve, il backend interroga i provider gratuiti e deduplica le fonti.
4. I dati non attendibili (`<web_sources>`, `<selected_diagram>`, `<document>`)
   viaggiano in messaggi `user` separati, mai nel system message.
5. Il backend aggiunge sempre `## Fonti consultate` quando c'è ricerca, con
   titolo, URL e data di accesso; il modello non scrive la bibliografia.
6. Se il modello cita un ID inesistente, la sezione lo segnala come
   «Riferimenti non validi».

### Provider (nessuna chiave obbligatoria)

| Provider | Uso | Note |
|---|---|---|
| Wikipedia it/en | panoramiche, definizioni, persone, eventi | API MediaWiki, no key |
| Wikidata | entità e relazioni | claims whitelist, no key |
| OpenAlex | articoli accademici | keyless best-effort (budget condiviso) |
| Bing RSS | web generale e attualità | no key, 10 risultati; uso personale/non commerciale, attribuzione |
| URL diretto | pagine ufficiali o fornite | SSRF guard, max 2MB |

Bing RSS è l'unico provider con condizioni d'uso restrittive: la v1 è pensata per
uso personale/non commerciale. Per una distribuzione commerciale va sostituito
con SearXNG o Brave Search API, mantenendo lo stesso contratto del planner.

## Sicurezza

- Client di ricerca dedicato con `.no_proxy()` e redirect disabilitati.
- DNS pinning: la connessione usa l'IP validato, non una seconda risoluzione.
- Redirect manuali, massimo 5, rivalidati a ogni hop.
- Solo `http`/`https`, porte 80/443, niente credenziali.
- Blocco di loopback, reti private, link-local, multicast, documentazione,
  IPv4-mapped e IPv6 speciali.
- Body massimo 2MB, content-type allowlist, estrazione HTML senza script/style.
- Timeout: 8s per richiesta, 20s complessivi per la ricerca.
- I contenuti web sono dati non attendibili: il prompt istruisce a ignorare
  comandi al loro interno; i delimitatori di chiusura vengono sanificati.

## Limiti

- La ricerca web generalista dipende da Bing RSS; se il feed cambia o blocca,
  la risposta prosegue senza fonti e dichiara «non verificato».
- OpenAlex keyless ha un budget condiviso e può fallire.
- Non c'è cache persistente: ogni ricerca è fresca. Se in futuro servisse, si
  potrà aggiungere una cache in memoria senza migrazioni.
- Il planner aggiunge una chiamata solo quando `shouldPlan` è vero; le modifiche
  pure con diagramma selezionato non lo attivano.
- I modelli reasoning possono consumare token in `reasoning` prima del contenuto:
  il planner usa un budget di 1200 token e, se il contenuto è vuoto, il backend
  ripiega sul testo di reasoning; la generazione principale non impone un
  `max_tokens` basso.

## Verifica manuale

Con una API key configurata:

1. Chiedi «Chi è Alan Turing?» → deve attivare ricerca, citare `[S1]` e mostrare
   `## Fonti consultate`.
2. Chiedi «Crea un diagramma da questo testo» con un allegato → non deve partire
   il planner.
3. Apri un diagramma e chiedi «Cambia il colore dei nodi» → nessuna ricerca,
   aggiornamento completo del target.
4. Annulla durante «Ricerca fonti…» → stato annullato, usage del planner
   conservato se disponibile.
5. Prova offline: la risposta deve proseguire senza fonti e dichiarare i limiti.

Smoke Rust opzionale (rete reale):

```bash
source scripts/env.sh
cargo test --manifest-path src-tauri/Cargo.toml smoke_providers -- --ignored --nocapture
```


## Qualità e valutazione

- Dopo ogni risposta l'app valida i blocchi Mermaid: prima con Pele, poi con il
  renderer Mermaid. I blocchi non validi vengono inviati al modello come
  richiesta di correzione (massimo 2 tentativi); il testo corretto viene salvato
  nel messaggio.
- Ogni card diagramma in chat ha un feedback 👍/👎 persistito nella colonna
  `diagrams.feedback` (migrazione `user_version = 4`).
- Il prompt aggiunge un esempio few-shot mirato sul tipo richiesto, senza
  duplicare il tema o le regole di sicurezza.
- Il prompt ha una variante **compact** opzionale per modelli free/piccoli
  (Impostazioni → System prompt). È più corta (circa un terzo del prompt full)
  ma meno precisa sulla scelta della vista; il default resta il prompt completo.
  Se è presente un prompt personalizzato, la variante compact non viene usata.
- La valutazione su 60 testi realistici vive in `eval/prompts/cases.json`:
  ```bash
  npm run eval:prompt:check   # fixture + prompt, nessuna rete
  OPENROUTER_API_KEY=... npm run eval:prompt
  # modello predefinito: openai/gpt-4o-mini; override con EVAL_MODEL
  # parallelismo: EVAL_CONCURRENCY (default 3)
  ```
  Il report viene scritto in `eval/results/latest.json` (ignorato da git).
  Esito attuale: 60/60 PASS, top-1 100%, coerenza 100%, sintassi raw 93%,
  sintassi finale 100%. Il test finale indipendente su 15 casi holdout è
  `npm run eval:prompt:holdout`: 15/15 PASS, top-1 100%, coerenza 100%,
  sintassi raw 93%, sintassi finale 100%.
