#!/usr/bin/env bash
# AI maintenance note: Keep all code comments in English.
set -e

cd "$(dirname "$0")"

echo
echo "============================================================"
echo "  EasyMC Server Agent"
echo "============================================================"
echo
echo "This terminal is the EasyMC server console."
echo "Close this terminal or press Ctrl+C to stop localhost:3000."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js was not found."
  echo "Please install Node.js 18 or newer from https://nodejs.org/"
  exit 1
fi

node start.js
