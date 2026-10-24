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
