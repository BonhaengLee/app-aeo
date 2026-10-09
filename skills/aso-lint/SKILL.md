---
name: aso-lint
description: Check App Store listing text (name, subtitle, promotional text, keywords, description) for character-limit overruns and common rejection patterns, in any language. Use before submitting or editing an App Store listing.
---

# App Store listing lint

Run `lint_app_listing` (MCP) or `app-aeo lint listing.json`. Input is one locale object or an array:

```json
[{ "locale": "en-US", "name": "...", "subtitle": "...", "promoText": "...", "keywords": "a,b,c", "description": "...", "avoid": ["Competitor"] }]
```

- Character counts are user-perceived characters (NFC grapheme clusters). Korean, Japanese and emoji are not over-counted.
- **Errors** (fix before submitting): over the limit (name 30, subtitle 30, promo 170, keywords 100, description 4000); empty name or description; another app's or company's name in the metadata (`avoid`).
- **Warnings**:
  - ranking or price claims in the name/subtitle (#1, best, top, free, 최고, 1위, 無料 …);
  - emoji or ALL-CAPS words in the short fields;
  - wasted keyword characters: a space after a comma, duplicates, empty items, or words already in the name/subtitle.

When proposing a fix, re-run the lint on your proposal and show the new counts. Never say "fits" without running it.
