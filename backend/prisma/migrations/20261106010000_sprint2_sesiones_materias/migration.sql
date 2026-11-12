-- Sprint 2: cambios aditivos; no modifica ni elimina filas existentes.
ALTER TABLE "Materia" ADD COLUMN "descripcion" VARCHAR(1000);

CREATE TABLE "Sesion" (
  "sid" TEXT NOT NULL,
  "datos" JSONB NOT NULL,
  "expiraEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sesion_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "Sesion_expiraEn_idx" ON "Sesion"("expiraEn");