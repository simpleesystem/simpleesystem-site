/* Simple eSystem flow diagram. Lights one real path per cycle: source, three pillars, outcome, lead score. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Flow(fig) {
    this.fig = fig;
    this.grid = fig.querySelector('.flow__grid');
    this.svg = fig.querySelector('.flow__wires');
    this.scen = JSON.parse(fig.getAttribute('data-flow'));
    this.i = 0; this.timers = []; this.visible = false; this.paused = false; this.running = false;
    this.stages = {};
    fig.querySelectorAll('.flow__stage').forEach(function (s) { this.stages[s.getAttribute('data-stage')] = s; }, this);
    this.addControl();
    var self = this;
    new IntersectionObserver(function (en) {
      self.visible = en[0].isIntersecting;
      if (self.visible && !self.paused && !self.running) self.play();
    }, { threshold: 0.25 }).observe(fig);
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.redraw(); }).observe(this.grid);
    d.addEventListener('visibilitychange', function () { if (d.hidden) self.stop(); else if (self.visible && !self.paused) self.play(); });
  }
  var d = document;

  Flow.prototype.addControl = function () {
    var b = d.createElement('button'), self = this;
    b.type = 'button'; b.className = 'chip flow__pause'; b.textContent = 'Pause';
    b.setAttribute('aria-label', 'Pause the animation');
    b.style.marginLeft = 'auto';
    b.addEventListener('click', function () {
      self.paused = !self.paused;
      b.textContent = self.paused ? 'Play' : 'Pause';
      b.setAttribute('aria-label', self.paused ? 'Play the animation' : 'Pause the animation');
      if (self.paused) self.stop(); else self.play();
    });
    this.fig.querySelector('.flow__story').appendChild(b);
    this.fig.querySelector('.flow__story').removeAttribute('aria-hidden');
  };

  // Geometry relative to the grid.
  Flow.prototype.box = function (el) {
    var g = this.grid.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - g.left, t: r.top - g.top, r: r.right - g.left, b: r.bottom - g.top, cx: r.left - g.left + r.width / 2, cy: r.top - g.top + r.height / 2 };
  };
  Flow.prototype.stacked = function () {
    var a = this.fig.querySelector('.flow__col--src').getBoundingClientRect(), b = this.fig.querySelector('.flow__col--stages').getBoundingClientRect();
    return b.top >= a.bottom - 4;
  };
  function curveH(a, b) { var mx = (a.x + b.x) / 2; return 'M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
  function curveV(a, b) { var my = (a.y + b.y) / 2; return 'M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + my + ' ' + b.x + ' ' + my + ' ' + b.x + ' ' + b.y; }

  Flow.prototype.segments = function (s) {
    var src = this.fig.querySelector('.flow__src[data-src="' + s.source + '"]');
    var out = this.fig.querySelector('.flow__out[data-out="' + s.outcome + '"]');
    var score = this.fig.querySelector('.flow__out--score');
    var F = this.box(this.stages.found), S = this.box(this.stages.site), E = this.box(this.stages.engage);
    var segs = [], st = this.stacked();
    if (src) {
      var A = this.box(src);
      if (st) { var rail = this.grid.clientWidth - 4, top = F.t - 14; segs.push('M' + A.r + ' ' + A.cy + ' H' + (rail - 10) + ' Q' + rail + ' ' + A.cy + ' ' + rail + ' ' + (A.cy + 10) + ' V' + (top - 10) + ' Q' + rail + ' ' + top + ' ' + (rail - 10) + ' ' + top + ' H' + (F.cx + 10) + ' Q' + F.cx + ' ' + top + ' ' + F.cx + ' ' + F.t); }
      else segs.push(curveH({ x: A.r, y: A.cy }, { x: F.l, y: F.cy }));
    }
    segs.push(curveV({ x: F.cx, y: F.b }, { x: S.cx, y: S.t }));
    segs.push(curveV({ x: S.cx, y: S.b }, { x: E.cx, y: E.t }));
    var O = out ? this.box(out) : null, C = this.box(score);
    if (O) segs.push(st ? curveV({ x: E.cx, y: E.b }, { x: O.cx, y: O.t }) : curveH({ x: E.r, y: E.cy }, { x: O.l, y: O.cy }));
    var scoreSeg = st ? curveV({ x: E.cx, y: E.b }, { x: C.cx, y: C.t }) : curveH({ x: E.r, y: E.cy }, { x: C.l, y: C.cy });
    return { segs: segs, score: scoreSeg };
  };

  Flow.prototype.redraw = function () {
    if (!this.cur) { this.drawIdle(); return; }
    var g = this.segments(this.cur);
    this.svg.innerHTML = '';
    this.paths = g.segs.map(function (p) { return this.path(p); }, this);
    this.scorePath = this.path(g.score);
    for (var k = 0; k < this.lit; k++) if (this.paths[k]) this.paths[k].classList.add('is-on');
    if (this.lit >= this.paths.length) this.scorePath.classList.add('is-on');
  };
  Flow.prototype.drawIdle = function () {
    this.svg.innerHTML = '';
    var F = this.box(this.stages.found), S = this.box(this.stages.site), E = this.box(this.stages.engage);
    this.path(curveV({ x: F.cx, y: F.b }, { x: S.cx, y: S.t }));
    this.path(curveV({ x: S.cx, y: S.b }, { x: E.cx, y: E.t }));
  };
  Flow.prototype.path = function (dStr) {
    var p = d.createElementNS(NS, 'path'); p.setAttribute('d', dStr); this.svg.appendChild(p); return p;
  };

  Flow.prototype.later = function (fn, ms) { this.timers.push(setTimeout(fn.bind(this), reduce ? Math.min(ms, 600) + ms * 0.4 : ms)); };
  Flow.prototype.stop = function () { this.timers.forEach(clearTimeout); this.timers = []; this.running = false; if (this.raf) cancelAnimationFrame(this.raf); };
  Flow.prototype.play = function () { this.stop(); this.running = true; this.fig.classList.add('is-running'); this.run(); };

  Flow.prototype.travel = function (path, ms, done) {
    path.classList.add('is-on');
    if (reduce || !path.getTotalLength) { done.call(this); return; }
    var len = path.getTotalLength(), dot = d.createElementNS(NS, 'circle'), start = null, self = this;
    dot.setAttribute('r', 5); this.svg.appendChild(dot);
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, pt = path.getPointAtLength(len * e);
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      if (p < 1) self.raf = requestAnimationFrame(step); else { dot.remove(); done.call(self); }
    }
    this.raf = requestAnimationFrame(step);
  };

  Flow.prototype.reset = function () {
    var f = this.fig;
    f.querySelectorAll('.is-on').forEach(function (el) { el.classList.remove('is-on'); });
    f.classList.remove('is-looping');
    f.querySelectorAll('.flow__detail').forEach(function (el) { el.textContent = el.getAttribute('data-idle'); });
  };

  Flow.prototype.run = function () {
    var s = this.scen[this.i % this.scen.length], f = this.fig;
    this.reset(); this.cur = s; this.lit = 0; this.redraw();
    var story = f.querySelector('.flow__story');
    f.querySelector('[data-time]').textContent = s.time;
    f.querySelector('[data-ask]').textContent = s.ask;
    var src = f.querySelector('.flow__src[data-src="' + s.source + '"]');
    if (src) src.classList.add('is-on');
    var order = [['found', s.found], ['site', s.site], ['engage', s.engage]];
    var k = 0, self = this;
    function next() {
      if (k < order.length) {
        self.travel(self.paths[k], 650, function () {
          self.lit = k + 1;
          var st = self.stages[order[k][0]];
          st.classList.add('is-on');
          st.querySelector('.flow__detail').textContent = order[k][1];
          k++;
          self.later(next, 1250);
        });
      } else {
        self.travel(self.paths[k], 650, function () {
          self.lit = self.paths.length;
          var out = f.querySelector('.flow__out[data-out="' + s.outcome + '"]');
          if (out) out.classList.add('is-on');
          self.scorePath.classList.add('is-on');
          var sc = f.querySelector('.flow__out--score');
          sc.classList.add('is-on');
          sc.querySelector('[data-level]').textContent = s.score.level;
          sc.querySelector('[data-score-note]').textContent = s.score.note;
          self.count(sc.querySelector('[data-score]'), s.score.value);
          self.later(function () { f.classList.add('is-looping'); }, 1700);
          self.later(function () { this.i++; this.run(); }, 2600);
        });
      }
    }
    this.later(next, 500);
  };

  Flow.prototype.count = function (el, v) {
    if (reduce) { el.textContent = v; return; }
    var from = parseInt(el.textContent, 10) || 0, start = null;
    function step(ts) { if (!start) start = ts; var p = Math.min(1, (ts - start) / 600); el.textContent = Math.round(from + (v - from) * p); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  };

  d.querySelectorAll('.flow[data-flow]').forEach(function (fig) { new Flow(fig); });
})();
