# Valutazione del prompt Mermaid

Questo set misura il comportamento del prompt su testi realistici, senza
modificare il codice dell'app.

## Casi

`cases.json` contiene 60 testi realistici per la taratura. `holdout.json`
contiene 15 casi indipendenti, mai usati per modificare il prompt, da usare come
test finale.

Ogni caso contiene:

- `expectedTypes`: tipi Mermaid accettabili per quel testo;
- `mustMention`: concetti/entità che devono comparire nella risposta;
- `source`: provenienza o natura del testo.

I testi sono brevi e non contengono dati personali. Coprono i 12 tipi del catalogo: flowchart, sequence, class, ER, state, gantt, pie, mindmap, timeline, journey, quadrant e xychart.

## Esecuzione

Validazione locale (nessuna rete):

```bash
npm run eval:prompt:check
```

Valutazione reale (richiede una API key OpenRouter e un modello):

```bash
OPENROUTER_API_KEY=sk-or-... npm run eval:prompt
```

Test finale indipendente (holdout):

```bash
OPENROUTER_API_KEY=sk-or-... npm run eval:prompt:holdout
```

Risultati attuali:
- taratura (60 casi): 60/60 PASS, top-1 100%, coerenza 100%, sintassi raw 93%, finale 100%;
- holdout (15 casi): 15/15 PASS, top-1 100%, coerenza 100%, sintassi raw 93%, finale 100%.

Modello predefinito: `openai/gpt-4o-mini` (sovrascrivibile con `EVAL_MODEL`).

Variabili opzionali:

- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`);
- `EVAL_MAX_CASES` per limitare i casi;
- `EVAL_CONCURRENCY` (default 3) per parallelizzare le richieste;
- `MERMAID_CREATOR_OPENROUTER_KEY` come alternativa alla API key.

Il report viene scritto in `eval/results/latest.json` ed è ignorato da git.
L'harness valuta il prompt base; gli esempi few-shot vengono scelti a runtime in
base al testo e non sono inclusi nel conteggio del file prompt.
