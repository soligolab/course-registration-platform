# Corsi – richieste di prenotazione

Piattaforma web per raccogliere richieste di prenotazione dei corsi: il cliente sceglie un pacchetto, seleziona gli slot da 30 minuti sul calendario, verifica l'email con un codice e invia la richiesta. Conferma e pagamento restano manuali.

## Sviluppo locale (Windows)

1. Installa Node 24: `winget install OpenJS.NodeJS.LTS`
2. Nella cartella del progetto:
   ```sh
   copy .env.example .env      # poi imposta AUTH_SECRET con una stringa casuale lunga
   npm install
   npm run db:migrate          # crea data/app.db
   npm run db:seed             # opzionale: 3 pacchetti di esempio
   npm run dev
   ```
3. Apri http://localhost:3000, clicca **Accedi** e usa la tua email: **il primo utente che accede diventa amministratore**. Senza `SMTP_HOST` il codice di verifica viene stampato nel terminale.

Con Docker Desktop puoi anche usare `docker compose -f docker-compose.dev.yml up --build` e leggere le email su http://localhost:8025 (Mailpit).

## Primo utilizzo come amministratore
1. **Impostazioni**: nome attività, dati del titolare del trattamento (compaiono nell'informativa privacy), email per le notifiche, preavviso minimo, orari della griglia giornaliera.
2. **Pacchetti**: crea/modifica i pacchetti (ore totali, durata min/max di ogni lezione, giorni di validità, max lezioni a settimana).
3. **Disponibilità**: apri un giorno, seleziona gli slot liberi, **Salva giorno**; usa "Applica a tutti i …" per ripetere lo stesso orario sugli stessi giorni della settimana.
4. **Richieste**: conferma, rifiuta o annulla (rifiuto/annullamento liberano gli slot), con email facoltativa al cliente.
5. **Clienti**: esportazione dati (JSON) e cancellazione, per le richieste GDPR.

⚠️ L'informativa in `content/privacy.it.md` / `privacy.en.md` è un modello: falla verificare prima di andare online.

## Deploy su VPS (Docker)
1. Copia la cartella sul server (senza `node_modules`, `.next`, `data`).
2. Crea `.env` partendo da `.env.example`:
   - `APP_URL=https://tuodominio.it`
   - `AUTH_SECRET=` stringa casuale lunga (es. `openssl rand -hex 32`)
   - `ADMIN_EMAIL=` la tua email (consigliato: impedisce che un altro diventi admin prima di te)
   - credenziali SMTP della tua casella
3. In `Caddyfile` sostituisci `corsi.example.com` con il tuo dominio (DNS già puntato al server).
4. `docker compose up -d --build`
5. Opzionale: `docker compose exec app npm run db:seed`

Il database è il file `data/app.db`: per il backup basta copiarlo (meglio a servizio fermo, oppure `sqlite3 data/app.db ".backup backup.db"`).

Aggiornamento: `git pull` (o copia dei file) e `docker compose up -d --build`; le migrazioni vengono applicate all'avvio.

Senza Docker, in un container LXC con systemd: vedi [docs/DEPLOY-LXC.md](docs/DEPLOY-LXC.md).

## Test
- `npm test` – unit test delle regole di prenotazione
- `npm run typecheck`, `npm run build`
