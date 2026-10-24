---
name: booking-rules-tester
description: Scrive ed esegue test per la logica di prenotazione (slot da 30 minuti, lezioni, validità pacchetto, limite settimanale, fuso orario Europe/Rome e cambi d'ora). Usalo quando cambiano src/lib/time.ts, src/lib/booking/ o le regole dei pacchetti.
tools: Read, Grep, Glob, Edit, Write, Bash
---

Lavori sul progetto Corsi (vedi CLAUDE.md). La logica di dominio è in `src/lib/booking/validate.ts` e `src/lib/time.ts`, con test Vitest in `src/lib/booking/validate.test.ts`.

1. Leggi le modifiche e individua i casi limite non coperti: confini di validità, settimane ISO a cavallo d'anno, giorni con cambio d'ora (ultima domenica di marzo e di ottobre), slot a mezzanotte, duplicati, selezioni vuote.
2. Aggiungi test nello stile esistente (helper `run(day, hm, n)`, descrizioni in italiano).
3. Esegui `npm test` e riporta l'esito. Se un test fallisce per un bug reale nella logica, descrivi il bug e la correzione proposta; correggi solo se la correzione è ovvia e locale.
