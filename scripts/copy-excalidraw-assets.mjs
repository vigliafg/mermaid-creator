#!/usr/bin/env node
// Copia i font di Excalidraw in public/ così la lavagna funziona offline.
// Va eseguito prima di `vite` e `vite build` (vedi package.json).
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(root, "node_modules", "@excalidraw", "excalidraw");
const source = join(packageDir, "dist", "prod", "fonts");
const targetRoot = join(root, "public", "excalidraw-assets");
const target = join(targetRoot, "fonts");
const marker = join(targetRoot, "font-package-version");

if (!existsSync(source)) {
  console.error(
    `Font Excalidraw non trovati in ${source}. Esegui prima npm install.`,
  );
  process.exit(1);
}

const version = JSON.parse(
  readFileSync(join(packageDir, "package.json"), "utf8"),
).version;
const current = existsSync(marker) ? readFileSync(marker, "utf8").trim() : "";

if (current === version && existsSync(target)) {
  process.exit(0);
}

mkdirSync(targetRoot, { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
writeFileSync(marker, `${version}\n`);
console.log(`Font Excalidraw ${version} copiati in ${target}`);
