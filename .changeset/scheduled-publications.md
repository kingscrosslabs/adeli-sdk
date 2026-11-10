---
'@adeli/sdk': minor
---

Schedule publications and save drafts. `createPublication` accepts `scheduledFor` (ISO 8601 with an offset, one minute to 365 days ahead), `timeZone`, and `draft`; a scheduled publication or draft answers `201` with status `scheduled` or `draft`, and `Publication` gains `scheduledFor`, `timeZone`, and `canceledAt`. New `publications.listPublications`, `updatePublication` (reschedule or replace the post), `publishPublication` (publish now), and `cancelPublication`; the three writes are never retried automatically. `Publication['status']` adds `scheduled`, `draft`, and `canceled`, so an exhaustive `switch` needs three new branches. `listPosts` returns scheduled posts first, with optional `status: 'scheduled'`, `scheduledFor`, and `publicationId` on `NormalizedPost`. `waitForPublication` keeps waiting through `scheduled` and `draft` and treats `canceled` as terminal.
