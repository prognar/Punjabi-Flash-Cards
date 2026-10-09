/* Punjabi Lessons — UI */
(function () {
  const { items, lessons, order } = window.MODEL;
  const E = window.ENGINE, S = window.SPEECH, Store = E.Store;
  const app = document.getElementById('app');
  const AVATARS = ['🦁', '🐯', '🐼', '🦊', '🐸', '🐵', '🦉', '🐢', '🦚', '🐘', '🚀', '⚽', '🎸', '🌟', '👦', '👧', '👨', '👩', '🧔', '👵'];
  const KIND_LABEL = { letter: 'Letters', vocab: 'Words', phrase: 'Phrases' };

  let P = null, PR = null, SES = null, route = { name: 'profiles' };

  // ------------------------------------------------------------ helpers
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const isKid = () => P && P.type === 'kid';
  const setG = () => P.settings.showGurmukhi !== false;
  const setR = () => P.settings.showRoman !== false || !setG();
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
  function save() { if (P) Store.saveProgress(P.id, PR); }
  function paHTML(it, cls = '') {
    return `<div class="pa ${cls}">${setG() ? `<span class="gur" lang="pa">${esc(it.pa)}</span>` : ''}${setR() ? `<span class="rom">${esc(it.rom)}</span>` : ''}</div>`;
  }
  function speak(it) { S.say({ pa: it.kind === 'letter' ? it.name : it.paAnswers[0], rom: it.rom }, { rate: isKid() ? 0.72 : 0.85 }); }
  const praise = () => (isKid() ? ['Shabaash! 🎉', 'Great job! ⭐', 'Wah! 🌟', 'You got it! 🙌', 'Bahut vadia! 💪'] : ['Correct', 'Nice', 'Shabaash!', 'Right']).sort(() => Math.random() - .5)[0];
  const encourage = () => (isKid() ? ['Almost! Let\'s look again 👀', 'Good try! 💛', 'Nice try — here it is:'] : ['Not quite —', 'Here\'s the answer:']).sort(() => Math.random() - .5)[0];
  function confetti() {
    const c = document.createElement('div'); c.className = 'confetti';
    const colors = ['#f4a259', '#2a9d8f', '#e76f51', '#f6bd60', '#2b59c3'];
    for (let i = 0; i < 60; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = colors[i % 5]; s.style.animationDelay = Math.random() * .6 + 's'; c.appendChild(s); }
    document.body.appendChild(c); setTimeout(() => c.remove(), 2500);
  }
  function go(name, extra = {}) { route = Object.assign({ name }, extra); render(); window.scrollTo(0, 0); }

  // first letter of a word → which base letter it belongs to (vowel carriers)
  const CARRIER = { 'ਉ': 'ੳ', 'ਊ': 'ੳ', 'ਓ': 'ੳ', 'ਅ': 'ਅ', 'ਆ': 'ਅ', 'ਐ': 'ਅ', 'ਔ': 'ਅ', 'ਇ': 'ੲ', 'ਈ': 'ੲ', 'ਏ': 'ੲ' };
  const firstLetter = w => { const c = Array.from(w.normalize('NFC'))[0]; return CARRIER[c] || c; };

  // ------------------------------------------------------------ router
  function render() {
    S.stop();
    if (route.name !== 'profiles' && route.name !== 'editProfile' && !P) route = { name: 'profiles' };
    const views = { profiles: vProfiles, editProfile: vEditProfile, home: vHome, session: vSession, summary: vSummary, progress: vProgress, browse: vBrowse, settings: vSettings };
    (views[route.name] || vProfiles)();
  }

  function selectProfile(id) {
    P = Store.profile(id); Store.setActive(id);
    PR = Store.progress(id); E.touchStreak(PR);
    go('home');
  }

  // ------------------------------------------------------------ profiles
  function vProfiles() {
    const ps = Store.profiles();
    app.innerHTML = `
      <div class="brand"><div class="logo">ੳ</div><div><h1>Punjabi Lessons</h1><div class="muted">Who's learning today?</div></div></div>
      <div class="profiles">
        ${ps.map(p => { const pr = Store.progress(p.id); return `
          <button class="profile" data-act="pick" data-id="${p.id}">
            <div class="avatar lg">${esc(p.avatar)}</div>
            <div class="name">${esc(p.name)}</div>
            <div class="muted small">Lesson ${pr.unlocked} · ${p.type === 'kid' ? 'Kid' : 'Adult'}</div>
          </button>`; }).join('')}
        <button class="profile add" data-act="new"><div style="font-size:40px">＋</div><div>Add learner</div></button>
      </div>
      <div class="row wrap" style="margin-top:28px">
        <button class="btn ghost" data-act="settings">⚙️ Backup &amp; settings</button>
        <a class="btn ghost" href="gurmukhi-game.html">🎮 Classic flash games</a>
      </div>`;
    app.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'pick') selectProfile(b.dataset.id);
      if (b.dataset.act === 'new') go('editProfile', { id: null });
      if (b.dataset.act === 'settings') go('settings');
    };
  }

  function vEditProfile() {
    const existing = route.id ? Store.profile(route.id) : null;
    const f = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', avatar: AVATARS[0], type: 'kid', settings: Object.assign({}, E.PROFILE_DEFAULTS.kid) };
    const pr = existing ? Store.progress(existing.id) : null;
    let startLesson = pr ? pr.unlocked : 1;
    const draw = () => {
      app.innerHTML = `
        <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">←</button><h2>${existing ? 'Edit learner' : 'New learner'}</h2></div>
        <div class="card stack">
          <div class="field"><label for="nm">Name</label><input id="nm" class="input" maxlength="24" value="${esc(f.name)}" placeholder="e.g. Drew"></div>
          <div class="field"><label>Picture</label><div class="emoji-pick">${AVATARS.map(a => `<button data-act="av" data-v="${a}" class="${a === f.avatar ? 'on' : ''}">${a}</button>`).join('')}</div></div>
          <div class="field"><label>Learner type</label>
            <div class="seg"><button data-act="type" data-v="kid" class="${f.type === 'kid' ? 'on' : ''}">🧒 Kid</button><button data-act="type" data-v="adult" class="${f.type === 'adult' ? 'on' : ''}">🧑 Adult</button></div>
            <div class="muted small">Kids get shorter sessions, gentler speech checking and more celebration. Adults get longer sessions and stricter checking.</div>
          </div>
          <div class="field"><label for="sl">Already covered in class up to lesson</label>
            <select id="sl" class="input">${lessons.map(L => `<option value="${L.n}" ${L.n === startLesson ? 'selected' : ''}>Lesson ${L.n}${L.letter.length ? ' — ' + L.letter.map(id => items[id].glyph).join(' ') : ''}</option>`).join('')}</select>
            <div class="muted small">Opens lessons up to here. Anything from earlier lessons is still introduced and reviewed.</div>
          </div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3>Options</h3>
          ${toggleRow('showGurmukhi', 'Show Gurmukhi script', f.settings)}
          ${toggleRow('showRoman', 'Show English-letter spelling', f.settings)}
          ${toggleRow('speech', 'Speaking practice (microphone)', f.settings)}
          ${toggleRow('writing', 'Letter writing practice', f.settings)}
          <div class="toggle"><span>Cards per session</span><select id="ss" class="input" style="width:auto">${[8, 12, 16, 20, 30].map(n => `<option ${n === f.settings.sessionSize ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <div class="row" style="margin-top:18px">
          ${existing ? '<button class="btn ghost" data-act="del" style="color:#b5501d">Delete learner</button>' : ''}
          <span class="spacer"></span><button class="btn primary big" data-act="save">Save</button>
        </div>`;
    };
    function toggleRow(k, label, s) { return `<label class="toggle"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] !== false ? 'checked' : ''}></label>`; }
    draw();
    app.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      f.name = document.getElementById('nm').value;
      startLesson = +document.getElementById('sl').value;
      const a = b.dataset.act;
      if (a === 'back') return go(existing ? 'home' : 'profiles');
      if (a === 'av') { f.avatar = b.dataset.v; draw(); }
      if (a === 'type') {
        f.type = b.dataset.v;
        const d = E.PROFILE_DEFAULTS[f.type]; f.settings.sessionSize = d.sessionSize; f.settings.maxNew = d.maxNew;
        draw();
      }
      if (a === 'del' && confirm(`Delete ${existing.name} and all their progress?`)) { Store.deleteProfile(existing.id); P = null; go('profiles'); }
      if (a === 'save') {
        if (!f.name.trim()) { toast('Add a name first'); return; }
        app.querySelectorAll('[data-set]').forEach(i => { f.settings[i.dataset.set] = i.checked; });
        f.settings.sessionSize = +document.getElementById('ss').value;
        let id;
        if (existing) { Store.updateProfile(existing.id, { name: f.name.trim(), avatar: f.avatar, type: f.type, settings: f.settings }); id = existing.id; }
        else { id = Store.addProfile({ name: f.name.trim(), avatar: f.avatar, type: f.type }).id; Store.updateProfile(id, { settings: f.settings }); }
        const pr2 = Store.progress(id);
        pr2.unlocked = Math.max(1, Math.min(lessons.length, startLesson));
        Store.saveProgress(id, pr2);
        selectProfile(id);
      }
    };
  }

  // ------------------------------------------------------------ home
  function dueCount() {
    const t = Date.now();
    return lessons.slice(0, PR.unlocked).flatMap(L => L.letter.concat(L.vocab, L.phrase)).filter(id => { const s = E.peek(PR, id); return s && s.intro && s.due <= t; }).length;
  }
  function vHome() {
    const L = lessons[PR.unlocked - 1];
    const g = E.gateStatus(PR, lessons);
    const s = g.stats || E.lessonStats(PR, L);
    const sk = E.skill(PR), req = E.masteryRequirement(PR), streak = E.touchStreak(PR).streak;
    const due = dueCount();
    const sec = (k, ico, cls, title, preview) => {
      const ks = s.kinds[k]; if (!ks.total) return '';
      return `<div class="card section">
        <div class="ico ${cls}">${ico}</div>
        <div class="meta"><h3>${title}</h3><div class="muted small">${preview}</div>
          <div class="bar" style="margin-top:8px"><i style="width:${Math.round(ks.mastered / ks.total * 100)}%"></i></div>
          <div class="muted small" style="margin-top:4px">${ks.mastered}/${ks.total} mastered${ks.learning ? ` · ${ks.learning} learning` : ''}</div></div>
        <button class="btn teal" data-act="start" data-scope="${k}">Practice</button></div>`;
    };
    let gateMsg;
    if (g.last && g.ok) gateMsg = '🏆 Every lesson is open. Keep reviewing to stay sharp!';
    else if (g.ok) gateMsg = 'Ready for the next lesson!';
    else {
      const bits = [`${Math.round(s.pct * 100)}% of 90% mastered`];
      if (!g.kindsOk) bits.push('each section needs 80%');
      if (!g.reviewOk) bits.push(`review accuracy ${Math.round((g.reviewAcc || 0) * 100)}% (needs 70%)`);
      gateMsg = `Lesson ${L.n + 1 <= lessons.length ? L.n + 1 : ''} unlocks at: ${bits.join(' · ')}`;
    }
    app.innerHTML = `
      <div class="topbar">
        <div class="avatar">${esc(P.avatar)}</div>
        <div><h2>${isKid() ? 'Sat Sri Akal' : 'Hi'}, ${esc(P.name)}!</h2><div class="muted small">${streak ? `🔥 ${streak}-day streak` : 'Practice today to start a streak'}</div></div>
        <span class="spacer"></span>
        <button class="icon-btn" data-act="switch" title="Switch learner" aria-label="Switch learner">👥</button>
      </div>
      <div class="hero stack">
        <div class="lesson-no">Lesson ${L.n} of ${lessons.length}</div>
        <h1>${L.letter.length ? `<span class="gur">${L.letter.map(id => items[id].glyph).join(' ')}</span> · ` : ''}${L.vocab.length} words · ${L.phrase.length} phrases</h1>
        <div class="bar onhero"><i style="width:${Math.round(s.pct * 100)}%"></i></div>
        <div class="small" style="font-weight:600">${esc(gateMsg)}</div>
        <button class="btn primary big block" data-act="start" data-scope="all">▶ Today's practice</button>
      </div>
      <div class="stack" style="margin-top:16px">
        ${sec('letter', L.letter.map(id => items[id].glyph).join(''), 'l', 'Letters', L.letter.map(id => esc(items[id].rom)).join(', '))}
        ${sec('vocab', '📖', 'v', 'Words', L.vocab.slice(0, 4).map(id => esc(items[id].en)).join(', ') + (L.vocab.length > 4 ? '…' : ''))}
        ${sec('phrase', '💬', 'p', 'Phrases', L.phrase.slice(0, 3).map(id => esc(items[id].en)).join(', ') + (L.phrase.length > 3 ? '…' : ''))}
        <div class="card section">
          <div class="ico" style="background:#fff4dd">🔁</div>
          <div class="meta"><h3>Review</h3><div class="muted small">${due ? `${due} card${due > 1 ? 's' : ''} ready to review` : 'Nothing due right now'}</div></div>
          <button class="btn" data-act="start" data-scope="review" ${due ? '' : 'disabled'}>Review</button>
        </div>
      </div>
      <div class="grid3" style="margin-top:16px">
        <div class="stat"><b>${Object.values(PR.items).filter(x => x.intro).length}</b><span class="muted small">seen</span></div>
        <div class="stat"><b>${sk.n >= 8 ? Math.round(sk.acc * 100) + '%' : '—'}</b><span class="muted small">recent accuracy</span></div>
        <div class="stat"><b>${cap(req.label)}</b><span class="muted small">mastery pace</span></div>
      </div>
      <div class="row wrap" style="margin-top:16px; justify-content:center">
        <button class="btn" data-act="progress">📈 Progress</button>
        <button class="btn" data-act="browse">📚 All cards</button>
        <button class="btn" data-act="edit">⚙️ Options</button>
      </div>`;
    app.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'switch') { P = null; go('profiles'); }
      if (a === 'start') startSession(b.dataset.scope);
      if (a === 'progress') go('progress');
      if (a === 'browse') go('browse', { lesson: PR.unlocked, kind: 'letter' });
      if (a === 'edit') go('editProfile', { id: P.id });
    };
  }

  // ------------------------------------------------------------ session
  function startSession(scope) {
    const { queue, info } = E.buildSession(PR, P, window.MODEL, scope);
    if (!queue.length) { toast('Nothing to practice here right now 🎉'); return; }
    SES = { scope, queue, pos: 0, info, right: 0, wrong: 0, missed: new Set(), answered: false, startUnlocked: PR.unlocked };
    go('session');
  }

  function distractors(it, n, field) {
    const pool = order[it.kind].map(id => items[id]).filter(x => x.id !== it.id && x[field] !== it[field] && x.pa !== it.pa && x.en !== it.en);
    const near = pool.filter(x => x.lesson <= PR.unlocked);
    const src = near.length >= n ? near : pool;
    return shuffle(src).slice(0, n);
  }

  function vSession() {
    if (!SES || SES.pos >= SES.queue.length) return finishSession();
    const card = SES.queue[SES.pos], it = items[card.id];
    SES.answered = false;
    const pct = Math.round(SES.pos / SES.queue.length * 100);
    app.innerHTML = `
      <div class="progress-top"><button class="icon-btn" data-act="quit" aria-label="Stop">✕</button><div class="bar"><i style="width:${pct}%"></i></div><span class="muted small">${SES.pos + 1}/${SES.queue.length}</span></div>
      <div id="ex" class="ex"></div>`;
    app.onclick = e => { const b = e.target.closest('[data-act="quit"]'); if (b) { if (SES.pos === 0 || confirm('Stop this session? Answers so far are saved.')) finishSession(); } };
    const ex = document.getElementById('ex');
    const R = { intro: exIntro, 'mc-en2pa': exMcEn2Pa, 'mc-pa2en': exMcPa2En, 'pick-letter': exPickLetter, 'name-letter': exNameLetter, 'word-letter': exWordLetter, trace: exTrace, write: exTrace, say: exSay, build: exBuild };
    let fn = R[card.ex] || exMcEn2Pa;
    if ((card.ex === 'say') && P.settings.speech === false) fn = exSay; // exSay handles no-mic (reveal + self-check)
    if ((card.ex === 'trace' || card.ex === 'write') && P.settings.writing === false) fn = exPickLetter;
    if (card.ex === 'word-letter' && !it.words.some(w => firstLetter(w.pa) === it.glyph)) fn = exNameLetter;
    fn(ex, it, card);
  }

  function next() { SES.pos++; render(); }

  /** Grade the current card. ok=true/false. Shows feedback and a next button (auto-advance on correct). */
  function grade(ok, it, card, holder, opts = {}) {
    if (SES.answered) return; SES.answered = true;
    E.record(PR, it.id, ok, card.ex, card.review);
    if (ok) SES.right++; else { SES.wrong++; SES.missed.add(it.id); E.requeueMiss(SES.queue, SES.pos, card, window.MODEL); }
    save();
    const fb = document.createElement('div');
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.innerHTML = ok
      ? `${praise()}${opts.showAnswer ? `<div class="answer">${paHTML(it)}</div>` : ''}`
      : `${encourage()}<div class="answer">${it.kind === 'letter' ? `<span class="gur" style="font-size:44px">${esc(it.glyph)}</span> ${esc(it.rom)}` : `${paHTML(it)}<div class="muted">${esc(it.en)}</div>`}</div>`;
    holder.appendChild(fb);
    if (it.note) fb.insertAdjacentHTML('beforeend', `<div class="note">${esc(it.note)}</div>`);
    const btn = document.createElement('div'); btn.className = 'actions';
    btn.innerHTML = `<button class="btn ghost" data-k="hear">🔊 Hear it</button><button class="btn primary big" data-k="next">Next →</button>`;
    holder.appendChild(btn);
    btn.onclick = e => { const k = e.target.closest('[data-k]'); if (!k) return; if (k.dataset.k === 'hear') speak(it); else next(); };
    if (!ok || opts.showAnswer) speak(it);
    if (ok && !opts.noAuto) { const pos = SES.pos; setTimeout(() => { if (SES && SES.pos === pos && route.name === 'session') next(); }, isKid() ? 1300 : 900); }
    btn.querySelector('[data-k="next"]').focus({ preventScroll: true });
  }

  function checkFlag(it) { return it.check ? `<div class="check-flag">⚠️ Ask teacher: ${esc(it.check)}</div>` : ''; }

  function exIntro(el, it) {
    const isL = it.kind === 'letter';
    el.innerHTML = `
      <div class="prompt-label">New ${isL ? 'letter' : it.kind === 'vocab' ? 'word' : 'phrase'}</div>
      <div class="card" style="margin-top:10px">
        ${isL ? `<div class="glyph-xl">${esc(it.glyph)}</div><div class="en-prompt"><span class="gur">${esc(it.name)}</span> · ${esc(it.rom)}</div><div class="muted">${esc(it.sound)}</div>`
              : `<div class="en-prompt">${esc(it.en)}</div>${paHTML(it, 'xl')}`}
        ${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}${checkFlag(it)}
        ${isL && it.words.length ? `<div class="words">${it.words.map(w => `<button class="word" data-w="${esc(w.pa)}" data-r="${esc(w.rom)}"><div class="e">${w.emoji}</div><span class="gur">${esc(w.pa)}</span><div class="r">${esc(w.rom)}</div><div class="small">${esc(w.en)}</div></button>`).join('')}</div>` : ''}
      </div>
      <div class="actions"><button class="btn" data-k="hear">🔊 Hear it</button><button class="btn primary big" data-k="ok">Got it →</button></div>`;
    speak(it);
    el.onclick = e => {
      const w = e.target.closest('.word'); if (w) { S.say({ pa: w.dataset.w, rom: w.dataset.r }); return; }
      const k = e.target.closest('[data-k]'); if (!k) return;
      if (k.dataset.k === 'hear') speak(it);
      if (k.dataset.k === 'ok') { E.markIntroduced(PR, it.id); save(); next(); }
    };
  }

  function mcRender(el, it, card, promptHTML, opts, render, isRight, cls = '') {
    el.innerHTML = `${promptHTML}<div class="options ${cls}">${opts.map((o, i) => `<button class="opt ${cls}" data-i="${i}">${render(o)}</button>`).join('')}</div>`;
    el.onclick = e => {
      const b = e.target.closest('.opt'); if (!b || SES.answered) return;
      const o = opts[+b.dataset.i], ok = isRight(o);
      el.querySelectorAll('.opt').forEach((x, i) => { x.disabled = true; if (isRight(opts[i])) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      grade(ok, it, card, el);
    };
    const hb = el.querySelector('[data-hear]'); if (hb) hb.onclick = ev => { ev.stopPropagation(); speak(it); };
  }

  function exMcEn2Pa(el, it, card) {
    const opts = shuffle([it].concat(distractors(it, 3, 'pa')));
    mcRender(el, it, card,
      `<div class="prompt-label">How do you say</div><div class="prompt en-prompt">${esc(it.en)}</div>`,
      opts, o => `${setG() ? `<span class="gur">${esc(o.pa)}</span>` : ''}${setR() ? `<span class="rom">${esc(o.rom)}</span>` : ''}`, o => o.id === it.id);
  }
  function exMcPa2En(el, it, card) {
    const opts = shuffle([it].concat(distractors(it, 3, 'en')));
    mcRender(el, it, card,
      `<div class="prompt-label">What does this mean?</div><div class="prompt">${paHTML(it, 'xl')}<button class="btn ghost" data-hear>🔊 Hear it</button></div>`,
      opts, o => esc(o.en), o => o.id === it.id);
    speak(it);
  }
  function exPickLetter(el, it, card) {
    const opts = shuffle([it].concat(distractors(it, 3, 'glyph')));
    mcRender(el, it, card,
      `<div class="prompt-label">Find the letter</div><div class="prompt en-prompt"><span class="gur">${esc(it.name)}</span> · ${esc(it.rom)}</div><button class="btn ghost" data-hear>🔊 Hear it</button>`,
      opts, o => `<span class="gur">${esc(o.glyph)}</span>`, o => o.id === it.id, 'glyph');
    speak(it);
  }
  function exNameLetter(el, it, card) {
    const opts = shuffle([it].concat(distractors(it, 3, 'rom')));
    mcRender(el, it, card,
      `<div class="prompt-label">What is this letter called?</div><div class="prompt glyph-xl">${esc(it.glyph)}</div>`,
      opts, o => `${setG() ? `<span class="gur">${esc(o.name)}</span>` : ''}<span class="rom">${esc(o.rom)}</span>`, o => o.id === it.id);
  }
  function exWordLetter(el, it, card) {
    const words = it.words.filter(w => firstLetter(w.pa) === it.glyph);
    const w = words[Math.floor(Math.random() * words.length)];
    const opts = shuffle([it].concat(distractors(it, 3, 'glyph')));
    mcRender(el, it, card,
      `<div class="prompt-label">Which letter does it start with?</div>
       <div class="prompt"><div class="emoji-xl">${w.emoji}</div><div class="en-prompt">${esc(w.en)}</div><div class="muted">${esc(w.rom)}</div></div>`,
      opts, o => `<span class="gur">${esc(o.glyph)}</span>`, o => o.id === it.id, 'glyph');
    S.say({ pa: w.pa, rom: w.rom });
  }

  function exTrace(el, it, card) {
    const write = card.ex === 'write';
    let tries = 0;
    el.innerHTML = `
      <div class="prompt-label">${write ? 'Write the letter from memory' : 'Trace the letter'}</div>
      <div class="prompt en-prompt"><span class="gur">${esc(it.name)}</span> · ${esc(it.rom)} <button class="btn ghost" data-k="hear">🔊</button></div>
      <div class="pad-wrap"><canvas class="pad" id="pad" aria-label="Writing pad"></canvas></div>
      <div class="actions" id="padActions"><button class="btn" data-k="undo">↶ Undo</button><button class="btn" data-k="clear">Clear</button><button class="btn teal big" data-k="done">Done ✓</button></div>
      <div id="padFb"></div>`;
    const pad = new window.TracePad(document.getElementById('pad'), { glyph: it.glyph, mode: write ? 'write' : 'trace', others: order.letter.map(id => items[id].glyph) });
    if (!write) speak(it);
    const fb = document.getElementById('padFb');
    el.onclick = e => {
      const k = e.target.closest('[data-k]'); if (!k || SES.answered) return;
      const a = k.dataset.k;
      if (a === 'hear') speak(it);
      if (a === 'undo') pad.undo();
      if (a === 'clear') { pad.clear(); fb.innerHTML = ''; }
      if (a === 'self') { pad.showAnswer = true; pad.draw(); document.getElementById('padActions').remove(); grade(true, it, card, el, { noAuto: true }); }
      if (a === 'done') {
        if (!pad.hasInk()) { toast(write ? 'Write the letter in the box' : 'Trace over the grey letter'); return; }
        const r = pad.score(!isKid());
        tries++;
        if (r.pass) { pad.showAnswer = write; pad.draw(); document.getElementById('padActions').remove(); grade(true, it, card, el, { noAuto: write }); return; }
        if (tries < 2) {
          const hint = write
            ? (r.best && r.best !== it.glyph ? `That looks more like <span class="gur" style="font-size:30px">${esc(r.best)}</span> — have a look and try again!` : 'Not quite — have a look and try again!')
            : (r.coverage < r.precision ? 'Cover more of the letter — try again!' : 'Try to stay on the letter — try again!');
          fb.innerHTML = `<div class="feedback bad">${hint}</div>`;
          if (write) { pad.showAnswer = true; pad.draw(); setTimeout(() => { pad.showAnswer = false; pad.clear(); }, 1600); } else pad.clear();
          return;
        }
        pad.showAnswer = true; pad.draw();
        document.getElementById('padActions').innerHTML = !isKid() ? '<button class="btn ghost" data-k="self">My letter was right — count it</button>' : '';
        fb.innerHTML = '';
        grade(false, it, card, el);
      }
    };
  }

  function exSay(el, it, card) {
    const mic = S.available && P.settings.speech !== false;
    let tries = 0;
    el.innerHTML = `
      <div class="prompt-label">Say it in Punjabi</div>
      <div class="prompt en-prompt">${esc(it.en)}</div>
      ${mic ? `<button class="speak-btn" id="mic" aria-label="Tap and speak">🎤</button><div class="heard" id="heard">Tap the mic and say it</div>` : `<div class="muted">Say it out loud, then check.</div>`}
      <div class="actions" id="sayActions"><button class="btn ${mic ? 'ghost' : 'primary big'}" data-k="reveal">Show answer</button></div>
      <div id="sayFb"></div>`;
    const heard = document.getElementById('heard');
    const reveal = (msg) => {
      document.getElementById('sayActions').innerHTML = `<button class="btn" data-k="hear">🔊 Hear it</button><button class="btn" data-k="miss">✗ I missed it</button><button class="btn teal big" data-k="got">✓ I said it</button>`;
      document.getElementById('sayFb').innerHTML = `<div class="card" style="margin-top:12px">${msg ? `<div class="muted small">${msg}</div>` : ''}${paHTML(it, 'xl')}${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}${checkFlag(it)}</div>`;
      const m = document.getElementById('mic'); if (m) m.disabled = true;
      speak(it);
    };
    el.onclick = async e => {
      if (SES.answered) return;
      if (e.target.closest('#mic')) {
        const m = document.getElementById('mic');
        if (m.classList.contains('listening')) { S.stop(); return; }
        m.classList.add('listening'); heard.textContent = 'Listening…';
        const thr = isKid() ? 0.55 : 0.65;
        const r = await S.listen(it, { threshold: thr, lang: P.settings.speechLang || 'auto' });
        m.classList.remove('listening');
        if (SES.answered || !document.body.contains(m)) return;
        if (r.error) {
          heard.textContent = r.error === 'not-allowed' ? '🎙️ Microphone is blocked — allow it in the browser address bar.' : r.error === 'no-speech' ? "Didn't hear anything — try again." : r.error === 'unsupported' ? 'This browser has no speech recognition — use Chrome or Edge.' : 'Mic problem (' + r.error + ') — try again or use Show answer.';
          return;
        }
        tries++;
        heard.textContent = `Heard: “${r.heard}”${r.lang === 'en-US' ? ' (English mode)' : ''}`;
        if (r.ok) { m.disabled = true; document.getElementById('sayActions').remove(); grade(true, it, card, el, { showAnswer: true }); }
        else if (tries < 3) heard.textContent += ' — not quite, try again!';
        else reveal('Speech check couldn\'t confirm it. Compare and decide:');
        return;
      }
      const k = e.target.closest('[data-k]'); if (!k) return;
      if (k.dataset.k === 'reveal') reveal('');
      if (k.dataset.k === 'hear') speak(it);
      if (k.dataset.k === 'got' || k.dataset.k === 'miss') { document.getElementById('sayActions').remove(); grade(k.dataset.k === 'got', it, card, el, { noAuto: false }); }
    };
  }

  function exBuild(el, it, card) {
    const ans = it.paAnswers[0].replace(/[?,.!]/g, '').trim().split(/\s+/);
    const romWords = it.romAnswers[0].replace(/[?,.!]/g, '').trim().split(/\s+/);
    const useRom = romWords.length === ans.length;
    const tokens = ans.map((g, i) => ({ g, r: useRom ? romWords[i] : '', i }));
    let pool = shuffle(tokens); if (pool.map(t => t.i).join() === tokens.map(t => t.i).join() && pool.length > 1) pool = pool.reverse();
    const picked = [];
    const tileHTML = t => `${setG() || !useRom ? `<span class="gur">${esc(t.g)}</span>` : ''}${setR() && useRom ? `<span class="rom">${esc(t.r)}</span>` : ''}`;
    const draw = () => {
      el.innerHTML = `
        <div class="prompt-label">Put the words in order</div>
        <div class="prompt en-prompt">${esc(it.en)}</div>
        <div class="tiles answer">${picked.map((t, i) => `<button class="tile" data-back="${i}">${tileHTML(t)}</button>`).join('')}</div>
        <div class="tiles">${pool.map((t, i) => `<button class="tile" data-take="${i}">${tileHTML(t)}</button>`).join('')}</div>
        <div class="actions"><button class="btn teal big" data-k="check" ${pool.length ? 'disabled' : ''}>Check</button></div>`;
    };
    draw();
    el.onclick = e => {
      if (SES.answered) return;
      const tk = e.target.closest('[data-take]'), bk = e.target.closest('[data-back]'), ck = e.target.closest('[data-k="check"]');
      if (tk) { picked.push(pool.splice(+tk.dataset.take, 1)[0]); draw(); }
      else if (bk) { pool.push(picked.splice(+bk.dataset.back, 1)[0]); draw(); }
      else if (ck) {
        const ok = picked.map(t => t.g).join(' ') === ans.join(' ');
        el.querySelectorAll('button').forEach(b => b.disabled = true);
        grade(ok, it, card, el, { showAnswer: true });
      }
    };
  }

  function finishSession() {
    const advanced = E.maybeAdvance(PR, lessons);
    E.touchStreak(PR); save();
    SES = Object.assign(SES || {}, { advanced });
    go('summary');
  }

  function vSummary() {
    const s = SES || { right: 0, wrong: 0, missed: new Set() };
    const total = s.right + s.wrong, pct = total ? s.right / total : 0;
    const missed = [...(s.missed || [])].map(id => items[id]);
    if (s.advanced || pct >= 0.8) confetti();
    app.innerHTML = `
      <div class="celebrate">
        <div class="big-emoji">${s.advanced ? '🔓' : pct >= 0.9 ? '🏆' : pct >= 0.7 ? '⭐' : '💪'}</div>
        <h1>${s.advanced ? `Lesson ${PR.unlocked} unlocked!` : pct >= 0.9 ? 'Amazing!' : pct >= 0.7 ? 'Great practice!' : 'Good effort!'}</h1>
        <p class="muted">${s.right} of ${total} correct${s.advanced ? ' · new letters, words and phrases are ready' : ''}</p>
      </div>
      ${missed.length ? `<div class="card"><h3>Coming back soon</h3><div class="muted small" style="margin-bottom:8px">These will show up more often until they stick.</div>
        <div class="list">${missed.map(rowHTML).join('')}</div></div>` : ''}
      <div class="actions"><button class="btn" data-act="home">Home</button><button class="btn primary big" data-act="again">Practice more</button></div>`;
    app.onclick = e => {
      const b = e.target.closest('[data-act]'); if (b) { if (b.dataset.act === 'home') go('home'); else startSession(s.scope || 'all'); return; }
      const h = e.target.closest('[data-hear]'); if (h) speak(items[h.dataset.hear]);
    };
  }

  function rowHTML(it) {
    const st = E.itemStatus(PR, it.id);
    const main = it.kind === 'letter' ? `<span class="gur" style="font-size:34px">${esc(it.glyph)}</span>` : '';
    return `<div class="item-row">${main}
      <div class="txt">${it.kind === 'letter' ? `<b>${esc(it.rom)}</b> <span class="gur">${esc(it.name)}</span><div class="r">${esc(it.sound)}</div>` : `<b>${esc(it.en)}</b>${setG() ? `<div class="gur">${esc(it.pa)}</div>` : ''}<div class="r">${esc(it.rom)}</div>`}
        ${it.check ? `<div class="pill warn" title="${esc(it.check)}">ask teacher</div>` : ''}${it.src === 'generated' ? ' <span class="pill">added</span>' : ''}</div>
      <span class="pill ${st}">${st}</span><button class="icon-btn" data-hear="${it.id}" aria-label="Hear">🔊</button></div>`;
  }

  // ------------------------------------------------------------ progress
  function vProgress() {
    const req = E.masteryRequirement(PR), sk = E.skill(PR), ra = E.reviewAccuracy(PR);
    const tot = k => order[k].length, mast = k => order[k].filter(id => E.isMastered(PR, id, req)).length;
    const days = Object.keys(PR.days).length;
    const weak = Object.entries(PR.items).filter(([id, s]) => s.intro && s.wrong > 0 && !E.isMastered(PR, id, req))
      .sort((a, b) => (b[1].wrong - b[1].right * .3) - (a[1].wrong - a[1].right * .3)).slice(0, 8).map(([id]) => items[id]).filter(Boolean);
    app.innerHTML = `
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">←</button><div class="avatar">${esc(P.avatar)}</div><h2>${esc(P.name)}'s progress</h2></div>
      <div class="grid3">
        <div class="stat"><b>${mast('letter')}/${tot('letter')}</b><span class="muted small">letters</span></div>
        <div class="stat"><b>${mast('vocab')}/${tot('vocab')}</b><span class="muted small">words</span></div>
        <div class="stat"><b>${mast('phrase')}/${tot('phrase')}</b><span class="muted small">phrases</span></div>
      </div>
      <div class="grid3" style="margin-top:10px">
        <div class="stat"><b>${sk.n >= 8 ? Math.round(sk.acc * 100) + '%' : '—'}</b><span class="muted small">recent accuracy</span></div>
        <div class="stat"><b>${ra == null ? '—' : Math.round(ra * 100) + '%'}</b><span class="muted small">review accuracy</span></div>
        <div class="stat"><b>${days}</b><span class="muted small">days practiced</span></div>
      </div>
      <div class="card" style="margin-top:14px"><h3>Alphabet</h3><div class="muted small" style="margin-bottom:10px">Grey = not started · yellow = learning · green = mastered</div>
        <div class="letter-grid">${order.letter.map(id => `<div class="letter-cell ${E.itemStatus(PR, id, req)}" title="${esc(items[id].rom)}">${esc(items[id].glyph)}</div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><h3>Lessons</h3><div class="muted small" style="margin-bottom:10px">% mastered</div>
        <div class="lesson-grid">${lessons.map(L => { const s = E.lessonStats(PR, L); const open = L.n <= PR.unlocked; return `<div class="lesson-cell ${open ? (s.pct >= E.GATE.overall ? 'done' : 'open') : ''}"><b>${L.n}</b>${open ? Math.round(s.pct * 100) + '%' : '🔒'}</div>`; }).join('')}</div></div>
      <div class="card" style="margin-top:14px"><h3>How mastery works for ${esc(P.name)}</h3>
        <p class="small">An item counts as mastered after it's answered right on <b>${req.days} different days</b> and reaches level <b>${req.box}</b>. This adjusts with accuracy: doing well means fewer repeats; struggling adds more. The next lesson opens at 90% mastered (80% in each section) with review accuracy of at least 70%. Missed cards come back a few cards later and then more often until they stick.</p>
        <p class="small muted">Current pace: ${cap(req.label)} · Review share in sessions: ${Math.round((sk.acc < .7 ? .6 : sk.acc > .9 ? .25 : .4) * 100)}%</p></div>
      ${weak.length ? `<div class="card" style="margin-top:14px"><h3>Needs more practice</h3><div class="list" style="margin-top:8px">${weak.map(rowHTML).join('')}</div></div>` : ''}`;
    app.onclick = e => {
      if (e.target.closest('[data-act="back"]')) go('home');
      const h = e.target.closest('[data-hear]'); if (h) speak(items[h.dataset.hear]);
    };
  }

  // ------------------------------------------------------------ browse
  function vBrowse() {
    const L = lessons[route.lesson - 1], k = route.kind;
    const list = L[k].map(id => items[id]);
    app.innerHTML = `
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">←</button><h2>All cards</h2></div>
      <div class="tabs">${lessons.map(x => `<button class="tab ${x.n === L.n ? 'on' : ''}" data-l="${x.n}">${x.n <= PR.unlocked ? '' : '🔒 '}Lesson ${x.n}</button>`).join('')}</div>
      <div class="seg" style="margin:10px 0 14px">${['letter', 'vocab', 'phrase'].map(x => `<button class="${x === k ? 'on' : ''}" data-k="${x}">${KIND_LABEL[x]} (${L[x].length})</button>`).join('')}</div>
      ${L.n > PR.unlocked ? '<div class="muted small" style="margin-bottom:10px">Preview — this lesson opens once the earlier ones are mastered.</div>' : ''}
      <div class="list">${list.length ? list.map(rowHTML).join('') : '<div class="muted">Nothing in this section.</div>'}</div>`;
    app.onclick = e => {
      if (e.target.closest('[data-act="back"]')) return go('home');
      const t = e.target.closest('[data-l]'); if (t) return go('browse', { lesson: +t.dataset.l, kind: k });
      const s = e.target.closest('[data-k]'); if (s) return go('browse', { lesson: L.n, kind: s.dataset.k });
      const h = e.target.closest('[data-hear]'); if (h) speak(items[h.dataset.hear]);
    };
  }

  // ------------------------------------------------------------ settings / backup
  function vSettings() {
    const tts = S.ttsMode();
    const ttsLabel = { pa: 'Punjabi voice', hi: 'Hindi voice reading Punjabi (close match)', en: 'English voice reading the spelling (no Punjabi/Hindi voice on this device)', none: 'Not available' }[tts];
    app.innerHTML = `
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">←</button><h2>Backup &amp; settings</h2></div>
      <div class="card stack">
        <h3>Backup progress</h3>
        <p class="small muted">Progress is saved in this browser. Download a backup to move it to another device or keep it safe.</p>
        <div class="row wrap"><button class="btn teal" data-act="export">⬇ Download backup</button>
          <label class="btn">⬆ Restore backup<input type="file" accept="application/json,.json" id="imp" hidden></label></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <h3>Speech on this device</h3>
        <p class="small"><b>Listening:</b> ${S.available ? 'Supported. Tries Punjabi recognition first and falls back to English-sounds matching.' : 'Not supported in this browser — use Chrome or Edge. You can still practice by revealing the answer and checking yourself.'}</p>
        <p class="small"><b>Speaking:</b> ${ttsLabel}</p>
        <div class="row wrap"><button class="btn" data-act="test">🔊 Test voice</button></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <h3>Content</h3>
        <p class="small">${order.letter.length} letters · ${order.vocab.length} words · ${order.phrase.length} phrases · ${lessons.length} lessons.
        ${Object.values(items).filter(i => i.check).length} cards are flagged “ask teacher”; ${Object.values(items).filter(i => i.src === 'generated').length} words were added beyond the teacher's list.</p>
      </div>`;
    app.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'back') go(P ? 'home' : 'profiles');
      if (b.dataset.act === 'test') S.say({ pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', rom: 'sat sri akal' });
      if (b.dataset.act === 'export') {
        const blob = new Blob([JSON.stringify(Store.exportAll(), null, 1)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'punjabi-lessons-backup-' + E.dayKey(Date.now()) + '.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    };
    document.getElementById('imp').onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try { const n = Store.importAll(JSON.parse(await f.text())); toast(`Restored ${n} learner${n > 1 ? 's' : ''}`); if (P) { P = Store.profile(P.id); PR = Store.progress(P.id); } }
      catch (err) { toast('Could not read that file: ' + err.message); }
    };
  }

  // ------------------------------------------------------------ boot
  const act = Store.active();
  if (act) { P = act; PR = Store.progress(act.id); E.touchStreak(PR); route = { name: 'home' }; }
  render();
  window.__APP = { go, get P() { return P; }, get PR() { return PR; }, get SES() { return SES; } }; // for debugging/tests
})();
