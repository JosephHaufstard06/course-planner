/*
 * 选课匹配核心逻辑（纯函数，无 DOM 依赖）
 * ------------------------------------------------------------
 * 设计原则（对应方案文档）：
 *  1. 时间可行 = 整班组合全部班别都不撞堂（不是只看 Lecture）。
 *  2. 三态：明确不符合 / 已知条件符合 / 仍有条件待核实。资料缺失一律落到待确认。
 *  3. 冲突必须可定位：撞哪门课、哪个班别、哪个时段。
 *  4. 日期范围参与判定：半学期课程与全学期课程并非必然冲突。
 *  5. 不判断“有没有剩余名额”：一律标记为需学生自行核实。
 *  6. 面向学生的文案全部走 i18n.js，判定本身与语言无关。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CM_LOGIC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 文案层：浏览器里由 index.html 先加载（globalThis.CM_I18N）；
  // Node 测试里按目录结构逐个尝试，这样移动目录也不会坏。
  var i18n = (function () {
    if (typeof module === 'object' && typeof require === 'function') {
      var candidates = ['./i18n.js', '../04-文案字典/i18n.js', '../i18n.js'];
      for (var i = 0; i < candidates.length; i++) {
        try { return require(candidates[i]); } catch (e) { /* try next */ }
      }
    }
    if (typeof globalThis !== 'undefined' && globalThis.CM_I18N) return globalThis.CM_I18N;
    return null;
  })();

  function tr(key, params) { return i18n ? i18n.t(key, params) : key; }
  function dayLabel(day) { return i18n ? i18n.dayLabel(day) : day; }
  function areaLabel(key) {
    if (!key) return '';
    if (i18n && i18n.has('area.' + key)) return tr('area.' + key);
    return key;
  }

  var DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var FULL_TERM = null;

  /* ---------------- 基础工具 ---------------- */

  function toMin(t) {
    if (!t) return NaN;
    var p = String(t).split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toTime(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function norm(code) { return String(code == null ? '' : code).trim().toUpperCase(); }

  function datesOverlap(a, b) {
    if (!a || !b || !a[0] || !b[0]) return true; // unknown dates → assume overlap (conservative)
    return a[0] <= b[1] && b[0] <= a[1];
  }

  function setTerm(range) { FULL_TERM = range || null; }

  function isFullTerm(range) {
    if (!FULL_TERM || !range) return false;
    return range[0] === FULL_TERM[0] && range[1] === FULL_TERM[1];
  }

  function dateLabel(range) {
    if (!range || !range[0] || !range[1]) return '';
    if (isFullTerm(range)) return '';
    return tr('date.range', { from: range[0].slice(5), to: range[1].slice(5) });
  }

  /* ---------------- 区间构造 ---------------- */

  function entryIntervals(entry) {
    var out = [];
    var s = toMin(entry.start), e = toMin(entry.end);
    var label = entry.label || ((entry.code || '') + (entry.component ? ' ' + entry.component : ''));
    (entry.days || []).forEach(function (d) {
      if (!isFinite(s) || !isFinite(e) || e <= s) return;
      out.push({
        day: d,
        start: entry.start,
        end: entry.end,
        startMin: s,
        endMin: e,
        dateRange: entry.dateRange || null,
        code: entry.code || '',
        title: entry.title || '',
        component: entry.component || '',
        sectionId: entry.sectionId || '',
        label: label.trim()
      });
    });
    return out;
  }

  function sectionsMap(course) {
    var map = {};
    (course.sections || []).forEach(function (s) { map[s.id] = s; });
    return map;
  }

  function bundleIntervals(course, bundle) {
    var map = sectionsMap(course);
    var out = [];
    (bundle.sections || []).forEach(function (sid) {
      var sec = map[sid];
      if (!sec) { out.push({ missing: true, sectionId: sid, reason: 'missing' }); return; }
      var s = toMin(sec.start), e = toMin(sec.end);
      var days = sec.days || [];
      if (!days.length || !isFinite(s) || !isFinite(e) || e <= s) {
        out.push({
          missing: true,
          sectionId: sid,
          reason: tr('bundle.sectionNoTime', { component: sec.component || '', id: sid })
        });
        return;
      }
      days.forEach(function (d) {
        out.push({
          day: d,
          start: sec.start,
          end: sec.end,
          startMin: s,
          endMin: e,
          dateRange: sec.dateRange || null,
          code: course.code,
          title: course.title || '',
          component: sec.component || '',
          sectionId: sid,
          label: course.code + ' ' + sid + ' ' + (sec.component || '')
        });
      });
    });
    return out;
  }

  /* ---------------- 冲突判定 ---------------- */

  function compareIntervals(cands, blockers, bufferMin) {
    var conflicts = [], tightGaps = [];
    var minGap = Math.max(Number(bufferMin) || 0, 1);
    cands.forEach(function (c) {
      blockers.forEach(function (b) {
        if (!c.day || !b.day || c.day !== b.day) return;
        if (!datesOverlap(c.dateRange, b.dateRange)) return;
        if (c.startMin < b.endMin && b.startMin < c.endMin) {
          conflicts.push({ candidate: c, blocked: b });
          return;
        }
        var gap = Math.max(b.startMin - c.endMin, c.startMin - b.endMin);
        if (gap >= 0 && gap < minGap) tightGaps.push({ candidate: c, blocked: b, gap: gap });
      });
    });
    return { conflicts: conflicts, tightGaps: tightGaps };
  }

  // 同一个班别组合内部各节之间也要检查（Lecture 与 Tutorial 互相撞 / 间隔太短）
  function compareSelf(intervals, bufferMin) {
    var conflicts = [], tightGaps = [];
    var minGap = Math.max(Number(bufferMin) || 0, 1);
    for (var i = 0; i < intervals.length; i++) {
      for (var j = i + 1; j < intervals.length; j++) {
        var a = intervals[i], b = intervals[j];
        if (!a.day || !b.day || a.day !== b.day) continue;
        if (!datesOverlap(a.dateRange, b.dateRange)) continue;
        if (a.startMin < b.endMin && b.startMin < a.endMin) {
          conflicts.push({ candidate: b, blocked: a });
          continue;
        }
        var gap = Math.max(b.startMin - a.endMin, a.startMin - b.endMin);
        if (gap >= 0 && gap < minGap) tightGaps.push({ candidate: b, blocked: a, gap: gap });
      }
    }
    return { conflicts: conflicts, tightGaps: tightGaps };
  }

  function describeInterval(iv) {
    var rl = dateLabel(iv.dateRange);
    return tr('time.interval', { day: dayLabel(iv.day), start: iv.start, end: iv.end }) +
      (rl ? ' (' + rl + ')' : '');
  }

  /* ---------------- 班别组合评估 ---------------- */

  function wrapOverlaps(list) {
    return list.map(function (c) {
      return {
        kind: 'overlap',
        candidate: c.candidate,
        blocked: c.blocked,
        text: tr('conflict.overlap', {
          candidate: describeInterval(c.candidate),
          blocked: c.blocked.label,
          blockedTime: describeInterval(c.blocked)
        })
      };
    });
  }

  function evaluateBundle(course, bundle, ctx) {
    var res = {
      bundleId: bundle.id,
      label: bundle.label || bundle.id,
      sections: (bundle.sections || []).slice(),
      status: 'ok',          // ok | adjacent | unknown | conflict
      conflicts: [],
      tightGaps: [],
      notes: [],
      intervals: []
    };

    if (!bundle.sections || !bundle.sections.length) {
      res.status = 'unknown';
      res.notes.push(tr('bundle.noSections'));
      return res;
    }

    var all = bundleIntervals(course, bundle);
    var missing = all.filter(function (x) { return x.missing; });
    res.intervals = all.filter(function (x) { return !x.missing; });

    if (missing.length) {
      res.status = 'unknown';
      missing.forEach(function (m) {
        res.notes.push(tr('bundle.missingData', {
          reason: m.reason === 'missing' ? (m.sectionId + '') : m.reason
        }));
      });
      return res;
    }

    var selfCmp = compareSelf(res.intervals, ctx.bufferMin);
    if (selfCmp.conflicts.length) {
      res.status = 'conflict';
      selfCmp.conflicts.forEach(function (c) {
        res.conflicts.push({
          kind: 'internal',
          text: tr('conflict.internal', {
            a: c.blocked.label,
            b: c.candidate.label,
            day: dayLabel(c.candidate.day),
            time: c.candidate.start + '-' + c.candidate.end
          })
        });
      });
    }

    var vsConfirmed = compareIntervals(res.intervals, ctx.confirmed, ctx.bufferMin);
    if (vsConfirmed.conflicts.length) {
      res.status = 'conflict';
      res.conflicts = res.conflicts.concat(wrapOverlaps(vsConfirmed.conflicts));
    }

    if (ctx.uncertain && ctx.uncertain.length) {
      var vsUncertain = compareIntervals(res.intervals, ctx.uncertain, ctx.bufferMin);
      if (vsUncertain.conflicts.length) {
        if (res.status !== 'conflict') res.status = 'unknown';
        res.notes.push(tr('bundle.overlapUncertain'));
        res.conflicts = res.conflicts.concat(wrapOverlaps(vsUncertain.conflicts));
      }
    }

    if (ctx.unavailable && ctx.unavailable.length) {
      var vsUnavail = compareIntervals(res.intervals, ctx.unavailable, ctx.bufferMin);
      if (vsUnavail.conflicts.length) {
        res.status = 'conflict';
        res.conflicts = res.conflicts.concat(wrapOverlaps(vsUnavail.conflicts));
      }
    }

    if (res.status === 'ok') {
      var gaps = vsConfirmed.tightGaps.concat(selfCmp.tightGaps);
      if (ctx.unavailable && ctx.unavailable.length) {
        gaps = gaps.concat(compareIntervals(res.intervals, ctx.unavailable, ctx.bufferMin).tightGaps);
      }
      if (gaps.length) {
        res.status = 'adjacent';
        res.tightGaps = gaps;
        var min = Math.min.apply(null, gaps.map(function (g) { return g.gap; }));
        if (min === 0) res.notes.push(tr('bundle.overlapping'));
        res.notes.push(tr('bundle.gap', { gap: min, buffer: ctx.bufferMin || 0 }));
      }
    }

    return res;
  }

  /* ---------------- 修读条件评估（三态） ---------------- */

  function evalRequirements(course, ctx) {
    var fail = [], unknown = [], notes = [];
    var cond = course.conditions || {};
    var taken = (ctx.takenCodes || []).map(norm);
    var flags = { missingArea: !course.area };

    // 1) GE 类别
    if (!course.area) {
      unknown.push(tr('req.missingArea'));
    } else if (ctx.areas && ctx.areas.length && ctx.areas.indexOf(course.area) === -1) {
      fail.push(tr('req.outOfScope', { area: areaLabel(course.area) }));
    }

    // 2) 已修 / 互斥
    if (taken.indexOf(norm(course.code)) !== -1) fail.push(tr('req.alreadyTaken', { code: course.code }));
    (cond.exclusions || []).forEach(function (x) {
      if (taken.indexOf(norm(x)) !== -1) fail.push(tr('req.exclusion', { code: x }));
    });

    // 3) 学分总量（上限需与学院确认，这里按你填写的上限判断）
    var planned = Number(ctx.plannedCredits) || 0;
    var max = Number(ctx.maxCredits) || 0;
    if (max > 0 && planned + (course.credits || 0) > max) {
      fail.push(tr('req.creditCap', { total: planned + (course.credits || 0), max: max }));
    }

    // 4) 先修 / 主修限制 → 待确认
    if (cond.prereq) unknown.push(tr('req.prereq', { code: cond.prereq }));
    if (cond.majorRestricted) {
      var noteText = cond.note && i18n ? i18n.pick(cond.note) : (typeof cond.note === 'string' ? cond.note : '');
      unknown.push(noteText ? tr('req.major', { note: noteText }) : tr('req.majorNoNote'));
    }

    // 5) 该类别是否已修过（提示，不算不符合）
    if (course.area && ctx.coveredAreas && ctx.coveredAreas.indexOf(course.area) !== -1) {
      notes.push(tr('req.covered'));
    }

    var state = fail.length ? 'notMet' : (unknown.length ? 'unknown' : 'met');
    return {
      state: state,
      fail: fail,
      unknown: unknown,
      notes: notes,
      flags: flags,
      alwaysCheck: [tr('req.always')]
    };
  }

  /* ---------------- 安排影响 ---------------- */

  function dayMergeMap(intervals) {
    var by = {};
    intervals.forEach(function (iv) {
      if (!iv.day || !isFinite(iv.startMin) || !isFinite(iv.endMin)) return;
      (by[iv.day] = by[iv.day] || []).push({ s: iv.startMin, e: iv.endMin });
    });
    Object.keys(by).forEach(function (d) {
      by[d].sort(function (a, b) { return a.s - b.s; });
      var merged = [];
      by[d].forEach(function (x) {
        var last = merged[merged.length - 1];
        if (last && x.s <= last.e) last.e = Math.max(last.e, x.e);
        else merged.push({ s: x.s, e: x.e });
      });
      by[d] = merged;
    });
    return by;
  }

  function summarizeSchedule(intervals) {
    var by = dayMergeMap(intervals);
    var campusDays = 0, gapMinutes = 0, spans = [];
    DAY_ORDER.forEach(function (d) {
      var blocks = by[d];
      if (!blocks || !blocks.length) return;
      campusDays += 1;
      for (var i = 1; i < blocks.length; i++) gapMinutes += blocks[i].s - blocks[i - 1].e;
      spans.push({
        day: d,
        first: toTime(blocks[0].s),
        last: toTime(blocks[blocks.length - 1].e),
        blocks: blocks
      });
    });
    return { campusDays: campusDays, gapMinutes: gapMinutes, spans: spans };
  }

  function arrangementOf(ctx, extraIntervals) {
    var base = summarizeSchedule(ctx.confirmed);
    var after = summarizeSchedule(ctx.confirmed.concat(extraIntervals || []));
    return {
      baseCampusDays: base.campusDays,
      campusDays: after.campusDays,
      addedDays: after.campusDays - base.campusDays,
      gapMinutes: after.gapMinutes,
      addedGapMinutes: after.gapMinutes - base.gapMinutes,
      spans: after.spans
    };
  }

  /* ---------------- 单门课程分析 ---------------- */

  function scoreOf(bundleRes, ctx, course, arrangement) {
    var score;
    if (ctx.sortBy === 'gap') {
      score = arrangement.addedGapMinutes * 1000 + arrangement.addedDays * 100;
    } else if (ctx.sortBy === 'area') {
      var covered = course.area && ctx.coveredAreas && ctx.coveredAreas.indexOf(course.area) !== -1;
      score = (covered ? 1e6 : 0) + arrangement.addedDays * 1000 + arrangement.addedGapMinutes;
    } else {
      score = arrangement.addedDays * 1000 + arrangement.addedGapMinutes;
    }
    if (bundleRes.status === 'unknown') score += 300;
    if (bundleRes.status === 'adjacent') score += 150;
    return score;
  }

  var FEASIBLE = { ok: true, adjacent: true, unknown: true };

  function analyzeCourse(course, ctx) {
    var req = evalRequirements(course, ctx);
    var bundles = (course.bundles || []).map(function (b) { return evaluateBundle(course, b, ctx); });
    var feasibleBundles = bundles.filter(function (b) { return FEASIBLE[b.status] === true; });

    var best = null, bestScore = Infinity;
    feasibleBundles.forEach(function (b) {
      var arr = arrangementOf(ctx, b.intervals);
      var sc = scoreOf(b, ctx, course, arr);
      b.arrangement = arr;
      b.score = sc;
      if (sc < bestScore) { bestScore = sc; best = b; }
    });

    var timeState;
    if (!feasibleBundles.length) timeState = 'conflict';
    else if (best.status === 'ok') timeState = 'ok';
    else timeState = best.status;

    var state;
    if (req.state === 'notMet') state = 'notMet';
    else if (!feasibleBundles.length) state = 'timeConflict';
    else if (req.state === 'unknown' || timeState === 'unknown' || timeState === 'adjacent') state = 'unknown';
    else state = 'met';

    return {
      code: course.code,
      course: course,
      requirement: req,
      bundles: bundles,
      feasibleBundles: feasibleBundles,
      bestBundle: best,
      timeState: timeState,
      state: state,
      arrangement: best ? best.arrangement : arrangementOf(ctx, []),
      conflictBundles: bundles.filter(function (b) { return b.status === 'conflict'; }),
      unknownBundles: bundles.filter(function (b) { return b.status === 'unknown'; })
    };
  }

  /* ---------------- 全量分析 ---------------- */

  function analyzeAll(courses, ctx) {
    var strict = !!ctx.strictOnly;
    var analyses = courses.map(function (c) { return analyzeCourse(c, ctx); });

    function isCandidate(a) {
      if (a.state === 'met') return true;
      if (a.state === 'unknown') return !strict;
      return false;
    }

    var candidates = analyses.filter(isCandidate);
    var excluded = analyses.filter(function (a) { return !isCandidate(a); });

    candidates.sort(function (a, b) {
      var sa = a.bestBundle ? a.bestBundle.score : Infinity;
      var sb = b.bestBundle ? b.bestBundle.score : Infinity;
      if (sa !== sb) return sa - sb;
      if (a.state !== b.state) return a.state === 'met' ? -1 : 1;
      return a.code.localeCompare(b.code);
    });

    var stats = {
      total: analyses.length,
      candidates: candidates.length,
      met: candidates.filter(function (a) { return a.state === 'met'; }).length,
      unknown: candidates.filter(function (a) { return a.state === 'unknown'; }).length,
      excludedTime: excluded.filter(function (a) { return a.state === 'timeConflict'; }).length,
      excludedReq: excluded.filter(function (a) { return a.state === 'notMet'; }).length,
      excludedUnknown: excluded.filter(function (a) { return a.state === 'unknown'; }).length,
      missingData: analyses.filter(function (a) {
        return a.requirement.flags.missingArea || a.unknownBundles.length > 0;
      }).length
    };

    var emptyReasons = [];
    if (!candidates.length) {
      if (stats.excludedTime) {
        emptyReasons.push({
          key: 'time',
          title: tr('empty.time.title', { n: stats.excludedTime }),
          detail: tr('empty.time.detail')
        });
      }
      if (stats.excludedReq) {
        emptyReasons.push({
          key: 'scope',
          title: tr('empty.scope.title', { n: stats.excludedReq }),
          detail: tr('empty.scope.detail')
        });
      }
      if (stats.excludedUnknown) {
        emptyReasons.push({
          key: 'hidden',
          title: tr('empty.hidden.title', { n: stats.excludedUnknown }),
          detail: tr('empty.hidden.detail')
        });
      }
      if (stats.missingData) {
        emptyReasons.push({
          key: 'data',
          title: tr('empty.data.title', { n: stats.missingData }),
          detail: tr('empty.data.detail')
        });
      }
      if (!emptyReasons.length) {
        emptyReasons.push({ key: 'none', title: tr('empty.none.title'), detail: tr('empty.none.detail') });
      }
    }

    return { analyses: analyses, candidates: candidates, excluded: excluded, stats: stats, emptyReasons: emptyReasons };
  }

  /* ---------------- 多门组合复核 ---------------- */

  function collectSelectedIntervals(selected) {
    var out = [];
    (selected || []).forEach(function (sel) {
      var b = bundleOf(sel);
      if (b && b.intervals) out = out.concat(b.intervals);
    });
    return out;
  }

  function bundleOf(sel) {
    if (!sel || !sel.analysis) return null;
    var list = sel.analysis.bundles || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].bundleId === sel.bundleId) return list[i];
    }
    return sel.analysis.bestBundle || null;
  }

  function checkSelection(selected, ctx) {
    var items = (selected || []).filter(function (s) { return s && s.analysis; });
    if (items.length < 2) {
      return { ok: true, conflicts: [], arrangement: arrangementOf(ctx, collectSelectedIntervals(items)), pairs: 0 };
    }
    var conflicts = [];
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var bi = bundleOf(items[i]);
        var bj = bundleOf(items[j]);
        if (!bi || !bj) continue;
        var cmp = compareIntervals(bi.intervals || [], bj.intervals || [], ctx.bufferMin);
        cmp.conflicts.forEach(function (c) {
          conflicts.push({
            a: items[i].analysis.code,
            b: items[j].analysis.code,
            text: tr('conflict.overlap', {
              candidate: items[i].analysis.code + ' ' + describeInterval(c.candidate),
              blocked: items[j].analysis.code,
              blockedTime: describeInterval(c.blocked)
            })
          });
        });
      }
    }
    return {
      ok: conflicts.length === 0,
      conflicts: conflicts,
      arrangement: arrangementOf(ctx, collectSelectedIntervals(items)),
      pairs: (items.length * (items.length - 1)) / 2
    };
  }

  /* ---------------- 展示辅助 ---------------- */

  function formatIntervals(intervals) {
    var by = {};
    (intervals || []).forEach(function (iv) {
      var key = dayLabel(iv.day) + '|' + iv.start + '-' + iv.end + '|' + (dateLabel(iv.dateRange) || '');
      if (!by[key]) by[key] = { day: dayLabel(iv.day), time: iv.start + '-' + iv.end, tag: dateLabel(iv.dateRange) || '', components: [] };
      if (iv.component && by[key].components.indexOf(iv.component) === -1) by[key].components.push(iv.component);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) {
      return a.day.localeCompare(b.day) || a.time.localeCompare(b.time);
    });
  }

  function stateLabel(state) { return tr('state.' + state); }

  return {
    DAY_ORDER: DAY_ORDER,
    toMin: toMin,
    toTime: toTime,
    norm: norm,
    datesOverlap: datesOverlap,
    dateLabel: dateLabel,
    setTerm: setTerm,
    isFullTerm: isFullTerm,
    entryIntervals: entryIntervals,
    bundleIntervals: bundleIntervals,
    compareIntervals: compareIntervals,
    compareSelf: compareSelf,
    describeInterval: describeInterval,
    evaluateBundle: evaluateBundle,
    evalRequirements: evalRequirements,
    summarizeSchedule: summarizeSchedule,
    arrangementOf: arrangementOf,
    analyzeCourse: analyzeCourse,
    analyzeAll: analyzeAll,
    checkSelection: checkSelection,
    collectSelectedIntervals: collectSelectedIntervals,
    bundleOf: bundleOf,
    formatIntervals: formatIntervals,
    stateLabel: stateLabel,
    setLang: function (l) { if (i18n) i18n.setLang(l); },
    lang: function () { return i18n ? i18n.getLang() : 'zh'; }
  };
});
