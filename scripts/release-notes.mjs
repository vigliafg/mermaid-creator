#!/usr/bin/env node
// Estrae da CHANGELOG.md la sezione della versione del tag corrente.
// Uso: node scripts/release-notes.mjs v0.20.0 CHANGELOG.md
import { readFileSync } from "node:fs";

const tag = (process.argv[2] ?? "").trim();
const file = process.argv[3] ?? "CHANGELOG.md";
const version = tag.replace(/^v/, "");
if (!version) {
  console.error("Uso: release-notes.mjs <tag> [CHANGELOG.md]");
  process.exit(1);
}

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.trim().startsWith(`## ${version}`));
if (start < 0) {
  console.error(`Sezione ## ${version} non trovata in ${file}`);
  process.exit(1);
}

const body = [];
for (let index = start; index < lines.length; index += 1) {
  const line = lines[index];
  if (index > start && line.startsWith("## ")) break;
  body.push(line);
}

console.log(
  `${body.join("\n").trim()}\n\n---\n\nAsset generati automaticamente dalla pipeline di release.`,
);
