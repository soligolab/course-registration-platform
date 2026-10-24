-- Pacchetti "lezione singola" (uno per durata del tariffario), creati e aggiornati dal salvataggio del tariffario
ALTER TABLE "Package" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PACKAGE';
