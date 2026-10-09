<!-- DRAFT — not posted. Target: https://github.com/every-app/open-seo/issues/256 -->

Two pieces of this issue can be built today without waiting on app keyword data, and I have working versions of both I'd like to contribute:

**1. "When someone asks an LLM for an app recommendation in my category, am I named?"**
I built this as a small standalone tool: [app-aeo](<repo url>). Given an app (App Store id / Play package), competitors and a prompt set, it asks several answer engines and reports per engine:
- the mention rate, with n and a 95% Wilson interval;
- the list position;
- whether the answer links to the store;
- share of voice against competitors;
- the prompts where the app is missing, and the apps recommended instead.

Matching works on store links (`apps.apple.com/...id123`, `play.google.com/...id=pkg`) as well as names. It also handles generic-prefix titles like "Habit Tracker - HabitKit", which otherwise inflate the rate. It's zero-dependency JS with an MCP server, so it could map onto OpenSEO's existing AI Visibility workflow as an "app" target type rather than a separate tool.

**2. "Help getting my store listing right, handed to an agent"**
A listing lint as an Agent Skill. It counts characters per field as users see them (NFC grapheme clusters, so Korean, Japanese and emoji aren't over-counted) and flags:
- over-limit fields;
- competitor or brand names in the metadata;
- rank or price claims (en/ko/ja);
- emoji or caps in name/subtitle;
- wasted keyword characters (spaces after commas, duplicates, words already in name/subtitle).

It's small and needs no data vendor, so it could be a first PR independent of the DataForSEO question.

On the open question in the issue: as far as I could find, DataForSEO's App Data API covers rankings, app info and reviews, but has no keyword search-volume endpoint. On the Apple side the only first-party popularity signal I know of is Apple Ads' search-term popularity, which requires an Apple Ads account. Google Play has no public volume source. So any volume number for Play would be an estimate and should be labelled that way in the UI.

If you're open to it, I can send the listing-lint skill as a PR first, then propose the AI-visibility "app target" once you've decided on the project data model.
