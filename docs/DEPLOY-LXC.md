# Deploy in un container LXC (Proxmox), senza Docker

Alternativa al deploy Docker del README: Node + systemd in un container, con l'HTTPS gestito
da un reverse proxy esterno (es. Cloudflare Tunnel + Nginx Proxy Manager). I dettagli di una
specifica installazione (host, IP, container) **non** vanno in questo repository, che è pubblico:
stanno in `.deploy.env`, non versionato.

## Struttura nel container

| | |
|---|---|
| Runtime | Node 24 + servizio systemd `corsi.service`, utente `corsi`, porta 80 con `CAP_NET_BIND_SERVICE` |
| Codice | `/opt/corsi/app` (copia della cartella, senza `node_modules`, `.next`, `data`, `.env`) |
| Configurazione | `/opt/corsi/.env` (600): fuori dal codice, non viene sovrascritta dagli aggiornamenti |
| Dati | `/opt/corsi/data/app.db` (SQLite) e `/opt/corsi/data/uploads` (`UPLOAD_DIR`) |
| Build | `/opt/corsi/build.sh`: `npm ci`, typecheck, test, `prisma migrate deploy`, `next build` |

Il servizio applica le migrazioni anche a ogni avvio (`ExecStartPre`). Nel `.env`, oltre a
quanto descritto nel README: `UPLOAD_DIR=/opt/corsi/data/uploads`. La build scarica i caratteri
da Google (next/font), quindi il container deve poter uscire su internet; i browser dei clienti
invece non contattano Google.

Esempio di unità systemd:

```ini
[Service]
User=corsi
Group=corsi
WorkingDirectory=/opt/corsi/app
EnvironmentFile=/opt/corsi/.env
Environment=NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=80 HOSTNAME=0.0.0.0
ExecStartPre=/opt/corsi/app/node_modules/.bin/prisma migrate deploy
ExecStart=/opt/corsi/app/node_modules/.bin/next start -p 80 -H 0.0.0.0
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/corsi/data
Restart=on-failure
MemoryMax=1G
```

## Aggiornare

```bash
cp .deploy.env.example .deploy.env   # una volta: host, id del container, dataset ZFS
./scripts/deploy-lxc.sh
```

Lo script copia il codice nel rootfs del container, lancia `build.sh` come utente `corsi`,
riavvia il servizio e, se il repository ha un `origin`, fa `git push`. Avvisa se ci sono
modifiche non committate.

## Dietro un proxy

L'app riceve http dal proxy. Il cookie di sessione è `secure` solo per le richieste all'host di
`APP_URL` in https: così funziona sia l'indirizzo pubblico sia un eventuale nome solo-LAN in http.
