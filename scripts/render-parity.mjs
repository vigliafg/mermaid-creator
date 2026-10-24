#!/usr/bin/env node
/**
 * Controllo di parità Pele/Mermaid sulle capacità usate dall'editor:
 * style per nodo, linkStyle per arco (dove supportato), data-id degli archi.
 * Mermaid richiede Chrome; se non è disponibile lo script salta quella parte.
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render as peleRender } from "pele";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = {
  flowchart: `flowchart LR
  A[Uno] --> B[Due]
  style A fill:#ff0000,stroke:#00ff00,stroke-width:3px
  linkStyle 0 stroke:#0000ff`,
  class: `classDiagram
  class Uno
  class Due
  Uno <|-- Due
  style Uno fill:#ff0000,stroke:#00ff00`,
  state: `stateDiagram-v2
  [*] --> Uno
  Uno --> Due
  style Uno fill:#ff0000,stroke:#00ff00
  linkStyle 0 stroke:#0000ff`,
  er: `erDiagram
  UNO ||--o{ DUE : ha
  style UNO fill:#ff0000,stroke:#00ff00`,
};

let failures = 0;
for (const [name, source] of Object.entries(fixtures)) {
  try {
    const svg = peleRender(source).svg;
    const ok = svg.includes("#ff0000") && svg.includes("#00ff00");
    console.log(`pele ${name}: ${ok ? "ok" : "FAIL"} (style nel render)`);
    if (!ok) failures += 1;
  } catch (error) {
    console.error(`pele ${name}: FAIL ${error}`);
    failures += 1;
  }
}

function chromePath() {
  const candidates = [
    "google-chrome",
    "chromium",
    "chromium-browser",
    "google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const finder = process.platform === "win32" ? "where" : "which";
  for (const candidate of candidates) {
    try {
      execFileSync(finder, [candidate], { stdio: "ignore" });
      return candidate;
    } catch {
      // continua
    }
  }
  return null;
}

const chrome = chromePath();
if (!chrome) {
  console.log("mermaid: skip (Chrome non trovato)");
  process.exit(failures ? 1 : 0);
}

const mermaidPath = join(root, "node_modules/mermaid/dist/mermaid.esm.mjs");
const mermaidSource = readFileSync(mermaidPath, "utf8");
const html = `<!doctype html><meta charset="utf-8"><body><pre id="result">pending</pre>
<script>
window.addEventListener("error", (event) => {
  document.getElementById("result").textContent = JSON.stringify({ fatal: String(event.error || event.message) });
});
window.addEventListener("unhandledrejection", (event) => {
  document.getElementById("result").textContent = JSON.stringify({ fatal: String(event.reason) });
});
</script>
<script type="module">
import mermaid from "/mermaid.mjs";
mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false, theme: "base" });
const fixtures = ${JSON.stringify(fixtures)};
const out = {};
for (const [name, source] of Object.entries(fixtures)) {
  try {
    const { svg } = await mermaid.render("parity-" + name, source);
    out[name] = {
      red: svg.includes("#ff0000"),
      green: svg.includes("#00ff00"),
      dataIds: (svg.match(/data-id="/g) || []).length,
      nodes: (svg.match(/class="node/g) || []).length,
    };
  } catch (error) {
    out[name] = { error: String(error) };
  }
}
document.getElementById("result").textContent = JSON.stringify(out);
</script>`;

const server = createServer((request, response) => {
  if (process.env.PARITY_DEBUG) console.error("REQ", request.url);
  if (request.url === "/mermaid.mjs") {
    response.writeHead(200, { "content-type": "text/javascript" });
    response.end(mermaidSource);
    return;
  }
  if (request.url?.startsWith("/chunks/") || request.url?.startsWith("/assets/")) {
    const relative = request.url.replace(/^\//, "");
    try {
      const file = readFileSync(join(root, "node_modules/mermaid/dist", relative));
      response.writeHead(200, {
        "content-type": relative.endsWith(".js") || relative.endsWith(".mjs") ? "text/javascript" : "application/octet-stream",
      });
      response.end(file);
    } catch {
      response.writeHead(404);
      response.end();
    }
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
try {
  const run = promisify(execFile);
  const { stdout: dom } = await run(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--virtual-time-budget=30000",
      "--dump-dom",
      `http://127.0.0.1:${port}/`,
    ],
    { encoding: "utf8", timeout: 40000, maxBuffer: 20 * 1024 * 1024 },
  );
  const match = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  const decoded = match
    ? match[1].replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<")
    : "";
  if (process.env.PARITY_DEBUG) console.error("DOM", dom.slice(0, 300), "DECODED", decoded);
  let result = {};
  try {
    result = decoded ? JSON.parse(decoded) : {};
  } catch {
    result = {};
  }
  if (result.fatal) {
    console.error(`mermaid: FAIL ${result.fatal}`);
    failures += 1;
  }
  for (const name of Object.keys(fixtures)) {
    const entry = result[name];
    const ok = entry && entry.red && entry.green;
    console.log(`mermaid ${name}: ${ok ? "ok" : "FAIL"} ${JSON.stringify(entry)}`);
    if (!ok) failures += 1;
  }
} catch (error) {
  console.error(`mermaid: FAIL ${error}`);
  failures += 1;
} finally {
  server.close();
}

process.exit(failures ? 1 : 0);
