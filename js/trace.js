/*
 * Letter tracing / writing pad.
 * Scoring compares the child's ink with the letter shape rendered from a Gurmukhi font:
 *   coverage  = how much of the letter was drawn over
 *   precision = how much of the ink stayed on the letter
 * Freehand mode first rescales the drawing to the letter's bounding box, and is more forgiving.
 */
(function (root) {
  const FONT = '"Noto Sans Gurmukhi", "Baloo Paaji 2", sans-serif';
  const N = 128; // scoring grid

  function TracePad(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.glyph = opts.glyph; this.mode = opts.mode || 'trace'; // 'trace' | 'write'
    this.others = opts.others || [];
    this.strokes = []; this.cur = null; this.showAnswer = false;
    this.colors = opts.colors || { guide: '#e8dccb', ink: '#2b59c3', answer: 'rgba(231,111,81,.55)', line: '#f1e7d8' };
    this._resize();
    this._bind();
    const ready = root.document && document.fonts ? document.fonts.load('100px "Noto Sans Gurmukhi"', this.glyph).catch(() => {}) : Promise.resolve();
    ready.then(() => this.draw());
  }
  TracePad.prototype._resize = function () {
    const r = this.c.getBoundingClientRect();
    const dpr = root.devicePixelRatio || 1;
    this.size = Math.max(200, Math.round(r.width || 300));
    this.c.width = this.size * dpr; this.c.height = this.size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  TracePad.prototype._pos = function (e) {
    const r = this.c.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; // normalized 0..1
  };
  TracePad.prototype._bind = function () {
    const c = this.c;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); this.cur = [this._pos(e)]; this.strokes.push(this.cur); this.draw(); });
    c.addEventListener('pointermove', e => { if (!this.cur) return; this.cur.push(this._pos(e)); this.draw(); });
    const end = () => { this.cur = null; if (this.onChange) this.onChange(); };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('pointerleave', end);
  };
  TracePad.prototype.clear = function () { this.strokes = []; this.showAnswer = false; this.draw(); };
  TracePad.prototype.undo = function () { this.strokes.pop(); this.draw(); };
  TracePad.prototype.hasInk = function () { return this.strokes.some(s => s.length > 1); };

  function drawGlyph(ctx, glyph, size, color) {
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = Math.round(size * 0.66) + 'px ' + FONT;
    ctx.fillText(glyph, size / 2, size * 0.56);
  }
  function drawInk(ctx, strokes, size, color, width, map) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.forEach(s => {
      if (!s.length) return;
      ctx.beginPath();
      s.forEach(([x, y], i) => { const p = map ? map(x, y) : [x, y]; const X = p[0] * size, Y = p[1] * size; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      if (s.length === 1) { const p = map ? map(s[0][0], s[0][1]) : s[0]; ctx.lineTo(p[0] * size + 0.1, p[1] * size); }
      ctx.stroke();
    });
  }

  TracePad.prototype.draw = function () {
    const { ctx, size } = this;
    ctx.clearRect(0, 0, size, size);
    // writing guide lines (top line = where the Gurmukhi headline sits)
    ctx.strokeStyle = this.colors.line; ctx.lineWidth = 2;
    [0.265, 0.71].forEach(f => { ctx.beginPath(); ctx.moveTo(size * 0.06, size * f); ctx.lineTo(size * 0.94, size * f); ctx.stroke(); });
    if (this.mode === 'trace') drawGlyph(ctx, this.glyph, size, this.colors.guide);
    drawInk(ctx, this.strokes, size, this.colors.ink, size * 0.065);
    if (this.showAnswer) drawGlyph(ctx, this.glyph, size, this.colors.answer);
  };

  // ---- scoring helpers on an N×N grid
  function mask(render) {
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, N, N);
    render(x);
    const d = x.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) m[i] = d[i * 4] < 160 ? 1 : 0;
    return m;
  }
  function dilate(m, r) {
    const out = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!m[y * N + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N) out[Y * N + X] = 1;
      }
    }
    return out;
  }
  function bbox(m) {
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0: x0 / N, y0: y0 / N, x1: (x1 + 1) / N, y1: (y1 + 1) / N };
  }
  function overlap(a, b) { let n = 0, k = 0; for (let i = 0; i < a.length; i++) if (a[i]) { n++; if (b[i]) k++; } return n ? k / n : 0; }

  // distance (in grid px) from every cell to the nearest inked cell — two-pass chamfer transform
  function distMap(m) {
    const INF = 1e6, d = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) d[i] = m[i] ? 0 : INF;
    const rel = (i, j, w) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (x > 0) rel(i, i - 1, 1); if (y > 0) { rel(i, i - N, 1); if (x > 0) rel(i, i - N - 1, 1.414); if (x < N - 1) rel(i, i - N + 1, 1.414); }
    }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x;
      if (x < N - 1) rel(i, i + 1, 1); if (y < N - 1) { rel(i, i + N, 1); if (x < N - 1) rel(i, i + N + 1, 1.414); if (x > 0) rel(i, i + N - 1, 1.414); }
    }
    return d;
  }
  function meanDist(A, dB) { let s = 0, n = 0; for (let i = 0; i < A.length; i++) if (A[i]) { s += Math.min(dB[i], 40); n++; } return n ? s / n : 40; }
  const glyphCache = {};
  function glyphInfo(g) {
    if (!glyphCache[g]) { const m = mask(x => drawGlyph(x, g, N, '#000')); glyphCache[g] = { m, d: distMap(m), b: bbox(m) }; }
    return glyphCache[g];
  }
  // how far apart the drawing and a letter are after fitting the drawing into the letter's box (lower = closer)
  function shapeDistance(strokes, g) {
    const G = glyphInfo(g);
    const raw = mask(x => drawInk(x, strokes, N, '#000', N * 0.05));
    const bu = bbox(raw), bg = G.b;
    if (!bu || !bg) return 99;
    const s = Math.min((bg.x1 - bg.x0) / Math.max(bu.x1 - bu.x0, 0.05), (bg.y1 - bg.y0) / Math.max(bu.y1 - bu.y0, 0.05));
    const cux = (bu.x0 + bu.x1) / 2, cuy = (bu.y0 + bu.y1) / 2, cgx = (bg.x0 + bg.x1) / 2, cgy = (bg.y0 + bg.y1) / 2;
    const U = mask(x => drawInk(x, strokes, N, '#000', N * 0.05, (px, py) => [cgx + (px - cux) * s, cgy + (py - cuy) * s]));
    return (meanDist(U, G.d) + meanDist(G.m, distMap(U))) / 2;
  }

  /**
   * trace: coverage/precision against the guide letter.
   * write: the drawing is compared with every letter; it passes when the target is among the closest
   *        matches (top 1 adult / top 2 kid) and close enough in absolute terms.
   */
  TracePad.prototype.score = function (strict) {
    if (!this.hasInk()) return { pass: false, coverage: 0, precision: 0, score: 0 };
    if (this.mode === 'write') {
      const all = (this.others && this.others.length ? this.others : [this.glyph]);
      const ranked = all.map(g => [g, shapeDistance(this.strokes, g)]).sort((a, b) => a[1] - b[1]);
      const rank = ranked.findIndex(r => r[0] === this.glyph);
      const dist = (ranked.find(r => r[0] === this.glyph) || [0, 99])[1];
      const maxRank = strict ? 1 : 2, maxDist = strict ? 1.4 : 1.8;
      return { rank, dist, best: ranked[0][0], score: 1 / (1 + dist), pass: rank <= maxRank && dist <= maxDist };
    }
    const G = glyphInfo(this.glyph).m;
    const U = mask(x => drawInk(x, this.strokes, N, '#000', N * 0.065));
    const coverage = overlap(G, dilate(U, 5));
    const precision = overlap(U, dilate(G, 5));
    const need = strict ? 0.72 : 0.6;
    return { coverage, precision, score: Math.min(coverage, precision), pass: coverage >= need && precision >= need };
  };

  root.TracePad = TracePad;
})(window);
