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
  // voices that failed on this device ("synthesis-failed": listed but not downloaded / not usable) are skipped
  const badVoices = new Set();
  function pickVoice(prefix) {
    const ok = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(prefix) && !badVoices.has(v.voiceURI || v.name));
    return ok.find(v => v.localService) || ok[0];
  }
  function ttsMode() {
    if (!root.speechSynthesis) return 'none';
    if (pickVoice('pa')) return 'pa';
    if (pickVoice('hi')) return 'hi';
    return 'en';
  }
  let current = null;
  const blobCache = {};
  /** data: URLs → blob: URLs (iOS Safari plays these more reliably), done synchronously so the tap still counts */
  function playableUrl(u) {
    if (!/^data:/.test(u)) return u;
    if (blobCache[u]) return blobCache[u];
    try {
      const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(u);
      const bin = atob(m[2]); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return (blobCache[u] = URL.createObjectURL(new Blob([arr], { type: m[1] })));
    } catch (e) { return u; }
  }
  const report = (kind, detail) => {
    S_state.last = { kind, detail, at: Date.now() };
    try { root.dispatchEvent(new CustomEvent('pfc-sound', { detail: S_state.last })); } catch (e) {}
  };
  const S_state = { last: null, log: [] };
  /**
   * speak({pa, rom, audio, speakAs, voice, rate}, {rate})
   *   audio   — URL of a recorded clip (always wins)
   *   speakAs — alternative text for the voice to read (Gurmukhi or English-letters)
   *   voice   — 'auto' | 'pa' | 'hi' | 'en' to force which voice reads it
   * Must be called straight from a tap/click (phones block sound otherwise).
   */
  function say(text, opts = {}) {
    if (current && current.pause) { try { current.pause(); } catch (e) {} current = null; }
    const synth = root.speechSynthesis;
    if (text.audio && root.Audio) {
      try { if (synth && (synth.speaking || synth.pending)) synth.cancel(); } catch (e) {}
      const a = new root.Audio(); a.preload = 'auto'; a.src = playableUrl(text.audio); current = a;
      const p = a.play();
      if (p && p.catch) p.catch(err => {
        current = null; report('audio-failed', err && (err.name || err.message));
        const t = Object.assign({}, text); delete t.audio; say(t, opts);
      });
      return true;
    }
    if (!synth) { report('no-tts', 'This browser has no text-to-speech'); return false; }
    loadVoices(); // iOS doesn't always fire voiceschanged
    // Only cancel when something is actually playing — cancel() immediately followed by speak() swallows the new
    // utterance on iOS Safari and some Android builds.
    if (synth.speaking || synth.pending) synth.cancel();
    if (synth.paused) synth.resume();
    const auto = ttsMode();
    let mode = text.voice && text.voice !== 'auto' ? text.voice : auto;
    if (mode === 'pa' && !pickVoice('pa')) mode = auto;
    if (mode === 'hi' && !pickVoice('hi')) mode = auto === 'pa' ? 'pa' : 'en';
    const src = text.speakAs || text.pa || '';
    const isGur = /[਀-੿]/.test(src);
    const enText = (text.speakAs && !isGur ? text.speakAs : (text.rom || '')).replace(/\(n\)/g, 'n').replace(/-/g, '').split(' / ')[0];
    // Ways to say it, best first. If a voice fails on this phone we fall through to the next one.
    const tries = [];
    if (isGur && mode === 'pa') tries.push({ text: src, voice: pickVoice('pa'), lang: 'pa-IN' });
    if (isGur && (mode === 'hi' || mode === 'pa') && pickVoice('hi')) tries.push({ text: gurToDeva(src), voice: pickVoice('hi'), lang: 'hi-IN' });
    if (isGur && mode === 'pa') tries.push({ text: src, voice: null, lang: 'pa-IN' });            // let the phone choose
    if (enText) {
      tries.push({ text: enText, voice: pickVoice('en'), lang: 'en-US' });
      tries.push({ text: enText, voice: null, lang: 'en-US' });                                    // phone's default voice
    }
    const rate = text.rate || opts.rate || 0.8;
    const attempt = i => {
      const t = tries[i];
      if (!t) { report('tts-error', 'no working voice'); return; }
      const u = new SpeechSynthesisUtterance(t.text);
      if (t.voice) u.voice = t.voice;
      u.lang = (t.voice && t.voice.lang) || t.lang;
      u.rate = rate;
      let started = false;
      const tag = ((t.voice && t.voice.name) || 'phone default') + ' [' + u.lang + ']';
      S_state.log.push(tag + ': trying'); if (S_state.log.length > 12) S_state.log.shift();
      u.onstart = () => { started = true; S_state.log.push(tag + ': ✓ playing'); report('ok', tag); };
      u.onerror = e => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        S_state.log.push(tag + ': ✗ ' + e.error);
        if (t.voice && /synthesis|voice|language/.test(e.error || '')) badVoices.add(t.voice.voiceURI || t.voice.name);
        if (!started && i + 1 < tries.length) { try { synth.cancel(); } catch (x) {} setTimeout(() => attempt(i + 1), 60); }
        else report('tts-error', e.error);
      };
      synth.speak(u);
      // Chrome on Android sometimes stalls the queue; a resume() nudge fixes it
      setTimeout(() => { try { if (synth.pending && !synth.speaking) synth.resume(); } catch (x) {} }, 250);
    };
    attempt(0);
    return true;
  }
  function voiceInfo() {
    loadVoices();
    return { pa: (pickVoice('pa') || {}).name || null, hi: (pickVoice('hi') || {}).name || null, en: (pickVoice('en') || {}).name || null, auto: ttsMode(), bad: [...badVoices] };
  }

  /**
   * Gurmukhi → English-letters "sounds-like" spelling in the teacher's style (syllables split by hyphens),
   * e.g. ਕੁੱਤਾ → kut-taa, ਪਾਣੀ → paa-nee, ਗੇਂਦ → gaind, ਬਾਂਹ → baan(h)
   */
  const AV = { 'ਾ': 'aa', 'ਿ': 'i', 'ੀ': 'ee', 'ੁ': 'u', 'ੂ': 'oo', 'ੇ': 'ay', 'ੈ': 'ai', 'ੋ': 'o', 'ੌ': 'au' };
  const AVI = { 'ਅ': 'a', 'ਆ': 'aa', 'ਇ': 'i', 'ਈ': 'ee', 'ਉ': 'u', 'ਊ': 'oo', 'ਏ': 'ay', 'ਐ': 'ai', 'ਓ': 'o', 'ਔ': 'au', 'ੳ': 'u', 'ੲ': 'i' };
  const AC = Object.assign({}, CONS, { 'ਟ': 't', 'ਤ': 't', 'ਡ': 'd', 'ਦ': 'd', 'ੜ': 'r', 'ਣ': 'n' });
  function anglicizeWord(w) {
    const ch = Array.from(w.normalize('NFC'));
    const syl = []; // {c: consonants, v: vowel}
    let cur = { c: '', v: '' }, dbl = false;
    const flush = () => { syl.push(cur); cur = { c: '', v: '' }; };
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i], nx = ch[i + 1];
      if (AC[c]) {
        let b = AC[c];
        if (nx === '਼') { b = NUKTA[c] || b; i++; }
        if (cur.v) flush();
        if (dbl) { // addak: close previous syllable with this consonant (ਬੱਚਾ → buch-chaa)
          if (syl.length) syl[syl.length - 1].coda = (syl[syl.length - 1].coda || '') + (b === 'chh' ? 'ch' : b.length > 1 && b.endsWith('h') ? b.slice(0, -1) : b);
          dbl = false;
        }
        cur.c += b;
        const after = ch[i + 1];
        if (after === '੍') { i++; continue; }            // cluster
        if (!(after && (AV[after] || after === 'ੱ' || after === 'ੰ' || after === 'ਂ'))) cur.v = 'a';   // inherent vowel
      } else if (AVI[c]) { if (cur.v || cur.c) flush(); cur.v = AVI[c]; cur.ind = true; }
      else if (AV[c]) cur.v = AV[c];
      else if (c === 'ੰ' || c === 'ਂ') { if (!cur.v) cur.v = 'u'; cur.nas = true; }
      else if (c === 'ੱ') { if (!cur.v) cur.v = 'u'; dbl = true; }
    }
    if (cur.c || cur.v) flush();
    // drop the inherent vowel at the end of the word (ਘਰ → ghar)
    if (syl.length > 1) { const L = syl[syl.length - 1]; if (L.v === 'a' && !L.nas && !L.coda) { const P = syl[syl.length - 2]; P.coda = (P.coda || '') + L.c; syl.pop(); } }
    else if (syl.length === 1 && syl[0].v === 'a' && syl[0].c && w.length > 1) { /* single syllable like ਘਰ handled above */ }
    // Punjabi drops the short "a" in the middle of a word: ਕੁਰਸੀ is kur-see, not ku-ra-see
    for (let i = 1; i < syl.length - 1; i++) {
      const x = syl[i];
      if (x.v === 'a' && !x.nas && !x.coda && !x.ind && x.c && syl[i - 1].v && syl[i + 1].v && syl[i + 1].c && !syl[i - 1].sync) {
        syl[i - 1].coda = (syl[i - 1].coda || '') + x.c; syl[i - 1].sync = true; syl.splice(i, 1); i--;
      }
    }
    const parts = syl.map(x => {
      let v = x.v === 'a' && !x.ind ? 'u' : x.v;       // schwa sounds like the u in "cup"
      let s = x.c + v;
      if (x.nas) s += (/aa|ee|oo|ai|au|ay|o$/.test(v) && !x.coda ? '(n)' : 'n');
      return s + (x.coda || '');
    });
    // merge a syllable that is only consonants into its neighbour
    const out = [];
    parts.forEach(p => { if (out.length && !/[aeiou]/.test(p)) out[out.length - 1] += p; else out.push(p); });
    return out.join('-').replace(/u-hi([^aeiou(-]*)/g, 'eh$1').replace(/ih(?=-)/g, 'eh').replace(/^-|-$/g, '').replace(/--+/g, '-');
  }
  function anglicize(s) {
    return (s || '').split(' / ').map(alt => alt.replace(/[?,.!।]/g, '').trim().split(/\s+/).filter(Boolean).map(anglicizeWord).join(' ')).join(' / ');
  }

  root.SPEECH = { available: !!SR, listen, stop, say, ttsMode, voiceInfo, sound: S_state, playableUrl, key, gurToLatin, gurToDeva, anglicize, scoreHeard, sim, state };
})(typeof window !== 'undefined' ? window : globalThis);
