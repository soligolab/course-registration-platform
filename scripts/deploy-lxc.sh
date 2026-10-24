#!/bin/bash
# Aggiorna un'installazione in un container LXC su Proxmox (systemd, niente Docker) con il codice
# di questa cartella. Host, container e dataset si leggono da .deploy.env (non versionato):
# vedi .deploy.env.example e docs/DEPLOY-LXC.md.
# Uso, da questa cartella:  ./scripts/deploy-lxc.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .deploy.env ] || { echo "Manca .deploy.env (copia .deploy.env.example e compilalo)"; exit 1; }
# shellcheck disable=SC1091
. ./.deploy.env
: "${DEPLOY_HOST:?}" "${DEPLOY_CT:?}" "${DEPLOY_DATASET:?}"

# il repository va tenuto allineato: si avvisa se si sta per pubblicare codice non committato
if git rev-parse --git-dir >/dev/null 2>&1 && [ -n "$(git status --porcelain)" ]; then
  echo "!! Ci sono modifiche non committate: il deploy usa i file così come sono."
fi

echo "== copia del codice"
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .env --exclude .deploy.env \
  --exclude .git --exclude tsconfig.tsbuildinfo --exclude .claude ./ "$DEPLOY_HOST:/root/corsi-src/"
ssh "$DEPLOY_HOST" "R=\$(zfs get -H -o value mountpoint $DEPLOY_DATASET); \
  U=\$(pct exec $DEPLOY_CT -- id -u corsi); G=\$(pct exec $DEPLOY_CT -- id -g corsi); \
  rsync -a --delete --chown=\$((100000+U)):\$((100000+G)) /root/corsi-src/ \$R/opt/corsi/app/"

echo "== build (dipendenze, typecheck, test, migrazioni, next build)"
ssh "$DEPLOY_HOST" "pct exec $DEPLOY_CT -- su -s /bin/bash corsi -c /opt/corsi/build.sh"

echo "== riavvio"
ssh "$DEPLOY_HOST" "pct exec $DEPLOY_CT -- systemctl restart corsi && sleep 5 && pct exec $DEPLOY_CT -- systemctl is-active corsi"
[ -n "${DEPLOY_CHECK_URL:-}" ] && curl -s -o /dev/null -w "$DEPLOY_CHECK_URL -> HTTP %{http_code}\n" "$DEPLOY_CHECK_URL"

# allineamento con GitHub: si pubblica ciò che è committato
if git rev-parse --git-dir >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  echo "== push su origin"
  git push --quiet origin HEAD && echo "ok"
fi
