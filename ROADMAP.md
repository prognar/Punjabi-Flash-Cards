# Punjabi Learning App — Status & Roadmap to iOS / Android

_Last updated: 2026-11-16 · Owner: Drew Campbell (prognar)_

This document is the handoff from the web prototype to a full mobile product. Read it top to bottom before writing code. It covers what exists, what we learned, the target architecture, the native-speaker content workflow, and a phased timeline.

---

## 1. Goal

Build the first Duolingo-quality app for learning **Punjabi in Gurmukhi script** for English speakers, on iOS and Android.

- **Who it's for:** diaspora families, meaning heritage kids, parents and non-Punjabi spouses. Also adults taking classes and anyone visiting Punjab or attending the Gurdwara.
- **What it teaches:** letters → words → phrases → conversation, plus a Gurdwara track.
- **Method:** follows the Duolingo Method (2023 whitepaper):
  - learn by doing,
  - personalized spaced review,
  - a curriculum built on what learners need to do,
  - motivation (streaks, XP, goals),
  - delight (characters, stories).
- **Differentiators:**
  - Gurmukhi writing practice
  - Native-speaker-verified content and audio
  - Family accounts
  - Gurdwara and Sikh-culture content
  - A path for weekly class learners and Gurdwara schools

Existing competitors (Ling, Mango, Pimsleur, uTalk, Dinolingo) are shallow on Punjabi: weak or no script teaching, no writing, little adaptive review. Duolingo has no Punjabi course for English speakers.

---

## 2. Where we are: the web prototype

- **Repo:** `github.com/prognar/Punjabi-Flash-Cards` (public), branch `main`
- **Live:** GitHub Pages from `main`: `https://prognar.github.io/Punjabi-Flash-Cards/`, plus `/admin.html` for the content console
- **Stack:** static HTML/CSS/vanilla JS. No build step, no backend. Progress lives in each browser's `localStorage`, per learner profile, with JSON backup and restore.

### 2.1 Files

| File | What it is |
|---|---|
| `data/content.js` | Letters (35, each with picture words), vocab, phrases, categories, per-lesson sizes |
| `data/sentences.js` | Glossary, word classes, sentence templates, ~100 hand-written sentences, 25 conversations |
| `data/custom.js` | Admin overrides and additions, published from the admin console |
| `js/model.js` | Builds items, lesson order, categories and sentences from the data files; applies admin overrides |
| `js/engine.js` | Spaced repetition, mastery, lesson gate, session builder, placement seeding, XP, weekly unlock |
| `js/app.js` | UI: profiles, home, placement test, sessions (all exercise types), summary, progress, browse, settings |
| `js/speech.js` | Text-to-speech fallback ladder, speech recognition, phonetic matching (Gurmukhi ↔ romanized) |
| `js/trace.js` | Letter tracing and freehand writing scorer |
| `js/admin.js`, `admin.html` | Content console: edit/add cards, record audio, voice tuning, publish to GitHub via a token |
| `tests/engine.test.js`, `tests/speech.test.js` | Node unit tests (seeded learner simulations, matcher) |
| `LESSONS.md` | Detailed behavior documentation of the prototype. Read it. |
| `gurmukhi-game.html` | The original kids' flash game (legacy) |

### 2.2 Content (as of this writing)

| | Count | Notes |
|---|---|---|
| Letters | 35 | 7 rows × 5, with picture words for each |
| Words | 760 | 22 categories. About 90 from the teacher's sheet; the rest written for the app |
| Phrases | 288 | 20 groups, including Gurdwara etiquette, visiting family, meals, shopping, directions, phone and celebrations |
| Lessons | 38 | 2–3 letters (lessons 1–14), 20 words and 8 phrases per lesson, one theme per lesson from lesson 15 |
| Practice sentences | ~1,250 | Generated from templates by word class, plus hand-written ones |
| Conversations | 25 | "Pick the best reply" |
| **Native-verified items** | **0** | All Gurmukhi was written by AI or taken from the teacher's romanized sheet |
| **Native recordings** | **0** | Audio is device TTS with fallbacks; quality varies, worst on iOS and older Android |

### 2.3 Learner features that work today

- **Profiles:** kid or adult per learner (session size, strictness, celebrations).
- **Placement test:**
  - Starts with a letter check, then adaptive blocks per lesson (3 words + 1 phrase).
  - Skips ahead on perfect blocks and re-checks skipped lessons on a miss. Has an "I don't know" button.
  - Recommends a starting lesson and seeds earlier lessons as already seen.
- **Spaced repetition:**
  - Boxes 0–6 with intervals of 8h, 1d, 3d, 7d, 16d and 35d.
  - At most one box gained per day.
  - Mastery threshold scales with recent accuracy (strong / normal / struggling).
- **Lesson gate:**
  - 80% of the lesson mastered overall, 60% per kind, 60% review accuracy.
  - Next lesson also unlocks weekly, plus a manual "Class has moved on" button.
  - Category practice ("Colors", "Gurdwara"…) at any time.
- **Exercises:**
  - Intro card; multiple choice both directions (wrong options from the same category)
  - Letters: find, name, first letter of a picture word, trace, write from memory
  - Say it (speech recognition), build a phrase from tiles
  - Fill in the blank, tile translation both ways, listen and tap, pick the best reply, match pairs
  - Missed cards come back 3–4 cards later as an easier exercise
- **Motivation:** XP, daily goal, streak, known-word counts, 7-day chart, session summary.

### 2.4 Admin console today (`admin.html`)

- Edit or add words and phrases:
  - English, Gurmukhi (on-screen keyboard), sounds-like spelling (auto-suggested), accepted alternatives, notes.
  - "Teacher-checked" flag; hide a card; choose where it goes in the order.
- **Record audio** in the browser. It's converted to a trimmed 16 kHz WAV and used for everyone.
- Tune the computer voice per card: language, speed, "say it as".
- Changes are kept as a draft per browser, with a live preview in the app.
- **Publish** commits `data/custom.js` and audio to GitHub with a personal fine-grained token. A setup link lets a second device publish.
- **Limits:**
  - No user accounts or roles.
  - No review states, sign-off, comments, history, or per-reviewer queues.
  - One shared publish token.
  - Drafts are stuck in one browser.
  - No way to review the generated sentences.

### 2.5 Lessons learned from the prototype (carry forward)

1. **Item IDs must be stable.** Progress is keyed by a slug of the original English. Editing a card's text must never change its ID. The new system should use opaque IDs plus a `legacy_id` for migration.
2. **Show progress.** Users felt stuck even when practicing daily. Fixes that worked: XP and daily goal, visible counts, weekly unlock, placement, and a manual "next lesson" button.
3. **Wrong answers must be plausible.** Use the same category or group.
4. **Letter quizzes:** don't show the Gurmukhi letter name (it contains the letter). Show the romanized name plus audio.
5. **Writing checks were too strict at first.** Tolerances were loosened: trace coverage 0.55 (kid) / 0.6 (adult), freehand top-4 / top-3.
6. **Answer screens:** wait for a tap (or an optional countdown); never auto-advance.
7. **Gendered phrases:** show the man's form, accept the woman's, and give both in a note.
8. **Device TTS for Punjabi is unreliable.** Native recordings are the real fix. Cloud TTS (`pa-IN`) is a stopgap.
9. **Speech recognition:** `pa-IN` with English fallback, matched on a forgiving phonetic key. Kids pass at 55% similarity, adults at 65%.
10. **The learner rarely starts at zero.** Lessons mirror a weekly class: 2–3 letters, ~20 words and phrases.

### 2.6 Known gaps (from reviewing against the Duolingo Method)

- **No vowel signs (laga-matra):** ਿ ੀ ੁ ੂ ੇ ੈ ੋ ੌ ਂ ੰ ੱ and subjoined letters. These are required to read anything.
- No grammar teaching by contrast (gender agreement, verb tenses, postpositions) and no error tips.
- Units are themed word lists, not real-world tasks ("Greet elders", "Eat langar"). No level framework.
- No stories or characters. No leaderboards or friends. No push reminders.
- Simple Leitner review with no per-item difficulty. A better model exists: half-life regression, published by Duolingo.
- No accounts or sync, no analytics, no A/B testing.

---

## 3. Target product (v1.0)

### 3.1 Platforms and recommended stack

| Layer | Recommendation | Why |
|---|---|---|
| Mobile app | **React Native + Expo (TypeScript)**, Expo Router, EAS Build/Submit | One codebase for iOS and Android. The existing JS logic ports directly. Over-the-air updates. |
| Drawing pad | `@shopify/react-native-skia` | Smooth tracing; port `trace.js` scoring |
| Audio | `expo-audio`, pre-recorded files from a CDN, cached offline | Native recordings first, cloud TTS as fallback |
| Speech recognition | `expo-speech-recognition` (on-device). Cloud fallback: Google Speech-to-Text `pa-Guru-IN` | **Verify `pa-IN` support on iOS early.** If iOS lacks it, use the cloud fallback or English-keyed matching as today. |
| Backend | **Supabase**: Postgres, Auth, Storage, Row-Level Security, Edge Functions | Roles for the content workflow, learner sync, audio storage, cheap at our scale. Firebase is the alternative. |
| Content Studio (admin) | Web app (Vite + React + TypeScript) on the same Supabase project; mobile-friendly | Reviewers and voice talent can work from a phone or laptop |
| Payments | **RevenueCat** (App Store and Play subscriptions, family sharing) plus Stripe for web and school invoices | Handles both stores' subscriptions and entitlements |
| Analytics / errors | PostHog (events, funnels, A/B flags) and Sentry | Duolingo-style iteration needs data from day one |
| Cloud TTS (stopgap) | Google Cloud TTS `pa-IN` voices, pre-generated at publish | Replaced item by item as native recordings are approved |

**Monorepo layout (suggested):**

```
apps/mobile      Expo app
apps/studio      Content Studio web app
packages/core    engine, model builder, placement, matcher, tracing scorer (pure TS, unit-tested)
packages/content seed data, import/export scripts, content-pack builder
supabase/        migrations, RLS policies, edge functions
```

Port `engine.js`, `model.js`, `speech.js` (matcher only) and `trace.js` (scorer) into `packages/core` first, with the existing tests. That logic is proven and platform-independent.

### 3.2 Learner app v1.0 scope

- **Accounts:**
  - A parent or adult account with up to 6 learner profiles (family).
  - Kid profiles have no login, chat or ads (COPPA / GDPR-K).
  - Sign in with Apple and Google, plus email.
  - In-app account deletion (an App Store requirement).
- **Sync and offline:** progress syncs across devices (Supabase) and works offline. A learner can download lesson content packs and audio.
- **Path:**
  - Units mapped to beginner levels, each named for a real task, with the existing 38 lessons regrouped into them.
  - A new **vowel-signs unit** after the consonants.
  - A Gurdwara track.
- **Learning features:**
  - Every prototype exercise type is ported, plus grammar-contrast exercises with short plain-English tips after mistakes.
  - Placement test, streak (with a freeze), XP, daily goal, family leaderboard, reminders (push notifications).
  - Stories: 5–10 short illustrated read-and-listen stories with recurring characters, such as a family in Amritsar.
- **Audio:** native recordings for every published card, with a slow version for phrases.
- **Paywall (RevenueCat):** free core path, Premium, and a family plan.

### 3.3 Content Studio v1.0 (for native speakers)

The heart of quality. Replaces `admin.html`.

**Roles** (Supabase Auth + RLS):

| Role | Can |
|---|---|
| Owner/Admin | Everything: invite users, assign roles, publish releases, edit the curriculum and order |
| Editor | Create and edit drafts, import spreadsheets, write notes, request review |
| Reviewer (native speaker) | Review, comment, approve or request changes on language fields; suggest edits |
| Religious reviewer | Required second sign-off for items tagged `gurbani` / `gurdwara` |
| Voice talent | Record takes for assigned items, re-record when asked |
| Teacher (later) | Read-only content plus class dashboards |

**Item lifecycle:**

```
draft → in_review → changes_requested ⟲ → approved_text → recording → approved_audio → ready → published (in a release)
```

- **Per-field sign-off:**
  - Gurmukhi spelling
  - English meaning
  - Romanization
  - Accepted alternatives
  - Gender/register note
  - Cultural fit
- Every field must be ✓ by a reviewer before `approved_text`.
- **Two-person rule:**
  - Gurbani/Gurdwara items need a religious reviewer.
  - Any item edited after approval goes back to review.
- **Generated sentences and conversations** go through the same queue, so reviewers check the actual sentences learners see, not only the words.
- **Batch mode:**
  - A fast swipe/keyboard review UI: approve, flag, edit inline. Target 60–100 cards per hour.
  - Audio auto-plays.

**Recording:**

- **Recording sessions:** an assigned queue of approved-text items. Record, play back, and re-take. Keep multiple takes and mark the best one.
- **Processing:** automatic silence trim and loudness normalization (target about −16 LUFS), stored as compressed audio (AAC/Opus) plus the original WAV.
- **Voices:** male and female, adult and child, with slow takes for phrases.
- **Audio review:** a second native speaker approves the take, checking clarity, correct word, accent and background noise.

**Collaboration and accountability:**

- Comment threads per item; @mention; side-by-side diff.
- Full audit history: who changed, approved or recorded what, and when.
- A contributor dashboard of items reviewed and recorded and hours. Used to credit and pay contributors.

**Imports and curriculum:**

- Import the teacher's spreadsheet (`.xlsx`/CSV), then de-duplicate against existing items.
- Curriculum editor: units, lessons and their order, tags (category, level, grammar point, `gurbani`).

**Releases:**

- Publish an approved set as a versioned **content pack** (JSON + audio manifest on a CDN).
- The app downloads only the differences.
- Roll back a release.
- Item IDs never change. A retired item is hidden, never deleted, so learner progress survives.

**Quality dashboard:** percent of the curriculum verified and recorded per unit, plus items blocking the next release.

### 3.4 Data model sketch

```
users(id, role[], display_name)                     -- studio users
items(id uuid, legacy_id, kind[letter|vocab|phrase|sentence|conversation|story_line],
      en, pa, rom, pa_alts[], rom_alts[], note, gender_forms jsonb,
      category, phrase_group, tags[], level, status, version, created_by, updated_at)
item_field_reviews(item_id, field, reviewer_id, verdict[ok|change], comment, item_version, at)
recordings(id, item_id, speaker_id, take_no, storage_path, duration, lufs, is_slow, status, reviewed_by)
comments(id, item_id, user_id, body, resolved, at)
units(id, title, can_do, level, order) · lessons(id, unit_id, order) · lesson_items(lesson_id, item_id, order)
releases(id, version, notes, published_by, at) · release_items(release_id, item_id, item_version, recording_id)
audit_log(id, actor, action, entity, entity_id, before jsonb, after jsonb, at)
-- learner side
accounts(id, plan, store_customer_id) · learners(id, account_id, name, type[kid|adult], settings jsonb)
item_progress(learner_id, item_id, box, due, seen, right, wrong, days[], last, ...)
events(learner_id, type, item_id, exercise, correct, ms, at)   -- feeds analytics and the future review model
```

---

## 4. Timeline

Assumptions: Drew part-time with Claude doing most of the coding, and 1–3 native-speaker reviewers plus 1–2 voice talents available a few hours a week. **Content review is the critical path, so start it in week 2.**

| Phase | Weeks | Deliverables | Exit criteria |
|---|---|---|---|
| **0. Foundations** | 1–2 | Monorepo, Expo app shell, Supabase project, `packages/core` ported with the existing tests, current content imported into Postgres with `legacy_id`, CI (lint, test, EAS preview builds) | Tests pass in TS; the seeded database matches the prototype counts (35 / 760 / 288 / 38) |
| **1. Content Studio v1** | 2–6 | Roles and invites, item lifecycle, per-field sign-off, batch review UI, recording sessions with take management and audio processing, comments, audit log, spreadsheet import, release builder (content pack + CDN) | Reviewers verify and record lessons 1–5 end to end, and a release is consumed by the app |
| **Content review (ongoing)** | 2 → launch | Native review of all words, phrases and sentences; recordings for all published cards | Launch gate: lessons 1–20 at 100% verified and recorded; the rest verified before it unlocks |
| **2. Mobile MVP (parity)** | 4–10 | Accounts and family profiles, sync and offline, path and lessons, all exercise types, tracing in Skia, recorded audio, speech recognition, placement, XP, streak, daily goal, progress, settings | A private TestFlight / Play internal test used daily by the family for 2 weeks without blocking bugs |
| **3. Curriculum upgrades** | 8–12 | Vowel-signs unit; task-based units with level tags; grammar-contrast exercises and error tips (gender, present tense, postpositions); 5 stories with characters; family leaderboard and reminders | Placement covers the new units; vowel-sign reading accuracy is measured in the beta |
| **4. Monetization and launch prep** | 10–14 | RevenueCat paywall (free / Premium / family), PostHog events and funnels, Sentry, privacy policy, kid-safe settings, store listings and screenshots, closed beta with 20–50 Gurdwara-class families | Beta: day-7 retention ≥ 30%; crash-free sessions ≥ 99.5%; store review approved |
| **5. Public launch v1.0** | 15–16 | App Store and Play release, landing page, launch with Gurdwaras and Punjabi classes | — |
| **6. Growth** | Months 4–9 | Teacher/school dashboard (class codes, assignments, reports), tutor booking (commission), adaptive review model and difficulty estimates, A/B testing, more stories, intermediate content (past/future tense, conversation units), packs (Meet the in-laws, Wedding, Trip to Punjab); consider Shahmukhi later | — |

**Content effort estimate** (for planning reviewer and voice time):

- **Text review:**
  - About 1,100 words and phrases at 60–100 per hour ≈ **12–20 reviewer-hours**.
  - About 1,250 sentences ≈ **15–25 hours**.
  - Religious review of about 90 Gurdwara items ≈ **2–3 hours**.
- **Recording:**
  - About 1,100 cards plus about 290 slow phrase takes at 60–100 clips per hour ≈ **15–25 hours per voice**.
  - Audio review ≈ half the recording time.

---

## 5. Revenue model (for planning paywall and entitlements)

1. **Family subscription (primary):**
   - Free core path. Premium about $6.99/month or $49.99/year; family plan about $79.99/year for up to 6 learners.
   - Premium adds unlimited practice, offline packs, stories, parent reports, and no session limits.
2. **Schools and Gurdwara classes:** teacher dashboard and class codes. About $300–1,000 per school per year, or $2–3 per student per month (Stripe invoices).
3. **Tutor marketplace:** book native tutors in the app (starting with the current teacher); 15–20% commission.
4. **One-time packs, $15–25:** Meet the In-laws, Wedding Season (Anand Karaj), Trip to Punjab.
5. **Gurbani/Gurdwara content stays free**, with donations or a "sponsor a learner" (seva / dasvandh) option, sponsors and grants. Paywalling sacred content risks backlash.
6. **Later:** a proficiency certificate for school or heritage credit.

**No ads**, because kids are users. Store fees are 15–30%, and the small-business programs (15%) apply at the start.

---

## 6. Store and compliance checklist

- [ ] Apple Developer ($99/yr) and Google Play ($25 one-time) accounts in the business's name
- [ ] Sign in with Apple, required if Google sign-in is offered
- [ ] In-app account deletion
- [ ] Privacy policy, data-safety form (Play) and privacy labels (App Store)
- [ ] Kids: parent-gated purchases and settings; no third-party ads or tracking in kid profiles; COPPA/GDPR-K review
- [ ] Microphone permission strings; speech data disclosure (on-device vs cloud)
- [ ] Contributor agreement for reviewers and voice talent: audio and text rights assigned to the app, plus credit and pay terms
- [ ] Content licensing: the teacher's material used with permission

---

## 7. Open decisions (settle early in the new session)

1. App name and brand (domain, store availability).
2. Supabase vs Firebase. The recommendation is Supabase, because of relational content, the review workflow and row-level security.
3. Standard dialect and spelling conventions for reviewers. Suggested: standard Majhi / Amritsar, the teacher's region. Write a short **style guide**: spelling (ਗੁਰਦੁਆਰਾ vs ਗੁਰਦਵਾਰਾ), romanization scheme, gender notes, respectful forms (ਤੁਸੀਂ / ਜੀ).
4. Romanization scheme: keep the prototype's friendly "sounds-like" style (`kuk-kaa`, `tu-see(n)`)? It is learner-friendly but not standard.
5. Who the reviewers and voice talent are, and how they're paid or credited.
6. Keep a web version of the learner app? (Expo can export web; useful for schools.)
7. iOS on-device Punjabi speech recognition support. Test in week 1 to choose on-device vs cloud.

---

## 8. Instructions for the next session

1. Clone `prognar/Punjabi-Flash-Cards`. Read `ROADMAP.md` (this file) and `LESSONS.md`, then skim `js/engine.js`, `js/model.js`, `js/speech.js` and `js/trace.js`.
2. Run the prototype locally (`python3 -m http.server`, open `index.html` and `admin.html`) to see the current behavior.
3. Start Phase 0:
   - Create the monorepo (in a new repo or a `v2/` folder; decide with Drew).
   - Port the core logic to TypeScript with the existing tests.
   - Write the Supabase migrations from §3.4.
   - Write an import script that loads `data/content.js`, `data/sentences.js` and `data/custom.js` into Postgres, preserving `legacy_id` (the prototype's slug IDs).
4. Then build the Content Studio (Phase 1) before the mobile UI, so native-speaker review can begin while the app is being built.
5. Keep the GitHub Pages prototype running for the family until the mobile beta replaces it.
