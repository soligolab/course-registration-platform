# Piattaforma prenotazione corsi — Piano

## Context
Il docente vuole automatizzare la raccolta delle **richieste di prenotazione** dei suoi corsi. Il cliente sceglie un pacchetto configurato dall'admin (es. 4h/mese, 8h/mese, 6 mesi 1 volta/settimana), seleziona sul calendario gli slot da 30 min disponibili nel numero richiesto dal pacchetto, si identifica via email+OTP con dati anagrafici e consenso privacy, e invia la richiesta. Conferma e pagamento restano manuali. Partono due email: al cliente ("verrai contattato") e all'admin ("nuova richiesta").
La cartella `C:\Users\ut1\Desktop\Corsi` è vuota; sulla macchina non ci sono Node/Python/Docker.

**Decisioni prese con l'utente**
- Hosting: VPS con Docker → Next.js + SQLite in container
- Email: SMTP configurabile da `.env`
- Regole slot: configurabili per pacchetto
- Pacchetti ricorrenti: l'utente seleziona a mano ogni data (il sistema valida i vincoli)
- Le richieste PENDING bloccano subito gli slot; rifiuto/annullamento li libera
- Admin: login con email + OTP (stesso meccanismo dei clienti), primo utente registrato = admin
- Interfaccia IT + EN

## Stack
- **Next.js 15 (App Router) + TypeScript**, Server Actions / route handlers
- **Prisma + SQLite** (file in `data/` montato come volume Docker)
- **Tailwind CSS** + componenti propri (calendario mensile custom, niente librerie pesanti)
- **next-intl** per IT/EN (`messages/it.json`, `messages/en.json`, default `it`)
- **nodemailer** (SMTP), template email bilingue
- **zod** per validazione, **date-fns / date-fns-tz** con timezone fissa `Europe/Rome` (DB in UTC)
- **Vitest** per i test della logica di dominio
- Docker: `Dockerfile` multi-stage + `docker-compose.yml` (app) + `docker-compose.dev.yml` con **Mailpit** per vedere le email in sviluppo

## Modello dati (`prisma/schema.prisma`)
- `User` — email (unique), firstName, lastName, age, phone, role (`ADMIN`|`CLIENT`), locale, emailVerifiedAt, privacyAcceptedAt, privacyVersion, (se età < 14: guardianName + guardianConsentAt)
- `OtpCode` — email, codeHash, expiresAt (10 min), attempts (max 5), consumedAt
- `Session` — tokenHash, userId, expiresAt (cookie httpOnly, SameSite=Lax)
- `Package` — nameIt/nameEn, descriptionIt/descriptionEn, `totalSlots` (unità da 30 min), `minLessonSlots`, `maxLessonSlots`, `validityDays` (finestra prima→ultima lezione), `maxLessonsPerWeek` (nullable), `active`, `sortOrder`
- `AvailabilitySlot` — `startAt` (UTC, allineato a 30 min, unique)
- `BookingRequest` — userId, packageId, status (`PENDING`|`CONFIRMED`|`REJECTED`|`CANCELLED`), userNotes, adminNotes, createdAt
- `BookedSlot` — requestId, `startAt` **unique** → l'unicità a DB impedisce doppie prenotazioni anche in concorrenza; su rifiuto/annullamento le righe vengono cancellate e lo slot torna libero
- `Setting` — key/value (email notifiche admin, preavviso minimo in ore, nome attività/titolare per privacy)

Slot libero = esiste in `AvailabilitySlot` AND non esiste in `BookedSlot` AND `startAt >= now + preavviso`.

## Logica di dominio (`src/lib/booking/`)
`validateSelection(package, slots[], availability, booked, now)` — pura e testata:
1. numero slot == `package.totalSlots`
2. raggruppa slot contigui dello stesso giorno in "lezioni"; ogni lezione tra `minLessonSlots` e `maxLessonSlots`
3. tutte le lezioni entro `validityDays` dalla prima
4. se `maxLessonsPerWeek` impostato, rispettato per ogni settimana ISO
5. ogni slot disponibile, non prenotato, rispetta il preavviso

Restituisce errori localizzabili (codici) usati sia dal client (feedback live: "6/8 slot, lezione del 12/11 troppo corta") sia dal server in transazione al submit (`prisma.$transaction`, errore unique → "slot appena preso da un altro utente").

Esempi config: 4h/mese = totalSlots 8, min 2, max 4, validity 31; 6 mesi 1/sett. da 1h = totalSlots 52, min=max 2, validity 183, maxLessonsPerWeek 1.

## Flussi
**Cliente** (`/[locale]/...`)
1. `/` — elenco pacchetti attivi
2. `/prenota/[packageId]` — calendario mensile: giorni con slot liberi evidenziati; click sul giorno apre il pannello degli slot da 30 min (toggle); riepilogo laterale con contatore e validazione live. Selezione salvata in `localStorage` per sopravvivere al login.
3. "Invia richiesta" → se non autenticato: email → codice OTP via email → se nuovo utente: form nome, cognome, età, telefono, checkbox privacy **non preselezionata** con link a `/privacy` (+ consenso genitore se età < 14)
4. Riepilogo + note opzionali → submit → email al cliente + email all'admin → pagina di conferma
5. `/le-mie-richieste` — storico richieste e stato

**Admin** (`/[locale]/admin/...`, guard su role ADMIN)
- Bootstrap: alla prima verifica OTP, se `User.count() == 0` (in transazione) il nuovo utente diventa ADMIN. Opzionale `ADMIN_EMAIL` in `.env` per restringere chi può diventarlo (protezione se il sito viene esposto prima del setup).
- **Richieste**: lista filtrabile per stato, dettaglio con dati cliente e slot; azioni Conferma / Rifiuta / Annulla (rifiuta/annulla libera gli slot); opzionale email al cliente su cambio stato
- **Disponibilità**: calendario mensile; aprendo un giorno griglia slot 30 min (es. 07:00–22:00) cliccabili per aprire/chiudere; slot già prenotati mostrati non modificabili. Scorciatoie: "copia questo giorno su tutti i [lunedì] del mese" e "copia settimana sulla successiva"
- **Pacchetti**: CRUD con i campi sopra, attiva/disattiva, ordinamento
- **Clienti**: elenco, esportazione dati e cancellazione (diritti GDPR)
- **Impostazioni**: email notifiche, preavviso minimo, dati titolare per l'informativa

## Privacy / GDPR
- Pagina `/privacy` da file `content/privacy.it.md` / `content/privacy.en.md` (bozza modello da far rivedere: titolare, finalità, base giuridica, conservazione, diritti); `PRIVACY_VERSION` registrata con timestamp all'accettazione
- Dati minimi, codici OTP hashati, cookie solo tecnici (nessun banner cookie necessario)

## Sicurezza
- OTP 6 cifre, hash, scadenza 10 min, max 5 tentativi; rate limit per email e IP sull'invio
- Tutte le validazioni ripetute lato server; route admin protette in middleware + nelle action

## Struttura progetto (tutto confinato nella cartella)
```
Corsi/
  CLAUDE.md                 # istruzioni progetto per Claude (stack, comandi, convenzioni)
  .claude/settings.json     # permessi Claude a livello progetto
  .claude/agents/           # agenti di progetto (es. reviewer GDPR/sicurezza, tester)
  docs/SPEC.md              # requisiti originali + decisioni (prompt di riferimento)
  prisma/schema.prisma, prisma/seed.ts (pacchetti di esempio)
  src/app/[locale]/...      # pagine cliente e admin
  src/lib/booking/          # logica slot + test
  src/lib/auth/, src/lib/mail/ (template email IT/EN)
  messages/it.json, messages/en.json
  content/privacy.*.md
  Dockerfile, docker-compose.yml, docker-compose.dev.yml, .env.example, .nvmrc, README.md
```
Nessuna memoria o configurazione verrà scritta fuori dalla cartella: le note persistenti vanno in `CLAUDE.md` / `docs/`.

## Prerequisito locale
Installare Node 22 LTS (`winget install OpenJS.NodeJS.LTS`) per lo sviluppo; Docker serve solo sul VPS (o Docker Desktop in locale, opzionale).

## Ordine di implementazione
1. Scaffold Next.js + Tailwind + Prisma + next-intl, CLAUDE.md, .claude/, docs/SPEC.md
2. Schema DB + seed; logica `validateSelection` + test Vitest
3. Auth OTP + sessioni + bootstrap admin
4. Admin: disponibilità → pacchetti → impostazioni
5. Flusso cliente: pacchetti → calendario → auth/profilo/privacy → submit + email
6. Admin: gestione richieste, clienti
7. Docker + README deploy (reverse proxy HTTPS es. Caddy, backup del file SQLite)

## Verifica
- `npm run test` — unit test di `validateSelection` (conteggio, lezioni min/max, validità, max/settimana, preavviso, conflitti)
- `docker compose -f docker-compose.dev.yml up` → Mailpit su `localhost:8025`
- E2E manuale: registrarsi come primo utente → diventa admin; aprire disponibilità; creare pacchetto; da browser in incognito prenotare come cliente → verificare OTP in Mailpit, le 2 email finali, slot bloccati per un secondo cliente; rifiutare dall'admin → slot di nuovo liberi
- Test concorrenza: due submit simultanei sullo stesso slot → uno solo va a buon fine
- `npm run build` e `docker build` senza errori; cambio lingua IT/EN su tutte le pagine
