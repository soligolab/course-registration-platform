-- Prezzo del pacchetto configurato dall'admin (centesimi); null = lezioni × tariffa
ALTER TABLE "Package" ADD COLUMN "priceCents" INTEGER;
