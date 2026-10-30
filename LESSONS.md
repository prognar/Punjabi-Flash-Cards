# Punjabi Lessons (index.html)

Each lesson follows the same order as class: **letters → words → phrases**. Every learner's progress is tracked separately. The original game is still in `gurmukhi-game.html`, linked from the start screen.

## Running it
Open `index.html` in Chrome or Edge, or serve the folder (GitHub Pages works). There's no build step.
Speech recognition needs Chrome or Edge. Microphone access needs `https://` or `localhost`. If you open the file directly with `file://`, mic access may be blocked.

## Lesson structure
| Per lesson | Default |
|---|---|
| Letters | 2 and 3, alternating (all 35 letters are covered in 14 lessons) |
| Words | 20 — the teacher's words first, then everyday words grouped by category (questions, numbers, colors, food, everyday items, people, time & days, action words…) |
| Phrases | 8, in the teacher's order |

Lesson sizes are set in `perLesson` in `data/content.js`.

## Learners
- Each learner has a **Kid** or **Adult** profile:
  - **Kid:** 12-card sessions, more forgiving speech and writing checks, more celebration.
  - **Adult:** 20 cards, stricter checks.
- **"Already covered in class up to lesson N"** unlocks lessons up to that point. Items from earlier lessons are still introduced and then reviewed.
- Progress is stored in the browser. Use **Backup & settings** to download or restore it, or to move it to another device.

## Keep going
- **Practice by category**: home screen → any category (Colors, Numbers, Food & drink, Everyday items…) or phrase group. Cards there can be learned any time, even before your lessons reach them, and the progress counts toward lessons.
- **"Class has moved on? Start lesson N"** on the home screen opens the next lesson whenever you want. Unmastered cards keep coming back in review.

## How review and mastery work
- **Spacing:** each card has a level from 0 to 6.
  - A correct answer pushes the card further out: 8 hours, then 1, 3, 7, 16 and 35 days.
  - A wrong answer drops it a level and makes it due again right away. It also comes back 3–4 cards later in the same session, using an easier exercise.
- **The level climbs at most one step per day** (two on the first day). So "mastered" always means the card was remembered on separate days.
- **Mastery adjusts with skill**, based on the last 40 answers:
  - **Strong (90% or more):** level 2 on 2 different days counts as mastered.
  - **Normal:** level 3 on 2 days.
  - **Struggling (under 70%):** level 3 on 3 days.
- **Review share** in a session is 25% when strong, 40% normally and 60% when struggling. Review picks overdue, unmastered and recently missed cards first.
- **New cards per session** are capped (4 for kids, 6 for adults). The cap is halved when a learner is struggling, and drops to 1 when 8 or more cards in the current lesson are still shaky.
- **Unlocking the next lesson** requires:
  - 80% of the lesson mastered,
  - at least 60% in each section, and
  - review accuracy of at least 60%.
  (Or start the next lesson yourself — see Keep going.)
- **Simulated pace** (`tests/engine.test.js`): about 3 days per lesson for a strong learner, about 6 for an average one, and about 10 or more for a struggling one.

## Duolingo-style practice (sentences & conversations)
`data/sentences.js` adds practice in context:
- **Pick the missing word**: a Punjabi sentence with one word blanked out, plus the English meaning.
- **Write it in Punjabi / English**: build the sentence from word tiles. Extra decoy tiles are mixed in.
- **Pick the best reply**: someone says something in Punjabi and you choose the right response (25 short conversations).
- **Tap what you hear**: audio only.
- **Match the pairs**: one round per session, using words you've met.
- **Tap any word in a sentence** to see its meaning.
- **Repetition**: each word being learned comes back 2–3 times per session, each time in a different exercise. Slips on those repeat cards cost less than a fresh miss.
- **Pattern sentences**: built automatically for each word from its class (thing, animal, food, adjective, verb…). For example, "Where is the ___?", "Give me the ___", "I like ___". Hand-written sentences cover the rest.
- **Coverage**: about 130 of 150 words and 84 of 104 phrases have sentences; the rest use the flash-card style exercises.
- **All sentence Punjabi was written for the app** — have the teacher check it.

## Admin console (admin.html)
Open it from **Backup & settings → Admin**, or go to `/admin.html`.
- **Add or edit words and phrases**: English, Gurmukhi (there's an on-screen ⌨ keyboard and a Google Translate link), sounds-like spelling, other accepted answers, a note for the card, and whether the teacher has checked it. You can also hide a card.
- **Sounds-like**: leave it empty and it's filled in from the Gurmukhi, or press "Use this" on the suggestion.
- **Where new cards go**: by default into the next class slot, after the teacher's latest card and before the generated filler words. You can also pick a spot.
- **How it sounds**:
  - Play it the way learners will hear it.
  - **Record your own voice**. A recording is used for everyone and is the surest fix.
  - Or tune the computer voice: force Punjabi, Hindi or English, change the speed, or give the voice a different spelling to read ("Say it as").
- **Letters**: you can fix each letter's sounds-like name, sound hint and pronunciation.
- **Draft and preview**: changes stay as a draft in that browser. Tick "Preview…" to see them in the app on that device.
- **Publish**: writes `data/custom.js` (plus any recordings into `data/audio/`) to GitHub using a fine-grained token with Contents: read & write on this repo. The token is stored only in that browser. Everyone sees the changes once the site updates.
- **No token?** "Download custom.js" lets you replace the file by hand. Recordings can only be published with the token.
- **Learner progress is safe**: it's tied to each card's id, so editing a card's English doesn't reset anyone's progress on it.

## Exercises
| | New | Learning | Stronger |
|---|---|---|---|
| Letters | Intro with picture words | Find the letter / name the letter, **trace** | Which letter does the picture word start with, **write from memory** |
| Words & phrases | Intro | Pick the Punjabi / pick the English | **Say it** (mic or reveal and self-check), put the words in order (phrases) |

**Writing check:**
- **Trace mode** checks how much of the letter the ink covers and how much of the ink stays on the letter.
- **Freehand mode** resizes the drawing and compares it with all 35 letters. It passes only when the target letter is one of the closest matches. In testing, simulated handwriting passed about 97–99% of the time and random scribbles about 3%.
- After a miss, the app shows which letter the drawing looked like.

## Speech
- **Recognition:** the app tries **Punjabi (`pa-IN`)** first, which returns Gurmukhi text. If that isn't available it falls back to English recognition and matches against the English-sounds spelling.
- **Matching:** both the Gurmukhi and the spelling are reduced to a forgiving phonetic key. For example, "gaind", "gend", "gained" and ਗੇਂਦ all match. The pass threshold is 55% similarity for kids and 65% for adults.
- **Playback:** uses a Punjabi voice if the device has one. Otherwise a Hindi voice reads the same text converted to Devanagari (a close match), and as a last resort an English voice reads the spelling.

## Adding content from class
Edit `data/content.js`. Each row is `[english, gurmukhi, sounds-like, {options}]`. Progress is keyed by the English text, so reordering rows is safe.
- `src: 'teacher'` marks items from her sheet. `src: 'generated'` marks words added to extend the list; replace those as the teacher covers new letters.
- `check: '...'` shows an "ask teacher" note on the card. These are currently set on the questionable entries from the sheet (*away*, *uncle – mom's sister's husband*, *see you later*, *I am not sure*).
- All Gurmukhi was added here because the sheet only had romanization. Have the teacher check it.

## Tests
```
node tests/speech.test.js   # phonetic matcher
node tests/engine.test.js   # spacing, mastery gate, simulated learners
```
