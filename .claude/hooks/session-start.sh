#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "Installing server dependencies..."
cd "$CLAUDE_PROJECT_DIR/server" && npm install

echo "Installing client dependencies..."
cd "$CLAUDE_PROJECT_DIR/client" && npm install

echo "Dependencies installed successfully."
