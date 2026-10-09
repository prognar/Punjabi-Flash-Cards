/*
 * Learning engine: profiles, per-item progress, spaced review, mastery gate, session builder.
 * Pure logic (no DOM) so it can be unit tested in Node.
 */
(function (root) {
  const DAY = 864e5, HOUR = 36e5;
  // Spacing after a correct answer, by box (0..6)
  const INTERVALS = [0, 8 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
  const MAX_BOX = 6;

  let clock = () => Date.now();
  const now = () => clock();
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  const PROFILE_DEFAULTS = {
    kid:   { sessionSize: 12, maxNew: 4, autoNext: 0, showGurmukhi: true, showRoman: true, speech: true, writing: true },
    adult: { sessionSize: 20, maxNew: 6, autoNext: 0, showGurmukhi: true, showRoman: true, speech: true, writing: true }
  };

  // ---------------------------------------------------------------- storage
  const mem = {};
  const storage = {
    get(k) { try { const v = root.localStorage.getItem(k); return v == null ? mem[k] ?? null : v; } catch (e) { return mem[k] ?? null; } },
    set(k, v) { mem[k] = v; try { root.localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ } },
    del(k) { delete mem[k]; try { root.localStorage.removeItem(k); } catch (e) {} }
  };
  const KEY = 'pfc.lessons.v1';
  const pkey = id => KEY + '.p.' + id;

  const Store = {
    _db: null,
    db() {
      if (!this._db) {
        try { this._db = JSON.parse(storage.get(KEY)) || null; } catch (e) { this._db = null; }
        if (!this._db) this._db = { profiles: [], activeId: null };
      }
      return this._db;
    },
    save() { storage.set(KEY, JSON.stringify(this.db())); },
    profiles() { return this.db().profiles; },
    profile(id) { return this.profiles().find(p => p.id === id) || null; },
    active() { return this.profile(this.db().activeId); },
    setActive(id) { this.db().activeId = id; this.save(); },
    addProfile({ name, avatar, type }) {
      const id = 'u' + Math.random().toString(36).slice(2, 9);
      const p = { id, name, avatar: avatar || '🙂', type: type === 'adult' ? 'adult' : 'kid', created: now(),
        settings: Object.assign({}, PROFILE_DEFAULTS[type === 'adult' ? 'adult' : 'kid']) };
      this.profiles().push(p); this.save();
      return p;
    },
    updateProfile(id, patch) {
      const p = this.profile(id); if (!p) return;
      if (patch.settings) { Object.assign(p.settings, patch.settings); delete patch.settings; }
      Object.assign(p, patch); this.save();
    },
    deleteProfile(id) {
      const db = this.db(); db.profiles = db.profiles.filter(p => p.id !== id);
      if (db.activeId === id) db.activeId = null;
      storage.del(pkey(id)); this.save();
    },
    progress(id) {
      let pr = null;
      try { pr = JSON.parse(storage.get(pkey(id))); } catch (e) {}
      return Object.assign({ items: {}, unlocked: 1, history: [], days: {}, streakDays: 0 }, pr || {});
    },
    saveProgress(id, pr) { storage.set(pkey(id), JSON.stringify(pr)); },
    exportAll() {
      const out = { app: 'punjabi-lessons', version: 1, exported: new Date(now()).toISOString(), profiles: [] };
      this.profiles().forEach(p => out.profiles.push({ profile: p, progress: this.progress(p.id) }));
      return out;
    },
    importAll(data) {
      if (!data || data.app !== 'punjabi-lessons' || !Array.isArray(data.profiles)) throw new Error('Not a Punjabi Lessons backup file');
      const db = this.db();
      data.profiles.forEach(({ profile, progress }) => {
        db.profiles = db.profiles.filter(p => p.id !== profile.id);
        db.profiles.push(profile);
        this.saveProgress(profile.id, progress);
      });
      this.save();
      return data.profiles.length;
    }
  };

  // ---------------------------------------------------------------- item state
  function st(pr, id) {
    return pr.items[id] || (pr.items[id] = { box: 0, seen: 0, right: 0, wrong: 0, streak: 0, last: 0, due: 0, days: [], intro: false, boxDay: '', writes: 0 });
  }
  const peek = (pr, id) => pr.items[id] || null;

  function markIntroduced(pr, id) {
    const s = st(pr, id); s.intro = true; s.last = now(); s.due = now();
  }

  /** Record an answer. Box can climb at most one step per calendar day (two on the first day),
   *  so "mastered" always means remembered across separate days. */
  function record(pr, id, ok, ex, isReview) {
    const s = st(pr, id), t = now(), today = dayKey(t);
    s.intro = true; s.seen++; s.last = t;
    if (ok) {
      s.right++; s.streak++;
      const firstDay = !s.days.length || (s.days.length === 1 && s.days[0] === today);
      if (s.boxDay !== today) s.gainsToday = 0;
      const allowed = firstDay ? 2 : 1;
      if ((s.gainsToday || 0) < allowed && s.box < MAX_BOX) { s.box++; s.gainsToday = (s.gainsToday || 0) + 1; s.boxDay = today; }
      if (!s.days.includes(today)) { s.days.push(today); if (s.days.length > 8) s.days.shift(); }
      s.due = t + INTERVALS[s.box];
      if (ex === 'trace' || ex === 'write') s.writes++;
      if (!s.everMastered && isMastered(pr, id)) s.everMastered = true; // counts toward unlocking even if it slips later (review keeps it alive)
    } else {
      s.wrong++; s.streak = 0;
      s.box = s.box >= 4 ? 2 : Math.max(0, s.box - 1);
      s.due = t; s.lastWrong = t;
    }
    pr.history.push({ t, id, ok: !!ok, ex, r: !!isReview });
    if (pr.history.length > 600) pr.history.splice(0, pr.history.length - 600);
    const dk = dayKey(t);
    pr.days[dk] = (pr.days[dk] || 0) + 1;
    return s;
  }

  // ---------------------------------------------------------------- skill + mastery
  /** Rolling accuracy over the last N graded answers. */
  function skill(pr, n = 40) {
    const h = pr.history.filter(x => x.ex !== 'intro').slice(-n);
    if (h.length < 8) return { acc: 0.8, n: h.length, level: 'normal' };
    const acc = h.filter(x => x.ok).length / h.length;
    return { acc, n: h.length, level: acc >= 0.9 ? 'strong' : acc < 0.7 ? 'struggling' : 'normal' };
  }
  function reviewAccuracy(pr, n = 20) {
    const h = pr.history.filter(x => x.r).slice(-n);
    return h.length ? h.filter(x => x.ok).length / h.length : null;
  }
  /** What "mastered" means right now for this learner: better learners need fewer repetitions. */
  function masteryRequirement(pr) {
    const { level } = skill(pr);
    if (level === 'strong') return { box: 2, days: 2, label: 'strong' };
    if (level === 'struggling') return { box: 3, days: 3, label: 'extra practice' };
    return { box: 3, days: 2, label: 'normal' };
  }
  function isMastered(pr, id, req) {
    const s = peek(pr, id); if (!s) return false;
    req = req || masteryRequirement(pr);
    return s.box >= req.box && s.days.length >= req.days;
  }
  function itemStatus(pr, id, req, forGate) {
    const s = peek(pr, id);
    if (!s || !s.intro) return 'new';
    return isMastered(pr, id, req) || (forGate && s.everMastered) ? 'mastered' : 'learning';
  }

  // ---------------------------------------------------------------- lessons
  const KINDS = ['letter', 'vocab', 'phrase'];
  function lessonStats(pr, L) {
    const req = masteryRequirement(pr);
    const out = { total: 0, mastered: 0, learning: 0, fresh: 0, kinds: {} };
    KINDS.forEach(k => {
      const ks = { total: L[k].length, mastered: 0, learning: 0, fresh: 0 };
      L[k].forEach(id => { const s = itemStatus(pr, id, req, true); ks[s === 'new' ? 'fresh' : s]++; });
      out.kinds[k] = ks;
      out.total += ks.total; out.mastered += ks.mastered; out.learning += ks.learning; out.fresh += ks.fresh;
    });
    out.pct = out.total ? out.mastered / out.total : 1;
    return out;
  }
  const GATE = { overall: 0.9, perKind: 0.8, review: 0.7 };
  function gateStatus(pr, lessons) {
    const L = lessons[pr.unlocked - 1];
    if (!L) return { ok: false, done: true };
    const s = lessonStats(pr, L);
    const kindsOk = KINDS.every(k => !s.kinds[k].total || s.kinds[k].mastered / s.kinds[k].total >= GATE.perKind);
    const ra = reviewAccuracy(pr);
    const reviewOk = pr.unlocked === 1 || ra === null || ra >= GATE.review;
    return { ok: s.pct >= GATE.overall && kindsOk && reviewOk, pct: s.pct, kindsOk, reviewOk, reviewAcc: ra, stats: s, last: pr.unlocked >= lessons.length };
  }
  function maybeAdvance(pr, lessons) {
    const g = gateStatus(pr, lessons);
    if (g.ok && pr.unlocked < lessons.length) { pr.unlocked++; return true; }
    return false;
  }

  // ---------------------------------------------------------------- exercises
  function multiWord(item) { return item.paAnswers[0].replace(/[?,.!]/g, '').trim().split(/\s+/).length >= 2; }
  function chooseExercise(item, s, profile, opts = {}) {
    const set = profile.settings || {};
    if (!s || !s.intro) return 'intro';
    const b = s.box, flip = (s.seen + (opts.salt || 0)) % 2 === 0;
    if (item.kind === 'letter') {
      if (b <= 0) return flip ? 'pick-letter' : 'name-letter';
      if (set.writing !== false && s.writes < 2) return 'trace';
      if (b === 1) return flip ? 'pick-letter' : 'name-letter';
      if (b === 2) return item.words.length && flip ? 'word-letter' : (set.writing !== false ? 'trace' : 'pick-letter');
      if (set.writing !== false && flip) return 'write';
      return item.words.length ? 'word-letter' : 'name-letter';
    }
    if (b <= 0) return 'mc-en2pa';
    if (b === 1) return flip ? 'mc-pa2en' : 'mc-en2pa';
    if (item.kind === 'phrase' && multiWord(item) && b >= 3 && flip) return 'build';
    return 'say';
  }
  /** Easier exercise used when re-asking a missed item later in the same session. */
  function retryExercise(item) { return item.kind === 'letter' ? 'pick-letter' : 'mc-en2pa'; }

  // ---------------------------------------------------------------- sessions
  function reviewShareFor(acc) { return acc < 0.7 ? 0.6 : acc > 0.9 ? 0.25 : 0.4; }

  /**
   * Build a practice queue.
   * scope: 'all' | 'letter' | 'vocab' | 'phrase' | 'review'
   * Returns { queue:[{id, ex, review}], info }
   */
  function buildSession(pr, profile, model, scope = 'all') {
    const set = profile.settings;
    const kinds = KINDS.includes(scope) ? [scope] : KINDS;
    const t = now();
    const { acc } = skill(pr);
    const req = masteryRequirement(pr);
    const size = set.sessionSize || 12;
    const cur = model.lessons[pr.unlocked - 1] || model.lessons[model.lessons.length - 1];
    const curIds = kinds.flatMap(k => cur[k]);
    const prevIds = model.lessons.slice(0, pr.unlocked - 1).flatMap(L => kinds.flatMap(k => L[k]));

    // --- review candidates: anything introduced from earlier lessons (+ current lesson items in review mode)
    const reviewPoolIds = scope === 'review' ? prevIds.concat(curIds) : prevIds;
    const scoreReview = id => {
      const s = peek(pr, id); if (!s || !s.intro) return -1;
      const overdue = (t - s.due) / Math.max(INTERVALS[s.box] || HOUR, HOUR); // >0 means due
      const mastered = isMastered(pr, id, req);
      const recentMiss = s.lastWrong && t - s.lastWrong < 3 * DAY ? 1.5 : 0;
      return (overdue > 0 ? 2 + Math.min(overdue, 3) : overdue) + (mastered ? 0 : 1.5) + recentMiss + (MAX_BOX - s.box) * 0.15 + Math.random() * 0.3;
    };
    const reviewRanked = reviewPoolIds.map(id => [id, scoreReview(id)]).filter(x => x[1] > -1).sort((a, b) => b[1] - a[1]);

    let reviewIds, currentIds = [], newIds = [];
    if (scope === 'review') {
      reviewIds = reviewRanked.filter(x => x[1] > 0.5).slice(0, size).map(x => x[0]);
    } else {
      // --- new items for this lesson (in teaching order); fewer when struggling or many still shaky
      const shaky = curIds.filter(id => itemStatus(pr, id, req) === 'learning').length;
      let maxNew = set.maxNew || 4;
      if (acc < 0.7) maxNew = Math.max(1, Math.floor(maxNew / 2));
      if (shaky >= 8) maxNew = Math.min(maxNew, 1);
      // earlier lessons first (catch-up after jumping ahead), then this lesson, in teaching order
      // (round-robin across letters / words / phrases so one session touches each section)
      const fresh = prevIds.concat(curIds).filter(id => !(peek(pr, id) || {}).intro);
      const byKind = kinds.map(k => fresh.filter(id => model.items[id].kind === k));
      newIds = [];
      for (let r = 0; newIds.length < maxNew && byKind.some(a => a.length); r++) {
        byKind.forEach(a => { if (a.length && newIds.length < maxNew) newIds.push(a.shift()); });
      }
      // --- items of current lesson already introduced: weakest / most due first
      currentIds = curIds.filter(id => (peek(pr, id) || {}).intro)
        .map(id => { const s = peek(pr, id); return [id, (isMastered(pr, id, req) ? 0 : 3) + (t >= s.due ? 2 : 0) + (MAX_BOX - s.box) * 0.3 + Math.random() * 0.4]; })
        .sort((a, b) => b[1] - a[1]).map(x => x[0]);
      const reviewTarget = reviewRanked.length ? Math.round(size * reviewShareFor(acc)) : 0;
      const currentSlots = Math.max(0, size - reviewTarget - newIds.length * 2); // each new item = intro + quiz
      currentIds = currentIds.slice(0, currentSlots);
      const reviewSlots = size - newIds.length * 2 - currentIds.length;
      reviewIds = reviewRanked.slice(0, Math.max(0, reviewSlots)).map(x => x[0]);
      // if review ran short, top up with more current practice
      const left = size - newIds.length * 2 - currentIds.length - reviewIds.length;
      if (left > 0) {
        const extra = curIds.filter(id => (peek(pr, id) || {}).intro && !currentIds.includes(id)).slice(0, left);
        currentIds = currentIds.concat(extra);
      }
    }

    // --- assemble: interleave review between current items, new item quiz 2–3 cards after its intro
    const mk = (id, review, ex) => ({ id, ex: ex || chooseExercise(model.items[id], peek(pr, id), profile, { salt: Math.floor(Math.random() * 2) }), review });
    const main = [];
    const cq = currentIds.map(id => mk(id, false));
    const rq = reviewIds.map(id => mk(id, true));
    while (cq.length || rq.length) {
      if (cq.length) main.push(cq.shift());
      if (rq.length) main.push(rq.shift());
      if (rq.length && rq.length > cq.length) main.push(rq.shift());
    }
    let queue = [];
    if (newIds.length) {
      // spread intros across the session; each followed by its first quiz a couple of cards later
      const gap = Math.max(2, Math.floor(main.length / (newIds.length + 1)));
      let mi = 0;
      newIds.forEach(id => {
        queue.push({ id, ex: 'intro', review: false });
        const before = main.slice(mi, mi + Math.min(2, gap)); mi += before.length;
        queue = queue.concat(before);
        queue.push({ id, ex: chooseExercise(model.items[id], { intro: true, box: 0, seen: 0, writes: 0 }, profile), review: false });
        const after = main.slice(mi, mi + Math.max(0, gap - 2)); mi += after.length;
        queue = queue.concat(after);
      });
      queue = queue.concat(main.slice(mi));
    } else queue = main;

    return {
      queue,
      info: { size, acc, reviewShare: reviewShareFor(acc), newCount: newIds.length, reviewCount: reviewIds.length, currentCount: currentIds.length, lesson: cur.n, req }
    };
  }

  /** After a miss, re-insert the item 3–4 cards later (max twice per session). */
  function requeueMiss(queue, pos, card, model) {
    card.retries = (card.retries || 0) + 1;
    if (card.retries > 2) return false;
    const at = Math.min(queue.length, pos + 3 + Math.floor(Math.random() * 2));
    queue.splice(at, 0, { id: card.id, ex: retryExercise(model.items[card.id]), review: card.review, retries: card.retries, retry: true });
    return true;
  }

  function touchStreak(pr) {
    const days = Object.keys(pr.days).sort();
    let streak = 0, d = new Date(now());
    for (;;) {
      const k = dayKey(d.getTime());
      if (pr.days[k]) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    pr.streakDays = streak;
    return { streak, totalDays: days.length };
  }

  root.ENGINE = {
    Store, storage, st, peek, record, markIntroduced, skill, reviewAccuracy, masteryRequirement, isMastered, itemStatus,
    lessonStats, gateStatus, maybeAdvance, chooseExercise, buildSession, requeueMiss, touchStreak, dayKey,
    INTERVALS, GATE, PROFILE_DEFAULTS, _setClock(fn) { clock = fn || (() => Date.now()); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
