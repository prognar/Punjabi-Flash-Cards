# Punjabi Lessons (index.html)

Each lesson follows the same order as class: **letters → words → phrases**. Every learner's progress is tracked separately. The original game is still in `gurmukhi-game.html`, linked from the start screen.

## Running it
Open `index.html` in Chrome or Edge, or serve the folder (GitHub Pages works). There's no build step.
Speech recognition needs Chrome or Edge. Microphone access needs `https://` or `localhost`. If you open the file directly with `file://`, mic access may be blocked.

## Lesson structure
| Per lesson | Default |
|---|---|
| Letters | 2 and 3, alternating (all 35 letters are covered in 14 lessons) |
| Words | 10, in alphabetical order, the same as the class list |
| Phrases | 7, in the teacher's order |

Lesson sizes are set in `perLesson` in `data/content.js`.

## Learners
- Each learner has a **Kid** or **Adult** profile:
  - **Kid:** 12-card sessions, more forgiving speech and writing checks, more celebration.
  - **Adult:** 20 cards, stricter checks.
- **"Already covered in class up to lesson N"** unlocks lessons up to that point. Items from earlier lessons are still introduced and then reviewed.
- Progress is stored in the browser. Use **Backup & settings** to download or restore it, or to move it to another device.

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
  - 90% of the lesson mastered,
  - at least 80% in each section, and
  - review accuracy of at least 70%.
- **Simulated pace** (`tests/engine.test.js`): about 3 days per lesson for a strong learner, about 6 for an average one, and about 10 or more for a struggling one.

## Exercises
| | New | Learning | Stronger |
|---|---|---|---|
| Letters | Intro with picture words | Find the letter / name the letter, **trace** | Which letter does the picture word start with, **write from memory** |
| Words & phrases | Intro | Pick the Punjabi / pick the English | **Say it** (mic or reveal and self-check), put the words in order (phrases) |

**Writing check:**
- **Trace mode** checks how much of the letter the ink covers and how much of the ink stays on the letter.
- **Freehand mode** resizes the drawing and compares it with all 35 letters. It passes only when the target letter is one of the closest matches. In testing, simulated handwriting passed about 92–96% of the time and random scribbles 0%.
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
