(function () {
  'use strict';

  var L = window.CM_LOGIC;
  var DATA = window.CM_DATA;
  var I = window.CM_I18N;
  var API_BASE = 'http://127.0.0.1:8000';
  var aiExplanations = {};
  var aiStatus = 'idle';

  async function loadCoursesFromBackend() {
    try {
      var response = await fetch(API_BASE + '/api/courses');
      if (!response.ok) throw new Error('HTTP ' + response.status);

      var data = await response.json();
      if (!data || !Array.isArray(data.courses)) {
        throw new Error('No courses array');
      }

      DATA.courses = data.courses;
      console.log('Loaded courses from backend:', DATA.courses.length);
      return true;
    } catch (err) {
      console.warn('Falling back to local demo data:', err);
      return false;
    }
  }

  function explanationPayload(analysis) {
    var c = analysis.course;
    var bundle = analysis.bestBundle;
    return {
      code: c.code,
      title: pick(c.title),
      section: bundle ? bundle.label : '',
      reasons: (analysis.requirement && analysis.requirement.unknown ? analysis.requirement.unknown : [])
        .concat(analysis.requirement && analysis.requirement.alwaysCheck ? analysis.requirement.alwaysCheck : [])
        .concat(bundle && bundle.notes ? bundle.notes : []),
      needs_confirmation: []
    };
  }

  async function requestAiExplanations() {
    if (!S.results || !S.results.candidates.length) return;

    aiStatus = 'loading';
    aiExplanations = {};
    renderResults();

    try {
      var response = await fetch(API_BASE + '/api/explain-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'en',
          candidates: S.results.candidates.map(explanationPayload)
        })
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);

      var data = await response.json();

      var list = Array.isArray(data.explanations)
        ? data.explanations
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      list.forEach(function (item) {
        if (!item || !item.code) return;
        aiExplanations[item.code] = item;
      });

      aiStatus = 'ok';
    } catch (err) {
      console.error('AI explanation failed:', err);
      aiStatus = 'error';
    }

    renderResults();
  }

  function t(key, params) { return I.t(key, params); }
  function pick(v) { return I.pick(v); }
  function dayLabel(d) { return I.dayLabel(d); }
  function dayChip(d) { return I.dayChip(d); }

  L.setTerm(DATA.meta.termDates);
  var DAYS = DATA.days;

  function defaultPrefs() {
    return {
      areas: DATA.areas.slice(),
      plannedCredits: DATA.defaults.plannedCredits,
      maxCredits: DATA.defaults.maxCredits,
      takenCodes: DATA.defaults.takenCodes.slice(),
      bufferMin: DATA.defaults.bufferMin,
      sortBy: DATA.defaults.sortBy,
      strictOnly: false,
      unavailable: []
    };
  }

  var S = {
    step: 1,
    locked: false,
    imported: deepCopy(DATA.importedSchedule),
    prefs: defaultPrefs(),
    results: null,
    selected: {},
    picked: {},
    checks: {},
    pendingDays: []
  };

  function $(id) { return document.getElementById(id); }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cls(list) { return list.filter(Boolean).join(' '); }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function courseOf(code) {
    return DATA.courses.filter(function (x) { return L.norm(x.code) === L.norm(code); })[0] || null;
  }

  function coveredAreas() {
    var out = [];
    S.prefs.takenCodes.forEach(function (code) {
      var c = courseOf(code);
      if (c && c.area && out.indexOf(c.area) === -1) out.push(c.area);
    });
    return out;
  }

  function buildContext() {
    var confirmed = [], uncertain = [];
    S.imported.forEach(function (e) {
      var ivs = L.entryIntervals(e);
      if (e.confidence === 'uncertain') uncertain = uncertain.concat(ivs);
      else confirmed = confirmed.concat(ivs);
    });
    var unavailable = [];
    S.prefs.unavailable.forEach(function (u) {
      if (!u.days.length || !u.start || !u.end) return;
      L.entryIntervals({ code: '', component: '', days: u.days, start: u.start, end: u.end, dateRange: null })
        .forEach(function (iv) {
          iv.label = t('s2.unavail');
          unavailable.push(iv);
        });
    });
    return {
      confirmed: confirmed,
      uncertain: uncertain,
      unavailable: unavailable,
      bufferMin: Number(S.prefs.bufferMin) || 0,
      areas: S.prefs.areas.slice(),
      plannedCredits: Number(S.prefs.plannedCredits) || 0,
      maxCredits: Number(S.prefs.maxCredits) || 0,
      takenCodes: S.prefs.takenCodes.slice(),
      coveredAreas: coveredAreas(),
      sortBy: S.prefs.sortBy,
      strictOnly: !!S.prefs.strictOnly
    };
  }

  function applyI18n() {
    document.documentElement.lang = I.getLang();
    document.title = t('app.title');
    var mark = $('brandMark');
    if (mark) mark.textContent = t('app.mark');
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var phs = document.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < phs.length; j++) {
      phs[j].setAttribute('placeholder', t(phs[j].getAttribute('data-i18n-ph')));
    }
    renderLangSwitch();
  }

  function renderLangSwitch() {
    var wrap = $('langSwitch');
    if (!wrap) return;
    var btns = wrap.querySelectorAll('[data-lang]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-lang') === I.getLang());
    }
  }

  var STEPS = [1, 2, 3, 4];

  function unlocked(n) {
    if (n === 1) return true;
    if (n === 2) return S.locked || S.step > 1;
    return !!S.results;
  }

  function renderStepper() {
    $('stepper').innerHTML = STEPS.map(function (n) {
      var done = (n === 1 && (S.locked || S.step > 1)) ||
        (n === 2 && !!S.results) ||
        (n === 3 && !!S.results && S.step > 3);
      var c = cls(['step', n === S.step ? 'step-current' : '', done ? 'step-done' : '', unlocked(n) ? '' : 'step-locked']);
      return '<button type="button" class="' + c + '" data-act="goStep" data-step="' + n + '"' +
        (unlocked(n) ? '' : ' aria-disabled="true"') + '>' +
        '<span class="step-num">' + (done ? '✓' : n) + '</span>' +
        '<span class="step-text"><span class="step-title">' + esc(t('step.' + n + '.title')) + '</span>' +
        '<span class="step-desc">' + esc(t('step.' + n + '.desc')) + '</span></span>' +
        '</button>';
    }).join('');
  }

  function componentOptions(current) {
    return ['Lecture', 'Tutorial', 'Lab', 'Activity'].map(function (c) {
      return '<option' + (c === current ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
  }

  function dayChips(activeDays, idx, disabled) {
    return DAYS.map(function (d) {
      var on = activeDays.indexOf(d) !== -1;
      return '<button type="button" class="chip' + (on ? ' chip-on' : '') + '" data-act="eDay" data-idx="' + idx +
        '" data-day="' + d + '"' + (disabled ? ' disabled' : '') + '>' + esc(dayLabel(d)) + '</button>';
    }).join('');
  }

  function renderSchedule() {
    var dis = S.locked;
    var list = S.imported.map(function (e, i) {
      var uncertain = e.confidence === 'uncertain';
      return '<div class="sch-card' + (uncertain ? ' is-uncertain' : '') + '" data-idx="' + i + '">' +
        '<div class="sch-top">' +
        '<input class="inp" data-field="code" value="' + esc(e.code) + '" aria-label="' + esc(t('s1.f.code')) + '"' + (dis ? ' disabled' : '') + '>' +
        '<input class="inp" data-field="title" value="' + esc(pick(e.title)) + '" aria-label="' + esc(t('s1.f.title')) + '"' + (dis ? ' disabled' : '') + '>' +
        '<select class="inp" data-field="component" aria-label="' + esc(t('s1.f.component')) + '"' + (dis ? ' disabled' : '') + '>' + componentOptions(e.component) + '</select>' +
        '<label class="sch-flag"><input type="checkbox" data-field="uncertain"' + (uncertain ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + esc(t('s1.uncertain')) + '</label>' +
        '<button type="button" class="icon-btn" data-act="delEntry" data-idx="' + i + '"' + (dis ? ' disabled' : '') + '>' + esc(t('s1.del')) + '</button>' +
        '</div>' +
        '<div class="sch-bottom">' +
        '<div class="chipgroup">' + dayChips(e.days || [], i, dis) + '</div>' +
        '<div class="timepair">' +
        '<input class="inp" type="time" data-field="start" value="' + esc(e.start) + '" aria-label="' + esc(t('s1.f.start')) + '"' + (dis ? ' disabled' : '') + '>' +
        '<span class="sep">→</span>' +
        '<input class="inp" type="time" data-field="end" value="' + esc(e.end) + '" aria-label="' + esc(t('s1.f.end')) + '"' + (dis ? ' disabled' : '') + '>' +
        '</div>' +
        (e.dateRange && !L.isFullTerm(e.dateRange) ? '<span class="tt-tag">' + esc(L.dateLabel(e.dateRange)) + '</span>' : '') +
        '</div>' +
        '</div>';
    }).join('');

    $('scheduleList').innerHTML = list || '<p class="unavail-empty">' + esc(t('s1.empty')) + '</p>';

    $('entryDays').innerHTML = DAYS.map(function (d) {
      var on = S.pendingDays.indexOf(d) !== -1;
      return '<button type="button" class="chip' + (on ? ' chip-on' : '') + '" data-act="pendingDay" data-day="' + d + '">' + esc(dayLabel(d)) + '</button>';
    }).join('');

    $('unlockBtn').hidden = !S.locked;
    updateLockState();
  }

  function validEntries() {
    return S.imported.filter(function (e) {
      return (e.days || []).length && e.start && e.end && L.toMin(e.start) < L.toMin(e.end);
    });
  }

  function updateLockState() {
    var ok = validEntries();
    $('lockBtn').disabled = S.locked || !ok.length;
    $('lockBtn').textContent = S.locked ? t('s1.locked') : t('s1.lock');
    $('lockHint').textContent = ok.length ? t('s1.hintOk', { n: ok.length }) : t('s1.hintNeed');
  }

  function renderPrefs() {
    $('areaChips').innerHTML = DATA.areas.map(function (a) {
      var on = S.prefs.areas.indexOf(a) !== -1;
      return '<button type="button" class="chip' + (on ? ' chip-on' : '') + '" data-act="area" data-area="' + a + '">' + esc(t('area.' + a)) + '</button>';
    }).join('');

    $('plannedCredits').value = S.prefs.plannedCredits;
    $('maxCredits').value = S.prefs.maxCredits;
    $('takenCodes').value = S.prefs.takenCodes.join(', ');
    $('sortBy').value = S.prefs.sortBy;
    $('bufferMin').value = S.prefs.bufferMin;
    $('strictOnly').checked = !!S.prefs.strictOnly;

    renderUnavail();
  }

  function renderUnavail() {
    var wrap = $('unavailList');
    if (!S.prefs.unavailable.length) {
      wrap.innerHTML = '<p class="unavail-empty">' + esc(t('s2.unavailEmpty')) + '</p>';
      return;
    }
    wrap.innerHTML = S.prefs.unavailable.map(function (u, i) {
      var chips = DAYS.map(function (d) {
        var on = u.days.indexOf(d) !== -1;
        return '<button type="button" class="chip' + (on ? ' chip-on' : '') + '" data-act="uDay" data-u="' + i + '" data-day="' + d + '">' +
          esc(dayChip(d)) + '</button>';
      }).join('');
      return '<div class="unavail-row">' +
        '<div class="chipgroup">' + chips + '</div>' +
        '<div class="timepair">' +
        '<input class="inp" type="time" data-act="uStart" data-u="' + i + '" value="' + esc(u.start) + '" aria-label="' + esc(t('s2.unavailStart')) + '">' +
        '<span class="sep">→</span>' +
        '<input class="inp" type="time" data-act="uEnd" data-u="' + i + '" value="' + esc(u.end) + '" aria-label="' + esc(t('s2.unavailEnd')) + '">' +
        '</div>' +
        '<button type="button" class="icon-btn" data-act="uDel" data-u="' + i + '">' + esc(t('s1.del')) + '</button>' +
        '</div>';
    }).join('');
  }

  function generate() {
    var ctx = buildContext();
    S.results = L.analyzeAll(DATA.courses, ctx);
    S.selected = {};
    S.picked = {};
    S.checks = {};
    renderResults();
    requestAiExplanations();
  }

  function bundleFor(analysis, bundleId) {
    if (!analysis) return null;
    var list = analysis.bundles || [];
    for (var i = 0; i < list.length; i++) if (list[i].bundleId === bundleId) return list[i];
    return analysis.bestBundle;
  }

  function bundleBadge(status) {
    var map = { ok: 'met', adjacent: 'unknown', unknown: 'unknown', conflict: 'bad' };
    return '<span class="badge ' + (map[status] || 'unknown') + '"><span class="dot"></span>' + esc(t('bundle.status.' + status)) + '</span>';
  }

  function candidateRow(a, ctx) {
    var c = a.course;
    var selectedId = S.selected[c.code];
    var viewId = S.picked[c.code] || selectedId;
    var chosen = viewId ? bundleFor(a, viewId) : a.bestBundle;
    var ivs = chosen ? chosen.intervals : [];
    var isPicked = !!selectedId;
    var arr = chosen ? L.arrangementOf(ctx, ivs) : a.arrangement;

    var timeHtml = L.formatIntervals(ivs).map(function (b) {
      return '<div class="tt-row"><b>' + esc(b.day) + '</b><span>' + esc(b.time) + '</span>' +
        (b.components.length ? '<span class="tt-tag">' + esc(b.components.join('/')) + '</span>' : '') +
        (b.tag ? '<span class="tt-tag">' + esc(b.tag) + '</span>' : '') + '</div>';
    }).join('') || '<span class="metric">—</span>';

    var conflictN = a.bundles.filter(function (b) { return b.status === 'conflict'; }).length;
    var unknownN = a.bundles.filter(function (b) { return b.status === 'unknown'; }).length;
    var okN = a.feasibleBundles.length;
    var timeMatch = '<div class="metric">' + esc(t('cand.timeFit', { ok: okN })) +
      (conflictN ? esc(t('cand.timeFitConflict', { n: conflictN })) : '') +
      (unknownN ? esc(t('cand.timeFitUnknown', { n: unknownN })) : '') + '</div>';

    var reqHtml;
    if (a.requirement.fail.length) {
      reqHtml = '<ul class="mini-list">' + a.requirement.fail.map(function (x) {
        return '<li class="neg">' + esc(x) + '</li>';
      }).join('') + '</ul>';
    } else if (a.requirement.unknown.length) {
      reqHtml = '<ul class="mini-list">' + a.requirement.unknown.slice(0, 2).map(function (x) {
        return '<li>' + esc(x) + '</li>';
      }).join('') +
        (a.requirement.unknown.length > 2 ? '<li>' + esc(t('cand.more', { n: a.requirement.unknown.length - 2 })) + '</li>' : '') +
        '</ul>';
    } else {
      reqHtml = '<div class="metric">' +
        esc(c.area ? t('cand.matchesAreas', { area: t('area.' + c.area) }) : t('cand.matchesAny')) + '</div>' +
        (a.requirement.notes.length ? '<ul class="mini-list">' + a.requirement.notes.map(function (x) {
          return '<li>' + esc(x) + '</li>';
        }).join('') + '</ul>' : '');
    }

    var daysValue = (arr.addedDays > 0 ? '+' : '+') + arr.addedDays;
    var arrHtml = '<div class="metric' + (arr.addedDays > 0 ? ' plus' : ' zero') + '">' + esc(t('cand.days', { n: daysValue })) + '</div>' +
      '<div class="metric">' + esc(t('cand.gap', { n: arr.gapMinutes })) + '</div>';

    var badgeCls = a.state === 'met' ? 'met' : (a.state === 'unknown' ? 'unknown' : 'bad');

    var reasonList = [];
    if (chosen) {
      reasonList.push(t('detail.reasons') + ' · ' + chosen.label + (chosen.status === 'ok' ? '' : ' (' + t('bundle.status.' + chosen.status) + ')'));
    }
    reasonList.push(t('cand.days', { n: daysValue }) + ' · ' + t('cand.gap', { n: arr.gapMinutes }));
    if (a.requirement.notes.length) reasonList = reasonList.concat(a.requirement.notes);

    var bundleCheck = a.bundles.map(function (b) {
      return '<li style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + bundleBadge(b.status) +
        '<span>' + esc(b.label) + '</span></li>';
    }).join('');

    var pendingList = a.requirement.unknown
      .concat(chosen ? chosen.notes : [])
      .concat(a.requirement.alwaysCheck);

    var explanation = aiExplanations[c.code];
    var aiText = explanation && (explanation.english_summary || explanation.summary || explanation.text || '');
    var aiHtml = '<div class="detail-block"><h4>AI explanation (English)</h4>' +
      (aiText
        ? '<p class="metric">' + esc(aiText) + '</p>'
        : '<p class="metric">' +
          (aiStatus === 'loading' ? 'Generating explanation…' :
           aiStatus === 'error' ? 'AI explanation unavailable; local results are still shown.' :
           'No AI explanation yet.') +
          '</p>') +
      '</div>';

    var bundleSelect = a.feasibleBundles.length > 1
      ? '<div class="bundle-pick"><span>' + esc(t('bundle.pick')) + '</span><select class="inp" data-act="pickBundle" data-code="' + esc(c.code) + '">' +
      a.feasibleBundles.map(function (b) {
        var cur = viewId || (a.bestBundle && a.bestBundle.bundleId);
        return '<option value="' + esc(b.bundleId) + '"' + (cur === b.bundleId ? ' selected' : '') + '>' + esc(b.label) + '</option>';
      }).join('') + '</select></div>'
      : '';

    var meta = t('cand.meta', { credits: c.credits || 0, area: c.area ? t('area.' + c.area) : t('cand.areaUnknown') });

    return '<article class="cand ' + cls([a.state === 'unknown' ? 'is-pending' : '', isPicked ? 'is-picked' : '']) + '" data-code="' + esc(c.code) + '">' +
      '<div class="cand-main">' +
      '<div class="cell pick"><input type="checkbox" data-act="pick" data-code="' + esc(c.code) + '"' + (isPicked ? ' checked' : '') + '></div>' +
      '<div class="cell course">' +
      '<div class="c-line1"><span class="code">' + esc(c.code) + '</span><span class="c-title">' + esc(pick(c.title)) + '</span></div>' +
      '<div class="c-sub">' + (chosen ? esc(t('cand.recommended', { label: chosen.label })) : esc(t('cand.noBundle'))) + ' · ' + esc(meta) + '</div>' +
      '</div>' +
      '<div class="cell" data-label="' + esc(t('col.time')) + '"><div class="tt-list">' + timeHtml + '</div></div>' +
      '<div class="cell" data-label="' + esc(t('col.timeFit')) + '">' + timeMatch + '</div>' +
      '<div class="cell" data-label="' + esc(t('col.req')) + '">' + reqHtml + '</div>' +
      '<div class="cell" data-label="' + esc(t('col.impact')) + '">' + arrHtml + '</div>' +
      '<div class="cell" data-label="' + esc(t('col.status')) + '"><span class="badge ' + badgeCls + '"><span class="dot"></span>' + esc(L.stateLabel(a.state)) + '</span></div>' +
      '</div>' +
      '<details class="cand-detail"><summary><span>' + esc(t('cand.detailSummary')) + '</span><span class="toggle-txt"></span></summary>' +
      '<div class="detail-body">' +
      '<div class="detail-block"><h4>' + esc(t('detail.bundleCheck')) + '</h4><ul class="mini-list">' + bundleCheck + '</ul></div>' +
      '<div class="detail-block"><h4>' + esc(t('detail.reasons')) + '</h4><ul class="mini-list">' +
      a.requirement.fail.concat(chosen && chosen.status !== 'ok' ? [] : [])
        .concat([t('detail.reasons') + '：' + (chosen ? chosen.label : '')])
        .concat(reasonList.filter(function (x, i) { return i > 0; }))
        .map(function (x) { return '<li class="pos">' + esc(x) + '</li>'; }).join('') +
      '</ul></div>' +
      aiHtml +
      '<div class="detail-block"><h4>' + esc(t('detail.pending')) + '</h4><ul class="mini-list">' + pendingList.map(function (x) {
        return '<li>' + esc(x) + '</li>';
      }).join('') + '</ul></div>' +
      (bundleSelect ? '<div class="detail-block">' + bundleSelect + '</div>' : '') +
      '<div class="detail-block"><h4>' + esc(t('detail.source')) + '</h4><div class="src">' +
      '<span>' + esc(pick(c.source.name)) + '</span>' +
      '<span>' + esc(t('detail.checkDate', { date: c.source.retrievedAt })) + '</span>' +
      '<a href="' + esc(c.source.url) + '" target="_blank" rel="noopener">' + esc(t('detail.open')) + '</a>' +
      '</div></div>' +
      '</div></details></article>';
  }

  function excludedBlock(results) {
    if (!results.excluded.length) return '';
    return '<details class="excluded"><summary><span>' + esc(t('excl.summary', { n: results.excluded.length })) + '</span><span class="toggle-txt"></span></summary>' +
      '<div class="excluded-list">' + results.excluded.map(function (a) {
        var c = a.course;
        var reason = a.state === 'notMet'
          ? (a.requirement.fail[0] || t('excl.reqFail'))
          : (a.state === 'timeConflict' ? t('excl.allConflict') : (a.requirement.unknown[0] || ''));
        var details = a.bundles.filter(function (b) { return b.status === 'conflict'; })
          .reduce(function (acc, b) {
            return acc.concat(b.conflicts.map(function (x) { return b.label + ' — ' + x.text; }));
          }, []);
        return '<div class="ex-item">' +
          '<div class="ex-head"><span class="code">' + esc(c.code) + '</span><span class="c-title">' + esc(pick(c.title)) + '</span>' +
          '<span class="badge ' + (a.state === 'timeConflict' || a.state === 'notMet' ? 'bad' : 'unknown') + '"><span class="dot"></span>' + esc(L.stateLabel(a.state)) + '</span></div>' +
          '<p class="ex-reason">' + esc(reason) + '</p>' +
          (details.length ? '<ul class="ex-bundles">' + details.slice(0, 4).map(function (d) {
            return '<li>' + esc(d) + '</li>';
          }).join('') + '</ul>' : '') +
          '</div>';
      }).join('') + '</div></details>';
  }

  function emptyBlock(results) {
    return '<div class="empty-state"><h3>' + esc(t('empty.title')) + '</h3>' +
      '<p class="hint">' + esc(t('empty.hint')) + '</p>' +
      results.emptyReasons.map(function (r) {
        return '<div class="empty-item"><div class="t">' + esc(r.title) + '</div><div class="d">' + esc(r.detail) + '</div></div>';
      }).join('') +
      '</div>';
  }

  function selectedPairs() {
    var out = [];
    if (!S.results) return out;
    Object.keys(S.selected).forEach(function (code) {
      var a = S.results.analyses.filter(function (x) { return x.code === code; })[0];
      if (a) out.push({ analysis: a, bundleId: S.selected[code] });
    });
    return out;
  }

  function renderCombo(ctx) {
    var wrap = $('comboWrap');
    var sel = selectedPairs();
    if (sel.length < 2) { wrap.innerHTML = ''; return; }
    var res = L.checkSelection(sel, ctx);
    var arr = res.arrangement;
    wrap.innerHTML = '<div class="combo ' + (res.ok ? 'is-ok' : 'is-bad') + '">' +
      '<h3>' + esc(t('combo.title', { n: sel.length })) + '</h3>' +
      (res.ok
        ? '<p>' + esc(t('combo.okPrefix')) + '<strong>' + esc(t('combo.okStrong')) + '</strong>' +
        esc(t('combo.okSuffix', { days: arr.campusDays, gap: arr.gapMinutes })) + '</p>'
        : '<p><strong>' + esc(t('combo.bad', { n: res.conflicts.length })) + '</strong></p>' +
        '<ul class="mini-list">' + res.conflicts.map(function (c) {
          return '<li class="neg">' + esc(c.text) + '</li>';
        }).join('') + '</ul>') +
      '<p class="combo-warn">' + esc(t('combo.warn')) + '</p>' +
      '</div>';
  }

  function stat(n, key, mod) {
    return '<span class="stat' + (mod ? ' ' + mod : '') + '"><b>' + n + '</b> ' + esc(t(key)) + '</span>';
  }

  function renderResults() {
    if (!S.results) return;
    var ctx = buildContext();
    var r = S.results;

    var summary = stat(r.stats.candidates, 'stat.candidates') +
      stat(r.stats.met, 'stat.met', 'ok') +
      stat(r.stats.unknown, 'stat.unknown', 'warn') +
      stat(r.stats.excludedTime, 'stat.timeConflict', 'bad') +
      stat(r.stats.excludedReq, 'stat.reqFail', 'bad');
    if (r.stats.excludedUnknown) summary += stat(r.stats.excludedUnknown, 'stat.hidden', 'warn');
    summary += stat(r.stats.missingData, 'stat.missing');
    $('resultSummary').innerHTML = summary;

    var candidateHtml = r.candidates.length
      ? '<div class="cand-head"><span></span><span>' + esc(t('col.course')) + '</span><span>' + esc(t('col.time')) +
      '</span><span>' + esc(t('col.timeFit')) + '</span><span>' + esc(t('col.req')) + '</span><span>' + esc(t('col.impact')) +
      '</span><span>' + esc(t('col.status')) + '</span></div>' +
      r.candidates.map(function (a) { return candidateRow(a, ctx); }).join('')
      : emptyBlock(r);

    $('candidateWrap').innerHTML = candidateHtml;
    $('excludedWrap').innerHTML = excludedBlock(r);
    renderCombo(ctx);

    var n = Object.keys(S.selected).length;
    $('step3Note').textContent = n === 0 ? t('s3.none') : (n === 1 ? t('s3.some', { n: n }) : t('s3.many', { n: n }));
    $('toStep4').disabled = n === 0;
  }

  function renderWeek(lockedIvs, pickIvs) {
    var startH = 8, endH = 21, half = 22, rows = (endH - startH) * 2;
    var html = '<div class="weekgrid" style="grid-template-rows:28px repeat(' + rows + ', ' + half + 'px)">';
    html += '<div class="wg-head" style="grid-column:1;grid-row:1">' + esc(t('week.timeCol')) + '</div>';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d, i) {
      html += '<div class="wg-head" style="grid-column:' + (i + 2) + ';grid-row:1">' + esc(dayLabel(d)) + '</div>';
    });
    for (var h = startH; h < endH; h++) {
      var row = 2 + (h - startH) * 2;
      html += '<div class="wg-time" style="grid-row:' + row + '">' + (h < 10 ? '0' : '') + h + ':00</div>';
      html += '<div class="wg-line" style="grid-row:' + row + '"></div>';
    }
    function block(iv, kind) {
      var col = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(iv.day) + 2;
      if (col < 2) return '';
      var s = Math.max(iv.startMin, startH * 60), e = Math.min(iv.endMin, endH * 60);
      if (e <= s) return '';
      var r0 = 2 + Math.floor((s - startH * 60) / 30);
      var span = Math.max(1, Math.ceil((e - startH * 60) / 30) - Math.floor((s - startH * 60) / 30));
      return '<div class="wg-block ' + kind + '" style="grid-column:' + col + ';grid-row:' + r0 + ' / span ' + span + '">' +
        '<b>' + esc(iv.code) + '</b><span>' + esc(iv.start + '-' + iv.end) + '</span></div>';
    }
    var body = '';
    (lockedIvs || []).forEach(function (iv) { body += block(iv, 'locked'); });
    (pickIvs || []).forEach(function (iv) { body += block(iv, 'pick'); });
    return html + body + '</div>';
  }

  function renderFinal() {
    if (!S.results) return;
    var ctx = buildContext();
    var sel = selectedPairs();
    var pickIvs = L.collectSelectedIntervals(sel);

    if (!sel.length) {
      $('finalWrap').innerHTML = '<div class="empty-state"><h3>' + esc(t('final.emptyTitle')) + '</h3>' +
        '<p class="hint">' + esc(t('final.emptyHint')) + '</p></div>';
      return;
    }

    var items = sel.map(function (s) {
      var a = s.analysis, c = a.course, b = bundleFor(a, s.bundleId);
      var key = c.code + '|' + (b ? b.bundleId : '');
      var state = S.checks[key] || {};
      var checks = [
        { k: 'seat', t: t('final.seat') },
        { k: 'qual', t: t('final.qual') },
        { k: 'time', t: t('final.time') }
      ];
      var timeList = L.formatIntervals(b ? b.intervals : []).map(function (x) {
        return x.day + ' ' + x.time;
      }).join(', ');
      return '<div class="final-item">' +
        '<div class="fi-head"><div class="c-line1"><span class="code">' + esc(c.code) + '</span>' +
        '<span class="c-title">' + esc(pick(c.title)) + '</span></div>' +
        '<span class="badge ' + (a.state === 'met' ? 'met' : 'unknown') + '"><span class="dot"></span>' + esc(L.stateLabel(a.state)) + '</span></div>' +
        '<div class="c-sub">' + esc(b ? b.label : '') + ' · ' + esc(timeList) + ' · ' +
        esc(c.area ? t('area.' + c.area) : t('cand.areaUnknown')) + '</div>' +
        '<ul class="checklist">' + checks.map(function (ck) {
          return '<li><label><input type="checkbox" data-act="finalCheck" data-key="' + esc(key) + '" data-k="' + ck.k + '"' +
            (state[ck.k] ? ' checked' : '') + '> ' + esc(ck.t) + '</label></li>';
        }).join('') + '</ul>' +
        '<div class="detail-block" style="margin-top:10px"><div class="src">' +
        '<span>' + esc(t('final.checkDate', { date: c.source.retrievedAt })) + '</span>' +
        '<a href="' + esc(c.source.url) + '" target="_blank" rel="noopener">' + esc(t('final.open')) + '</a>' +
        '</div></div>' +
        '</div>';
    }).join('');

    var combo = sel.length >= 2 ? L.checkSelection(sel, ctx) : null;

    $('finalWrap').innerHTML =
      '<div class="week"><div class="week-cap"><span class="mini-label">' + esc(t('week.preview')) + '</span>' +
      '<div class="legend"><span><i class="swatch locked"></i>' + esc(t('week.locked')) + '</span>' +
      '<span><i class="swatch pick"></i>' + esc(t('week.pick')) + '</span></div></div>' +
      renderWeek(ctx.confirmed, pickIvs) + '</div>' +
      (combo && combo.ok
        ? '<div class="combo is-ok"><h3>' + esc(t('final.okTitle')) + '</h3><p>' +
        esc(t('final.okBody', { n: sel.length, days: combo.arrangement.campusDays })) + '</p>' +
        '<p class="combo-warn">' + esc(t('final.okWarn')) + '</p></div>'
        : combo
          ? '<div class="combo is-bad"><h3>' + esc(t('final.badTitle')) + '</h3><ul class="mini-list">' + combo.conflicts.map(function (c) {
            return '<li class="neg">' + esc(c.text) + '</li>';
          }).join('') + '</ul><p class="combo-warn">' + esc(t('final.badHint')) + '</p></div>'
          : '') +
      '<h3 style="font-family:var(--serif);font-size:17px;margin:22px 0 10px">' + esc(t('final.title')) + '</h3>' +
      '<div class="final-list">' + items + '</div>' +
      '<div class="disclaim"><strong>' + esc(t('final.disclaimTitle')) + '</strong><br>' + esc(t('final.disclaimBody')) + '</div>' +
      '<div class="panel-foot"><p class="foot-note">' + esc(t('final.foot')) + '</p>' +
      '<button class="btn btn-secondary" id="copyBtn" type="button">' + esc(t('final.copy')) + '</button></div>';
  }

  function goStep(n) {
    if (!unlocked(n)) { toast(t('step.lockedToast')); return; }
    S.step = n;
    for (var i = 1; i <= 4; i++) $('panel-' + i).hidden = i !== n;
    renderStepper();
    if (n === 1) renderSchedule();
    if (n === 2) renderPrefs();
    if (n === 3) renderResults();
    if (n === 4) renderFinal();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  function setLang(lang) {
    I.setLang(lang);
    try { localStorage.setItem('cm.lang', I.getLang()); } catch (e) { /* file:// may block */ }
    applyI18n();
    renderStepper();
    renderSchedule();
    renderPrefs();
    if (S.results) renderResults();
    if (S.step === 4) renderFinal();
  }

  document.addEventListener('click', function (e) {
    var langBtn = e.target.closest ? e.target.closest('[data-lang]') : null;
    if (langBtn) { setLang(langBtn.getAttribute('data-lang')); return; }

    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'goStep') { goStep(Number(el.getAttribute('data-step'))); return; }

    if (act === 'pendingDay') {
      var d = el.getAttribute('data-day');
      var i = S.pendingDays.indexOf(d);
      if (i === -1) S.pendingDays.push(d); else S.pendingDays.splice(i, 1);
      el.classList.toggle('chip-on', S.pendingDays.indexOf(d) !== -1);
      return;
    }

    if (act === 'eDay') {
      var idx = Number(el.getAttribute('data-idx'));
      var day = el.getAttribute('data-day');
      var entry = S.imported[idx];
      if (!entry || S.locked) return;
      entry.days = entry.days || [];
      var j = entry.days.indexOf(day);
      if (j === -1) entry.days.push(day); else entry.days.splice(j, 1);
      el.classList.toggle('chip-on', entry.days.indexOf(day) !== -1);
      updateLockState();
      return;
    }

    if (act === 'delEntry') {
      S.imported.splice(Number(el.getAttribute('data-idx')), 1);
      renderSchedule();
      return;
    }

    if (act === 'area') {
      var area = el.getAttribute('data-area');
      var k = S.prefs.areas.indexOf(area);
      if (k === -1) S.prefs.areas.push(area); else S.prefs.areas.splice(k, 1);
      el.classList.toggle('chip-on', S.prefs.areas.indexOf(area) !== -1);
      return;
    }

    if (act === 'uDay') {
      var ui = Number(el.getAttribute('data-u'));
      var ud = el.getAttribute('data-day');
      var u = S.prefs.unavailable[ui];
      if (!u) return;
      var m = u.days.indexOf(ud);
      if (m === -1) u.days.push(ud); else u.days.splice(m, 1);
      el.classList.toggle('chip-on', u.days.indexOf(ud) !== -1);
      return;
    }

    if (act === 'uDel') {
      S.prefs.unavailable.splice(Number(el.getAttribute('data-u')), 1);
      renderUnavail();
      return;
    }
  });

  $('addEntryBtn').addEventListener('click', function () {
    var code = ($('entryCode').value || '').trim().toUpperCase();
    var start = $('entryStart').value, end = $('entryEnd').value;
    if (!S.pendingDays.length) { toast(t('s1.toastNeedDay')); return; }
    if (!start || !end || L.toMin(start) >= L.toMin(end)) { toast(t('s1.toastBadTime')); return; }
    S.imported.push({
      id: 'e' + Date.now(),
      code: code,
      title: ($('entryTitle').value || '').trim(),
      component: $('entryComponent').value,
      days: S.pendingDays.slice(),
      start: start,
      end: end,
      dateRange: DATA.terms.FULL,
      confidence: 'confirmed'
    });
    S.pendingDays = [];
    $('entryCode').value = '';
    $('entryTitle').value = '';
    renderSchedule();
    toast(t('s1.toastAdded'));
  });

  $('scheduleList').addEventListener('input', function (e) {
    var card = e.target.closest('[data-idx]');
    if (!card) return;
    var i = Number(card.getAttribute('data-idx'));
    var field = e.target.getAttribute('data-field');
    var entry = S.imported[i];
    if (!entry || !field) return;
    if (field === 'uncertain') {
      entry.confidence = e.target.checked ? 'uncertain' : 'confirmed';
      card.classList.toggle('is-uncertain', e.target.checked);
    } else if (field === 'code') {
      entry.code = e.target.value.toUpperCase();
    } else if (field === 'title') {
      entry.title = e.target.value;
    } else if (field === 'component') {
      entry.component = e.target.value;
    } else if (field === 'start' || field === 'end') {
      entry[field] = e.target.value;
    }
    updateLockState();
  });

  $('unavailList').addEventListener('input', function (e) {
    var u = e.target.getAttribute('data-u');
    var act = e.target.getAttribute('data-act');
    if (u == null) return;
    var item = S.prefs.unavailable[Number(u)];
    if (!item) return;
    if (act === 'uStart') item.start = e.target.value;
    if (act === 'uEnd') item.end = e.target.value;
  });

  $('addUnavailBtn').addEventListener('click', function () {
    S.prefs.unavailable.push({ days: [], start: '18:00', end: '21:00' });
    renderUnavail();
  });

  $('lockBtn').addEventListener('click', function () {
    if (!validEntries().length) { toast(t('s1.toastNeedOne')); return; }
    S.locked = true;
    S.results = null;
    S.selected = {};
    S.picked = {};
    renderSchedule();
    goStep(2);
    toast(t('s1.toastLocked'));
  });

  $('unlockBtn').addEventListener('click', function () {
    S.locked = false;
    S.results = null;
    S.selected = {};
    S.picked = {};
    renderStepper();
    renderSchedule();
    toast(t('s1.toastUnlocked'));
  });

  ['plannedCredits', 'maxCredits', 'takenCodes', 'sortBy', 'bufferMin'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      if (id === 'takenCodes') S.prefs.takenCodes = $('takenCodes').value.split(/[,，\s]+/).filter(Boolean);
      else if (id === 'sortBy') S.prefs.sortBy = $('sortBy').value;
      else S.prefs[id] = Number($(id).value) || 0;
    });
    $(id).addEventListener('change', function () {
      if (id === 'sortBy') S.prefs.sortBy = $('sortBy').value;
    });
  });

  $('strictOnly').addEventListener('change', function () {
    S.prefs.strictOnly = $('strictOnly').checked;
  });

  $('genBtn').addEventListener('click', function () {
    generate();
    goStep(3);
    toast(t('s2.toastGenerated'));
  });

  $('candidateWrap').addEventListener('change', function (e) {
    var code = e.target.getAttribute('data-code');
    var act = e.target.getAttribute('data-act');
    if (!S.results) return;

    if (act === 'pickBundle') {
      S.picked[code] = e.target.value;
      if (S.selected[code]) S.selected[code] = e.target.value;
      renderResults();
      return;
    }

    if (act !== 'pick') return;
    if (e.target.checked) {
      var an = S.results.analyses.filter(function (x) { return x.code === code; })[0];
      S.selected[code] = S.picked[code] || (an && an.bestBundle ? an.bestBundle.bundleId : '');
    } else {
      delete S.selected[code];
    }
    renderResults();
  });

  $('toStep4').addEventListener('click', function () {
    if (!Object.keys(S.selected).length) { toast(t('s3.toastPickFirst')); return; }
    goStep(4);
  });

  $('finalWrap').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-act') !== 'finalCheck') return;
    var key = e.target.getAttribute('data-key');
    var k = e.target.getAttribute('data-k');
    S.checks[key] = S.checks[key] || {};
    S.checks[key][k] = e.target.checked;
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('#copyBtn') : null;
    if (!btn) return;
    var sel = selectedPairs();
    var lines = [t('copy.title'), t('copy.term', { term: DATA.meta.term })];
    sel.forEach(function (s) {
      var a = s.analysis, b = bundleFor(a, s.bundleId);
      var times = L.formatIntervals(b ? b.intervals : []).map(function (x) { return x.day + ' ' + x.time; }).join(', ');
      lines.push(t('copy.line', {
        code: a.code, title: pick(a.course.title), bundle: b ? b.label : '',
        times: times, date: a.course.source.retrievedAt
      }));
    });
    lines.push(t('copy.tail'));
    var text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(t('toast.copied')); }, function () { toast(t('toast.copyFail')); });
    } else {
      toast(t('toast.copyUnsupported'));
    }
  });

  $('resetBtn').addEventListener('click', function () {
    S.imported = deepCopy(DATA.importedSchedule);
    S.prefs = defaultPrefs();
    S.locked = false;
    S.results = null;
    S.selected = {};
    S.picked = {};
    S.checks = {};
    S.pendingDays = [];
    S.step = 1;
    for (var i = 1; i <= 4; i++) $('panel-' + i).hidden = i !== 1;
    renderStepper();
    renderSchedule();
    renderPrefs();
    toast(t('toast.reset'));
  });

  async function boot() {
    await loadCoursesFromBackend();
    var q = new URLSearchParams(location.search);
    var wanted = q.get('lang');
    if (wanted !== 'zh' && wanted !== 'en') {
      try { wanted = localStorage.getItem('cm.lang'); } catch (e) { wanted = null; }
    }
    I.setLang(wanted === 'en' ? 'en' : 'zh');

    applyI18n();
    renderStepper();
    renderSchedule();
    renderPrefs();

    var stage = Number(q.get('stage') || 1);
    if (stage < 2) { goStep(1); return; }

    S.locked = true;
    renderSchedule();
    if (stage === 2) { goStep(2); return; }

    generate();
    if (stage >= 4) {
      var picks = S.results.candidates.slice(0, Number(q.get('pick') || 2));
      picks.forEach(function (a) {
        if (a.bestBundle) S.selected[a.code] = a.bestBundle.bundleId;
      });
      renderResults();
      goStep(4);
    } else {
      goStep(3);
    }
  }

  boot();
})();