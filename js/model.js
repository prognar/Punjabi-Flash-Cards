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

  window.MODEL = { items, order, lessons, slug };
})();
