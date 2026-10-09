global.window = global;
require('../data/content.js'); require('../js/model.js'); require('../js/engine.js');
const E = window.ENGINE, M = window.MODEL;
let T = new Date('2026-10-01T18:00:00').getTime();
E._setClock(() => T);
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

function simulate(type, accuracy, days, sessionsPerDay) {
  const prof = { type, settings: Object.assign({}, E.PROFILE_DEFAULTS[type]) };
  const pr = { items: {}, unlocked: 1, history: [], days: {} };
  const unlockDays = [];
  let reviewShares = [];
  for (let d = 0; d < days; d++) {
    for (let s = 0; s < sessionsPerDay; s++) {
      const { queue, info } = E.buildSession(pr, prof, M, 'all');
      reviewShares.push(info.reviewCount / Math.max(1, queue.length));
      for (let i = 0; i < queue.length; i++) {
        const c = queue[i];
        if (c.ex === 'intro') { E.markIntroduced(pr, c.id); continue; }
        const ok = Math.random() < accuracy;
        E.record(pr, c.id, ok, c.ex, c.review);
        if (!ok) E.requeueMiss(queue, i, c, M);
        T += 20e3;
      }
      if (E.maybeAdvance(pr, M.lessons)) unlockDays.push(d + 1);
      T += 2 * 3600e3;
    }
    T = new Date(new Date(T).toDateString()).getTime() + 86400e3 + 18 * 3600e3;
  }
  return { pr, unlockDays, avgReview: reviewShares.reduce((a, b) => a + b, 0) / reviewShares.length, skill: E.skill(pr), req: E.masteryRequirement(pr) };
}

const strong = simulate('adult', 0.97, 30, 2);
console.log('strong adult  unlocked', strong.pr.unlocked, 'days', strong.unlockDays.join(','), 'req', strong.req.label, 'avgReviewShare', strong.avgReview.toFixed(2));
const kid = simulate('kid', 0.85, 30, 2);
console.log('average kid   unlocked', kid.pr.unlocked, 'days', kid.unlockDays.join(','), 'req', kid.req.label, 'avgReviewShare', kid.avgReview.toFixed(2));
const weak = simulate('kid', 0.68, 30, 2);
console.log('struggling kid unlocked', weak.pr.unlocked, 'days', weak.unlockDays.join(','), 'req', weak.req.label, 'avgReviewShare', weak.avgReview.toFixed(2));

assert(strong.pr.unlocked > kid.pr.unlocked, 'strong learner advances faster than average');
assert(kid.pr.unlocked > weak.pr.unlocked, 'average learner advances faster than struggling');
assert(strong.unlockDays[0] >= 2, 'no unlock on day 1 (needs 2 separate days)');
assert(weak.pr.unlocked > 1, 'struggling learner still progresses');
assert(E.buildSession(weak.pr, {type:'kid',settings:E.PROFILE_DEFAULTS.kid}, M).info.reviewShare > E.buildSession(strong.pr, {type:'adult',settings:E.PROFILE_DEFAULTS.adult}, M).info.reviewShare, 'struggling learner gets a bigger review share');
assert(weak.req.days > strong.req.days || weak.req.box > strong.req.box, 'struggling learner needs more reps for mastery');

// single item: 2 boxes max on first day, 1/day after
T = new Date('2026-11-01T10:00:00').getTime();
const pr = { items: {}, unlocked: 1, history: [], days: {} };
for (let i = 0; i < 6; i++) E.record(pr, 'l1', true, 'pick-letter');
assert(pr.items.l1.box === 2, 'box capped at 2 on first day (got ' + pr.items.l1.box + ')');
T += 86400e3; for (let i = 0; i < 4; i++) E.record(pr, 'l1', true, 'pick-letter');
assert(pr.items.l1.box === 3, 'box +1 on day 2 (got ' + pr.items.l1.box + ')');
E.record(pr, 'l1', false, 'pick-letter');
assert(pr.items.l1.box === 2 && pr.items.l1.due <= T, 'miss drops box and makes it due now');

// requeue
const q = [{ id: 'l1', ex: 'trace' }, { id: 'l2', ex: 'x' }, { id: 'v-age', ex: 'x' }, { id: 'v-arm', ex: 'x' }, { id: 'v-air', ex: 'x' }];
E.requeueMiss(q, 0, q[0], M);
const idx = q.findIndex((c, i) => i > 0 && c.id === 'l1');
assert(idx >= 3 && q[idx].ex === 'pick-letter', 'miss re-asked 3–4 cards later with easier exercise');

// first session touches every section
const prof = { type: 'kid', settings: Object.assign({}, E.PROFILE_DEFAULTS.kid) };
const s0 = E.buildSession({ items: {}, unlocked: 1, history: [], days: {} }, prof, M, 'all');
const kinds = new Set(s0.queue.filter(c => c.ex === 'intro').map(c => M.items[c.id].kind));
assert(kinds.size === 3, 'first session introduces letters, words and phrases: ' + s0.queue.map(c => c.id + ':' + c.ex).join(' '));
