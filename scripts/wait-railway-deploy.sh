#!/usr/bin/env bash
# Tunggu deployment Railway untuk $SHA di GitHub (environment "Postific /
# staging") sampai berstatus success (T-175.1, CI-D07). Gagal bila deployment
# gagal, tidak muncul dalam 5 menit, atau belum selesai dalam 20 menit.
# Butuh: gh (GH_TOKEN), REPO (owner/repo), SHA.
set -euo pipefail

: "${REPO:?}" "${SHA:?}"
ENVIRONMENT="${DEPLOY_ENVIRONMENT:-Postific / staging}"
APPEAR_TIMEOUT="${APPEAR_TIMEOUT:-300}"
DONE_TIMEOUT="${DONE_TIMEOUT:-1200}"
POLL="${POLL_INTERVAL:-15}"

start=$SECONDS
deployment_id=""
while [ -z "$deployment_id" ]; do
  deployment_id=$(gh api -X GET "repos/$REPO/deployments" \
    -f sha="$SHA" -f environment="$ENVIRONMENT" --jq '.[0].id // empty')
  [ -n "$deployment_id" ] && break
  if [ $((SECONDS - start)) -ge "$APPEAR_TIMEOUT" ]; then
    echo "::error::Tidak ada deployment '$ENVIRONMENT' untuk $SHA dalam ${APPEAR_TIMEOUT}s (Railway tidak men-deploy commit ini?)"
    exit 1
  fi
  echo "Menunggu Railway membuat deployment untuk $SHA..."
  sleep "$POLL"
done
echo "Deployment $deployment_id ditemukan untuk $SHA"

start=$SECONDS
while true; do
  state=$(gh api "repos/$REPO/deployments/$deployment_id/statuses" --jq '.[0].state // "pending"')
  echo "Status deployment: $state"
  case "$state" in
    success) exit 0 ;;
    failure | error | inactive)
      echo "::error::Deploy Railway berstatus '$state'; E2E tidak dijalankan"
      exit 1
      ;;
  esac
  if [ $((SECONDS - start)) -ge "$DONE_TIMEOUT" ]; then
    echo "::error::Deploy belum selesai dalam ${DONE_TIMEOUT}s"
    exit 1
  fi
  sleep "$POLL"
done
