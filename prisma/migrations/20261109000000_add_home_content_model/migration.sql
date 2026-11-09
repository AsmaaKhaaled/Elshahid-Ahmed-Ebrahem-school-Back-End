-- CreateTable
CREATE TABLE IF NOT EXISTS "home_contents" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'principal_word',
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'مدير المدرسة',
    "photoUrl" TEXT,
    "message" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "home_contents_key_key" ON "home_contents"("key");

