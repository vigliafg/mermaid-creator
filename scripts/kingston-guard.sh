#!/usr/bin/env bash
set -euo pipefail

MNT=/mnt/KINGSTON
UUID=fb76c7d5-eb88-4cad-a4b5-3b62244993ac
ROOT="$MNT/mermaid-creator"

findmnt -T "$MNT" >/dev/null 2>&1 || { echo "ERRORE: $MNT non è montato" >&2; exit 1; }
[ "$(findmnt -n -o UUID "$MNT")" = "$UUID" ] || { echo "ERRORE: UUID inatteso su $MNT" >&2; exit 1; }
[ -w "$MNT" ] || { echo "ERRORE: $MNT non è scrivibile" >&2; exit 1; }

for d in repo toolchain/rustup toolchain/cargo build/target build/tmp build/npm-cache build/playwright data; do
  [ -d "$ROOT/$d" ] || { echo "ERRORE: manca $ROOT/$d" >&2; exit 1; }
done

[ -f "$ROOT/data/.mermaid-creator-volume" ] || { echo "ERRORE: manca il sentinella della data dir" >&2; exit 1; }
