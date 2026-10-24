# Corsi – richieste di prenotazione

Piattaforma web per raccogliere richieste di prenotazione dei corsi: il cliente sceglie un pacchetto e le date delle lezioni sul calendario; solo al momento dell'invio verifica l'email con un codice e inserisce i suoi dati (anagrafica e fatturazione), che restano salvati per le richieste successive. Conferma e pagamento restano manuali.

Requisiti e decisioni: [docs/SPEC.md](docs/SPEC.md). Stato del lavoro: [STATUS.md](STATUS.md).

## Sviluppo locale

Serve Node 24 (`.nvmrc`).

```sh
cp .env.example .env        # poi imposta AUTH_SECRET con una stringa casuale lunga
npm install
npm run db:migrate          # crea data/app.db
npm run db:seed             # opzionale: 3 pacchetti base
npm run dev
```

Apri http://localhost:3000, clicca **Accedi** e usa la tua email: diventa amministratore l'email in `ADMIN_EMAIL` (se vuota, il primo utente che accede). Senza `SMTP_HOST` le email, codice di verifica compreso, sono stampate nel terminale.

Con Docker puoi anche usare `docker compose -f docker-compose.dev.yml up --build` e leggere le email su http://localhost:8025 (Mailpit).

## Primo utilizzo come amministratore
1. **Impostazioni**: nome attività, dati del titolare del trattamento (compaiono nell'informativa privacy), email per le notifiche, preavviso minimo, orari della griglia giornaliera, altri amministratori.
2. **Pacchetti**: tariffario (prezzo per durata di lezione) e pacchetti (numero di lezioni × durata fissa, giorni di validità, max lezioni a settimana).
3. **Disponibilità**: apri un giorno, seleziona le caselle libere (da 15 minuti), **Salva giorno**; "Applica a tutti i …" ripete lo stesso orario sugli stessi giorni della settimana.
4. **Aspetto**: colori, caratteri, immagini e testi del portale, con stili pronti e anteprima.
5. **Richieste**: conferma, rifiuta o annulla (rifiuto/annullamento liberano gli slot), con email facoltativa al cliente.
6. **Clienti**: esportazione dati (JSON) e cancellazione, per le richieste GDPR.

⚠️ L'informativa in `content/privacy.it.md` / `privacy.en.md` è un modello: falla verificare prima di andare online.

## Deploy

**In un container LXC con systemd, senza Docker** (installazione attuale): vedi [docs/DEPLOY-LXC.md](docs/DEPLOY-LXC.md); gli aggiornamenti si fanno con `./scripts/deploy-lxc.sh`.

**Su VPS con Docker:**
1. Copia la cartella sul server (senza `node_modules`, `.next`, `data`).
2. Crea `.env` partendo da `.env.example`:
   - `APP_URL=https://tuodominio.it`
   - `AUTH_SECRET=` stringa casuale lunga (es. `openssl rand -hex 32`)
   - `ADMIN_EMAIL=` la tua email (consigliato: impedisce che un altro diventi admin prima di te)
   - credenziali SMTP della tua casella
3. In `Caddyfile` sostituisci `corsi.example.com` con il tuo dominio (DNS già puntato al server).
4. `docker compose up -d --build`
5. Opzionale: `docker compose exec app npm run db:seed`

Aggiornamento: `git pull` e `docker compose up -d --build`; le migrazioni vengono applicate all'avvio.

Il database è il file `data/app.db`: per il backup basta copiarlo (meglio a servizio fermo, oppure `sqlite3 data/app.db ".backup backup.db"`).

## Test
- `npm test` – unit test di regole di prenotazione, tariffario, tema e fatturazione
- `npm run typecheck`, `npm run build`
