-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameIt" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionIt" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "totalSlots" INTEGER NOT NULL,
    "minLessonSlots" INTEGER NOT NULL,
    "maxLessonSlots" INTEGER NOT NULL,
    "lessonStepSlots" INTEGER NOT NULL DEFAULT 1,
    "validityDays" INTEGER NOT NULL,
    "maxLessonsPerWeek" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Package" ("active", "createdAt", "descriptionEn", "descriptionIt", "id", "maxLessonSlots", "maxLessonsPerWeek", "minLessonSlots", "nameEn", "nameIt", "sortOrder", "totalSlots", "validityDays") SELECT "active", "createdAt", "descriptionEn", "descriptionIt", "id", "maxLessonSlots", "maxLessonsPerWeek", "minLessonSlots", "nameEn", "nameIt", "sortOrder", "totalSlots", "validityDays" FROM "Package";
DROP TABLE "Package";
ALTER TABLE "new_Package" RENAME TO "Package";
-- pacchetti esistenti con durate tutte in ore intere: blocchi da 1 ora
UPDATE "Package" SET "lessonStepSlots" = 2
WHERE "minLessonSlots" % 2 = 0 AND "maxLessonSlots" % 2 = 0 AND "totalSlots" % 2 = 0;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
