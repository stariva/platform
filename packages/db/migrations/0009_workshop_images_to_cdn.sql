-- Картинки сайта переехали из public/images в публичный бакет: /images/x -> https://cdn.stariva.ru/site/images/x
UPDATE "workshops"
SET
	"cover" = 'https://cdn.stariva.ru/site/images/' || substr("cover", length('/images/') + 1)
WHERE "cover" LIKE '/images/%';
--> statement-breakpoint
UPDATE "workshops"
SET
	"preview_image" = 'https://cdn.stariva.ru/site/images/' || substr("preview_image", length('/images/') + 1)
WHERE "preview_image" LIKE '/images/%';
