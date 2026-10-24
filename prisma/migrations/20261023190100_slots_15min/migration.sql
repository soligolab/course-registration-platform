-- Gli slot passano da 30 a 15 minuti (SLOT_MINUTES in src/lib/time.ts): stessa durata reale,
-- numero di slot doppio. Ogni slot da 30 min diventa due slot da 15 (inizio e inizio + 15 min).
-- Le date sono millisecondi Unix; in slotsJson stringhe ISO UTC.

UPDATE "Package" SET
  "totalSlots" = "totalSlots" * 2,
  "minLessonSlots" = "minLessonSlots" * 2,
  "maxLessonSlots" = "maxLessonSlots" * 2,
  "lessonStepSlots" = "lessonStepSlots" * 2;

INSERT OR IGNORE INTO "AvailabilitySlot" ("id", "startAt")
SELECT "id" || 'q', "startAt" + 900000 FROM "AvailabilitySlot";

INSERT OR IGNORE INTO "BookedSlot" ("id", "requestId", "startAt")
SELECT "id" || 'q', "requestId", "startAt" + 900000 FROM "BookedSlot";

UPDATE "BookingRequest" SET "slotsJson" = (
  SELECT json_group_array(v) FROM (
    SELECT value AS v FROM json_each("BookingRequest"."slotsJson")
    UNION
    SELECT strftime('%Y-%m-%dT%H:%M:%fZ', value, '+15 minutes') FROM json_each("BookingRequest"."slotsJson")
    ORDER BY v
  )
);
