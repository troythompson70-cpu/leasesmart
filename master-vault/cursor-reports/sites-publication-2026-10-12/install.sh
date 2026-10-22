#!/usr/bin/env bash
# Install the TGT Website PayPal release into an existing Sites checkout.
# Refuses every other project, including this LeaseSmart git repository.
set -euo pipefail

EXPECTED='appgprj_6a8fb5d9596c8191a045ee1e5744fffd'
ROOT="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
  echo "STOP: pass the existing TGT Website checkout directory." >&2
  exit 2
fi

HOST="$ROOT/.openai/hosting.json"
if [[ ! -f "$HOST" ]]; then
  echo "STOP: $ROOT has no .openai/hosting.json." >&2
  echo "This release installs only into TGT Website $EXPECTED." >&2
  echo "It must not be copied into the LeaseSmart repository." >&2
  exit 3
fi

python3 - "$HOST" "$EXPECTED" << 'PY'
import json, sys
path, expected = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path))
except json.JSONDecodeError:
    print("STOP: hosting.json is not valid JSON.", file=sys.stderr)
    sys.exit(4)
got = data.get("project_id")
if got != expected:
    print(f"STOP: project_id is {got!r}. Required {expected}.", file=sys.stderr)
    sys.exit(4)
print(f"project_id {got}")
PY

if [[ ! -f "$ROOT/server/paypal.js" || ! -f "$ROOT/scripts/build-sites-worker.mjs" ]]; then
  echo "STOP: checkout is missing server/paypal.js or scripts/build-sites-worker.mjs." >&2
  exit 5
fi

cp "$SCRIPT_DIR/paypal.js" "$ROOT/server/paypal.js"
if [[ -f "$ROOT/src/components/PayPalCheckout.jsx" ]]; then
  cp "$SCRIPT_DIR/PayPalCheckout.jsx" "$ROOT/src/components/PayPalCheckout.jsx"
fi

python3 - "$ROOT/scripts/build-sites-worker.mjs" << 'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text()
route = "    if (url.pathname === '/api/paypal/products') return handlePayPalProducts(request, env)\n"
if route in text:
    print("products route already present")
else:
    needle = "    if (url.pathname === '/api/paypal/config') return handlePayPalConfig(request, env)\n"
    if needle not in text:
        print("STOP: worker has no PayPal config route.", file=sys.stderr)
        sys.exit(6)
    path.write_text(text.replace(needle, needle + route, 1))
    print("products route added")
PY

echo "INSTALLED into $ROOT"
echo "Project: TGT Website $EXPECTED"
echo "Do not publish the e-book. Save and deploy only this existing Site from ChatGPT."
