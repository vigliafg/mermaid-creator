#!/usr/bin/env bash
set -euo pipefail

KINGSTON_ROOT=/mnt/KINGSTON/mermaid-creator
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/kingston-guard.sh"

export RUSTUP_HOME="$KINGSTON_ROOT/toolchain/rustup"
export CARGO_HOME="$KINGSTON_ROOT/toolchain/cargo"
export CARGO_TARGET_DIR="$KINGSTON_ROOT/build/target"
export TMPDIR="$KINGSTON_ROOT/build/tmp"
export npm_config_cache="$KINGSTON_ROOT/build/npm-cache"
export PLAYWRIGHT_BROWSERS_PATH="$KINGSTON_ROOT/build/playwright"
export MERMAID_CREATOR_DATA_DIR="$KINGSTON_ROOT/data"
export PATH="$CARGO_HOME/bin:$PATH"

# WebKitGTK 2.52 + Mesa 26 può andare in SIGSEGV in dri_gbm durante la
# chiusura della finestra (teardown dei buffer GPU). Disabilitiamo il
# renderer DMA-BUF: WebKit usa il percorso software e il crash non viene
# innescato. Se in futuro servisse la GPU, rimuovere questa riga dopo aver
# aggiornato webkit2gtk/libgbm.
export WEBKIT_DISABLE_DMABUF_RENDERER=1
