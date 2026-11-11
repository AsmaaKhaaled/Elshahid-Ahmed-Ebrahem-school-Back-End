-- CreateTable
CREATE TABLE IF NOT EXISTS "academic_terms" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATE,
    "endedAt" DATE,
    "plannedStartDate" DATE,
    "plannedEndDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "academic_terms_year_term_key" ON "academic_terms"("year", "term");

