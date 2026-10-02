/* Simple eSystem site behavior. Vanilla, no dependencies. */
(function () {
  var d = document, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile nav
  var t = d.querySelector('.nav-toggle'), nav = d.getElementById('site-nav');
  if (t && nav) t.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
    t.textContent = open ? 'Close' : 'Menu';
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); t.setAttribute('aria-expanded', 'false'); t.textContent = 'Menu'; t.focus(); }
  });

  // Count-up numbers: <span data-count="13">13</span>
  function countUp(el) {
    var end = parseFloat(el.getAttribute('data-count')), dec = (el.getAttribute('data-count').split('.')[1] || '').length;
    if (reduce || isNaN(end)) return;
    var start = null, dur = 1100;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = el.getAttribute('data-count');
    }
    requestAnimationFrame(step);
  }

  // Flywheel: light each step in turn while visible
  function flywheel(el) {
    if (reduce) return;
    var steps = el.querySelectorAll('.flywheel__step'), i = 0;
    setInterval(function () {
      if (el.getBoundingClientRect().bottom < 0 || el.getBoundingClientRect().top > innerHeight) return;
      steps.forEach(function (s, n) { s.classList.toggle('is-on', n === i); });
      i = (i + 1) % steps.length;
    }, 1600);
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('is-in');
      if (el.hasAttribute('data-count')) countUp(el);
      if (el.classList.contains('flywheel')) flywheel(el);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px' }) : null;
  d.querySelectorAll('.reveal, .chart, [data-count], .flywheel').forEach(function (el) {
    if (io) io.observe(el); else el.classList.add('is-in');
  });

  // Video facades: load YouTube only when the visitor presses play.
  d.addEventListener('click', function (e) {
    var b = e.target.closest('.video-facade'); if (!b) return;
    var f = d.createElement('iframe');
    f.className = 'video-frame'; f.title = b.getAttribute('aria-label').replace('Play video: ', '');
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'; f.allowFullscreen = true;
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.getAttribute('data-youtube') + '?autoplay=1&rel=0';
    b.replaceWith(f);
  });

  // AI visibility check: three steps, posts JSON to the configured webhook.
  d.querySelectorAll('[data-check-form]').forEach(function (f) {
    var step = 1, steps = f.querySelectorAll('.check-form__step'), dots = f.querySelectorAll('.check-form__steps li');
    var back = f.querySelector('[data-back]'), next = f.querySelector('[data-next]'), submit = f.querySelector('[data-submit]'), err = f.querySelector('.check-form__error');
    function show(n) {
      step = n;
      steps.forEach(function (s, i) { s.hidden = i !== n - 1; });
      dots.forEach(function (li, i) { li.classList.toggle('is-on', i < n); });
      back.hidden = n === 1; next.hidden = n === steps.length; submit.hidden = n !== steps.length;
      err.hidden = true;
      var first = steps[n - 1].querySelector('input'); if (first) first.focus();
    }
    function valid() {
      var bad = null;
      steps[step - 1].querySelectorAll('input[required]').forEach(function (i) {
        var ok = i.value.trim() !== '' && (i.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value.trim()));
        i.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok && !bad) bad = i;
      });
      if (bad) { err.textContent = 'Please fill in ' + bad.labels[0].textContent.replace(' (optional)', '').toLowerCase() + '.'; err.hidden = false; bad.focus(); return false; }
      return true;
    }
    next.addEventListener('click', function () { if (valid()) show(step + 1); });
    back.addEventListener('click', function () { show(step - 1); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid()) return;
      var data = {}; new FormData(f).forEach(function (v, k) { data[k] = String(v).trim(); });
      if (data.company_url) return; // spam trap
      delete data.company_url;
      data.page = location.pathname; data.submittedAt = new Date().toISOString();
      var qs = new URLSearchParams(location.search); ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (qs.get(k)) data[k] = qs.get(k); });
      submit.disabled = true; submit.textContent = 'Starting your check';
      var url = f.getAttribute('data-webhook');
      var done = function () {
        f.classList.add('is-done');
        f.querySelector('[data-done-email]').textContent = data.email;
        var box = f.querySelector('[data-done]'); box.hidden = false; box.focus();
      };
      if (!url) { done(); return; } // preview mode: no webhook configured yet
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () {
          submit.disabled = false; submit.textContent = 'Run my check';
          err.textContent = 'We could not start your check. Please try again, or call 817-541-1750.'; err.hidden = false;
        });
    });
  });

  // Fred: open the live widget when one is installed, otherwise follow the link.
  function openFred(q) {
    var api = window.Fred || window.FredWidget || window.TalkToFred;
    if (api && typeof api.open === 'function') { api.open(q ? { message: q } : undefined); return true; }
    return false;
  }
  d.addEventListener('click', function (e) {
    var a = e.target.closest('[data-fred-open], [data-fred-ask]');
    if (!a) return;
    if (openFred(a.getAttribute('data-fred-ask'))) e.preventDefault();
  });
  d.querySelectorAll('[data-fred-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var q = f.querySelector('input').value.trim();
      if (openFred(q)) e.preventDefault();
    });
  });
})();
