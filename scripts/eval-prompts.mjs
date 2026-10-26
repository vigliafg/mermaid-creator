#!/usr/bin/env node
/**
 * Valutazione del prompt Mermaid su testi realistici.
 *
 * Uso:
 *   OPENROUTER_API_KEY=sk-or-... EVAL_MODEL=<model-id> npm run eval:prompt
 *   npm run eval:prompt:check   # valida solo fixture + prompt, senza rete
 *
 * Il prompt viene letto da src-tauri/src/prompts.rs per evitare duplicazioni.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render as peleRender } from "pele";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tuneCasesPath = join(root, "eval/prompts/cases.json");
const holdoutCasesPath = join(root, "eval/prompts/holdout.json");
const promptPath = join(root, "src-tauri/src/prompts.rs");
const resultsDir = join(root, "eval/results");

const checkOnly = process.argv.includes("--check");
const help = process.argv.includes("--help") || process.argv.includes("-h");

if (help) {
  console.log(`Uso:
  npm run eval:prompt:check
  OPENROUTER_API_KEY=... npm run eval:prompt
  npm run eval:prompt -- --holdout   # test finale indipendente

Variabili:
  OPENROUTER_API_KEY / MERMAID_CREATOR_OPENROUTER_KEY
  EVAL_MODEL (default: openai/gpt-4o-mini)
  EVAL_PROMPT_PROFILE (full|compact; default full)
  EVAL_DATASET (tune|holdout; default tune)
  --holdout (equivale a EVAL_DATASET=holdout)
  OPENROUTER_BASE_URL (default https://openrouter.ai/api/v1)
  EVAL_MAX_CASES (default: tutti)
`);
  process.exit(0);
}

function readPrompt(profile = "full") {
  const source = readFileSync(promptPath, "utf8");
  const name =
    profile === "compact" ? "COMPACT_SYSTEM_PROMPT" : "DEFAULT_SYSTEM_PROMPT";
  const match = source.match(
    new RegExp(`pub const ${name}: &str = r#"([\\s\\S]*?)"#;`, "m"),
  );
  if (!match) throw new Error(`${name} non trovato in prompts.rs`);
  return match[1];
}

function readExamples() {
  const source = readFileSync(promptPath, "utf8");
  const examples = {};
  const pattern = /const ([A-Z_]+_EXAMPLE): &str = r#"([\s\S]*?)"#;/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    examples[match[1]] = match[2];
  }
  if (!examples.FLOWCHART_EXAMPLE) {
    throw new Error("esempi few-shot non trovati in prompts.rs");
  }
  return examples;
}

function hasWord(haystack, needle) {
  return haystack.split(/[^a-z0-9]+/i).includes(needle);
}

function pickExample(text, examples) {
  const lower = text.toLowerCase();
  if (lower.includes("flowchart") || lower.includes("flow chart")) return examples.FLOWCHART_EXAMPLE;
  if (
    lower.includes("sequence") || lower.includes("sequenza") || lower.includes("messaggi") ||
    lower.includes("chiamate api") || lower.includes("autenticazione") ||
    lower.includes("credenziali") || lower.includes("refresh token") || lower.includes("login") ||
    lower.includes("token")
  ) return examples.SEQUENCE_EXAMPLE;
  if (
    lower.includes("er diagram") || lower.includes("schema") || lower.includes("database") ||
    lower.includes("entità") || hasWord(lower, "er")
  ) return examples.ER_EXAMPLE;
  if (
    lower.includes("state") || lower.includes("stati") || lower.includes("stato") ||
    lower.includes("transizion") || lower.includes("ciclo di vita") ||
    lower.includes("macchina a stati") || lower.includes("bozza") ||
    lower.includes("revisione") || lower.includes("pubblicato")
  ) return examples.STATE_EXAMPLE;
  if (lower.includes("classificazione") || lower.includes("tassonomia") || lower.includes("gerarchia")) {
    return examples.MINDMAP_EXAMPLE;
  }
  if (lower.includes("class diagram") || lower.includes("classi") || hasWord(lower, "class")) {
    return examples.CLASS_EXAMPLE;
  }
  if (
    lower.includes("mindmap") || lower.includes("mappa mentale") || lower.includes("concetti") ||
    lower.includes("tassonomia") || lower.includes("gerarchia") || lower.includes("rischi")
  ) return examples.MINDMAP_EXAMPLE;
  if (
    lower.includes("gantt") || lower.includes("roadmap") || lower.includes("pianificazione") ||
    lower.includes("marzo") || lower.includes("aprile") || lower.includes("maggio") ||
    lower.includes("milestone") || lower.includes("scadenze")
  ) return examples.GANTT_EXAMPLE;
  if (lower.includes("ripartit") || lower.includes("budget") || lower.includes("composizione")) {
    return examples.PIE_EXAMPLE;
  }
  if (
    lower.includes("xychart") || lower.includes("grafico") || lower.includes("andamento") ||
    lower.includes("dati numerici") || lower.includes("ricavi") || lower.includes("costi") ||
    lower.includes("margine") || lower.includes("vendite") || lower.includes("trend")
  ) return examples.XYCHART_EXAMPLE;
  if (
    lower.includes("journey") || lower.includes("esperienza utente") ||
    lower.includes("percorso del cliente") || lower.includes("paziente") ||
    lower.includes("soddisfazione") || lower.includes("triage")
  ) return examples.JOURNEY_EXAMPLE;
  if (
    lower.includes("quadrant") || lower.includes("priorità") || lower.includes("posizionamento") ||
    lower.includes("costo") || lower.includes("copertura")
  ) {
    return examples.QUADRANT_EXAMPLE;
  }
  if (lower.includes("timeline") || lower.includes("cronologia")) return examples.TIMELINE_EXAMPLE;
  if (
    lower.includes("pie chart") || lower.includes("proporzioni") || lower.includes("torta") ||
    lower.includes("ripartit") || lower.includes("composizione") || lower.includes("budget")
  ) {
    return examples.PIE_EXAMPLE;
  }
  return examples.FLOWCHART_EXAMPLE;
}

function suggestedType(text) {
  const lower = text.toLowerCase();
  if (lower.includes("flowchart") || lower.includes("flow chart")) return "flowchart";
  if (
    lower.includes("sequence") || lower.includes("sequenza") || lower.includes("messaggi") ||
    lower.includes("chiamate api") || lower.includes("token") || lower.includes("refresh") ||
    lower.includes("login") || hasWord(lower, "client") || hasWord(lower, "server") ||
    lower.includes("acknowledgement") || lower.includes("pipeline")
  ) return "sequence";
  if (lower.includes("classificazione") || lower.includes("tassonomia") || lower.includes("gerarchia")) {
    return "mindmap";
  }
  if (
    lower.includes("class diagram") || hasWord(lower, "classi") || hasWord(lower, "classe") ||
    lower.includes("metodi") || lower.includes("oggetti") || lower.includes("ereditariet") || hasWord(lower, "class")
  ) return "class";
  if (
    lower.includes("er diagram") || lower.includes("schema") || lower.includes("database") ||
    lower.includes("tabelle") || lower.includes("colonne") || lower.includes("chiavi") ||
    hasWord(lower, "er")
  ) return "er";
  if (
    lower.includes("mindmap") || lower.includes("mappa mentale") || lower.includes("mappa concettuale") ||
    lower.includes("gerarchia") || lower.includes("tassonomia") || lower.includes("sottocategorie") ||
    lower.includes("classificazione") || lower.includes("rami")
  ) return "mindmap";
  if (
    lower.includes("journey") || lower.includes("esperienza utente") || lower.includes("percorso del cliente") ||
    lower.includes("percorso esperienziale") || lower.includes("paziente") || lower.includes("soddisfazione") ||
    lower.includes("triage") || lower.includes("onboarding")
  ) return "journey";
  if (
    lower.includes("gantt") || lower.includes("roadmap") || lower.includes("pianificazione") ||
    lower.includes("durate") || lower.includes("dipendenze") || lower.includes("milestone") ||
    lower.includes("scadenze")
  ) return "gantt";
  if (
    lower.includes("cronologia") || lower.includes("tappe") || lower.includes("timeline") ||
    lower.includes("successione degli eventi")
  ) return "timeline";
  if (
    lower.includes("quadrant") || lower.includes("quadrante") || lower.includes("impatto") ||
    lower.includes("sforzo") || lower.includes("probabilità") || lower.includes("probabilita") ||
    lower.includes("matrice dei rischi") || lower.includes("valore e sforzo") ||
    lower.includes("costo") || lower.includes("copertura")
  ) return "quadrant";
  if (lower.includes("ripartit") || lower.includes("budget") || lower.includes("composizione")) {
    return "pie";
  }
  if (
    lower.includes("ricavi") || lower.includes("costi") || lower.includes("vendite") ||
    lower.includes("download") || lower.includes("temperature") || lower.includes("traffico") ||
    lower.includes("trimestrali") || lower.includes("mensili") || lower.includes("andamento") ||
    lower.includes("trend") || lower.includes("conversioni") || lower.includes("obiettivi")
  ) return "xychart";
  if (
    lower.includes("percentuale") || lower.includes("ripartit") || lower.includes("composizione") ||
    lower.includes("budget") || lower.includes("mix ") || lower.includes("distribuito") ||
    lower.includes("distribuzione") || lower.includes("share")
  ) return "pie";
  if (
    lower.includes("bozza") || lower.includes("revisione") || lower.includes("pubblicato") ||
    lower.includes("transizion") || lower.includes("ciclo di vita") || lower.includes("stati") ||
    lower.includes("stato")
  ) return "state";
  return null;
}

function buildEvalPrompt(prompt, text, examples) {
  const today = new Date().toISOString().slice(0, 10);
  const hint = suggestedType(text);
  const hintBlock = hint
    ? `\n\n## Vincolo di coerenza\nIl sistema ha rilevato segnali forti di \`${hint}\`. La vista con priorità 1 e il diagramma principale devono essere \`${hint}\`. Se il contenuto è palesemente incompatibile, spiega in una riga e scegli l'alternativa.`
    : "";
  return `${prompt}\n\nData odierna: ${today}. Usa questa data per valutare la freschezza delle fonti.\n\n## Esempi di riferimento\nUsa questi esempi solo come guida di sintassi, formato e leggibilità: non copiarne il contenuto.\n\n${pickExample(text, examples)}${hintBlock}`;
}

function readCases(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("cases.json deve contenere un array non vuoto");
  }
  const allowed = new Set([
    "flowchart",
    "sequence",
    "class",
    "state",
    "er",
    "gantt",
    "pie",
    "mindmap",
    "timeline",
    "journey",
    "quadrant",
    "xychart",
    "sankey",
    "c4",
    "block",
  ]);
  const ids = new Set();
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== "object") throw new Error(`case ${index} non valido`);
    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new Error(`case ${index}: id mancante`);
    }
    if (ids.has(item.id)) throw new Error(`id duplicato: ${item.id}`);
    ids.add(item.id);
    if (typeof item.text !== "string" || item.text.trim().length < 80) {
      throw new Error(`${item.id}: testo troppo corto o mancante`);
    }
    if (!Array.isArray(item.expectedTypes) || item.expectedTypes.length === 0) {
      throw new Error(`${item.id}: expectedTypes mancante`);
    }
    for (const type of item.expectedTypes) {
      if (!allowed.has(type)) throw new Error(`${item.id}: tipo sconosciuto ${type}`);
    }
    if (item.expectedTopTypes !== undefined) {
      if (!Array.isArray(item.expectedTopTypes) || item.expectedTopTypes.length === 0) {
        throw new Error(`${item.id}: expectedTopTypes non valido`);
      }
      for (const type of item.expectedTopTypes) {
        if (!item.expectedTypes.includes(type)) {
          throw new Error(`${item.id}: expectedTopTypes contiene ${type} non ammesso`);
        }
      }
    } else if (typeof item.expectedTopType !== "string" || !item.expectedTypes.includes(item.expectedTopType)) {
      throw new Error(`${item.id}: expectedTopType mancante o non incluso in expectedTypes`);
    }
    if (!Array.isArray(item.mustMention) || item.mustMention.length === 0) {
      throw new Error(`${item.id}: mustMention mancante`);
    }
    if (item.mustNotMention !== undefined && !Array.isArray(item.mustNotMention)) {
      throw new Error(`${item.id}: mustNotMention deve essere un array`);
    }
  }
  return raw;
}

function diagramBlocks(content) {
  const out = [];
  const pattern = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    out.push(match[1].trim());
  }
  return out;
}

const TYPE_MAP = {
  graph: "flowchart",
  flowchart: "flowchart",
  "flowchart-elk": "flowchart",
  sequenceDiagram: "sequence",
  classDiagram: "class",
  stateDiagram: "state",
  "stateDiagram-v2": "state",
  stateDiagramV2: "state",
  erDiagram: "er",
  gantt: "gantt",
  pie: "pie",
  mindmap: "mindmap",
  timeline: "timeline",
  journey: "journey",
  quadrantChart: "quadrant",
  xychart: "xychart",
  "xychart-beta": "xychart",
  sankey: "sankey",
  "block-beta": "block",
  block: "block",
  C4Context: "c4",
  C4Container: "c4",
  C4Component: "c4",
  C4Dynamic: "c4",
  C4Deployment: "c4",
};

function diagramType(source) {
  const first = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));
  const token = first?.split(/\s+/)[0] ?? "";
  return TYPE_MAP[token] ?? token.toLowerCase();
}

function hasTitle(source) {
  return source
    .split(/\r?\n/)
    .slice(0, 5)
    .some((line) => /^%%\s*title\s*:/i.test(line.trim()));
}

function parseRecommendedTypes(content) {
  const section = content.split(/##\s*Viste consigliate/i)[1] ?? content;
  const cut = section.split(/##\s*Diagramma|```mermaid/i)[0] ?? section;
  const types = [];
  const rowPattern = /^\s*\|\s*\d+\s*\|\s*([A-Za-z0-9_-]+)/gm;
  let match;
  while ((match = rowPattern.exec(cut)) !== null) {
    const type = TYPE_MAP[match[1]] ?? match[1].toLowerCase();
    if (!types.includes(type)) types.push(type);
  }
  if (types.length === 0) {
    const listPattern = /^\s*(?:\d+[.)]|[-*])\s*(?:\*\*)?([A-Za-z0-9_-]+)(?:\*\*)?/gm;
    while ((match = listPattern.exec(cut)) !== null) {
      const token = match[1];
      const type = TYPE_MAP[token] ?? (token.length > 2 ? token.toLowerCase() : null);
      if (type && !types.includes(type)) types.push(type);
    }
  }
  if (types.length === 0) {
    const found = [];
    for (const [token, type] of Object.entries(TYPE_MAP)) {
      const index = cut.search(new RegExp(`\\b${token}\\b`, "i"));
      if (index >= 0) found.push({ index, type });
    }
    for (const item of found.sort((a, b) => a.index - b.index)) {
      if (!types.includes(item.type)) types.push(item.type);
    }
  }
  return types;
}

function simplifySequenceActivations(source) {
  return source.replace(/(-->>|->>|-->|->|--x|--\)|-\))([+-])/g, "$1");
}

function simplifyXYChartSeries(source) {
  if (!/^\s*xychart-beta/m.test(source)) return source;
  const numbersFrom = (body) =>
    body
      .split(/[,\s]+/)
      .map((value) => value.trim().replace(/[€$£%]/g, ""))
      .map((value) => {
        if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) return value.replace(/\./g, "");
        if (/^\d{1,3}(?:,\d{3})+$/.test(value)) return value.replace(/,/g, "");
        return value.replace("_", "").replace(",", ".");
      })
      .filter((value) => /^-?\d+(?:\.\d+)?$/.test(value));
  return source
    .replace(/^(\s*(?:line|bar)\s+)\[([^\]]*)\][^\n]*/gm, (full, prefix, body) => {
      const numbers = numbersFrom(body);
      return numbers.length >= 2 ? `${prefix}[${numbers.join(", ")}]` : full;
    })
    .replace(/^(\s*(?:line|bar)\s+)"[^"]*"\s+([^\n]+)/gm, (full, prefix, body) => {
      const numbers = numbersFrom(body);
      return numbers.length >= 2 ? `${prefix}[${numbers.join(", ")}]` : full;
    });
}

function simplifyQuadrantLabels(source) {
  if (!/^\s*quadrantChart/m.test(source)) return source;
  const lines = source.split(/\r?\n/);
  let xMax = 1;
  let yMax = 1;
  for (const line of lines) {
    const match = line.match(/^\s*([xy])-axis\b.*?0\s*-->\s*([\d.]+)/i);
    if (match) {
      const value = Number(match[2]);
      if (Number.isFinite(value) && value > 1) {
        if (match[1].toLowerCase() === "x") xMax = value;
        else yMax = value;
      }
    }
  }
  return lines
    .map((line) => {
      const axis = line.match(/^(\s*[xy]-axis\b.*?0\s*-->\s*)[\d.]+(.*)$/i);
      if (axis && (xMax > 1 || yMax > 1)) {
        return `${axis[1]}1${axis[2]}`;
      }
      const point = line.match(/^(\s*)(?:point\s+)?"([^"]+)"\s*:\s*\[([^\]]+)\](.*)$/i)
        ?? line.match(/^(\s*)(?:point\s+)?([^:]+?)\s*:\s*\[([^\]]+)\](.*)$/i);
      if (!point) return line;
      const indent = point[1];
      const label = point[2].trim();
      const values = point[3]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
      if (values.length < 2) return line;
      const x = Math.max(0, Math.min(1, values[0] / xMax));
      const y = Math.max(0, Math.min(1, values[1] / yMax));
      return `${indent}${label}: [${Number(x.toFixed(3))}, ${Number(y.toFixed(3))}]`;
    })
    .join("\n");
}

function blockRenders(source) {
  try {
    peleRender(source);
    return true;
  } catch {
    return false;
  }
}

function applyFallbacks(content) {
  let index = 0;
  return content.replace(/```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi, (full, source) => {
    let fixed = source.trim();
    if (!blockRenders(fixed)) {
      for (const simplify of [
        simplifySequenceActivations,
        simplifyXYChartSeries,
        simplifyQuadrantLabels,
      ]) {
        const candidate = simplify(fixed);
        if (candidate !== fixed && blockRenders(candidate)) {
          fixed = candidate;
          break;
        }
      }
    }
    index += 1;
    return `\`\`\`mermaid\n${fixed}\n\`\`\``;
  });
}

function evaluateCase(item, content) {
  const reasons = [];
  const rawBlocks = diagramBlocks(content);
  const rawSyntaxOk =
    rawBlocks.length > 0 && rawBlocks.every((block) => blockRenders(block));
  const normalizedContent = applyFallbacks(content);
  const blocks = diagramBlocks(normalizedContent);
  const types = blocks.map(diagramType);
  const recommended = parseRecommendedTypes(normalizedContent);
  const topType = recommended[0] ?? null;
  const topAllowed = item.expectedTopTypes ?? [item.expectedTopType];
  const topOk = topType !== null && topAllowed.includes(topType);
  const generatedOk =
    blocks.length > 0 && types.some((type) => item.expectedTypes.includes(type));
  const coherent = topType ? types[0] === topType : false;
  let syntaxOk = blocks.length > 0;
  if (blocks.length === 0) reasons.push("nessun blocco Mermaid");
  if (blocks.length > 4) reasons.push(`troppi diagrammi: ${blocks.length} > 4`);
  if (!topOk) {
    reasons.push(
      `priorità 1 inattesa: ${topType ?? "assente"}; ammesse ${topAllowed.join(", ")}`,
    );
  }
  if (!generatedOk) {
    reasons.push(
      `tipo generato inatteso: ${types.join(", ") || "assente"}; ammessi ${item.expectedTypes.join(", ")}`,
    );
  }
  if (topType && types[0] && !coherent) {
    reasons.push(`incoerenza: priorità 1 ${topType}, generato ${types[0]}`);
  }
  for (const block of blocks) {
    if (!hasTitle(block)) reasons.push("blocco senza %% title");
    if (!blockRenders(block)) {
      syntaxOk = false;
      reasons.push("Mermaid non valido anche dopo i fallback");
    }
  }
  const lower = normalizedContent.toLowerCase();
  for (const term of item.mustMention) {
    if (!lower.includes(String(term).toLowerCase())) {
      reasons.push(`termine mancante: ${term}`);
    }
  }
  for (const term of item.mustNotMention ?? []) {
    if (lower.includes(String(term).toLowerCase())) {
      reasons.push(`termine non ammesso: ${term}`);
    }
  }
  return {
    ok: reasons.length === 0,
    reasons,
    types,
    topType,
    recommended,
    topOk,
    generatedOk,
    coherent,
    rawSyntaxOk,
    syntaxOk,
    blocks: blocks.length,
    content: normalizedContent,
  };
}


async function callModel(prompt, text, model, apiKey) {
  const base = (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost/mermaid-creator",
      "X-OpenRouter-Title": "Mermaid Creator Eval",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      stream: false,
      temperature: 0,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${raw.slice(0, 500)}`);
  }
  const value = JSON.parse(raw);
  const content = value?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("risposta senza content");
  }
  return content;
}

async function main() {
  const profile = process.env.EVAL_PROMPT_PROFILE === "compact" ? "compact" : "full";
  const dataset =
    process.argv.includes("--holdout") || process.env.EVAL_DATASET === "holdout"
      ? "holdout"
      : "tune";
  const casesPath = dataset === "holdout" ? holdoutCasesPath : tuneCasesPath;
  const prompt = readPrompt(profile);
  const examples = readExamples();
  const cases = readCases(casesPath);
  const limit = Number(process.env.EVAL_MAX_CASES ?? 0);
  const selected = limit > 0 ? cases.slice(0, limit) : cases;
  console.log(
    `Dataset ${dataset} · prompt ${profile}: ${prompt.length} caratteri · esempi: ${Object.keys(examples).length} · casi: ${selected.length}/${cases.length}`,
  );

  if (checkOnly) {
    const sample = parseRecommendedTypes(
      "## Viste consigliate\n1. **sequenceDiagram** (priorità 1)\n2. flowchart",
    );
    if (sample[0] !== "sequence") {
      throw new Error(`parser raccomandazioni non valido: ${sample.join(", ")}`);
    }
    const tune = readCases(tuneCasesPath);
    const holdout = readCases(holdoutCasesPath);
    console.log(
      `Fixture valide: tune ${tune.length}, holdout ${holdout.length} · esempi ${Object.keys(examples).length} · nessuna chiamata di rete.`,
    );
    return;
  }

  const apiKey =
    process.env.OPENROUTER_API_KEY ??
    process.env.MERMAID_CREATOR_OPENROUTER_KEY ??
    "";
  const model = process.env.EVAL_MODEL ?? "openai/gpt-4o-mini";
  if (!apiKey) {
    console.error(
      "Manca OPENROUTER_API_KEY (o MERMAID_CREATOR_OPENROUTER_KEY). Usa --check per la sola validazione.",
    );
    process.exit(1);
    return;
  }
  if (!model) {
    console.error("Manca EVAL_MODEL (es. un modello free o economico OpenRouter).");
    process.exit(1);
    return;
  }

  const results = new Array(selected.length);
  let failures = 0;
  const concurrency = Math.max(
    1,
    Math.min(Number(process.env.EVAL_CONCURRENCY ?? 3) || 1, selected.length),
  );
  let cursor = 0;
  const runOne = async () => {
    while (true) {
      const index = cursor++;
      if (index >= selected.length) return;
      const item = selected[index];
      const started = Date.now();
      try {
        const content = await callModel(buildEvalPrompt(prompt, item.text, examples), item.text, model, apiKey);
        const evaluation = evaluateCase(item, content);
        if (!evaluation.ok) failures += 1;
        console.log(
          `${evaluation.ok ? "PASS" : "FAIL"} ${item.id} · top ${evaluation.topType ?? "?"} · gen ${evaluation.types.join(", ") || "?"} · ${Date.now() - started}ms`,
        );
        if (!evaluation.ok) {
          for (const reason of evaluation.reasons) console.log(`  - ${reason}`);
        }
        results[index] = {
          id: item.id,
          ok: evaluation.ok,
          reasons: evaluation.reasons,
          types: evaluation.types,
          topType: evaluation.topType,
          recommended: evaluation.recommended,
          topOk: evaluation.topOk,
          generatedOk: evaluation.generatedOk,
          coherent: evaluation.coherent,
          rawSyntaxOk: evaluation.rawSyntaxOk,
          syntaxOk: evaluation.syntaxOk,
          blocks: evaluation.blocks,
          latencyMs: Date.now() - started,
          content: evaluation.content.slice(0, 12_000),
        };
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${item.id} · errore: ${String(error)}`);
        results[index] = {
          id: item.id,
          ok: false,
          reasons: [String(error)],
          types: [],
          topType: null,
          recommended: [],
          topOk: false,
          generatedOk: false,
          coherent: false,
          rawSyntaxOk: false,
          syntaxOk: false,
          blocks: 0,
          latencyMs: Date.now() - started,
          content: "",
        };
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, runOne));

  const total = selected.length;
  const percent = (value) => `${Math.round((value / total) * 100)}%`;
  const count = (key) => results.filter((item) => item?.[key]).length;
  console.log("\nMetriche:");
  console.log(`  top-1: ${count("topOk")}/${total} (${percent(count("topOk"))})`);
  console.log(`  tipo ammesso: ${count("generatedOk")}/${total} (${percent(count("generatedOk"))})`);
  console.log(`  coerenza top/generato: ${count("coherent")}/${total} (${percent(count("coherent"))})`);
  console.log(`  sintassi raw: ${count("rawSyntaxOk")}/${total} (${percent(count("rawSyntaxOk"))})`);
  console.log(`  sintassi finale: ${count("syntaxOk")}/${total} (${percent(count("syntaxOk"))})`);
  console.log(`  PASS complessivi: ${total - failures}/${total} (${percent(total - failures)})`);

  mkdirSync(resultsDir, { recursive: true });
  const reportName = dataset === "holdout" ? "holdout-latest.json" : "latest.json";
  writeFileSync(
    join(resultsDir, reportName),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model,
        dataset,
        promptProfile: profile,
        promptChars: prompt.length,
        cases: results,
      },
      null,
      2,
    ),
  );
  console.log(
    `\nRisultato: ${selected.length - failures}/${selected.length} PASS · report in eval/results/${reportName}`,
  );
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
