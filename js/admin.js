/*
 * Admin console: add / edit words & phrases, fix how they sound, publish for everyone.
 *
 * Changes are kept as a draft in this browser (and can be previewed in the app on this device).
 * "Publish" writes data/custom.js (and any recordings to data/audio/) to the GitHub repo,
 * which is what the live site serves — so every learner gets the update.
 */
(function () {
  const M = window.MODEL, S = window.SPEECH;
  const root = document.getElementById('admin');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save in this browser: ' + e.message); return false; } },
    raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setRaw(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const K_DRAFT = 'pfc.admin.draft', K_GH = 'pfc.admin.gh', K_PREVIEW = 'pfc.admin.preview';
  const BASE = JSON.parse(JSON.stringify(window.CUSTOM || { version: 1, items: {}, added: [] }));
  const clone = o => JSON.parse(JSON.stringify(o));
  // --- drafts are "my changes on top of what was published"; rebased whenever the published file moves on
  function changesOf(d, base) {
    const ch = { items: {}, added: {} };
    const bi = (base && base.items) || {}, di = d.items || {};
    new Set(Object.keys(di).concat(Object.keys(bi))).forEach(id => {
      if (JSON.stringify(di[id] || null) !== JSON.stringify(bi[id] || null)) ch.items[id] = di[id] ? clone(di[id]) : null;
    });
    const ba = {}; ((base && base.added) || []).forEach(a => { ba[a.id] = a; });
    (d.added || []).forEach(a => { if (JSON.stringify(a) !== JSON.stringify(ba[a.id] || null)) ch.added[a.id] = clone(a); });
    Object.keys(ba).forEach(id => { if (!(d.added || []).find(x => x.id === id)) ch.added[id] = null; });
    return ch;
  }
  function applyChanges(target, ch) {
    const t = clone(target); t.items = t.items || {}; t.added = t.added || [];
    Object.entries(ch.items).forEach(([id, v]) => { if (v) t.items[id] = v; else delete t.items[id]; });
    Object.entries(ch.added).forEach(([id, v]) => {
      const i = t.added.findIndex(a => a.id === id);
      if (!v) { if (i >= 0) t.added.splice(i, 1); } else if (i >= 0) t.added[i] = v; else t.added.push(v);
    });
    return t;
  }
  const stripBase = d => { const o = clone(d); delete o.__base; return o; };
  let draft = LS.get(K_DRAFT, null);
  if (!draft) draft = Object.assign(clone(BASE), { __base: clone(BASE) });
  else {
    // rebase onto the currently published file so changes published from another device aren't lost
    const mine = changesOf(draft, draft.__base || BASE);
    draft = Object.assign(applyChanges(BASE, mine), { __base: clone(BASE) });
  }
  draft.items = draft.items || {}; draft.added = draft.added || [];
  if (LS.raw(K_DRAFT) !== JSON.stringify(draft)) {
    const had = LS.raw(K_DRAFT);
    LS.set(K_DRAFT, draft);
    // the card list was built from the old draft — rebuild once with the rebased one
    if (had && JSON.stringify(JSON.parse(had).items) + JSON.stringify(JSON.parse(had).added) !== JSON.stringify(draft.items) + JSON.stringify(draft.added)) { location.reload(); return; }
  }
  const gh = Object.assign({ owner: 'prognar', repo: 'Punjabi-Flash-Cards', branch: 'main', token: '' }, LS.get(K_GH, {}));
  // "setup link" from another device: admin.html#setup=<base64 json> → save, then scrub it from the address bar
  (() => {
    const m = /[#&]setup=([^&]+)/.exec(location.hash);
    if (!m) return;
    try { const cfg = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); Object.assign(gh, cfg); LS.set(K_GH, gh); setTimeout(() => toast('Publishing is set up on this device ✓'), 300); } catch (e) { setTimeout(() => toast('That setup link is broken'), 300); }
    history.replaceState(null, '', location.pathname);
  })();

  const KIND_LABEL = { vocab: 'Words', phrase: 'Phrases', letter: 'Letters' };
  const state = Object.assign({ tab: 'vocab', q: '', filter: 'all' }, (() => { try { return /setup=/.test(location.hash) ? {} : JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}'); } catch (e) { return {}; } })());

  // ------------------------------------------------------------------ helpers
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function toast(msg, ms = 2800) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
  const saveDraft = () => LS.set(K_DRAFT, draft);
  const stable = o => JSON.stringify(o, Object.keys(o || {}).sort());
  function pendingIds() {
    const ch = changesOf(draft, draft.__base || BASE);
    return [...new Set(Object.keys(ch.items).concat(Object.keys(ch.added)))];
  }
  function reloadKeeping(extra = {}) {
    location.hash = encodeURIComponent(JSON.stringify(Object.assign({ tab: state.tab, q: state.q, filter: state.filter }, extra)));
    location.reload();
  }
  function speakItem(it, over = {}) {
    const p = Object.assign({ audio: it.audio, speakAs: it.speakAs, voice: it.voice, rate: it.rate }, over);
    S.say({ pa: it.kind === 'letter' ? it.name : (over.pa || it.paAnswers[0]), rom: over.rom || it.rom, audio: p.audio, speakAs: p.speakAs, voice: p.voice, rate: p.rate }, { rate: 0.8 });
  }
  const statusBadges = it => [
    it.hidden ? '<span class="pill">hidden</span>' : '',
    it.src === 'admin' ? '<span class="pill new">added</span>' : it.src === 'generated' ? '<span class="pill">generated</span>' : it.kind !== 'letter' ? '<span class="pill">teacher</span>' : '',
    it.verified ? '<span class="pill mastered">✓ checked</span>' : '',
    it.check ? '<span class="pill warn">ask teacher</span>' : '',
    it.audio ? '<span class="pill learning">🎙 recorded</span>' : (it.speakAs || it.voice) ? '<span class="pill learning">voice tuned</span>' : '',
    pendingIds().includes(it.id) ? '<span class="pill dot">unpublished</span>' : ''
  ].join(' ');

  // ------------------------------------------------------------------ main view
  function listItems() {
    const q = state.q.trim().toLowerCase();
    let ids = state.tab === 'letter' ? M.order.letter.slice() : M.order[state.tab].slice();
    if (state.tab !== 'letter') ids = ids.concat(Object.values(M.items).filter(x => x.kind === state.tab && x.hidden).map(x => x.id));
    return ids.map(id => M.items[id]).filter(it => {
      if (state.filter === 'teacher' && it.src !== 'teacher') return false;
      if (state.filter === 'generated' && it.src !== 'generated') return false;
      if (state.filter === 'added' && it.src !== 'admin') return false;
      if (state.filter === 'check' && !(it.check || (!it.verified && it.kind !== 'letter'))) return false;
      if (state.filter === 'unpublished' && !pendingIds().includes(it.id)) return false;
      if (!q) return true;
      return [it.en, it.pa, it.rom, it.name || ''].join(' ').toLowerCase().includes(q);
    });
  }

  function render() {
    const pend = pendingIds();
    const preview = LS.raw(K_PREVIEW) === '1';
    const list = listItems();
    const vi = S.voiceInfo();
    root.innerHTML = `
      <header class="adm-top">
        <a class="icon-btn" href="index.html" aria-label="Back to app" title="Back to app">←</a>
        <div><h1>Admin</h1><div class="muted small">Add and fix words, phrases and how they sound.</div></div>
        <span class="spacer"></span>
        <div class="publish-box">
          <div class="small ${pend.length ? 'pending' : 'muted'}">${pend.length ? `${pend.length} unpublished change${pend.length > 1 ? 's' : ''} <span class="muted">(saved on this device only)</span>` : 'Everything is published'}</div>
          ${gh.token ? `<button class="btn primary" data-a="publish" ${pend.length ? '' : 'disabled'}>⬆ Publish</button>`
            : `<button class="btn primary" data-a="setup">🔑 Set up publishing</button>`}
        </div>
      </header>

      <details class="card gh" ${gh.token ? '' : 'open'}>
        <summary><b>Publishing setup</b> <span class="muted small">${gh.token ? `connected to ${esc(gh.owner)}/${esc(gh.repo)} (${esc(gh.branch)})` : 'not set up — needed to publish'}</span></summary>
        <p class="small">Publishing saves your changes into the app's GitHub repository, which is what the live site serves. It needs a GitHub access token, kept only in this browser.</p>
        <ol class="small">
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>.</li>
          <li>Repository access: <b>Only select repositories</b> → <b>${esc(gh.repo)}</b>.</li>
          <li>Permissions → Repository → <b>Contents: Read and write</b>. Generate, copy, paste below.</li>
        </ol>
        <div class="gh-grid">
          <label class="field"><span>Owner</span><input class="input" id="ghOwner" value="${esc(gh.owner)}"></label>
          <label class="field"><span>Repository</span><input class="input" id="ghRepo" value="${esc(gh.repo)}"></label>
          <label class="field"><span>Branch</span><input class="input" id="ghBranch" value="${esc(gh.branch)}"></label>
          <label class="field wide"><span>Token</span><input class="input" id="ghToken" type="password" autocomplete="off" placeholder="github_pat_…" value="${esc(gh.token)}"></label>
        </div>
        <p class="small muted">The token is remembered per browser — set it up once on each phone or computer you publish from.
          ${gh.token ? 'To set up another device quickly, copy the setup link below and open it there (send it only to yourself — it contains the token).' : ''}</p>
        <div class="row wrap"><button class="btn teal" data-a="ghsave">Save &amp; test</button>${gh.token ? '<button class="btn" data-a="setuplink">📱 Copy setup link for another device</button>' : ''}<button class="btn ghost" data-a="ghforget">Forget token</button>
          <button class="btn ghost" data-a="download">⬇ Download custom.js instead</button></div>
      </details>

      <div class="row wrap toolbar">
        <div class="seg">${['vocab', 'phrase', 'letter'].map(k => `<button class="${k === state.tab ? 'on' : ''}" data-tab="${k}">${KIND_LABEL[k]}</button>`).join('')}</div>
        <input class="input search" id="q" placeholder="Search English, Gurmukhi or sounds-like…" value="${esc(state.q)}">
        <select class="input" id="filter">
          ${[['all', 'All'], ['teacher', "Teacher's"], ['generated', 'Generated'], ['added', 'Added here'], ['check', 'Not checked yet'], ['unpublished', 'Unpublished']].map(([v, l]) => `<option value="${v}" ${v === state.filter ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        ${state.tab !== 'letter' ? `<button class="btn primary" data-a="add">＋ Add ${state.tab === 'vocab' ? 'word' : 'phrase'}</button>` : ''}
      </div>
      <div class="row wrap small muted" style="margin:6px 2px 10px">
        <span>${list.length} shown</span><span>·</span>
        <span>Voices on this device: ${vi.pa ? 'Punjabi ✓' : 'Punjabi ✗'}, ${vi.hi ? 'Hindi ✓' : 'Hindi ✗'}, ${vi.en ? 'English ✓' : 'English ?'} — other people's devices may differ, so <b>recording</b> is the surest fix.</span>
        <button class="btn ghost" data-a="soundcheck">🔊 Sound check</button>
        <span class="spacer"></span>
        <label class="row" style="gap:6px"><input type="checkbox" id="preview" ${preview ? 'checked' : ''}> Preview unpublished changes in the app on this device</label>
      </div>

      <div class="adm-list">
        ${list.map(it => `
          <div class="adm-row ${it.hidden ? 'is-hidden' : ''}" data-id="${it.id}">
            <div class="lno" title="Lesson">${it.lesson ? 'L' + it.lesson : '—'}</div>
            <div class="main">
              <div class="en">${it.kind === 'letter' ? `<span class="gur big">${esc(it.glyph)}</span> ${esc(it.name)}` : esc(it.en)}</div>
              ${it.kind !== 'letter' ? `<div class="gur">${esc(it.pa)}</div>` : `<div class="muted small">${esc(it.sound)}</div>`}
              <div class="rom">${esc(it.rom)}</div>
              <div class="badges">${statusBadges(it)}</div>
            </div>
            <button class="icon-btn" data-play="${it.id}" aria-label="Play">🔊</button>
            <button class="btn" data-edit="${it.id}">Edit</button>
          </div>`).join('') || '<div class="muted">Nothing matches.</div>'}
      </div>`;
    bindMain();
  }

  function bindMain() {
    root.onclick = e => {
      const t = e.target;
      const tab = t.closest('[data-tab]'); if (tab) { state.tab = tab.dataset.tab; render(); return; }
      const play = t.closest('[data-play]'); if (play) { speakItem(M.items[play.dataset.play]); return; }
      const ed = t.closest('[data-edit]'); if (ed) { openEditor(M.items[ed.dataset.edit]); return; }
      const a = t.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'add') openEditor(null);
      if (a.dataset.a === 'publish') publish();
      if (a.dataset.a === 'setup') { const d = document.querySelector('details.gh'); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); setTimeout(() => document.getElementById('ghToken').focus(), 400); }
      if (a.dataset.a === 'setuplink') {
        const link = location.origin + location.pathname + '#setup=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({ owner: gh.owner, repo: gh.repo, branch: gh.branch, token: gh.token })))));
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Setup link copied — open it on your phone (keep it private)', 4500))
          .catch(() => { prompt('Copy this link and open it on the other device (keep it private):', link); });
      }
      if (a.dataset.a === 'soundcheck') soundCheck();
      if (a.dataset.a === 'download') download();
      if (a.dataset.a === 'ghsave') ghSave();
      if (a.dataset.a === 'ghforget') { gh.token = ''; LS.set(K_GH, gh); toast('Token removed from this browser'); render(); }
    };
    const q = document.getElementById('q');
    q.oninput = () => { state.q = q.value; const pos = q.selectionStart; render(); const q2 = document.getElementById('q'); q2.focus(); q2.setSelectionRange(pos, pos); };
    document.getElementById('filter').onchange = e => { state.filter = e.target.value; render(); };
    document.getElementById('preview').onchange = e => { if (e.target.checked) { LS.setRaw(K_PREVIEW, '1'); saveDraft(); toast('The app on this device now shows your unpublished changes'); } else { LS.del(K_PREVIEW); toast('The app shows only published content'); } };
  }

  // ------------------------------------------------------------------ editor
  const GUR_KEYS = [
    'ੳ ਅ ੲ ਸ ਹ ਕ ਖ ਗ ਘ ਙ ਚ ਛ ਜ ਝ ਞ ਟ ਠ ਡ ਢ ਣ ਤ ਥ ਦ ਧ ਨ ਪ ਫ ਬ ਭ ਮ ਯ ਰ ਲ ਵ ੜ',
    'ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼ ਆ ਇ ਈ ਉ ਊ ਏ ਐ ਓ ਔ',
    'ਾ ਿ ੀ ੁ ੂ ੇ ੈ ੋ ੌ ੰ ਂ ੱ ੍ ਼'
  ];

  function openEditor(it) {
    const isNew = !it;
    const kind = it ? it.kind : state.tab;
    const isLetter = kind === 'letter';
    // working copy of the fields
    const w = it ? {
      en: it.en, pa: it.pa, rom: it.rom, note: it.note || '', alt: (it.paAnswers || []).slice(it.pa.split(' / ').length).join(', '),
      verified: !!it.verified, hidden: !!it.hidden, speakAs: it.speakAs || '', voice: it.voice || 'auto', rate: it.rate || 0.8,
      audio: it.audio || '', sound: it.sound || '', after: ''
    } : { en: '', pa: '', rom: '', note: '', alt: '', verified: false, hidden: false, speakAs: '', voice: 'auto', rate: 0.8, audio: '', sound: '', after: '' };
    let romTouched = !!(it && it.rom);
    const origPa = it ? it.pa : '';
    let rec = null, chunks = [];
    const ov = document.createElement('div'); ov.className = 'adm-overlay';
    const vi = S.voiceInfo();
    const afterOptions = () => M.order[kind].map(id => `<option value="${id}">after: ${esc(M.items[id].en)} (L${M.items[id].lesson})</option>`).join('');
    const draw = () => {
      const sugg = w.pa ? S.anglicize(w.pa) : '';
      ov.innerHTML = `
        <div class="adm-panel" role="dialog" aria-label="Edit">
          <div class="row"><h2>${isNew ? `Add a ${kind === 'vocab' ? 'word' : 'phrase'}` : isLetter ? `Letter ${esc(it.glyph)} ${esc(it.name)}` : 'Edit'}</h2><span class="spacer"></span><button class="icon-btn" data-x="close" aria-label="Close">✕</button></div>
          ${!isNew && it.lesson ? `<div class="muted small">Lesson ${it.lesson} · id <code>${it.id}</code></div>` : ''}
          ${isLetter ? `
            <label class="field"><span>Letter name, sounds-like</span><input class="input" data-f="rom" value="${esc(w.rom)}"></label>
            <label class="field"><span>Sound hint (shown on the card)</span><input class="input" data-f="sound" value="${esc(w.sound)}"></label>
          ` : `
            <label class="field"><span>English *</span><input class="input" data-f="en" value="${esc(w.en)}" placeholder="${kind === 'vocab' ? 'e.g. butterfly' : 'e.g. where are you going?'}"></label>
            <label class="field"><span>Gurmukhi <span class="muted">(use " / " between alternatives)</span></span>
              <div class="row"><input class="input gur-in" data-f="pa" lang="pa" value="${esc(w.pa)}" placeholder="ਗੁਰਮੁਖੀ"><button class="btn" data-x="kbd" title="Gurmukhi keyboard">⌨</button></div></label>
            <div class="kbd hidden" id="kbd">${GUR_KEYS.map(r => `<div class="krow">${r.split(' ').map(k => `<button class="key gur" data-k="${k}">${/^[਼-੍ੰੱਂ]$/.test(k) ? '◌' + k : k}</button>`).join('')}</div>`).join('')}
              <div class="krow"><button class="key" data-k=" ">space</button><button class="key" data-k="⌫">⌫</button><button class="key" data-k=" / ">or /</button></div></div>
            <div class="small muted">Don't know the Gurmukhi? <a href="https://translate.google.com/?sl=en&tl=pa&op=translate&text=${encodeURIComponent(w.en)}" target="_blank" rel="noopener">Look it up on Google Translate ↗</a> (check it with the teacher).</div>
            <label class="field"><span>Sounds like (English letters) <span class="muted">— leave empty and it's filled in from the Gurmukhi</span></span>
              <input class="input" data-f="rom" value="${esc(w.rom)}" placeholder="${esc(sugg || 'e.g. tit-lee')}"></label>
            ${sugg && sugg !== w.rom && (!w.rom || w.pa !== origPa) ? `<div class="sugg small">Suggested from the Gurmukhi: <b>${esc(sugg)}</b> <button class="link-btn" data-x="usesugg">Use this</button></div>` : ''}
            <label class="field"><span>Other accepted answers (Gurmukhi, comma-separated)</span><input class="input gur-in" data-f="alt" value="${esc(w.alt)}"></label>
            <label class="field"><span>Note shown on the card</span><input class="input" data-f="note" value="${esc(w.note)}" placeholder="e.g. used for both yesterday and tomorrow"></label>
            ${isNew ? `<label class="field"><span>Where in the lessons</span><select class="input" data-f="after"><option value="">Next class slot (after the teacher's latest, before generated words)</option>${afterOptions()}</select></label>` : ''}
            <div class="row wrap">
              <label class="row" style="gap:6px"><input type="checkbox" data-f="verified" ${w.verified ? 'checked' : ''}> Checked by the teacher</label>
              ${!isNew ? `<label class="row" style="gap:6px"><input type="checkbox" data-f="hidden" ${w.hidden ? 'checked' : ''}> Hide from lessons</label>` : ''}
            </div>
          `}

          <div class="card pron">
            <h3>How it sounds</h3>
            <div class="row wrap"><button class="btn teal" data-x="play">🔊 Play it as learners will hear it</button></div>
            <div class="muted small">${w.audio ? 'Learners hear <b>your recording</b>.' : `Learners hear the computer voice: ${vi.auto === 'pa' ? 'Punjabi' : vi.auto === 'hi' ? 'Hindi voice reading Punjabi' : 'English voice reading the sounds-like spelling'} on this device.`}</div>

            <h4>🎙 Record it (best — sounds the same for everyone)</h4>
            <div class="row wrap">
              <button class="btn ${rec ? 'danger' : ''}" data-x="rec">${rec ? '■ Stop recording' : '● Record'}</button>
              ${w.audio ? '<button class="btn" data-x="playrec">▶ Play recording</button><button class="btn ghost" data-x="delrec">🗑 Remove recording</button>' : ''}
            </div>
            ${rec ? '<div class="small pending">Recording… say it clearly, then press Stop.</div>' : ''}

            <h4>Or tune the computer voice</h4>
            <div class="row wrap">
              <label class="field"><span>Voice</span><select class="input" data-f="voice">
                ${[['auto', 'Automatic'], ['pa', 'Punjabi' + (vi.pa ? '' : ' (not on this device)')], ['hi', 'Hindi reading Punjabi' + (vi.hi ? '' : ' (not on this device)')], ['en', 'English reading the spelling']].map(([v, l]) => `<option value="${v}" ${w.voice === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="field"><span>Speed <b id="rateV">${(+w.rate).toFixed(2)}</b></span><input type="range" min="0.5" max="1.2" step="0.05" data-f="rate" value="${w.rate}"></label>
            </div>
            <label class="field"><span>Say it as (optional) — a different spelling just for the voice, in Gurmukhi or English letters</span>
              <input class="input" data-f="speakAs" value="${esc(w.speakAs)}" placeholder="e.g. ਗੈਂਦ  or  guy-nd"></label>
            <div class="row wrap"><button class="btn" data-x="try" data-v="pa">Try Punjabi voice</button><button class="btn" data-x="try" data-v="hi">Try Hindi voice</button><button class="btn" data-x="try" data-v="en">Try English voice</button></div>
          </div>

          <div class="row wrap" style="margin-top:14px">
            ${!isNew && it.edited && !it.added ? '<button class="btn ghost" data-x="revert">↺ Undo all my changes to this card</button>' : ''}
            ${isNew || !it.added ? '' : '<button class="btn ghost danger-t" data-x="delete">Delete this card</button>'}
            <span class="spacer"></span>
            <button class="btn" data-x="close">Cancel</button>
            <button class="btn primary big" data-x="save">Save</button>
          </div>
        </div>`;
    };
    draw();
    document.body.appendChild(ov);
    const read = () => {
      ov.querySelectorAll('[data-f]').forEach(i => { w[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; });
      w.rate = +w.rate;
    };
    const current = () => {
      read();
      const pa = w.pa || (it && it.pa) || '';
      return Object.assign({}, it || { kind, paAnswers: [pa.split(' / ')[0]], name: '' }, {
        pa, paAnswers: [pa.split(' / ')[0]], rom: w.rom || S.anglicize(pa), audio: w.audio || undefined, speakAs: w.speakAs || undefined, voice: w.voice, rate: w.rate
      });
    };
    let lastPa = w.pa;
    ov.addEventListener('input', e => {
      const f = e.target.dataset.f;
      if (f === 'rate') { ov.querySelector('#rateV').textContent = (+e.target.value).toFixed(2); }
      if (f === 'rom') romTouched = !!e.target.value;
      if (f === 'pa') {
        read();
        // keep the suggestion line fresh without re-rendering the field being typed in
        const box = ov.querySelector('.sugg');
        const sg = w.pa ? S.anglicize(w.pa) : '';
        const html = sg && sg !== w.rom && (!w.rom || w.pa !== origPa) ? `Suggested from the Gurmukhi: <b>${esc(sg)}</b> <button class="link-btn" data-x="usesugg">Use this</button>` : '';
        if (box) box.innerHTML = html; else if (html) ov.querySelector('[data-f="rom"]').closest('.field').insertAdjacentHTML('afterend', `<div class="sugg small">${html}</div>`);
        const romIn = ov.querySelector('[data-f="rom"]'); if (romIn) romIn.placeholder = sg || 'e.g. tit-lee';
        lastPa = w.pa;
      }
    });
    ov.addEventListener('click', async e => {
      const key = e.target.closest('[data-k]');
      if (key) {
        const inp = ov.querySelector('[data-f="pa"]'); const k = key.dataset.k;
        const s0 = inp.selectionStart ?? inp.value.length, s1 = inp.selectionEnd ?? inp.value.length;
        if (k === '⌫') { const a = Array.from(inp.value.slice(0, s0)); a.pop(); const before = a.join(''); inp.value = before + inp.value.slice(s1); inp.setSelectionRange(before.length, before.length); }
        else { inp.value = inp.value.slice(0, s0) + k + inp.value.slice(s1); inp.setSelectionRange(s0 + k.length, s0 + k.length); }
        inp.focus(); inp.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      const x = e.target.closest('[data-x]'); if (!x) return;
      const a = x.dataset.x;
      if (a === 'close') { if (rec) rec.stop(); ov.remove(); return; }
      if (a === 'kbd') { ov.querySelector('#kbd').classList.toggle('hidden'); return; }
      if (a === 'usesugg') { read(); w.rom = S.anglicize(w.pa); romTouched = true; ov.querySelector('[data-f="rom"]').value = w.rom; const b = ov.querySelector('.sugg'); if (b) b.remove(); return; }
      if (a === 'play') { const c = current(); speakItem(c, { pa: c.paAnswers[0], rom: c.rom }); return; }
      if (a === 'playrec') { read(); S.say({ audio: w.audio, pa: '' }); return; }
      if (a === 'try') { const c = current(); speakItem(c, { audio: '', voice: x.dataset.v, pa: c.paAnswers[0], rom: c.rom }); return; }
      if (a === 'delrec') { read(); w.audio = ''; draw(); return; }
      if (a === 'rec') {
        read();
        if (rec) { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
          rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = [];
          rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
          rec.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            rec = null;
            toWavDataUrl(blob).then(url => {
              if (url.length > 900 * 1024) { toast('That recording is too long — keep it under ~10 seconds'); draw(); return; }
              w.audio = url; draw(); toast('Recorded ✓ — tap ▶ Play recording to check it');
            });
          };
          rec.start(); draw();
          setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 12000);
        } catch (err) { rec = null; toast('Microphone not available: ' + err.message); draw(); }
        return;
      }
      if (a === 'revert') {
        if (!confirm('Undo all unpublished and published changes to this card and go back to the original?')) return;
        delete draft.items[it.id]; saveDraft(); reloadKeeping();
        return;
      }
      if (a === 'delete') {
        if (!confirm('Delete this card for everyone? Learner progress on it is kept but it will no longer appear.')) return;
        draft.added = draft.added.filter(x => x.id !== it.id); delete draft.items[it.id]; saveDraft(); reloadKeeping();
        return;
      }
      if (a === 'save') {
        read();
        if (rec) { toast('Stop the recording first'); return; }
        if (!isLetter) {
          if (!w.en.trim()) { toast('English is required'); return; }
          if (!w.pa.trim()) { toast('Add the Gurmukhi (use the ⌨ keyboard or the Google Translate link)'); return; }
          if (!w.rom.trim()) w.rom = S.anglicize(w.pa);
        }
        const alt = w.alt.split(',').map(s => s.trim()).filter(Boolean);
        const pron = { speakAs: w.speakAs.trim() || undefined, voice: w.voice !== 'auto' ? w.voice : undefined, rate: Math.abs(w.rate - 0.8) > 0.001 ? w.rate : undefined, audio: w.audio || undefined };
        if (isNew) {
          let id = (kind === 'vocab' ? 'v-' : 'p-') + M.slug(w.en);
          let n = 2; while (M.items[id] || draft.added.find(x => x.id === id)) id = id.replace(/-\d+$/, '') + '-' + n++;
          const row = clean(Object.assign({ id, kind, en: w.en.trim(), pa: w.pa.trim(), rom: w.rom.trim(), note: w.note.trim() || undefined, alt: alt.length ? alt : undefined,
            verified: w.verified || undefined, after: w.after || undefined, src: 'admin' }, pron));
          draft.added.push(row);
          saveDraft(); toast('Added — publish to share it'); setTimeout(() => reloadKeeping(), 500);
          return;
        }
        if (it.added) {
          const row = draft.added.find(x => x.id === it.id);
          Object.assign(row, { en: w.en.trim(), pa: w.pa.trim(), rom: w.rom.trim(), note: w.note.trim() || undefined, alt: alt.length ? alt : undefined, verified: w.verified || undefined, hidden: w.hidden || undefined });
          ['speakAs', 'voice', 'rate', 'audio'].forEach(k => { row[k] = pron[k]; });
          Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
          saveDraft(); toast('Saved — publish to share it'); setTimeout(() => reloadKeeping(), 400);
          return;
        }
        // patch only what differs from the original card
        const b = it.base || { en: it.en, pa: it.pa, rom: it.rom, opt: {} };
        const patch = {};
        if (isLetter) {
          const L = window.CONTENT.letters[it.index];
          if (w.rom.trim() && w.rom.trim() !== L[2]) patch.rom = w.rom.trim();
          if (w.sound.trim() && w.sound.trim() !== L[3]) patch.sound = w.sound.trim();
        } else {
          if (w.en.trim() !== b.en) patch.en = w.en.trim();
          if (w.pa.trim() !== b.pa) patch.pa = w.pa.trim();
          if (w.rom.trim() !== b.rom) patch.rom = w.rom.trim();
          if ((w.note.trim() || '') !== (b.opt.note || '')) patch.note = w.note.trim();
          if (JSON.stringify(alt) !== JSON.stringify(b.opt.alt || [])) patch.alt = alt;
          if (w.verified) patch.verified = true;
          if (w.hidden) patch.hidden = true;
          if (w.verified && b.opt.check) patch.check = ''; // teacher has checked it — drop the warning
        }
        Object.entries(pron).forEach(([k, v]) => { if (v !== undefined) patch[k] = v; });
        if (Object.keys(patch).length) draft.items[it.id] = patch; else delete draft.items[it.id];
        saveDraft(); toast('Saved — publish to share it'); setTimeout(() => reloadKeeping(), 400);
      }
    });
  }
  /**
   * Any recording → small mono 16 kHz WAV with the silence trimmed off both ends.
   * WAV plays on every phone and browser (Chrome records WebM, which older iPhones can't play).
   */
  async function toWavDataUrl(blob) {
    const blobToDataUrl = b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const ab = await (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer());
      const buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
      ac.close && ac.close();
      const RATE = 16000;
      const off = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.max(1, Math.ceil(buf.duration * RATE)), RATE);
      const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
      const out = await off.startRendering();
      let d = out.getChannelData(0);
      // trim silence (keep 0.12 s of padding)
      let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      const th = Math.max(0.02, peak * 0.08), pad = Math.round(0.12 * RATE);
      let a = 0, b = d.length - 1;
      while (a < d.length && Math.abs(d[a]) < th) a++;
      while (b > a && Math.abs(d[b]) < th) b--;
      if (b > a) d = d.subarray(Math.max(0, a - pad), Math.min(d.length, b + pad));
      const gain = peak > 0 && peak < 0.5 ? 0.9 / peak : 1; // even out quiet recordings
      const bytes = new DataView(new ArrayBuffer(44 + d.length * 2));
      const str = (o, t) => { for (let i = 0; i < t.length; i++) bytes.setUint8(o + i, t.charCodeAt(i)); };
      str(0, 'RIFF'); bytes.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
      bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
      str(36, 'data'); bytes.setUint32(40, d.length * 2, true);
      for (let i = 0; i < d.length; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i] * gain)) * 0x7fff, true);
      return blobToDataUrl(new Blob([bytes.buffer], { type: 'audio/wav' }));
    } catch (e) {
      console.warn('WAV conversion failed, keeping original recording', e);
      return blobToDataUrl(blob);
    }
  }
  const clean = o => { Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o; };

  // ------------------------------------------------------------------ publishing (GitHub contents API)
  function ghSave() {
    gh.owner = document.getElementById('ghOwner').value.trim();
    gh.repo = document.getElementById('ghRepo').value.trim();
    gh.branch = document.getElementById('ghBranch').value.trim() || 'main';
    gh.token = document.getElementById('ghToken').value.trim();
    LS.set(K_GH, gh);
    ghTest();
  }
  async function api(path, opts = {}) {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}${path}`, Object.assign({
      headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
    }, opts));
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(body.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return body;
  }
  async function ghTest() {
    if (!gh.token) { toast('Paste a token first'); return; }
    try {
      const repo = await api('');
      if (repo.permissions && repo.permissions.push === false) throw new Error('this token can read but not write the repository');
      toast(`Connected to ${repo.full_name} ✓`); render();
    } catch (e) { toast('GitHub said: ' + e.message, 5000); }
  }
  const b64utf8 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  async function putFile(path, contentB64, message) {
    let sha;
    try { sha = (await api(`/contents/${path}?ref=${encodeURIComponent(gh.branch)}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
    return api(`/contents/${path}`, { method: 'PUT', body: JSON.stringify(Object.assign({ message, content: contentB64, branch: gh.branch }, sha ? { sha } : {})) });
  }
  function customJs(obj) {
    return `/*
 * Changes made in the admin console (admin.html). Published automatically from there — no need to edit by hand.
 * items: edits keyed by card id (en, pa, rom, note, alt, hidden, verified, speakAs, audio, rate, voice, sound)
 * added: new cards { id, kind: 'vocab'|'phrase', en, pa, rom, note, after }
 */
window.CUSTOM = ${JSON.stringify(obj, null, 2)};
`;
  }
  async function publish() {
    if (!gh.token) { document.querySelector('details.gh').open = true; toast('Set up publishing first (token)'); return; }
    const pend = pendingIds();
    const btn = root.querySelector('[data-a="publish"]'); btn.disabled = true; btn.textContent = 'Publishing…';
    try {
      // 0) start from the latest published file (someone may have published from another device)
      btn.textContent = 'Checking for other changes…';
      let latest = BASE;
      try {
        const f = await api(`/contents/data/custom.js?ref=${encodeURIComponent(gh.branch)}`);
        const txt = new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
        const m = /window\.CUSTOM\s*=\s*([\s\S]*?);\s*$/.exec(txt.trim());
        if (m) latest = JSON.parse(m[1]);
      } catch (e) { if (e.status && e.status !== 404) throw e; }
      // 1) upload new recordings
      const out = stripBase(applyChanges(latest, changesOf(draft, draft.__base || BASE)));
      const recs = [];
      Object.entries(out.items).forEach(([id, p]) => { if (p.audio && p.audio.startsWith('data:')) recs.push([id, p]); });
      out.added.forEach(a => { if (a.audio && a.audio.startsWith('data:')) recs.push([a.id, a]); });
      for (const [id, p] of recs) {
        const m = /^data:([^;,]+)[^,]*,(.*)$/.exec(p.audio);
        const ext = /wav/.test(m[1]) ? 'wav' : /mp4|m4a|aac/.test(m[1]) ? 'm4a' : /ogg/.test(m[1]) ? 'ogg' : 'webm';
        const path = `data/audio/${id}-${Date.now().toString(36)}.${ext}`;
        btn.textContent = `Uploading recording for ${id}…`;
        await putFile(path, m[2], `Admin: recording for ${id}`);
        p.audio = path;
      }
      // 2) write data/custom.js
      btn.textContent = 'Saving changes…';
      const names = pend.map(id => (M.items[id] && M.items[id].en) || id).slice(0, 6).join(', ');
      await putFile('data/custom.js', b64utf8(customJs(out)), `Admin: update ${pend.length} card${pend.length > 1 ? 's' : ''} (${names}${pend.length > 6 ? '…' : ''})`);
      Object.keys(BASE).forEach(k => delete BASE[k]); Object.assign(BASE, clone(out));
      window.CUSTOM = clone(out);
      draft = Object.assign(clone(out), { __base: clone(out) }); saveDraft();
      toast('Published ✓ — live for everyone in about a minute', 5000);
      render();
    } catch (e) {
      toast('Publish failed: ' + e.message + (e.status === 401 ? ' (check the token)' : e.status === 404 ? ' (check owner/repo/branch and token access)' : ''), 7000);
      btn.disabled = false; btn.textContent = '⬆ Publish';
    }
  }
  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([customJs(stripBase(draft))], { type: 'text/javascript' }));
    a.download = 'custom.js'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Downloaded — replace data/custom.js in the repo with it. (Recordings only publish via the token.)', 6000);
  }

  function soundCheck() {
    const info = S.voiceInfo();
    const a = document.createElement('audio');
    const fmt = t => a.canPlayType(t) ? '✓' : '✗';
    S.say({ pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', rom: 'sat sri akal' });
    setTimeout(() => {
      const last = S.sound.last;
      alertBox(`<b>Sound check</b><br>
        Text-to-speech: ${window.speechSynthesis ? 'available' : '<b>not available</b>'} · voices loaded: ${window.speechSynthesis ? speechSynthesis.getVoices().length : 0}<br>
        Punjabi voice: ${esc(info.pa || 'none')} · Hindi voice: ${esc(info.hi || 'none')} · English voice: ${esc(info.en || 'none')}<br>
        Can play recordings: WAV ${fmt('audio/wav')} · WebM ${fmt('audio/webm')} · M4A ${fmt('audio/mp4')}<br>
        Last sound result: ${last ? esc(last.kind + (last.detail ? ' — ' + last.detail : '')) : 'nothing reported (if you heard nothing, check the volume and the silent switch)'}`);
    }, 1500);
  }
  function alertBox(html) {
    const d = document.createElement('div'); d.className = 'adm-overlay';
    d.innerHTML = `<div class="adm-panel"><div class="small">${html}</div><div class="row"><span class="spacer"></span><button class="btn primary">OK</button></div></div>`;
    d.onclick = e => { if (e.target.closest('button') || e.target === d) d.remove(); };
    document.body.appendChild(d);
  }
  window.addEventListener('pfc-sound', e => {
    const r = e.detail || {};
    if (r.kind === 'audio-failed') toast("Couldn't play the recording on this device (" + (r.detail || 'error') + ') — using the computer voice', 4500);
    if (r.kind === 'tts-error') toast('No sound: the voice reported "' + r.detail + '". Check volume / silent switch, then try 🔊 Sound check', 5000);
    if (r.kind === 'no-tts') toast('This browser has no text-to-speech. Record the word instead.', 5000);
  });

  // voices load asynchronously in some browsers
  if (window.speechSynthesis) window.speechSynthesis.addEventListener && window.speechSynthesis.addEventListener('voiceschanged', () => { if (!document.querySelector('.adm-overlay')) render(); });
  render();
  if (state.edit && M.items[state.edit]) openEditor(M.items[state.edit]);
  window.__ADMIN = { draft: () => draft, pendingIds, render, openEditor: id => openEditor(id ? M.items[id] : null) };
})();
