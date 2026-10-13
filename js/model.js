/* Turns window.CONTENT into items + weekly lessons. */
(function () {
  const C = window.CONTENT;

  const slug = s => s.toLowerCase().replace(/\(.*?\)/g, m => m.replace(/[^a-z]/g, '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const splitAlts = s => s.split(/\s+\/\s+/).map(x => x.trim()).filter(Boolean);

  const items = {};
  const order = { letter: [], vocab: [], phrase: [] };

  C.letters.forEach(([glyph, name, nameRom, sound, words], i) => {
    const id = 'l' + (i + 1);
    items[id] = {
      id, kind: 'letter', index: i,
      glyph, pa: glyph, paAnswers: [glyph, name], name, rom: nameRom, romAnswers: splitAlts(nameRom.replace(/\(.*?\)/g, '')),
      en: 'letter ' + nameRom.replace(/\s*\(.*?\)/, ''), sound,
      words: words.map(([pa, rom, en, emoji]) => ({ pa, rom, en, emoji })),
      src: 'teacher'
    };
    order.letter.push(id);
  });

  function addRows(rows, kind, prefix) {
    const seen = {};
    rows.forEach(([en, pa, rom, opt = {}]) => {
      let id = prefix + slug(en);
      if (seen[id]) id += '-' + (++seen[id]); else seen[id] = 1;
      const paAnswers = splitAlts(pa).concat(opt.alt || []);
      items[id] = {
        id, kind, en, pa, rom, paAnswers, romAnswers: splitAlts(rom),
        note: opt.note || '', check: opt.check || '', src: opt.src || 'teacher', group: opt.group || ''
      };
      order[kind].push(id);
    });
  }
  addRows(C.vocab, 'vocab', 'v-');
  addRows(C.phrases, 'phrase', 'p-');

  // Weekly lessons: letters alternate 2,3,2,3…; 10 vocab; 7 phrases.
  const lessons = [];
  const pat = C.perLesson.lettersPattern;
  let li = 0, vi = 0, pi = 0, n = 0;
  while (li < order.letter.length || vi < order.vocab.length || pi < order.phrase.length) {
    const nl = pat[n % pat.length];
    lessons.push({
      n: n + 1,
      letter: order.letter.slice(li, li + nl),
      vocab: order.vocab.slice(vi, vi + C.perLesson.vocab),
      phrase: order.phrase.slice(pi, pi + C.perLesson.phrases)
    });
    li += nl; vi += C.perLesson.vocab; pi += C.perLesson.phrases; n++;
  }
  // map item -> lesson number
  lessons.forEach(L => ['letter', 'vocab', 'phrase'].forEach(k => L[k].forEach(id => { items[id].lesson = L.n; })));

  // ---------------------------------------------------------------- sentences & conversations
  const SB = window.SENTENCES || { sentences: [], conversations: [], templates: [], classes: {}, glossary: {} };
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  function resolve(ref) {
    const [k, ...rest] = ref.split(':'); const en = norm(rest.join(':'));
    const kind = k === 'v' ? 'vocab' : 'phrase';
    let id = order[kind].find(i => norm(items[i].en) === en) || order[kind].find(i => norm(items[i].en).startsWith(en));
    if (!id && typeof console !== 'undefined') console.warn('sentence ref not found:', ref);
    return id || null;
  }
  const toks = s => s.split(/\s+/).map(t => t.replace(/_/g, ' '));
  const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
  const sentences = [], sentByFocus = {};
  const addSentence = sn => { if (!sn.focus) return; sentences.push(sn); (sentByFocus[sn.focus] = sentByFocus[sn.focus] || []).push(sn); };

  SB.sentences.forEach(([pa, rom, gloss, en, focus, blank, wrong], i) => {
    const P = toks(pa), R = toks(rom), G = gloss.split('|');
    addSentence({ id: 's' + i, pa: P, rom: R.length === P.length ? R : P.map(() => ''), gloss: G, en, focus: resolve(focus), blank, wrong: wrong || [], src: 'generated' });
  });
  const clsOf = {};
  Object.entries(SB.classes).forEach(([cls, words]) => words.forEach(w => {
    const id = order.vocab.find(i => norm(items[i].en.replace(/\s*\(.*?\)/, '')) === w);
    if (id) { items[id].cls = cls; clsOf[id] = cls; }
  }));
  SB.templates.forEach(T => {
    Object.entries(clsOf).forEach(([id, cls]) => {
      if (!T.cls.includes(cls)) return;
      const it = items[id], x = it.en.replace(/\s*\(.*?\)/, '');
      const P = toks(T.pa), R = toks(T.rom), G = T.gloss.split('|');
      const xi = P.indexOf('X');
      P[xi] = it.paAnswers[0]; R[xi] = it.romAnswers[0]; G[xi] = x;
      addSentence({ id: 't-' + T.id + '-' + id, pa: P, rom: R, gloss: G, en: T.en.replace('{a}', article(x)).replace('{x}', x),
        focus: id, blank: xi, wrong: [], template: T.id, src: 'generated' });
    });
  });

  // multi-word phrases are sentences too (build it from tiles / fill the missing word)
  const tokGloss = {};
  sentences.forEach(sn => sn.pa.forEach((t, i) => { if (sn.gloss[i] && !tokGloss[t]) tokGloss[t] = sn.gloss[i]; }));
  const glossFor = tok => (SB.glossary || {})[tok] || tokGloss[tok] || (() => { const v = order.vocab.concat(order.phrase).find(i => items[i].paAnswers.includes(tok)); return v ? items[v].en : ''; })();
  order.phrase.forEach(id => {
    const it = items[id];
    const P = it.paAnswers[0].replace(/[?,.!]/g, '').trim().split(/\s+/);
    if (P.length < 2) return;
    if ((sentByFocus[id] || []).some(sn => sn.pa.join(' ').replace(/[?,.!]/g, '') === P.join(' '))) return; // already written by hand
    const R0 = it.romAnswers[0].replace(/[?,.!]/g, '').trim().split(/\s+/);
    const R = R0.length === P.length ? R0 : P.map(() => '');
    // blank the longest word that isn't a tiny helper
    let bi = 0; P.forEach((w, i) => { if (w.length > P[bi].length) bi = i; });
    addSentence({ id: 'ph-' + id, pa: P, rom: R, gloss: P.map(glossFor), en: it.en.replace(/\s*\(.*?\)/, ''), focus: id, blank: bi, wrong: [], template: 'phrase', src: it.src });
  });

  const conversations = [], convByFocus = {};
  (SB.conversations || []).forEach(([pPa, pRom, pEn, rPa, rRom, rEn, focus, wrong], i) => {
    const c = { id: 'c' + i, prompt: { pa: pPa, rom: pRom, en: pEn }, reply: { pa: rPa, rom: rRom, en: rEn },
      focus: focus.map(resolve).filter(Boolean), wrong: (wrong || []).map(([pa, rom, en]) => ({ pa, rom, en })) };
    conversations.push(c);
    c.focus.forEach(id => (convByFocus[id] = convByFocus[id] || []).push(c));
  });

  window.MODEL = { items, order, lessons, slug, sentences, sentByFocus, conversations, convByFocus, glossary: SB.glossary || {} };
})();
