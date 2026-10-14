-- Данные ёлок жили в коде (TREE_MODELS) — переносим их в базу.
-- Подкатегория и тексты витрины записываются всегда: поля только что
-- появились в 0025. Цвет, размеры и срок изготовления — только если пустые,
-- чтобы не затереть правки из админки.
UPDATE "products" SET
	"category" = 'interior',
	"subcategory" = 'trees',
	"best_for" = 'Гостиная, лобби отеля, зал ресторана',
	"highlights" = ARRAY[
		'Заметна с порога — работает как фотозона',
		'Три оттенка: бежевый, натуральный, молочный',
		'Вешается за звезду на один крючок — без сверления'
	],
	"color" = coalesce(nullif("color", ''), 'Бежевый, натуральный, молочный'),
	"dimensions" = coalesce(nullif("dimensions", ''), '70–75 × 150 см'),
	"lead_time_min_days" = coalesce("lead_time_min_days", 2),
	"lead_time_max_days" = coalesce("lead_time_max_days", 3)
WHERE "slug" = 'elka-panno-makrame-0687';--> statement-breakpoint
UPDATE "products" SET
	"category" = 'interior',
	"subcategory" = 'trees',
	"best_for" = 'Детская, прихожая, салон, ресепшен',
	"highlights" = ARRAY[
		'Компактная — для небольших стен',
		'Глубокий природный оттенок',
		'Вешается за звезду на один крючок — без сверления'
	],
	"color" = coalesce(nullif("color", ''), 'Хаки'),
	"dimensions" = coalesce(nullif("dimensions", ''), '45 × 100 см'),
	"lead_time_min_days" = coalesce("lead_time_min_days", 2),
	"lead_time_max_days" = coalesce("lead_time_max_days", 3)
WHERE "slug" = 'elka-panno-makrame-8124';
