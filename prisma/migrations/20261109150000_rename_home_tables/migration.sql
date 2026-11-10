-- RenameTable
ALTER TABLE IF EXISTS "home_contents" RENAME TO "home_principal_word";

-- RenameIndex
ALTER INDEX IF EXISTS "home_contents_key_key" RENAME TO "home_principal_word_key_key";

-- RenameTable
ALTER TABLE IF EXISTS "gallery_slides" RENAME TO "home_gallery_slides";

-- RenameIndex
ALTER INDEX IF EXISTS "gallery_slides_order_idx" RENAME TO "home_gallery_slides_order_idx";
ALTER INDEX IF EXISTS "gallery_slides_hidden_idx" RENAME TO "home_gallery_slides_hidden_idx";

