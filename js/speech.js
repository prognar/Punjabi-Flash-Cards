/*
 * Speech: Punjabi recognition (pa-IN) with English-sounds fallback, phonetic matching, and text-to-speech.
 *
 * Recognition: Chrome / Edge send audio to Google's recognizer, which supports Punjabi (pa-IN) and
 * returns Gurmukhi text. We compare that to the expected Gurmukhi AND to a phonetic key built from
 * the romanization. If pa-IN is unavailable we fall back to en-US and match the English-sounding
 * spelling (e.g. "sat sri akal").
 *
 * TTS: uses a Punjabi voice if the device has one; otherwise a Hindi voice reading the same word
 * converted to Devanagari (near 1:1 letter mapping); otherwise English reading the romanization.
 */
(function (root) {
  // ---------------------------------------------------------------- transliteration
  const CONS = { 'ਕ': 'k', 'ਖ': 'kh', 'ਗ': 'g', 'ਘ': 'gh', 'ਙ': 'ng', 'ਚ': 'ch', 'ਛ': 'chh', 'ਜ': 'j', 'ਝ': 'jh', 'ਞ': 'ny',
    'ਟ': 't', 'ਠ': 'th', 'ਡ': 'd', 'ਢ': 'dh', 'ਣ': 'n', 'ਤ': 't', 'ਥ': 'th', 'ਦ': 'd', 'ਧ': 'dh', 'ਨ': 'n', 'ਪ': 'p', 'ਫ': 'ph',
    'ਬ': 'b', 'ਭ': 'bh', 'ਮ': 'm', 'ਯ': 'y', 'ਰ': 'r', 'ਲ': 'l', 'ਵ': 'v', 'ੜ': 'r', 'ਸ': 's', 'ਹ': 'h',
    'ਸ਼': 'sh', 'ਖ਼': 'kh', 'ਗ਼': 'g', 'ਜ਼': 'z', 'ਫ਼': 'f', 'ਲ਼': 'l' };
  const NUKTA = { 'ਸ': 'sh', 'ਖ': 'kh', 'ਗ': 'g', 'ਜ': 'z', 'ਫ': 'f', 'ਲ': 'l' };
  const VOW = { 'ਅ': 'a', 'ਆ': 'aa', 'ਇ': 'i', 'ਈ': 'ee', 'ਉ': 'u', 'ਊ': 'oo', 'ਏ': 'e', 'ਐ': 'ai', 'ਓ': 'o', 'ਔ': 'au', 'ੳ': 'u', 'ੲ': 'i' };
  const MAT = { 'ਾ': 'aa', 'ਿ': 'i', 'ੀ': 'ee', 'ੁ': 'u', 'ੂ': 'oo', 'ੇ': 'e', 'ੈ': 'ai', 'ੋ': 'o', 'ੌ': 'au' };

  /** Rough Gurmukhi → Latin (good enough for matching, not for display). */
  function gurToLatin(s) {
    const ch = Array.from(s.normalize('NFC'));
    let out = '', double = false;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i], nx = ch[i + 1];
      if (CONS[c]) {
        let base = CONS[c];
        if (nx === '਼') { base = NUKTA[c] || base; i++; }
        if (double) { out += base[0]; double = false; }
        out += base;
        const after = ch[i + 1];
        const endOfWord = !after || /[\s?.,!।'"\-/]/.test(after);
        if (!(after && (MAT[after] || after === '੍')) && !endOfWord) out += 'a'; // inherent vowel (dropped at word end)
      } else if (VOW[c]) out += VOW[c];
      else if (MAT[c]) out += MAT[c];
      else if (c === 'ੰ' || c === 'ਂ') out += 'n';
      else if (c === 'ੱ') double = true;
      else if (c === '੍' || c === '਼') { /* skip */ }
      else if (/\s/.test(c)) out += ' ';
    }
    return out;
  }

  /** Phonetic key so that "gaind", "gend", "ਗੇਂਦ", "gained" land close together. */
  function key(s) {
    if (!s) return '';
    if (/[਀-੿]/.test(s)) s = gurToLatin(s);
    s = s.toLowerCase().replace(/\(n\)/g, 'n').replace(/[^a-z]+/g, '');
    s = s.replace(/chh/g, '§').replace(/ch/g, '§').replace(/c/g, 'k').replace(/§/g, 'c')
      .replace(/ph/g, 'f').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j').replace(/th/g, 't')
      .replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/sh/g, 's').replace(/z/g, 'j').replace(/w/g, 'v')
      .replace(/q/g, 'k').replace(/x/g, 'ks')
      .replace(/ee|ie|ea/g, 'i').replace(/oo|ou/g, 'u').replace(/aa/g, 'a')
      .replace(/ai|ay|ae|ei|ey/g, 'e').replace(/au|aw|ow/g, 'o')
      .replace(/(?!^)h/g, '')            // aspiration is unreliable in recognizers
      .replace(/u/g, 'a')                // schwa: kum / kam / kahm
      .replace(/y/g, 'i')
      .replace(/(.)\1+/g, '$1');         // doubled consonants
    return s;
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const sim = (a, b) => (!a || !b) ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length);

  function normGur(s) { return s.normalize('NFC').replace(/[ੱ਼?.,!।'\s]/g, '').replace(/ੰ/g, 'ਂ'); }

  /** Score one heard transcript against an item. Returns 0..1 */
  function scoreHeard(heard, item) {
    const hk = key(heard);
    let best = 0;
    const targets = item.romAnswers.concat(item.paAnswers);
    if (item.kind === 'letter') targets.push(item.name);
    for (const t of targets) {
      const tk = key(t);
      if (!tk) continue;
      let s = sim(hk, tk);
      if (hk.length > tk.length && hk.includes(tk)) s = Math.max(s, 0.95);           // said it inside a sentence
      if (tk.length >= 6 && tk.includes(hk) && hk.length >= tk.length * 0.6) s = Math.max(s, 0.75); // partial phrase
      best = Math.max(best, s);
    }
    if (/[਀-੿]/.test(heard)) {
      const hg = normGur(heard);
      for (const p of item.paAnswers) {
        const pg = normGur(p);
        best = Math.max(best, sim(hg, pg), hg.includes(pg) ? 0.95 : 0);
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- recognition
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  const state = { punjabiOK: null, busy: false, rec: null };

  /**
   * listen(item, {lang:'auto'|'pa-IN'|'en-US', threshold}) → Promise<{ok, score, heard, lang} | {error}>
   */
  function listen(item, opts = {}) {
    if (!SR) return Promise.resolve({ error: 'unsupported' });
    if (state.busy) { try { state.rec && state.rec.abort(); } catch (e) {} }
    const want = opts.lang || 'auto';
    const lang = want === 'auto' ? (state.punjabiOK === false ? 'en-US' : 'pa-IN') : want;
    return new Promise(resolve => {
      const rec = new SR();
      state.rec = rec; state.busy = true;
      rec.lang = lang; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 10;
      let done = false;
      const finish = r => { if (done) return; done = true; state.busy = false; resolve(r); };
      rec.onresult = ev => {
        const alts = [];
        for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript.trim());
        if (lang === 'pa-IN') state.punjabiOK = true;
        let best = { score: 0, heard: alts[0] || '' };
        alts.forEach(a => { const s = scoreHeard(a, item); if (s > best.score) best = { score: s, heard: a }; });
        finish({ ok: best.score >= (opts.threshold || 0.6), score: best.score, heard: best.heard, alts, lang });
      };
      rec.onerror = ev => {
        if (lang === 'pa-IN' && (ev.error === 'language-not-supported' || ev.error === 'bad-grammar')) {
          state.punjabiOK = false;
          done = true; state.busy = false;
          resolve(listen(item, Object.assign({}, opts, { lang: 'en-US' })));
          return;
        }
        finish({ error: ev.error, lang });
      };
      rec.onend = () => finish({ error: 'no-speech', lang });
      try { rec.start(); } catch (e) { finish({ error: 'start-failed', lang }); }
      if (opts.onStart) opts.onStart(lang);
    });
  }
  function stop() { try { state.rec && state.rec.stop(); } catch (e) {} }

  // ---------------------------------------------------------------- text to speech
  function gurToDeva(s) {
    let out = '';
    const ch = Array.from(s.normalize('NFC'));
    const SPECIAL = { 'ੰ': 'ं', 'ਂ': 'ं', 'ੲ': 'इ', 'ੳ': 'उ', 'ੜ': 'ड़', 'ਖ਼': 'ख़', 'ਗ਼': 'ग़', 'ਜ਼': 'ज़', 'ਫ਼': 'फ़', 'ਲ਼': 'ळ', 'ਸ਼': 'श' };
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      if (c === 'ੱ') { // addak: double the next consonant
        const n = ch[i + 1];
        if (n && /[ਕ-ਹਖ਼-ਫ਼]/.test(n)) { const d = SPECIAL[n] || String.fromCharCode(n.charCodeAt(0) - 0x100); out += d + '्'; }
        continue;
      }
      if (c === 'ਸ' && ch[i + 1] === '਼') { out += 'श'; i++; continue; }
      if (SPECIAL[c]) { out += SPECIAL[c]; continue; }
      const code = c.charCodeAt(0);
      out += (code >= 0x0A00 && code <= 0x0A7F) ? String.fromCharCode(code - 0x100) : c;
    }
    return out;
  }
  let voices = [];
  function loadVoices() { try { voices = root.speechSynthesis ? root.speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
  if (root.speechSynthesis) { loadVoices(); root.speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice(prefix) { return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix)); }
  function ttsMode() {
    if (!root.speechSynthesis) return 'none';
    if (pickVoice('pa')) return 'pa';
    if (pickVoice('hi')) return 'hi';
    return 'en';
  }
  /** speak({pa, rom}, {rate}) */
  function say(text, opts = {}) {
    if (!root.speechSynthesis) return false;
    const synth = root.speechSynthesis; synth.cancel();
    const mode = ttsMode();
    let u;
    if (mode === 'pa') { u = new SpeechSynthesisUtterance(text.pa); u.voice = pickVoice('pa'); u.lang = u.voice.lang; }
    else if (mode === 'hi') { u = new SpeechSynthesisUtterance(gurToDeva(text.pa)); u.voice = pickVoice('hi'); u.lang = u.voice.lang; }
    else { u = new SpeechSynthesisUtterance((text.rom || '').replace(/\(n\)/g, 'n').replace(/-/g, '').split(' / ')[0]); u.lang = 'en-US'; }
    u.rate = opts.rate || 0.8;
    synth.speak(u);
    return true;
  }

  root.SPEECH = { available: !!SR, listen, stop, say, ttsMode, key, gurToLatin, gurToDeva, scoreHeard, sim, state };
})(typeof window !== 'undefined' ? window : globalThis);
