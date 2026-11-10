-- CreateTable
CREATE TABLE IF NOT EXISTS "gallery_slides" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "src" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "gallery_slides_order_idx" ON "gallery_slides"("order");
CREATE INDEX IF NOT EXISTS "gallery_slides_hidden_idx" ON "gallery_slides"("hidden");

