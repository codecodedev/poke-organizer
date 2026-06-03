#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

set -a
. apps/pricing-service/.env.local
set +a

CDP_URL="${LIGA_SYNC_CDP_URL:-http://127.0.0.1:9222}"
PROFILE_DIR="${LIGA_SYNC_MANUAL_PROFILE_DIR:-$ROOT_DIR/apps/pricing-service/.liga-manual-profile}"
START_URL="${LIGA_SYNC_START_URL:-https://www.ligapokemon.com.br/?view=cards/edicoes}"

if [ "${LIGA_SYNC_RESTART_BROWSER:-false}" = "true" ]; then
  pkill -f "user-data-dir=$PROFILE_DIR" 2>/dev/null || true
  sleep 1
fi

devtools_ready() {
  CDP_URL_CHECK="$CDP_URL" node -e "const url = new URL('/json/version', process.env.CDP_URL_CHECK); fetch(url).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1));" >/dev/null 2>&1
}

if ! devtools_ready; then
  open -na "Google Chrome" --args \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
    --user-data-dir="$PROFILE_DIR"
fi

for _ in {1..30}; do
  if devtools_ready; then
    break
  fi
  sleep 1
done

if ! devtools_ready; then
  echo "Chrome DevTools nao respondeu em $CDP_URL. Feche o Chrome aberto pelo pricing-service e tente novamente."
  exit 1
fi

CDP_URL_CHECK="$CDP_URL" START_URL="$START_URL" node <<'NODE' >/dev/null 2>&1 || true
(async () => {
  const base = new URL(process.env.CDP_URL_CHECK);
  const target = `${base.origin}/json/new?${encodeURIComponent(process.env.START_URL)}`;
  let response = await fetch(target, { method: "PUT" }).catch(() => null);
  if (!response?.ok) {
    response = await fetch(target).catch(() => null);
  }
})();
NODE

osascript -e 'tell application "Google Chrome" to activate' >/dev/null 2>&1 || true

export LIGA_SYNC_CDP_URL="$CDP_URL"

pnpm --filter pricing-service dev
