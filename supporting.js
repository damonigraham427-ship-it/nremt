// Supporting info — per-topic tab (NREMT site only).
// Data: supporting-info.json keyed by file -> topic -> sections
// {what, details[], history, economics, science} (missing sections stay out).
// Two comment channels, kept clearly separate and in different places:
//  - "supporting-info": comment to Edison about the supporting info itself,
//    sent from inside the supporting info panel (QA on the info).
//  - "cogpsych": comment to the Cognitive Psychology Bot, sent from its own
//    button + panel on the EXAM page, beside Quality review / Further
//    research at question level. It is NOT part of the supporting panel.
// Both ride examSync.sendReport. Panels are inline section toggles:
// opening one never navigates, so an exam in progress keeps its place.
(function () {
  var DATA = null;
  var cur = { file: null, topic: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function load(cb) {
    if (DATA) return cb(DATA);
    fetch('supporting-info.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { DATA = j || {}; cb(DATA); })
      .catch(function () { DATA = {}; cb(DATA); });
  }

  function entryFor(file, topic) {
    if (!DATA || !file || !topic) return null;
    return (DATA[file] && DATA[file][topic]) || null;
  }

  function sendReport(report, statusEl, textEl) {
    if (!window.examSync || !window.examSync.sendReport) {
      statusEl.textContent = 'Sending is not available right now.';
      return;
    }
    statusEl.textContent = 'Sending\u2026';
    window.examSync.sendReport(report).then(function () {
      statusEl.textContent = 'Sent.';
      textEl.value = '';
    }).catch(function () {
      statusEl.textContent = 'Could not send \u2014 check connection and try again.';
    });
  }

  // ---------- supporting info panel (Edison channel only) ----------
  var panel, bodyEl, selEl, edText, edStatus, titleEl;

  function buildPanel() {
    if (panel) return;
    var st = document.createElement('style');
    st.textContent =
      '#supporting-panel{border:2px solid #0f766e}' +
      '#supporting-panel h4{margin:14px 0 4px;font-size:15px;color:#0f766e}' +
      '#supporting-panel p{margin:2px 0 6px}' +
      '#supporting-panel ul{margin:2px 0 6px;padding-left:20px}' +
      '.sup-channel{border-top:1px solid #cbd5e1;margin-top:14px;padding-top:10px}' +
      '.sup-channel h4{color:#0f172a}' +
      '.sup-bot-note{font-size:13px;color:#475569;margin:0 0 6px}' +
      '.tp-sup-btn{margin-left:8px;font-size:13px}';
    document.head.appendChild(st);

    panel = document.createElement('section');
    panel.id = 'supporting-panel';
    panel.className = 'note-card';
    panel.hidden = true;
    panel.innerHTML =
      '<h3>&#128214; Supporting info &#8212; <span id="sup-title"></span></h3>' +
      '<div id="sup-body"></div>' +
      '<div class="sup-channel">' +
        '<h4>Comment to Edison &#8212; about this supporting info</h4>' +
        '<p class="sup-bot-note">Quality or accuracy of the information above. Goes to Edison, like a quality note.</p>' +
        '<label>Section: <select id="sup-section">' +
          '<option>General</option><option>What it is</option><option>Details</option>' +
          '<option>History</option><option>Economics</option><option>Science beside it</option>' +
        '</select></label>' +
        '<textarea id="sup-ed-comment" class="note-area" rows="3" placeholder="What is wrong, missing, or unclear in this supporting info&#8230;"></textarea>' +
        '<button id="sup-ed-send" type="button">Send to Edison</button>' +
        '<p id="sup-ed-status" role="status"></p>' +
      '</div>' +
      '<p><button id="sup-close" type="button">Close</button></p>';
    var main = document.querySelector('main') || document.body;
    main.appendChild(panel);

    titleEl = panel.querySelector('#sup-title');
    bodyEl = panel.querySelector('#sup-body');
    selEl = panel.querySelector('#sup-section');
    edText = panel.querySelector('#sup-ed-comment');
    edStatus = panel.querySelector('#sup-ed-status');

    panel.querySelector('#sup-close').addEventListener('click', function () { panel.hidden = true; });
    panel.querySelector('#sup-ed-send').addEventListener('click', sendToEdison);
  }

  function sendToEdison() {
    var text = edText.value.trim();
    if (!text) { edStatus.textContent = 'Write the comment first.'; return; }
    var item = { topic: cur.topic, section: selEl.value, comment: text };
    var report = {
      id: 'si' + Date.now(),
      ts: new Date().toISOString(),
      page: 'supporting-info',
      type: 'supporting-info',
      file: cur.file,
      groups: [{ title: cur.file + ' \u2014 ' + cur.topic + ' (supporting info)', items: [item] }]
    };
    sendReport(report, edStatus, edText);
  }

  function renderSections(e) {
    var h = '';
    if (e.what) h += '<h4>What it is</h4><p>' + esc(e.what) + '</p>';
    if (e.details && e.details.length) {
      h += '<h4>Details</h4><ul>' + e.details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
    }
    if (e.history) h += '<h4>History</h4><p>' + esc(e.history) + '</p>';
    if (e.economics) h += '<h4>Economics</h4><p>' + esc(e.economics) + '</p>';
    if (e.science) h += '<h4>Science beside it</h4><p>' + esc(e.science) + '</p>';
    return h || '<p>No supporting info for this topic yet.</p>';
  }

  window.openSupporting = function (file, topic) {
    buildPanel();
    load(function () {
      cur = { file: file, topic: topic };
      titleEl.textContent = topic || '';
      bodyEl.innerHTML = renderSections(entryFor(file, topic) || {});
      edStatus.textContent = '';
      panel.hidden = false;
      panel.scrollIntoView({ block: 'nearest' });
    });
  };

  // ---------- exam page ----------
  function examFile() {
    var m = /[?&]exam=([^&]+)/.exec(location.search || '');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function examTopic() {
    var tb = document.getElementById('topic-bar');
    if (!tb || !tb.textContent) return null;
    var t = tb.textContent.replace(/^Topic:\s*/, '');
    var cut = t.indexOf(' \u00B7 Chapter');
    return (cut >= 0 ? t.slice(0, cut) : t).trim() || null;
  }
  function examQuestion() {
    var q = document.getElementById('question-text');
    return q ? q.textContent : '';
  }

  // Cognitive Psychology Bot channel: its own button + panel on the exam
  // page, a peer of Quality review / Further research at question level.
  var cgPanel, cgQ, cgText, cgStatus;

  function buildCogPanel(anchorPanel) {
    if (cgPanel) return;
    cgPanel = document.createElement('section');
    cgPanel.id = 'cogpsych-panel';
    cgPanel.className = 'note-card';
    cgPanel.hidden = true;
    cgPanel.innerHTML =
      '<h3>&#129504; Comment to the Cognitive Psychology Bot &#8212; this question</h3>' +
      '<p class="sup-bot-note">Separate channel. This goes to the Cognitive Psychology Bot chat &#8212; not to Edison.</p>' +
      '<p id="cogpsych-q" class="np-q"></p>' +
      '<textarea id="cogpsych-comment" class="note-area" rows="3" placeholder="Comment for the Cognitive Psychology Bot&#8230;"></textarea>' +
      '<button id="cogpsych-send" type="button">Send to Cognitive Psychology Bot</button>' +
      '<button id="cogpsych-close" type="button">Close</button>' +
      '<p id="cogpsych-status" role="status"></p>';
    anchorPanel.parentNode.insertBefore(cgPanel, anchorPanel.nextSibling);
    cgQ = cgPanel.querySelector('#cogpsych-q');
    cgText = cgPanel.querySelector('#cogpsych-comment');
    cgStatus = cgPanel.querySelector('#cogpsych-status');
    cgPanel.querySelector('#cogpsych-close').addEventListener('click', function () { cgPanel.hidden = true; });
    cgPanel.querySelector('#cogpsych-send').addEventListener('click', sendToCogBot);
  }

  function sendToCogBot() {
    var text = cgText.value.trim();
    if (!text) { cgStatus.textContent = 'Write the comment first.'; return; }
    var f = examFile(), t = examTopic();
    var item = { topic: t, section: 'General', comment: text, question: examQuestion() };
    var report = {
      id: 'cp' + Date.now(),
      ts: new Date().toISOString(),
      page: 'supporting-info',
      type: 'cogpsych',
      file: f,
      groups: [{ title: f + ' \u2014 ' + t + ' (cogpsych comment)', items: [item] }]
    };
    sendReport(report, cgStatus, cgText);
  }

  function wireExam() {
    var anchor = document.getElementById('research-btn');
    if (!anchor) return false;
    var btn = document.createElement('button');
    btn.id = 'supporting-btn';
    btn.type = 'button';
    btn.innerHTML = '&#128214; Supporting info';
    btn.hidden = true;
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    btn.addEventListener('click', function () {
      var f = examFile(), t = examTopic();
      if (f && t) window.openSupporting(f, t);
    });

    var cgBtn = document.createElement('button');
    cgBtn.id = 'cogpsych-btn';
    cgBtn.type = 'button';
    cgBtn.innerHTML = '&#129504; Cognitive Psychology Bot';
    btn.parentNode.insertBefore(cgBtn, btn.nextSibling);
    var rp = document.getElementById('research-panel');
    buildCogPanel(rp || anchor);
    cgBtn.addEventListener('click', function () {
      cgQ.textContent = examQuestion();
      cgStatus.textContent = '';
      cgPanel.hidden = false;
      cgPanel.scrollIntoView({ block: 'nearest' });
    });

    load(function () {
      function checkBtn() {
        var f = examFile(), t = examTopic();
        btn.hidden = !(f && t && entryFor(f, t));
      }
      checkBtn();
      setInterval(checkBtn, 300);
    });
    return true;
  }

  // ---------- topics page: button on topic rows that have info ----------
  function wireTopics() {
    var box = document.getElementById('tp-detail');
    if (!box) return false;
    load(function () {
      var mo = new MutationObserver(function () { decorate(box); });
      mo.observe(box, { childList: true, subtree: true });
      decorate(box);
      var ticks = 0;
      var iv = setInterval(function () {
        decorate(box);
        if (++ticks >= 8) clearInterval(iv);
      }, 400);
    });
    return true;
  }
  function decorate(box) {
    var rows = box.querySelectorAll('.tp-topic-row');
    rows.forEach(function (row) {
      if (row.querySelector('.tp-sup-btn')) return;
      var link = row.querySelector('a.tp-practice[href*="exam="]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      var fm = /[?&]exam=([^&]+)/.exec(href), tm = /[?&]topic=([^&]+)/.exec(href);
      if (!fm || !tm) return;
      var f = decodeURIComponent(fm[1]), t = decodeURIComponent(tm[1]);
      if (!entryFor(f, t)) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tp-sup-btn';
      b.textContent = 'Supporting info';
      b.addEventListener('click', function () { window.openSupporting(f, t); });
      row.appendChild(b);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireExam() || wireTopics();
  });
})();
