-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('TAREA', 'TRABAJO_PRACTICO', 'EXAMEN');

-- CreateEnum
CREATE TYPE "TipoMaterial" AS ENUM ('TEXTO', 'PDF');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materia" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "usuarioId" UUID NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "tipo" "TipoActividad" NOT NULL,
    "fecha" DATE NOT NULL,
    "materiaId" UUID NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "tipo" "TipoMaterial" NOT NULL,
    "contenido" TEXT,
    "archivoClave" TEXT,
    "nombreArchivo" TEXT,
    "mimeType" TEXT,
    "tamanoBytes" INTEGER,
    "usuarioId" UUID NOT NULL,
    "materiaId" UUID,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resumen" (
    "id" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "materialId" UUID NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resumen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Materia_usuarioId_idx" ON "Materia"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Materia_id_usuarioId_key" ON "Materia"("id", "usuarioId");

-- CreateIndex
CREATE INDEX "Actividad_materiaId_fecha_idx" ON "Actividad"("materiaId", "fecha");

-- CreateIndex
CREATE INDEX "Material_usuarioId_idx" ON "Material"("usuarioId");

-- CreateIndex
CREATE INDEX "Material_materiaId_usuarioId_idx" ON "Material"("materiaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Resumen_materialId_key" ON "Resumen"("materialId");

-- AddForeignKey
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_materiaId_usuarioId_fkey" FOREIGN KEY ("materiaId", "usuarioId") REFERENCES "Materia"("id", "usuarioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resumen" ADD CONSTRAINT "Resumen_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
