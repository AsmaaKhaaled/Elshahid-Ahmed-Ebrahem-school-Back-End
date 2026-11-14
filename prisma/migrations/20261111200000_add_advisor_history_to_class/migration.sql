-- AlterTable
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "advisorHistory" JSONB DEFAULT '[]'::jsonb;

