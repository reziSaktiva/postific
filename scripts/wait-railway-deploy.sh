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

# Cocokkan path dengan satu pola watchPatterns (awalan "/", "**" dan "*" = glob bash).
matches_watch_pattern() {
  local path="/$1" pattern
  while IFS= read -r pattern; do
    pattern="${pattern//\*\*/*}"
    # shellcheck disable=SC2053
    [[ "$path" == $pattern ]] && return 0
  done < <(jq -r '.build.watchPatterns[]?' railway.json)
  return 1
}

# Cetak id deployment terdekat di leluhur $SHA, atau gagal bila ada perubahan
# yang seharusnya memicu deploy di antara keduanya.
find_previous_deployment() {
  local commit id
  for commit in $(git rev-list --first-parent --skip=1 --max-count=50 "$SHA"); do
    id=$(gh api -X GET "repos/$REPO/deployments" \
      -f sha="$commit" -f environment="$ENVIRONMENT" --jq '.[0].id // empty')
    if [ -n "$id" ]; then
      while IFS= read -r changed; do
        if matches_watch_pattern "$changed"; then
          echo "::error::$changed berubah antara $commit dan $SHA dan cocok dengan watchPatterns, tetapi Railway tidak men-deploy $SHA" >&2
          return 1
        fi
      done < <(git diff --name-only "$commit" "$SHA")
      echo "Railway melewati $SHA (hanya perubahan non-deploy); memakai deployment $id dari $commit" >&2
      echo "$id"
      return 0
    fi
  done
  echo "::error::Tidak ada deployment '$ENVIRONMENT' di 50 commit sebelum $SHA" >&2
  return 1
}

start=$SECONDS
deployment_id=""
while [ -z "$deployment_id" ]; do
  deployment_id=$(gh api -X GET "repos/$REPO/deployments" \
    -f sha="$SHA" -f environment="$ENVIRONMENT" --jq '.[0].id // empty')
  [ -n "$deployment_id" ] && break
  if [ $((SECONDS - start)) -ge "$APPEAR_TIMEOUT" ]; then
    # T-280.6: Railway melewati deploy bila commit hanya mengubah path di luar
    # build.watchPatterns (railway.json). Telusuri ke commit induk terdekat yang
    # punya deployment; gagal bila commit ini mengubah path yang seharusnya di-deploy.
    echo "Tidak ada deployment untuk $SHA dalam ${APPEAR_TIMEOUT}s; mencari deploy sebelumnya..."
    deployment_id=$(find_previous_deployment) || exit 1
    break
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
