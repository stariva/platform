ALTER TABLE "products" ADD COLUMN "best_for" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "highlights" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Тексты карточек ёлок жили в коде (TREE_MODELS) — переносим их в базу.
-- Заполняем только пустые поля, чтобы не затереть правки из админки.
UPDATE "products" SET
	"best_for" = 'Гостиная, лобби отеля, зал ресторана',
	"highlights" = ARRAY[
		'Заметна с порога — работает как фотозона',
		'Три оттенка: бежевый, натуральный, молочный',
		'Вешается за звезду на один крючок — без сверления'
	],
	"color" = coalesce(nullif("color", ''), 'Бежевый, натуральный, молочный'),
	"dimensions" = coalesce(nullif("dimensions", ''), '70–75 × 150 см')
WHERE "slug" = 'elka-panno-makrame-0687';--> statement-breakpoint
UPDATE "products" SET
	"best_for" = 'Детская, прихожая, салон, ресепшен',
	"highlights" = ARRAY[
		'Компактная — для небольших стен',
		'Глубокий природный оттенок',
		'Вешается за звезду на один крючок — без сверления'
	],
	"color" = coalesce(nullif("color", ''), 'Хаки'),
	"dimensions" = coalesce(nullif("dimensions", ''), '45 × 100 см')
WHERE "slug" = 'elka-panno-makrame-8124';
