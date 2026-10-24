-- Descrizione completa del pacchetto (HTML sanificato), mostrata nella pagina del corso
ALTER TABLE "Package" ADD COLUMN "detailsIt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Package" ADD COLUMN "detailsEn" TEXT NOT NULL DEFAULT '';
