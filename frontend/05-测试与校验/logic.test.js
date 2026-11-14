/*
 * 规则回归测试
 *   跑法：node 05-测试与校验/logic.test.js
 * 作用：证明“整班匹配 / 三态 / 日期范围 / 组合复核”这些容易做错的判定是对的，
 *       并验证中英两套文案都能正确生成（英文模式下不允许漏出中文）。
 * 任何人改 logic.js 或 i18n.js 后先跑这个。
 */
'use strict';

var L = require('../02-核心逻辑/logic.js');
var DATA = require('../03-示例数据/data.js');
var I = require('../04-文案字典/i18n.js');

L.setTerm(DATA.terms.FULL);

var pass = 0, fail = 0, failures = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS  ' + name);
  } catch (e) {
    fail++;
    failures.push(name + ' → ' + e.message);
    console.log('  FAIL  ' + name + '\n        ' + e.message);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error((what || '值') + ' 期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

function ok(cond, what) {
  if (!cond) throw new Error(what || '断言失败');
}

function courseOf(code) {
  var c = DATA.courses.filter(function (x) { return x.code === code; })[0];
  if (!c) throw new Error('找不到课程 ' + code);
  return c;
}

function ctxWith(overrides) {
  var base = {
    confirmed: [],
    uncertain: [],
    unavailable: [],
    bufferMin: DATA.defaults.bufferMin,
    areas: DATA.areas.slice(),
    plannedCredits: DATA.defaults.plannedCredits,
    maxCredits: DATA.defaults.maxCredits,
    takenCodes: [],
    coveredAreas: [],
    sortBy: 'days',
    strictOnly: false
  };
  DATA.importedSchedule.forEach(function (e) {
    var iv = L.entryIntervals(e);
    if (e.confidence === 'uncertain') base.uncertain = base.uncertain.concat(iv);
    else base.confirmed = base.confirmed.concat(iv);
  });
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

function bundleOf(analysis, id) {
  var list = (analysis.bundles || []).filter(function (b) { return b.bundleId === id; });
  return list[0];
}

// 收集由 logic 生成的、会展示给学生的文案（不含数据里的 zh/en 原文）
function generatedStrings(a) {
  var out = [];
  out = out.concat(a.requirement.fail, a.requirement.unknown, a.requirement.notes, a.requirement.alwaysCheck);
  (a.bundles || []).forEach(function (b) {
    out = out.concat(b.notes);
    (b.conflicts || []).forEach(function (c) { out.push(c.text); });
  });
  return out;
}

function cjkIn(list) {
  var hits = [];
  list.forEach(function (s) {
    var m = String(s).match(/[\u4e00-\u9fff]+/g);
    if (m) hits = hits.concat(m);
  });
  return hits;
}

I.setLang('zh');

console.log('\n[1] 整班匹配：Lecture 可行 ≠ 整班可行');
check('GE1401 的 L1+T2 因 Tutorial T2 与 CS2334 撞堂而冲突', function () {
  var a = L.analyzeCourse(courseOf('GE1401'), ctxWith());
  var b = bundleOf(a, 'L1+T2');
  eq(b.status, 'conflict', 'L1+T2 状态');
  ok(b.conflicts.some(function (c) { return /CS2334/.test(c.text); }), '冲突信息里应写明撞到 CS2334');
  ok(b.conflicts.some(function (c) { return /周二 11:00-12:50/.test(c.text); }), '冲突信息里应写明具体时段');
});
check('GE1401 仍有可行班别 L1+T1', function () {
  var a = L.analyzeCourse(courseOf('GE1401'), ctxWith());
  eq(bundleOf(a, 'L1+T1').status, 'ok', 'L1+T1 状态');
  eq(a.timeState, 'ok', '时间判定');
  eq(a.state, 'met', '资格状态');
});
check('GE2504 Lecture 可行但唯一 Tutorial 冲突 → 整门不可用', function () {
  var a = L.analyzeCourse(courseOf('GE2504'), ctxWith());
  eq(a.state, 'timeConflict', '整体状态');
  eq(a.conflictBundles.length, 1, '冲突班别数');
});

console.log('\n[2] 三态标注');
check('已修互斥课程 → 明确不符合', function () {
  var a = L.analyzeCourse(courseOf('GE2101'), ctxWith({ takenCodes: ['GE2100'] }));
  eq(a.state, 'notMet', '状态');
  ok(a.requirement.fail.some(function (t) { return /互斥/.test(t); }), '应给出互斥原因');
});
check('先修条件 → 仍有条件待核实', function () {
  var a = L.analyzeCourse(courseOf('GE2301'), ctxWith());
  eq(a.state, 'unknown', '状态');
  ok(a.requirement.unknown.some(function (t) { return /先修/.test(t); }), '应给出先修原因');
});
check('缺少 GE 类别 → 待核实（不能默认符合）', function () {
  var a = L.analyzeCourse(courseOf('GE2901'), ctxWith());
  eq(a.state, 'unknown', '状态');
  ok(a.requirement.flags.missingArea === true, '应标记缺类别');
});
check('班别时间未公布 → 待核实', function () {
  var a = L.analyzeCourse(courseOf('GE2601'), ctxWith());
  eq(a.state, 'unknown', '状态');
  eq(a.unknownBundles.length, 1, '未知班别数');
});
check('每门课都固定提示“余位不由本工具判断”', function () {
  var a = L.analyzeCourse(courseOf('GE2101'), ctxWith());
  ok(a.requirement.alwaysCheck.some(function (t) { return /不查询/.test(t); }), '应有固定提示');
});

console.log('\n[3] 类别与学分');
check('只选 Area 3 时 Area 2 课程明确不符合', function () {
  var a = L.analyzeCourse(courseOf('GE2101'), ctxWith({ areas: ['area3'] }));
  eq(a.state, 'notMet', '状态');
  ok(/Area 2/.test(a.requirement.fail[0]), '原因里应写明这门课属于哪个类别');
});
check('超出学分上限明确不符合', function () {
  var a = L.analyzeCourse(courseOf('GE2101'), ctxWith({ plannedCredits: 15, maxCredits: 15 }));
  eq(a.state, 'notMet', '状态');
});

console.log('\n[4] 日期范围（半学期）');
check('后半学期课程与后半学期已选课撞堂', function () {
  eq(L.analyzeCourse(courseOf('GE2701'), ctxWith()).state, 'timeConflict', '状态');
});
check('同一时段但前半学期 → 不冲突', function () {
  var a = L.analyzeCourse(courseOf('GE2750'), ctxWith());
  eq(a.state, 'met', '状态');
  eq(a.timeState, 'ok', '时间判定');
});

console.log('\n[5] 缓冲时间');
check('间隔 10 分钟、缓冲 10 分钟 → 可行', function () {
  eq(L.analyzeCourse(courseOf('GE2410'), ctxWith({ bufferMin: 10 })).timeState, 'ok', '时间判定');
});
check('缓冲设为 20 分钟 → 转为待核实并说明原因', function () {
  var a = L.analyzeCourse(courseOf('GE2410'), ctxWith({ bufferMin: 20 }));
  eq(a.timeState, 'adjacent', '时间判定');
  eq(a.state, 'unknown', '资格状态');
  ok(a.bestBundle.notes.some(function (n) { return /缓冲/.test(n); }), '应说明缓冲不足');
});

console.log('\n[6] 待确认课表不当作可行可确认');
check('课表识别待确认且时间重叠 → 该班别标待核实，且不会被推荐', function () {
  var ctx = ctxWith();
  var cs = DATA.importedSchedule.filter(function (e) { return e.code === 'CS2334'; })[0];
  ctx.confirmed = ctx.confirmed.filter(function (iv) { return iv.code !== 'CS2334'; });
  ctx.uncertain = ctx.uncertain.concat(L.entryIntervals(cs));
  var a = L.analyzeCourse(courseOf('GE1401'), ctx);
  eq(bundleOf(a, 'L1+T2').status, 'unknown', 'L1+T2 状态');
  eq(a.bestBundle.bundleId, 'L1+T1', '应推荐确定可行的班别');
  eq(a.state, 'met', '推荐班别可行时课程仍标已知符合');
});
check('唯一可能的班别与该待确认课表重叠 → 整门标待核实', function () {
  var ctx = ctxWith();
  var cs = DATA.importedSchedule.filter(function (e) { return e.code === 'CS2334'; })[0];
  ctx.confirmed = ctx.confirmed.filter(function (iv) { return iv.code !== 'CS2334'; });
  ctx.uncertain = ctx.uncertain.concat(L.entryIntervals(cs));
  var a = L.analyzeCourse(courseOf('GE2504'), ctx);
  eq(a.state, 'unknown', '整体状态');
  eq(a.timeState, 'unknown', '时间判定');
  ok(a.bestBundle.notes.some(function (n) { return /待确认/.test(n); }), '应说明原因');
});

console.log('\n[7] 安排影响');
check('GE2101 不新增到校天数，课间空档 350 分钟', function () {
  var a = L.analyzeCourse(courseOf('GE2101'), ctxWith());
  eq(a.arrangement.addedDays, 0, '新增到校天数');
  eq(a.arrangement.gapMinutes, 350, '课间空档总分钟');
});

console.log('\n[8] 空结果原因分类');
check('资料缺失的课程不会被静默丢弃（仍作为待确认候选出现）', function () {
  var r = L.analyzeAll(DATA.courses, ctxWith({ areas: ['china'] }));
  ok(r.candidates.some(function (a) { return a.code === 'GE2901'; }), 'GE2901 应作为待确认候选保留');
});
check('所有课程类别都已知且被过滤掉时，给出“范围过窄”说明', function () {
  var knownArea = DATA.courses.filter(function (c) { return !!c.area; });
  var r = L.analyzeAll(knownArea, ctxWith({ areas: ['china'] }));
  eq(r.candidates.length, 0, '候选数');
  ok(r.emptyReasons.some(function (x) { return x.key === 'scope'; }), '应指出范围过窄');
});
check('「只看已知符合」开启后，待核实的课不算候选但仍可查', function () {
  var strict = L.analyzeAll(DATA.courses, ctxWith({ areas: ['china'], strictOnly: true }));
  eq(strict.candidates.length, 0, '候选数');
  ok(strict.stats.excludedUnknown > 0, '应统计被隐藏的门数');
  ok(strict.emptyReasons.some(function (x) { return x.key === 'hidden'; }), '应说明是被开关隐藏');
  var loose = L.analyzeAll(DATA.courses, ctxWith({ areas: ['china'], strictOnly: false }));
  ok(loose.candidates.length > 0, '关掉开关后待核实的课应重新出现');
});

console.log('\n[9] 多门组合复核');
check('同时选两门相同时段的课 → 检出组合冲突', function () {
  var r = L.analyzeAll(DATA.courses, ctxWith());
  function pick(code) {
    return r.analyses.filter(function (a) { return a.code === code; })[0];
  }
  var res = L.checkSelection(
    [{ analysis: pick('GE1401'), bundleId: 'L1+T1' }, { analysis: pick('GE2301'), bundleId: 'L1+T1' }],
    ctxWith()
  );
  eq(res.ok, false, '组合可行性');
  ok(res.conflicts.length > 0, '应检出冲突');
  ok(/周一 16:00-17:50|周二 16:00-17:50|周一 16:00-16:50|周二 15:00-16:50/.test(res.conflicts[0].text), '冲突应写明具体时段');
});
check('两门互不冲突的课 → 组合可行', function () {
  var r = L.analyzeAll(DATA.courses, ctxWith());
  function pick(code) {
    return r.analyses.filter(function (a) { return a.code === code; })[0];
  }
  var res = L.checkSelection(
    [{ analysis: pick('GE1401'), bundleId: 'L1+T1' }, { analysis: pick('GE2101'), bundleId: 'L1+T1' }],
    ctxWith()
  );
  eq(res.ok, true, '组合可行性');
});

console.log('\n[10] 英文文案（切换语言后判定不变、文案不漏中文）');
check('英文模式下冲突描述是英文且保留具体时段', function () {
  I.setLang('en');
  var a = L.analyzeCourse(courseOf('GE1401'), ctxWith());
  var b = bundleOf(a, 'L1+T2');
  eq(b.status, 'conflict', '判定不受语言影响');
  ok(/overlaps/.test(b.conflicts[0].text), '应为英文 overlap 描述');
  ok(/Tue 11:00-12:50/.test(b.conflicts[0].text), '应写明具体时段');
});
check('英文模式下三态标签为英文', function () {
  I.setLang('en');
  eq(L.stateLabel('met'), 'conditions met', 'met');
  eq(L.stateLabel('unknown'), 'still to verify', 'unknown');
  eq(L.stateLabel('timeConflict'), 'no clash-free option', 'timeConflict');
});
check('英文模式下所有课程生成文案都不含中文', function () {
  I.setLang('en');
  var ctx = ctxWith({ bufferMin: 20, takenCodes: ['GE2100'] });
  var bad = [];
  DATA.courses.forEach(function (c) {
    var hits = cjkIn(generatedStrings(L.analyzeCourse(c, ctx)));
    if (hits.length) bad.push(c.code + ': ' + hits.slice(0, 3).join('/'));
  });
  ok(bad.length === 0, '漏翻：' + bad.join(' | '));
});
check('英文模式下空结果说明是英文', function () {
  I.setLang('en');
  var knownArea = DATA.courses.filter(function (c) { return !!c.area; });
  var r = L.analyzeAll(knownArea, ctxWith({ areas: ['china'], strictOnly: true }));
  var titles = r.emptyReasons.map(function (x) { return x.title + ' ' + x.detail; });
  ok(cjkIn(titles).length === 0, '空结果说明漏翻：' + cjkIn(titles).slice(0, 3).join('/'));
});
check('英文模式下星期与日期标签为英文', function () {
  I.setLang('en');
  eq(L.describeInterval({ day: 'Mon', start: '09:00', end: '10:50', dateRange: null }), 'Mon 09:00-10:50', '区间描述');
  eq(L.dateLabel(DATA.terms.H2), '02-22 to 04-24', '半学期日期');
});
check('切回中文后文案恢复', function () {
  I.setLang('zh');
  eq(L.stateLabel('met'), '已知条件符合', 'met');
  eq(L.dateLabel(DATA.terms.H2), '02-22 至 04-24', '半学期日期');
});

console.log('\n------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
if (fail) {
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
  process.exit(1);
}
