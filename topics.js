// Topics page — per-chapter circle (ALEKS-style): slice = set (topic group),
// dark = mastered topics, light = learning, pale = ready.
// Interaction: moving around the circle lights the slice under the pointer and
// the center shows that slice's % in its color; only the active slice's topics
// are shown (in the panel under the circle). Tap/click locks a slice open.
// Topic status comes from the latest finished attempt per exam file (examHistory).
(function () {
  var PALETTE = ['#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#475569', '#9333ea'];
  var STATUS = {
    'Mastered': '#15803d',
    'Learning': '#f59e0b',
    'Ready to Learn': '#2563eb'
  };
  var hist = {};
  try { hist = JSON.parse(localStorage.getItem('examHistory') || '{}'); } catch (e) { hist = {}; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tint(hex, f) { // mix hex color with white; f = fraction of white
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function shortTitle(e) {
    var t = e.title || e.file;
    var pre = (e.category || '') + ' \u2014 ';
    if (t.indexOf(pre) === 0) t = t.slice(pre.length);
    var pre2 = 'Chapter ' + e.chapter + ', ';
    if (t.indexOf(pre2) === 0) t = t.slice(pre2.length);
    return t;
  }
  function wedge(cx, cy, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001;
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return 'M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z';
  }

  var params = new URLSearchParams(location.search);
  var chParam = params.get('ch');

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var allNremt = (idx.exams || []).filter(function (e) { return e.category === 'NREMT'; });
    var entries = allNremt.filter(function (e) { return !/macro/.test(e.file); });
    var chapters = [];
    entries.forEach(function (e) { if (chapters.indexOf(e.chapter) === -1) chapters.push(e.chapter); });
    chapters.sort(function (a, b) { return a - b; });
    if (!chParam) return renderCards(entries, chapters);
    var macro = allNremt.filter(function (e) { return /macro/.test(e.file) && String(e.chapter) === String(chParam); })[0] || null;
    renderChapter(entries.filter(function (e) { return String(e.chapter) === String(chParam); }), chParam, macro);
  }).catch(function () {
    document.getElementById('tp-chapters').textContent = 'Could not load the exam list.';
  });

  function renderCards(entries, chapters) {
    var box = document.getElementById('tp-chapters');
    chapters.forEach(function (ch) {
      var es = entries.filter(function (e) { return e.chapter === ch; });
      var topics = 0, questions = 0;
      es.forEach(function (e) {
        var m = /Topics (\d+)\u2013(\d+)/.exec(e.title || '');
        if (m) topics += (+m[2] - +m[1] + 1);
        var q = /(\d+) questions/.exec(e.note || '');
        if (q) questions += +q[1];
      });
      var a = document.createElement('a');
      a.className = 'nav-card tp-card';
      a.href = 'topics.html?ch=' + ch;
      a.innerHTML = 'Chapter ' + ch + '<small>' + topics + ' topics \u00B7 ' + questions + ' questions</small>';
      box.appendChild(a);
    });
  }

  function statusFor(file, questions) {
    // Evidence per topic, newest wins, from two sources:
    //  - the latest full-set attempt: hist[file]
    //  - the latest topic run:        hist[file + '#topic:' + name]
    var byTopicQ = {};
    questions.forEach(function (q) {
      if (!q.topic) return;
      (byTopicQ[q.topic] || (byTopicQ[q.topic] = [])).push(q);
    });
    var out = {};
    function consider(topic, attempt, runQuestions) {
      if (!attempt) return;
      var missed = {};
      (attempt.missed || []).forEach(function (m) { missed[m.question] = true; });
      var flagged = {};
      (attempt.flagged || []).forEach(function (m) { flagged[m.question] = true; });
      var n = 0, correct = 0, fl = 0;
      runQuestions.forEach(function (q) {
        n++;
        if (!missed[q.question]) correct++;
        if (flagged[q.question]) fl++;
      });
      if (!n) return;
      var ts = Date.parse(attempt.ts || '') || 0;
      if (!out[topic] || ts >= out[topic].ts) {
        out[topic] = { n: n, correct: correct, flagged: fl, ts: ts };
      }
    }
    var setAttempts = hist[file] || [];
    var latestSet = setAttempts.length ? setAttempts[0] : null;
    Object.keys(byTopicQ).forEach(function (topic) {
      consider(topic, latestSet, byTopicQ[topic]);
      var key = file + '#topic:' + topic;
      var tAttempts = hist[key] || [];
      var latestTopic = tAttempts.length ? tAttempts[0] : null;
      consider(topic, latestTopic, byTopicQ[topic]);
    });
    return out;
  }

  function renderChapter(es, ch, macro) {
    document.getElementById('tp-title').textContent = 'Chapter ' + ch + ' \u2014 Topics';
    document.getElementById('tp-note').textContent = 'Status from your latest attempt on each topic \u2014 a topic run or a full set run, whichever is newer. Mastered = 80%+ correct. The % is your mastered share.';
    document.getElementById('tp-main').hidden = false;
    if (macro) {
      var mb = document.createElement('p');
      mb.innerHTML = '<a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(macro.file) + '">Chapter ' + ch + ' macro exam \u2014 all questions</a>';
      document.getElementById('tp-main').insertBefore(mb, document.getElementById('tp-main').children[1]);
    }
    Promise.all(es.map(function (e) {
      return fetch(e.file, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        return { entry: e, questions: d.questions || [] };
      }).catch(function () { return { entry: e, questions: [] }; });
    })).then(function (groups) {
      buildChapter(groups, ch);
    });
  }

  function buildChapter(groups, ch) {
    groups.forEach(function (g, gi) {
      g.color = PALETTE[gi % PALETTE.length];
      g.name = shortTitle(g.entry);
      g.isTextbook = /textbook/.test(g.entry.file);
      var per = statusFor(g.entry.file, g.questions);
      var byTopic = {};
      g.questions.forEach(function (q) {
        if (!q.topic) return;
        var t = byTopic[q.topic] || (byTopic[q.topic] = { name: q.topic, n: 0, topic_n: q.topic_n || 0 });
        t.n++;
      });
      g.topics = Object.keys(byTopic).map(function (k) { return byTopic[k]; }).sort(function (a, b) { return a.topic_n - b.topic_n; });
      g.topics.forEach(function (t) {
        var s = per && per[t.name];
        if (!s) { t.status = 'Ready to Learn'; t.flagged = 0; }
        else {
          t.flagged = s.flagged;
          t.status = (s.correct / s.n) >= 0.8 ? 'Mastered' : 'Learning';
        }
      });
      if (g.isTextbook) {
        var attempted = (hist[g.entry.file] || []).length > 0;
        g.topics = [{ name: 'All textbook case questions', n: g.questions.length, topic_n: 0, status: attempted ? 'Learning' : 'Ready to Learn', flagged: 0, all: true }];
      }
      g.counts = { 'Mastered': 0, 'Learning': 0, 'Ready to Learn': 0 };
      g.topics.forEach(function (t) { g.counts[t.status]++; });
      g.done = g.counts['Mastered'];
      g.pct = g.topics.length ? Math.round(100 * g.done / g.topics.length) : 0;
      if (g.isTextbook) {
        var tb = (hist[g.entry.file] || [])[0];
        g.pct = (tb && tb.total) ? Math.round(100 * (tb.score || 0) / tb.total) : 0;
      }
    });

    var totalTopics = groups.reduce(function (s, g) { return s + g.topics.length; }, 0);
    var realTopics = groups.reduce(function (s, g) { return s + (g.isTextbook ? 0 : g.topics.length); }, 0);
    var masteredTopics = 0;
    groups.forEach(function (g) { if (g.isTextbook) return; masteredTopics += g.counts['Mastered']; });
    var doneTopics = masteredTopics;

    // Up next: first Learning topic, else first Ready topic
    var up = null;
    ['Learning', 'Ready to Learn'].forEach(function (want) {
      if (up) return;
      groups.forEach(function (g) { if (up) return; g.topics.forEach(function (t) { if (!up && t.status === want && !t.all) up = { g: g, t: t }; }); });
    });
    var upEl = document.getElementById('tp-upnext');
    if (up) {
      upEl.hidden = false;
      upEl.innerHTML = 'UP NEXT: <strong>' + esc(up.t.name) + '</strong> \u00B7 ' + esc(up.g.name) +
        ' <a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(up.g.entry.file) + '&topic=' + encodeURIComponent(up.t.name) + '">Practice</a>';
    }

    // Pie
    var svg = document.getElementById('tp-pie');
    var CX = 210, CY = 210, R = 198;
    var a = -Math.PI / 2;
    var parts = [];
    groups.forEach(function (g, gi) {
      var span = totalTopics ? (Math.PI * 2) * (g.topics.length / totalTopics) : 0;
      var order = [['Mastered', g.color], ['Learning', tint(g.color, 0.45)], ['Ready to Learn', tint(g.color, 0.82)]];
      var cur = a;
      order.forEach(function (o) {
        if (!g.counts[o[0]]) return;
        var sub = span * (g.counts[o[0]] / g.topics.length);
        parts.push('<path d="' + wedge(CX, CY, R, cur, cur + sub) + '" fill="' + o[1] + '" stroke="#fff" stroke-width="2" data-group="' + gi + '"><title>' + esc(g.name) + '</title></path>');
        cur += sub;
      });
      a += span;
    });
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="80" fill="#fff" stroke="#cbd5e1" stroke-width="2" id="tp-center-bg"></circle>');
    parts.push('<text id="tp-center-num" x="' + CX + '" y="' + (CY - 2) + '" text-anchor="middle" font-size="40" font-weight="700" fill="#0f172a"></text>');
    parts.push('<text id="tp-center-lab" x="' + CX + '" y="' + (CY + 24) + '" text-anchor="middle" font-size="14" fill="#475569"></text>');
    svg.innerHTML = parts.join('');

    // Interaction state: preview = slice under the pointer; locked = tapped slice.
    var preview = -1, locked = -1, mi = 0;
    function active() { return preview >= 0 ? preview : locked; }

    function drawCenter() {
      var num = document.getElementById('tp-center-num');
      var lab = document.getElementById('tp-center-lab');
      var gi = active();
      if (gi >= 0) {
        var g = groups[gi];
        num.textContent = g.pct + '%';
        num.setAttribute('fill', g.color);
        lab.textContent = g.name;
        return;
      }
      num.setAttribute('fill', '#0f172a');
      var modes = [
        [doneTopics, 'topics done'],
        [masteredTopics, 'mastered'],
        [(realTopics ? Math.round(100 * doneTopics / realTopics) : 0) + '%', 'done']
      ];
      num.textContent = modes[mi][0];
      lab.textContent = modes[mi][1] + ' of ' + realTopics + ' topics';
    }

    function renderDetail() {
      var box = document.getElementById('tp-detail');
      var gi = active();
      if (gi < 0) {
        var mc = 0, lc = 0, rc = 0;
        groups.forEach(function (g) { if (g.isTextbook) return; mc += g.counts['Mastered']; lc += g.counts['Learning']; rc += g.counts['Ready to Learn']; });
        box.innerHTML = '<p class="tp-detail-head">Whole chapter</p>' +
          '<p class="tp-detail-counts"><span style="color:#15803d">Mastered ' + mc + '</span> \u00B7 <span style="color:#f59e0b">Learning ' + lc + '</span> \u00B7 <span style="color:#2563eb">Ready ' + rc + '</span></p>' +
          '<p class="tp-detail-hint">Move around the circle \u2014 only the section you touch shows its topics.</p>';
        return;
      }
      var g = groups[gi], c = g.counts;
      var html = '<p class="tp-detail-head"><span class="tp-chip-color" style="background:' + g.color + '"></span> ' + esc(g.name) +
        (locked >= 0 ? ' <button type="button" class="tp-reset" id="tp-reset">Whole chapter</button>' : '') + '</p>' +
        '<p class="tp-detail-counts"><span style="color:' + g.color + ';font-weight:700">' + g.pct + '% done</span> \u00B7 <span style="color:#15803d">Mastered ' + c['Mastered'] + '</span> \u00B7 <span style="color:#f59e0b">Learning ' + c['Learning'] + '</span> \u00B7 <span style="color:#2563eb">Ready ' + c['Ready to Learn'] + '</span></p>';
      html += '<p class="tp-detail-counts"><a class="tp-practice" href="notepad.html?exam=' + encodeURIComponent(g.entry.file) + '">This set\'s Notepad</a> \u00B7 <a class="tp-practice" href="quality.html?exam=' + encodeURIComponent(g.entry.file) + '">This set\'s Quality review</a></p>';
      if (!g.isTextbook) {
        html += '<div class="tp-topic-row"><span class="tp-topic-name">Full set exam</span><span class="tp-topic-meta">every topic in this set</span><a class="tp-practice" href="exam.html?exam=' + encodeURIComponent(g.entry.file) + '">Start</a></div>';
      }
      ['Mastered', 'Learning', 'Ready to Learn'].forEach(function (st) {
        var ts = g.topics.filter(function (x) { return x.status === st; });
        if (!ts.length) return;
        html += '<p class="tp-detail-group" style="color:' + STATUS[st] + '">' + st + '</p>';
        ts.forEach(function (x) {
          var href = 'exam.html?exam=' + encodeURIComponent(g.entry.file) + (x.all ? '' : '&topic=' + encodeURIComponent(x.name));
          html += '<div class="tp-topic-row"><span class="tp-topic-name">' + esc(x.name) + (x.flagged ? ' <span class="tp-flag">\u2605 ' + x.flagged + '</span>' : '') + '</span><span class="tp-topic-meta">' + x.n + ' questions</span><a class="tp-practice" href="' + href + '">Practice</a></div>';
        });
      });
      box.innerHTML = html;
      var rb = document.getElementById('tp-reset');
      if (rb) rb.addEventListener('click', function () { locked = -1; preview = -1; draw(); });
    }

    function draw() {
      var gi = active();
      svg.querySelectorAll('path[data-group]').forEach(function (p) {
        p.style.opacity = (gi < 0 || +p.getAttribute('data-group') === gi) ? '1' : '0.3';
      });
      drawCenter();
      renderDetail();
    }

    function sliceFromEvent(ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-group') !== null) return +t.getAttribute('data-group');
      return -2; // center or background
    }
    svg.addEventListener('pointermove', function (ev) {
      var gi = sliceFromEvent(ev);
      if (gi >= 0 && gi !== preview) { preview = gi; draw(); }
    });
    svg.addEventListener('pointerleave', function () {
      if (preview >= 0) { preview = -1; draw(); }
    });
    svg.addEventListener('click', function (ev) {
      if (ev.target.id === 'tp-center-bg' || ev.target.id === 'tp-center-num' || ev.target.id === 'tp-center-lab') {
        if (active() >= 0) { locked = -1; preview = -1; draw(); }
        else { mi = (mi + 1) % 3; drawCenter(); }
        return;
      }
      var gi = sliceFromEvent(ev);
      if (gi >= 0) { locked = (locked === gi) ? -1 : gi; preview = -1; draw(); }
    });

    draw();
  }
})();
