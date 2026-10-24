# Specifica – Piattaforma prenotazione corsi

## Richiesta originale (committente)

> Ho bisogno di realizzare una piattaforma per automatizzare le iscrizioni a dei corsi che tengo.
> L'idea è che l'utente tramite il portale possa definire quali giorni vorrebbe, ma è una richiesta di prenotazione, per ora poi la conferma e il pagamento verranno gestiti manualmente post richiesta.
> L'utente che accede al calendario può scegliere tra diversi tipi di pacchetti che configurerò io tipo 4h in un mese, 8h in un mese, 6 mesi una volta alla settimana etc...
> Scelto il pacchetto accederà ad un calendario con le disponibilità.
> Le disponibilità partono dai giorni/ore che io metto a disposizione configurandoli, pensavo ad un calendario con vista mensile dove aprendo un giorno posso cliccare sugli slot di 30min che ho liberi.
> In base al pacchetto scelto l'utente deve richiedere il numero corretto di slot.
> Le disponibilità devono tenere conto dei giorni già fissati da altri.
> Ovviamente servirà un accesso amministratore (il primo utente che si registra).
>
> Per gli utenti non credo serva una registrazione vera ma servirebbe una e-mail con invio del codice di verifica e un numero di telefono + nome cognome ed età.
>
> Visto che la registrazione dovrà richiedere dati personali (età, numero di telefono etc...) serve una presa visione delle norme per il trattamento dei dati.
> Al termine della richiesta di prenotazione dovrà essere mandata una mail al cliente in cui dico che verrà contattato per il completamento dell'ordine e una mail a me di avviso che c'è stata una richiesta.
>
> Tutto quello che riguarda questo progetto, prompt, configurazioni di claude e degli agenti, deve rimanere confinato in questa cartella così da essere portabile su altre macchine.

## Decisioni prese

| Tema | Decisione |
|---|---|
| Hosting | VPS con Docker (Next.js + SQLite, Caddy per HTTPS) |
| Email | SMTP configurabile da `.env` |
| Regole slot | Configurabili per pacchetto: numero di lezioni × **durata fissa** (scelta dal tariffario), validità in giorni, max lezioni/settimana |
| Tariffario | Prezzo per lezione in base alla durata (default 45 min, 1 h, 1,5 h). Prezzo pacchetto = lezioni × tariffa; congelato in `BookingRequest.priceCents` all'invio. Pagamento sempre manuale |
| Aspetto | *Admin → Aspetto*: colori, caratteri, forme, impaginazione, banner, pacchetti, footer; 4 stili pronti caldi. Salvato come JSON (Setting `theme`) e tradotto in variabili CSS lette da Tailwind |
| Fatturazione | Obbligatoria per inviare una richiesta (parte del profilo). Privato (nome, cognome, codice fiscale: l'intestatario può essere diverso dall'allievo, es. il genitore) o azienda/professionista (ragione sociale, P.IVA, CF facoltativo, codice SDI e/o PEC facoltativi → altrimenti 0000000). Controlli formali di CF e P.IVA con carattere di controllo; per l'estero niente controlli italiani. JSON in `User.billingJson`, copiato in `BookingRequest.billingJson` all'invio |
| Dati del cliente | Chiesti **solo al momento dell'invio** della prima richiesta: il cliente sceglie pacchetto e date anche senza accesso; all'invio verifica l'email (OTP) e, se il profilo è incompleto, compila dati personali e di fatturazione. La selezione resta in `localStorage` e la richiesta parte da sola al ritorno (`?invia=1`). I dati restano nel profilo per le richieste successive |
| Descrizione dei corsi | Due livelli: **riassunto** in testo semplice nella scheda della home e **descrizione completa** (`detailsIt`/`detailsEn`) nella pagina del corso `/corso/<id>`, aperta dal pulsante *Esplora*. Scritta con un editor visuale (TipTap): titoli, stili, elenchi, citazioni, allineamenti, link, immagini della galleria (a sinistra, destra, centro o larghe), due colonne. L'HTML è ripulito sul server (`src/lib/rich-text.ts`) al salvataggio e alla visualizzazione: solo i tag dell'editor e immagini interne. Se manca una lingua si mostra l'altra |
| Immagini | Logo, banner e immagine per pacchetto: esempi in `public/presets/` o caricate (PNG/JPG/WebP/GIF ≤ 5 MB, niente SVG) in `UPLOAD_DIR`, servite da `/media/…` |
| Pacchetti ricorrenti | L'utente seleziona a mano ogni data; il sistema valida i vincoli |
| Blocco slot | Le richieste in attesa bloccano subito gli slot; rifiuto/annullamento li liberano |
| Lezioni di gruppo | `Package.maxParticipants` (1 = individuale). Il primo cliente che prenota una lezione la fissa (`Lesson`): l'orario è occupato per tutti, nessuna lezione può sovrapporsi. Altri clienti dello stesso pacchetto, o di un pacchetto con lo stesso `groupKey` e la stessa durata, si uniscono alla lezione intera (`Seat`) finché ci sono posti; il massimo è quello del pacchetto che l'ha fissata. Nel calendario le lezioni con posti liberi compaiono come pulsanti a parte ("2 posti liberi"); il cliente non vede chi partecipa. Una lezione resta finché ha almeno un partecipante |
| Fasce orarie del corso | `Package.timeWindowsJson`: fasce settimanali (giorno + dalle/alle, ora di Roma) dentro la disponibilità generale. Una lezione nuova deve stare tutta in una fascia; nessuna fascia = sempre. Le iscrizioni a lezioni già fissate non sono vincolate alle fasce |
| Accesso admin | Email + codice OTP; il primo utente diventa admin (o `ADMIN_EMAIL` se impostata) |
| Più amministratori | Gestiti da *Impostazioni → Amministratori*: tutti con gli stessi poteri, si aggiungono per email (anche prima che si registrino), nessuno può togliersi da solo, quindi ne resta sempre almeno uno. Le notifiche di nuova richiesta vanno a **tutti** gli admin, più l'eventuale email aggiuntiva delle impostazioni |
| Lingue | Italiano (default) + inglese |
| Minori | Sotto i 14 anni richiesto nome e consenso del genitore/tutore (art. 2-quinquies Codice Privacy) |

## Modello a slot
- Unità: slot da **15 minuti** (`SLOT_MINUTES`), ora di Roma (DB in UTC). Fino al 2026-10-23 erano 30: la migrazione `slots_15min` ha raddoppiato i conteggi.
- Una "lezione" = slot consecutivi nello stesso giorno; con durata fissa (min = max) una sequenza più lunga sono più lezioni attaccate, permesse.
- Ogni pacchetto ha un "blocco lezione" (`lessonStepSlots`, es. 4 = 1 ora) e oggi min = max = blocco: un clic nel calendario seleziona una lezione intera, con inizio ogni 15 minuti.
- Pacchetti base (seed): "4 ore al mese" = 4 × 1 h (`totalSlots=16, min=max=step=4`), "8 ore al mese" = 8 × 1 h, "8 lezioni da 45 minuti" (`totalSlots=24, min=max=step=3`), tutti `validityDays=31`.

## Possibili evoluzioni
- Pagamento online, conferma automatica
- Promemoria email prima delle lezioni
- Esportazione calendario (iCal) per l'admin
