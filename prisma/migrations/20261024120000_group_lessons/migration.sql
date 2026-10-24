-- Lezioni di gruppo e fasce orarie per pacchetto.
-- Gli slot prenotati passano dalla richiesta alla lezione (Lesson); le richieste occupano un posto (Seat).

ALTER TABLE "Package" ADD COLUMN "maxParticipants" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Package" ADD COLUMN "groupKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Package" ADD COLUMN "timeWindowsJson" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "slotCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lesson_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Seat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    CONSTRAINT "Seat_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Seat_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BookingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Dati esistenti: gli slot di ogni richiesta, consecutivi e spezzati ogni lessonStepSlots, diventano lezioni.
-- Le date sono interi in millisecondi; 900000 = 15 minuti.
CREATE TEMP TABLE "_slot_lesson" AS
WITH ordered AS (
    SELECT b."id", b."startAt", b."requestId", r."packageId", MAX(p."lessonStepSlots", 1) AS step,
           b."startAt" - 900000 * ROW_NUMBER() OVER (PARTITION BY b."requestId" ORDER BY b."startAt") AS island
    FROM "BookedSlot" b
    JOIN "BookingRequest" r ON r."id" = b."requestId"
    JOIN "Package" p ON p."id" = r."packageId"
), chunked AS (
    SELECT *, (ROW_NUMBER() OVER (PARTITION BY "requestId", island ORDER BY "startAt") - 1) / step AS chunk
    FROM ordered
)
SELECT "id", "startAt", "requestId", "packageId",
       FIRST_VALUE("id") OVER (PARTITION BY "requestId", island, chunk ORDER BY "startAt") AS "lessonId"
FROM chunked;

INSERT INTO "Lesson" ("id", "packageId", "startAt", "slotCount")
SELECT "lessonId", MIN("packageId"), MIN("startAt"), COUNT(*) FROM "_slot_lesson" GROUP BY "lessonId";

INSERT INTO "Seat" ("id", "lessonId", "requestId", "seat")
SELECT "lessonId", "lessonId", MIN("requestId"), 1 FROM "_slot_lesson" GROUP BY "lessonId";

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookedSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    CONSTRAINT "BookedSlot_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookedSlot" ("id", "lessonId", "startAt") SELECT "id", "lessonId", "startAt" FROM "_slot_lesson";
DROP TABLE "BookedSlot";
ALTER TABLE "new_BookedSlot" RENAME TO "BookedSlot";
CREATE UNIQUE INDEX "BookedSlot_startAt_key" ON "BookedSlot"("startAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

DROP TABLE "_slot_lesson";

CREATE INDEX "Seat_requestId_idx" ON "Seat"("requestId");
CREATE UNIQUE INDEX "Seat_lessonId_seat_key" ON "Seat"("lessonId", "seat");
CREATE UNIQUE INDEX "Seat_lessonId_requestId_key" ON "Seat"("lessonId", "requestId");
