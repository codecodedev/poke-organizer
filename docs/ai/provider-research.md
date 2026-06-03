# Provider Research

## Catalog

Pokemon TCG API:

- Free without API key at lower rate limits.
- Provides card images, set data and TCGPlayer/CardMarket pricing data for many cards.
- Best initial source for search and images.

TCGdex:

- Free and no API key.
- Useful for language coverage and alternate catalog data.
- Image URLs require appending quality and extension, for example `/low.webp` or `/high.webp`.

## Brazilian Pricing

LigaPokemon and MYP Cards are important market references, but both need a dedicated integration investigation. Public inspection hit Cloudflare challenge pages. LigaPokemon also publishes a conservative crawl delay in `robots.txt`.

Implementation policy:

- Keep Brazilian pricing optional and behind `ENABLE_BRAZILIAN_PRICE_PROVIDERS`.
- Cache Brazilian prices in `PriceSnapshot`.
- Prefer stable public endpoints if discovered.
- Avoid login automation, Cloudflare bypass, CAPTCHA handling or runtime dependence on scraping.
