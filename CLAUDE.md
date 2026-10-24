# Corsi – piattaforma richieste di prenotazione

Requisiti e decisioni: [docs/SPEC.md](docs/SPEC.md). Leggilo prima di modificare il comportamento.
**Stato del lavoro e cose da fare: [STATUS.md](STATUS.md)** – aggiornarlo a fine sessione.

## Repository
`github.com/soligolab/course-registration-platform`, **pubblico**. Dopo ogni modifica: commit e push (lo script di deploy fa anche il push).
Mai committare dati di un'installazione: `.env`, `.deploy.env`, `data/`, IP, nomi host, email reali. Vanno nei file non versionati.

## Regola di progetto
Tutto ciò che riguarda il progetto (prompt, note, configurazione di Claude, agenti) resta **dentro questa cartella**:
- note persistenti → `CLAUDE.md` o `docs/`, mai nella memoria utente globale;
- configurazione Claude → `.claude/settings.json` (condivisa) e `.claude/agents/`.

## Stack
Next.js 15 (App Router, server actions) · TypeScript · Prisma 6 + SQLite · Tailwind 3 · next-intl 3 (it/en) · nodemailer · zod · Vitest.
Node 24 (`.nvmrc`). Deploy con Docker (`Dockerfile`, `docker-compose.yml` + Caddy).
In produzione gira in un container LXC con systemd, senza Docker: vedi [docs/DEPLOY-LXC.md](docs/DEPLOY-LXC.md); si aggiorna con `./scripts/deploy-lxc.sh` (legge `.deploy.env`, non versionato).

## Comandi
- `npm run dev` – sviluppo su http://localhost:3000 (senza `SMTP_HOST` le email sono stampate in console, incluso il codice OTP)
- `npm test` – unit test logica slot
- `npm run typecheck`, `npm run build`
- `npm run db:migrate -- --name <nome>` dopo modifiche a `prisma/schema.prisma`
- `npm run db:seed` – pacchetti di esempio (solo se non ce ne sono)

## Struttura
- `src/lib/time.ts` – tutto il calcolo date/ora in `Europe/Rome`; DB e client scambiano ISO UTC. `SLOT_MINUTES = 15`: mai scrivere 30 o 15 a mano, usare la costante
- `src/lib/pricing.ts` – tariffario e prezzi (centesimi); `src/lib/theme.ts` – tema → variabili CSS (condiviso server/client), `theme-server.ts` lettura/salvataggio
- `src/lib/billing.ts` – dati di fatturazione: schema zod, controllo CF/P.IVA, righe per fattura; i campi del modulo profilo hanno prefisso `b_`
- `src/lib/media.ts` + `src/app/api/admin/media` + `src/app/media/[name]` – immagini caricate (tipo riconosciuto dai byte, SVG escluso); `public/presets/` – immagini d'esempio
- `src/lib/availability.ts` – slot liberi, lezioni di gruppo a cui unirsi, pulizia delle lezioni vuote; `src/lib/packages.ts` – regole del pacchetto e fasce orarie (`timeWindowsJson`)
- `src/lib/booking/validate.ts` – regole del pacchetto, usate sia dal client (feedback live) sia dal server (in transazione). Modifiche alle regole → aggiornare i test accanto
- `src/app/actions/` – server actions (`auth`, `booking`, `admin`). Ogni action admin chiama `requireAdmin()`
- `src/app/[locale]/` – pagine; `admin/` protetto dal layout (redirect) + `requireAdminPage()` in ogni pagina
- `messages/{it,en}.json` – testi UI: ogni nuova chiave va aggiunta in entrambe le lingue
- `content/privacy.{it,en}.md` – informativa; se cambia nella sostanza aggiornare `PRIVACY_VERSION` in `src/lib/settings.ts` (forza la ri-accettazione)

## Trappole
- Messaggi ICU (`messages/*.json`): un apostrofo dritto prima di `<tag>` o `{` apre una citazione e rompe il testo. Usare l'apostrofo tipografico ’
- `<form action={action}>` con `useActionState`: React 19 svuota i campi non controllati dopo l'invio, anche in caso di errore. Nei form con validazione lato server usare `onSubmit` + `startTransition(() => action(formData))`

## Invarianti
- I colori `brand`/`accent`/`slate` di Tailwind sono variabili CSS del tema: niente colori fissi nei componenti, se non semantici (rosso errore, verde libero)
- Un'immagine in uso (tema o pacchetto) non si può eliminare dalla galleria
- `BookedSlot.startAt` è unique: è ciò che impedisce lezioni sovrapposte. Gli slot appartengono a una `Lesson` (lezione fissata); ogni richiesta vi occupa un `Seat`, con `(lessonId, seat)` unique per non superare `maxParticipants`. Rifiuto/annullamento/cancellazione tolgono i `Seat` e poi `deleteEmptyLessons()` libera le lezioni rimaste vuote; `BookingRequest.slotsJson` conserva lo storico
- Gli slot prenotati non si possono togliere dalla disponibilità
- Mai fidarsi della validazione client: `submitBooking` rivalida tutto
