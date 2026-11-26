// Population list (NREMT hub — Damoni, Nov 26, 2026): a self-filling list
// above the chapter selection, fed from three sources:
//   1. NEW questions in a set he already has history with (never asked in
//      any attempt, not answered in the set's saved progress) — e.g. the
//      Further research additions, so he never hunts pie by pie for what
//      is new.
//   2. Every question currently marked ⚑ Quality review.
//   3. Every question currently marked ★ Needs more work.
//   4. Every question whose latest answer was WRONG — it stays listed
//      until he answers it correctly (here or back in its set).
// Quiz all runs them as one exam (exam.html?exam=__population__); exam.js
// writes the answers back into each source set's progress, and a set
// that ends up fully answered records a finished attempt — its pie
// moves. New questions leave once answered; marked questions stay while
// their mark stands.
(function () {
  function ls(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var hist = ls('examHistory') || {};
  var prog = ls('examProgress') || {};

  var style = document.createElement('style');
  style.textContent = '.pop-tag{display:inline-block;padding:0 .45rem;border-radius:999px;font-size:.78rem;font-weight:700;border:1.5px solid #0f172a}' +
    '.pop-new{background:#dbeafe}.pop-flag{background:#ffd23f}.pop-quality{background:#ede9fe}' +
    '.pop-missed{background:#fecaca}' +
    '.pop-src{color:#475569;font-size:.85rem}.pop-quiet{color:#475569}' +
    '#pop-quiz{padding:.55rem 1rem;border-radius:8px;border:2px solid #111827;background:#fff;color:#0f172a;font-weight:600;font-size:1rem;cursor:pointer}' +
    '.pop-list li{margin:.45rem 0}';
  document.head.appendChild(style);

  fetch('index.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (idx) {
    var entries = (idx.exams || []).filter(function (e) { return e.category === 'NREMT'; });
    return Promise.all(entries.map(function (e) {
      return fetch(e.file, { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) { return { entry: e, questions: (d && d.questions) || [] }; })
        .catch(function () { return { entry: e, questions: [] }; });
    }));
  }).then(function (sets) {
    var items = [];
    var byText = {};
    function addItem(q, s, si, tag) {
      var it = byText[q.question];
      if (it) { it.tags.add(tag); return; }
      it = {
        question: q.question, choices: q.choices, answer: q.answer,
        explanation: q.explanation || '', source: q.source || '', topic: q.topic || '', topic_n: q.topic_n,
        srcFile: s.entry.file, srcIdx: si, srcTitle: s.entry.title, chapter: s.entry.chapter || '',
        tags: new Set([tag])
      };
      byText[q.question] = it;
      items.push(it);
    }
    sets.forEach(function (s) {
      var f = s.entry.file;
      var allAttempts = [];
      var plainAttempts = [];
      Object.keys(hist).forEach(function (k) {
        if (k === f) { plainAttempts = hist[k] || []; allAttempts = allAttempts.concat(plainAttempts); }
        else if (k.indexOf(f + '#') === 0) { allAttempts = allAttempts.concat(hist[k] || []); }
      });
      var asked = new Set();
      allAttempts.forEach(function (a) { (a.asked || []).forEach(function (t) { asked.add(t); }); });
      var rec = prog[f];
      var progAnswered = new Set();
      if (rec && Array.isArray(rec.answers)) rec.answers.forEach(function (a, i) { if (a !== undefined && a !== null) progAnswered.add(i); });
      if (allAttempts.length) {
        s.questions.forEach(function (q, si) {
          if (!asked.has(q.question) && !progAnswered.has(si)) addItem(q, s, si, 'new');
        });
      }
      var flaggedIdx = [], qualityIdx = [];
      if (rec) {
        flaggedIdx = rec.flagged || [];
        qualityIdx = rec.quality || [];
      } else if (plainAttempts.length) {
        var latest = plainAttempts.slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; })[0];
        (latest.flagged || []).forEach(function (m) {
          var si = s.questions.findIndex(function (q) { return q.question === m.question; });
          if (si >= 0) flaggedIdx.push(si);
        });
        (latest.quality || []).forEach(function (m) {
          var si = s.questions.findIndex(function (q) { return q.question === m.question; });
          if (si >= 0) qualityIdx.push(si);
        });
      }
      flaggedIdx.forEach(function (si) { if (s.questions[si]) addItem(s.questions[si], s, si, 'flagged'); });
      qualityIdx.forEach(function (si) { if (s.questions[si]) addItem(s.questions[si], s, si, 'quality'); });
      // MISSED: latest outcome per question — newest attempts first, and
      // the saved progress (an unfinished run) is fresher than any
      // finished attempt, so it decides last.
      var outcome = {};
      allAttempts.slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).forEach(function (a) {
        var missedTexts = {};
        (a.missed || []).forEach(function (m) { missedTexts[m.question] = 1; });
        (a.asked || []).forEach(function (t) {
          if (!(t in outcome)) outcome[t] = missedTexts[t] ? 'wrong' : 'correct';
        });
      });
      if (rec && Array.isArray(rec.answers)) {
        rec.answers.forEach(function (a, si) {
          if (a !== undefined && a !== null && s.questions[si]) {
            outcome[s.questions[si].question] = a === s.questions[si].answer ? 'correct' : 'wrong';
          }
        });
      }
      s.questions.forEach(function (q, si) {
        if (outcome[q.question] === 'wrong') addItem(q, s, si, 'missed');
      });
    });
    render(items);
  }).catch(function () { /* the list is an extra — never break the landing */ });

  function render(items) {
    var host = document.getElementById('level-categories');
    if (!host || !host.parentNode) return;
    var sec = document.createElement('section');
    sec.className = 'exam-card';
    sec.id = 'population-card';
    function tagHtml(t) {
      return t === 'new' ? '<span class="pop-tag pop-new">NEW</span>'
        : t === 'missed' ? '<span class="pop-tag pop-missed">\u2717 Missed</span>'
        : t === 'flagged' ? '<span class="pop-tag pop-flag">\u2605 Needs more work</span>'
        : '<span class="pop-tag pop-quality">\u2691 Quality review</span>';
    }
    if (!items.length) {
      sec.innerHTML = '<h3>Population \u2014 new &amp; marked</h3><p class="pop-quiet">Nothing new right now.</p>';
    } else {
      var html = '<h3>Population \u2014 new &amp; marked (' + items.length + ')</h3>' +
        '<p><button type="button" id="pop-quiz">Quiz all ' + items.length + '</button></p><ol class="pop-list">';
      items.forEach(function (it) {
        var tags = ['new', 'missed', 'flagged', 'quality'].filter(function (t) { return it.tags.has(t); }).map(tagHtml).join(' ');
        html += '<li>' + tags + ' ' + esc(it.question.length > 140 ? it.question.slice(0, 140) + '\u2026' : it.question) +
          '<br><span class="pop-src">' + esc(it.chapter) + ' \u00B7 ' + esc(it.srcTitle) + (it.topic ? ' \u00B7 ' + esc(it.topic) : '') + '</span></li>';
      });
      html += '</ol>';
      sec.innerHTML = html;
    }
    host.parentNode.insertBefore(sec, host);
    var btn = document.getElementById('pop-quiz');
    if (btn) btn.addEventListener('click', function () {
      var manifest = {
        title: 'Population \u2014 new & marked',
        questions: items.map(function (it) {
          return {
            question: it.question, choices: it.choices, answer: it.answer, explanation: it.explanation,
            source: it.source, topic: it.topic, topic_n: it.topic_n,
            srcFile: it.srcFile, srcIdx: it.srcIdx, srcTitle: it.srcTitle
          };
        })
      };
      try { localStorage.setItem('populationRun', JSON.stringify(manifest)); } catch (e) { /* storage unavailable */ }
      location.href = 'exam.html?exam=__population__';
    });
  }
})();
