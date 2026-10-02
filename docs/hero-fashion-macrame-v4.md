# Macrame fashion photo v4 — 2 October 2026

Client-supplied photo: two models in handmade cotton macrame (halter top with skirt, fringe dress with a woven bag) on a rocky seaside. Replaces the clothing imagery in the hero (slide 1) and in the clothes category. Hero v3 and the previous catalog images stay on the CDN, unreferenced.

Source: 1671 × 941 WebP, models between x≈42% and x≈90%, sea and sky on the left. Uploaded to `cdn.stariva.ru` under new names (objects are cached as immutable for a year, so they are never overwritten):

| File | Crop | Used for |
| --- | --- | --- |
| `site/images/home/hero-fashion-macrame-v4.webp` | full frame, 1671 × 941 | homepage hero slide 1, homepage Open Graph |
| `site/images/catalog/hero-clothes-macrame-v4.webp` | 1671 × 557 (≈3:1), top offset 22 px | `/catalog/clothes` banner |
| `site/images/catalog/category-clothes-macrame-v4.jpg` | 753 × 941 (4:5), left offset 745 px | clothes card in `/catalog`, header mega-menu |

Hero layout relies on the left ≈40% of the frame staying free for the headline; the models start at ≈42%. On mobile the slide is shifted left by 40% (`.photo[data-fashion]` in `hero.module.css`), so only the models remain visible.
