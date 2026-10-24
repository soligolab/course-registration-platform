# Stato del progetto

Aggiornato al **2026-10-24**. Da leggere a inizio sessione insieme a [CLAUDE.md](CLAUDE.md) e
[docs/SPEC.md](docs/SPEC.md). Il repository è **pubblico**: qui non vanno IP, nomi host,
credenziali né dati di clienti. I dettagli dell'installazione stanno nelle note private del
server (`corsi-deploy.md` nel progetto di manutenzione), in `.deploy.env` e in `/opt/corsi/.env`.

## In produzione

- **https://corsi.selenerampazzo.it** – online dal 2026-10-24, dietro Cloudflare (tunnel) e un
  reverse proxy. Container LXC con systemd, deploy con `./scripts/deploy-lxc.sh`.
- L'indirizzo temporaneo precedente (`corsi.soligo.net`) è disattivato.
- SMTP Infomaniak configurato e **verificato**: il codice di accesso arriva (prova del
  2026-10-24 con un account cliente reale). Mittente `course_registration@…`, accettato.
- Admin: il primo è `ADMIN_EMAIL`; altri si aggiungono da *Impostazioni → Amministratori*.
- Dati presenti: 3 pacchetti base, tariffario (45 min 18 €, 1 h 22 €, 1 h 30 35 €),
  disponibilità dal 19/10 al 29/12/2026, tema personalizzato dall'utente, 1 cliente di prova,
  nessuna richiesta.

## Fatto

| Data | Cosa |
|---|---|
| 10-14/15 | Prima versione: pacchetti, calendario, richieste, OTP, privacy, it/en |
| 10-23 | Più amministratori; notifiche a tutti gli admin |
| 10-23 | *Admin → Aspetto*: tema completo (colori, caratteri self-hosted, forme, banner, schede, footer), 4 stili pronti, anteprima dal vivo, avvisi di contrasto; immagini d'esempio in `public/presets/` e caricamenti (`/media/…`) |
| 10-23 | Griglia a **15 minuti** (migrazione dei dati); pacchetti = numero di lezioni × durata fissa; **tariffario** con prezzo congelato nella richiesta; 3 pacchetti base |
| 10-24 | **Dati di fatturazione** obbligatori per inviare una richiesta: privato (CF, intestatario anche diverso dall'allievo) o P.IVA (SDI/PEC); controllo formale CF/P.IVA; copia nella richiesta; informativa aggiornata (`PRIVACY_VERSION` 2026-10-24) |
| 10-24 | Corretti due difetti preesistenti: link dell'informativa rotto dall'apostrofo ICU; form che si svuotavano dopo un errore (React 19) |
| 10-24 | Repository GitHub; deploy reso generico (`.deploy.env`, `docs/DEPLOY-LXC.md`) |
| 10-24 | Pubblicazione su `corsi.selenerampazzo.it`; `APP_URL` aggiornato; login verificato |
| 10-24 | Dati del cliente chiesti **solo all'invio** della richiesta (prima si scelgono pacchetto e date, anche senza accesso); popup dopo "Salva e continua"; in caso di errore il modulo porta al primo campo da correggere |
| 10-24 | Corretto: al ritorno da login/profilo l'invio automatico della richiesta restava appeso su "Invio in corso…" (partiva mentre si caricava il calendario) |
| 10-24 | README riscritto (sviluppo su Linux, niente Windows; contenuti aggiornati) |
| 10-24 | **Pagina del corso** (`/corso/<id>`, pulsante *Esplora* nella home) con descrizione completa scritta in un editor visuale: titoli, stili, immagini della galleria, due colonne; HTML ripulito sul server. Migrazione `package_details` |
| 10-24 | **Lezioni di gruppo** (max partecipanti per pacchetto, gruppi di pacchetti che condividono le lezioni, posti liberi nel calendario) e **fasce orarie settimanali** per corso; lezioni consecutive permesse. Migrazione `group_lessons` (converte le prenotazioni esistenti) |
| 10-24 | **Prezzo del pacchetto** configurabile: prezzo pieno (lezioni × tariffa) barrato e percentuale di sconto; la richiesta registra il prezzo del pacchetto. **Sezione Tariffe** della home modificabile (titolo, sottotitolo, descrizione ricca, nome e testo di ogni scheda). Migrazione `package_price` |
| 10-24 | **Lezioni singole prenotabili** dalla sezione Tariffe ("Richiedi una lezione" → calendario): un pacchetto nascosto per durata, sincronizzato col tariffario. Migrazione `single_lessons`. Dopo il deploy basta aprire *Admin → Pacchetti* (o salvare il tariffario) per crearli |

Test: 60 (regole di prenotazione con lezioni di gruppo e fasce orarie, tariffario, tema, fatturazione, pulizia dell'HTML delle descrizioni). Ogni deploy li esegue.

## Da fare

**Bloccanti per l'uso con i clienti**

1. **Titolare del trattamento**: in *Impostazioni* mancano nome dell'attività, titolare
   (nome/ragione sociale, indirizzo, P.IVA) e contatto privacy. L'informativa pubblicata ha
   questi campi **vuoti**.
2. **Cancellazione dopo 24 mesi**: l'informativa promette che le richieste non seguite da un
   acquisto sono cancellate entro 24 mesi, ma **non è implementato**. Serve un job periodico
   (o un comando admin) che elimini richieste rifiutate/annullate/scadute più vecchie di 24 mesi
   e i clienti senza richieste, oppure va cambiato il testo.
3. **Prova completa di una richiesta**: verificare che arrivino la mail di conferma al cliente
   e l'avviso agli amministratori (con prezzo e dati di fatturazione), poi conferma/rifiuto
   dall'area admin con la relativa mail.

**Da decidere o rifinire**

- Aggiungere l'insegnante come amministratore.
- Rileggere l'informativa con un consulente (base giuridica, conservazione, terzo intestatario).
- La disponibilità si apre a caselle da 15 minuti: valutare la selezione di una fascia
  (trascinamento o "dalle… alle…") per renderla più rapida.
- `docs/PLAN.md` è il piano iniziale: aggiornarlo o archiviarlo.

## Come riprendere

```bash
cd ~/Corsi
node node_modules/typescript/bin/tsc --noEmit      # typecheck
node node_modules/vitest/vitest.mjs run             # test
./scripts/deploy-lxc.sh                             # deploy (+ git push a fine deploy)
```

Sul PC di sviluppo `node_modules/.bin` non è eseguibile: i tool si lanciano con
`node node_modules/…`. Per i test serve `@rollup/rollup-linux-x64-gnu` della stessa versione
di rollup (`npm i --no-save`).

Collaudo nel browser: build locale + `next start` su una copia del DB, pagine guidate da Chrome
headless via DevTools Protocol. Attenzione: Next rinomina il processo in `next-server`, quindi
un server rimasto acceso va cercato per porta (`ss -ltnp`), non per nome.

Dopo ogni modifica: commit e push.
