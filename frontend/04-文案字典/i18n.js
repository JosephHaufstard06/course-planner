/*
 * 文案层（中 / 英）
 * ------------------------------------------------------------
 * 所有界面文字、状态说明、冲突描述都从这里取，logic.js 与 app.js 里不再写死中文。
 * 用法：
 *   CM_I18N.setLang('en');
 *   CM_I18N.t('s1.h', { n: 3 })        // 带占位符
 *   CM_I18N.pick(course.title)          // 数据里 { zh, en } 形式的字段
 *   CM_I18N.dayLabel('Mon') / dayChip('Mon')
 *
 * 缺键时会回落到中文，再回落到键名——英文页里出现中文即视为漏翻（测试会拦）。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CM_I18N = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DICT = {
    zh: {
      'app.title': '学生选课匹配助手',
      'app.mark': '选',
      'app.subtitle': 'CityUHK 本科生 GE 选课辅助',
      'app.demoTag': '合成数据演示',
      'app.term': '2026/27 Sem B',
      'app.noCommit': '不代为选课',
      'app.reset': '重置演示',
      'app.footer1': '原型 v0.1 · 数据为合成示例，不代表真实课程资料 · 不提供抢课、查余位、代提交',
      'app.footer2': '保留学生自主权：所有推荐都可点开查看依据与资料来源。',
      'app.langSwitch': '语言',

      'step.1.title': '确认课表',
      'step.1.desc': '读入并修正',
      'step.2.title': '剩余要求',
      'step.2.desc': '类别与偏好',
      'step.3.title': '候选课程',
      'step.3.desc': '时间与条件',
      'step.4.title': '官方核实',
      'step.4.desc': '自行决定',
      'step.lockedToast': '先完成上一步',

      's1.h': '确认你的课表',
      's1.hint': '工具先读入你的已选课程，再由你修正并锁定。锁定后才用它做时间筛选——工具不读取学号或密码。',
      's1.notice': '识别结果可能有误：请逐条核对课程代码、班别与时间。标为「识别待确认」的课不会被当成确定时间使用，与它重叠的候选课只会标「待核实」。',
      's1.addTitle': '补充一门已选课程',
      's1.f.code': '课程代码',
      's1.f.title': '课程名称',
      's1.f.component': '组成部分',
      's1.f.start': '开始',
      's1.f.end': '结束',
      's1.ph.code': '例如 GE1401',
      's1.ph.title': '可留空',
      's1.add': '添加',
      's1.lock': '锁定课表，进入下一步',
      's1.locked': '课表已锁定',
      's1.unlock': '解锁修改',
      's1.uncertain': '识别待确认',
      's1.del': '删除',
      's1.empty': '还没有任何已选课程。可以在下方手动补充，或点右上角「重置演示」恢复示例课表。',
      's1.hintOk': '共 {n} 门有效课程，锁定后作为整班冲突判定的基准。',
      's1.hintNeed': '至少需要一门填了星期与完整时间的课程，才能开始筛选。',
      's1.toastNeedDay': '请先选择上课的星期',
      's1.toastBadTime': '结束时间要晚于开始时间',
      's1.toastAdded': '已添加，记得核对时间',
      's1.toastLocked': '课表已锁定，可用「解锁修改」回到第一步',
      's1.toastUnlocked': '已解锁，改完课表要重新生成候选',
      's1.toastNeedOne': '至少需要一门有效课程',

      's2.h': '剩余要求与时间偏好',
      's2.hint': '这里只记录你明确知道的信息。凡是工具无法判断的，一律不会替你填成「符合」。',
      's2.areas': '目标 GE 范畴',
      's2.areasHint': '全部取消勾选＝不限范畴。',
      's2.credits': '学分',
      's2.planned': '本学期拟增加',
      's2.max': '本学期上限',
      's2.creditsHint': '上限按你与学院确认的数额填写，工具不替你判断。',
      's2.taken': '已修课程代码',
      's2.takenHint': '只用于判断互斥与「该类别是否已修过」，工具不读取成绩单。',
      's2.takenPh': '用逗号分隔，例如 GE2100, MA1508',
      's2.unavail': '不可用时段',
      's2.unavailAdd': '+ 添加时段',
      's2.unavailHint': '兼职、通勤、固定活动等。与这些时段冲突的课会直接排除。',
      's2.unavailEmpty': '尚未设置。默认认为整天都可上课。',
      's2.unavailStart': '不可用开始',
      's2.unavailEnd': '不可用结束',
      's2.prefs': '排序与缓冲',
      's2.sortBy': '排序偏好',
      's2.sort.days': '尽量少到校天数',
      's2.sort.gap': '尽量少课间空档',
      's2.sort.area': '优先补未修的 GE 范畴',
      's2.buffer': '课间缓冲（分钟）',
      's2.bufferHint': '两节课间隔低于此值时，标「待核实」而不是直接可行。',
      's2.strict': '只显示已知条件符合的课程（隐藏待核实项）',
      's2.foot': '候选结果分三类：已知条件符合 / 仍有条件待核实 / 明确不符合。没有「保证能选上」。',
      's2.gen': '生成候选课程',
      's2.toastGenerated': '已按你的课表与偏好生成候选',

      's3.h': '候选课程',
      's3.hint': '每一行表示「把这一门单独加进你已锁定的课表」的结果。同时加多门必须重新检查组合。',
      's3.none': '勾选课程加入清单；只有勾选后才会做组合复核。',
      's3.some': '已加入清单 {n} 门。再勾选一门即可看到组合复核。',
      's3.many': '已加入清单 {n} 门。组合复核结果见下方。',
      's3.toStep4': '查看核实清单',
      's3.toastPickFirst': '先勾选至少一门课',

      'col.course': '课程 / 班别',
      'col.time': '上课时间',
      'col.timeFit': '时间匹配',
      'col.req': '需求对应',
      'col.impact': '安排影响',
      'col.status': '资格状态',

      'cand.recommended': '推荐班别 {label}',
      'cand.noBundle': '暂无可行班别',
      'cand.meta': '{credits} 学分 · {area}',
      'cand.areaUnknown': '类别未知',
      'cand.timeFit': '可行 {ok} 个班别组合',
      'cand.timeFitConflict': ' · 冲突 {n}',
      'cand.timeFitUnknown': ' · 待确认 {n}',
      'cand.matchesAreas': '满足你选择的 GE 范畴（{area}）',
      'cand.matchesAny': '满足你选择的 GE 范畴',
      'cand.more': '另有 {n} 项待核实',
      'cand.days': '到校 {n} 天',
      'cand.gap': '课间空档 {n} 分钟',
      'cand.detailSummary': '为什么推荐 · 待确认项 · 数据来源',

      'detail.bundleCheck': '班别组合检查',
      'detail.reasons': '推荐依据',
      'detail.pending': '待核实项（本工具不判断）',
      'detail.source': '资料来源',
      'detail.checkDate': '核对日期 {date}',
      'detail.open': '打开官方课程资料 ↗',
      'bundle.pick': '换一个可行班别：',
      'bundle.status.ok': '可行',
      'bundle.status.adjacent': '缓冲不足',
      'bundle.status.unknown': '待确认',
      'bundle.status.conflict': '冲突',

      'state.met': '已知条件符合',
      'state.unknown': '仍有条件待核实',
      'state.notMet': '明确不符合',
      'state.timeConflict': '时间无法组合',

      'stat.candidates': '门候选',
      'stat.met': '已知条件符合',
      'stat.unknown': '仍有条件待核实',
      'stat.timeConflict': '时间无法组合',
      'stat.reqFail': '修读条件不符',
      'stat.hidden': '因开关被隐藏',
      'stat.missing': '涉及资料缺失',

      'excl.summary': '已排除 {n} 门（点看具体原因）',
      'excl.allConflict': '所有班别组合都撞堂',
      'excl.reqFail': '修读条件不符',

      'empty.title': '没有匹配到课程',
      'empty.hint': '原因分三类，避免把「查不到」误当成「没有课」：',
      'empty.toggle': '展开原因',
      'detail.toggle': '展开',
      'detail.toggleHide': '收起',

      'combo.title': '组合复核（{n} 门同时加入）',
      'combo.okPrefix': '已重新检查两两之间的时间：',
      'combo.okStrong': '没有撞堂',
      'combo.okSuffix': '。组合后到校 {days} 天，课间空档合计 {gap} 分钟。',
      'combo.bad': '检出 {n} 处组合冲突，这几门不能同时加入：',
      'combo.warn': '组合可行 ≠ 都能选上：余位、资格与提交仍要在官方系统完成。',

      's4.h': '去官方系统核实',
      's4.hint': '工具到这里就结束了。余位、资格与最终提交一律在本校官方系统完成。',
      'week.preview': '周课表预览',
      'week.locked': '已锁定',
      'week.pick': '本次勾选',
      'week.timeCol': '时间',
      'final.title': '逐门核实清单',
      'final.seat': '我到官方系统确认过这门的剩余名额',
      'final.qual': '我确认自己满足先修 / 主修 / 年级等修读条件',
      'final.time': '我确认上课时间、地点与考试安排没有冲突',
      'final.checkDate': '资料核对日期 {date}',
      'final.open': '官方课程资料 ↗',
      'final.disclaimTitle': '接下来由你完成，工具不做这些事：',
      'final.disclaimBody': '① 打开官方课程资料确认余位与课室；② 核对先修、主修、年级等资格限制；③ 在官方选课系统里自行提交。本工具不查询余位、不抢课、不代为提交，所有判断以学校官方资料为准。',
      'final.foot': '数据核对日期来自课程资料来源，可能已过期。',
      'final.copy': '复制清单',
      'final.emptyTitle': '还没有勾选课程',
      'final.emptyHint': '回到「候选课程」勾选想进一步核实的课，这里会生成核实清单和周课表。',
      'final.okTitle': '组合时间检查通过',
      'final.okBody': '勾选的 {n} 门之间没有撞堂，合计到校 {days} 天。',
      'final.okWarn': '这只是时间上的可行，不代表都能选上。',
      'final.badTitle': '组合仍有冲突',
      'final.badHint': '请回上一步取消其中一门，或换一个班别组合。',

      'toast.reset': '已重置为示例数据',
      'toast.copied': '清单已复制',
      'toast.copyFail': '复制失败，可手动选择文本',
      'toast.copyUnsupported': '当前浏览器不支持自动复制',

      'copy.title': '选课核实清单（原型生成 · 数据为合成示例）',
      'copy.term': '学期：{term}',
      'copy.line': '{code} {title} | {bundle} | {times} | 资料核对日期 {date}',
      'copy.tail': '需自行核实：剩余名额、修读资格、上课时间与地点、官方系统提交。',

      'area.english': '英语',
      'area.area1': 'Area 1 · 人文艺术',
      'area.area2': 'Area 2 · 社会与商业',
      'area.area3': 'Area 3 · 科学与技术',
      'area.china': '中国文明',

      'day.Mon': '周一',
      'day.Tue': '周二',
      'day.Wed': '周三',
      'day.Thu': '周四',
      'day.Fri': '周五',
      'day.Sat': '周六',
      'channel.Mon': '一',
      'channel.Tue': '二',
      'channel.Wed': '三',
      'channel.Thu': '四',
      'channel.Fri': '五',
      'channel.Sat': '六',

      'date.range': '{from} 至 {to}',

      'req.missingArea': '课程资料缺少 GE 类别，无法判断是否满足你的剩余要求',
      'req.outOfScope': '不在你选择的 GE 范畴内（本课属于 {area}）',
      'req.alreadyTaken': '你已修过 {code}',
      'req.exclusion': '与已修课程 {code} 互斥',
      'req.creditCap': '加上本课共 {total} 学分，超过你设定的上限 {max} 学分',
      'req.prereq': '资料写明需先修 {code}，需你自行确认是否已满足',
      'req.major': '只面向指定主修/年级（{note}），需自行核实',
      'req.majorNoNote': '只面向指定主修/年级，需自行核实',
      'req.covered': '该类别你已修过课程，重复修读通常不计入剩余要求',
      'req.always': '剩余名额与选课优先级：本工具不查询、不判断，需你到官方系统自行核实',

      'bundle.noSections': '班别组合资料缺失',
      'bundle.missingData': '资料不足：{reason}',
      'bundle.sectionNoTime': '{component} {id} 时间未公布',
      'bundle.overlapUncertain': '与「识别待确认」的课表时间重叠，无法确认是否撞堂',
      'bundle.overlapping': '与下一节首尾相接（无缓冲）',
      'bundle.gap': '与相邻课程间隔仅 {gap} 分钟（低于设定的 {buffer} 分钟缓冲），是否来得及需自行确认',
      'conflict.overlap': '{candidate} 与「{blocked}」{blockedTime} 重叠',
      'conflict.internal': '本组合内班别时间重叠：{a} 与 {b} 都占 {day} {time}',
      'conflict.kindLocked': '已锁定课表',
      'conflict.kindUncertain': '待确认课表',
      'conflict.kindUnavailable': '不可用时段',
      'conflict.kindInternal': '组合内部',

      'empty.time.title': '时间冲突（{n} 门）',
      'empty.time.detail': '这些课程的所有班别组合都与你已锁定的课表或不可用时段重叠，不是资料问题。',
      'empty.scope.title': '范围过窄（{n} 门）',
      'empty.scope.detail': '这些课程不在你选择的 GE 范畴或已修范围内，可以回到上一步放宽类别。',
      'empty.hidden.title': '因「只看已知符合」被隐藏（{n} 门）',
      'empty.hidden.detail': '这些课程仍有待核实的条件（先修、主修限制或班别时间未公布），取消该开关就能看到并自行确认。',
      'empty.data.title': '资料不足（{n} 门）',
      'empty.data.detail': '部分课程缺少班别时间或修读类别，工具无法判断可行性，请到官方课程资料核对。',
      'empty.none.title': '没有符合条件的课程',
      'empty.none.detail': '请调整类别或时间偏好后重试。',

      'time.interval': '{day} {start}-{end}'
    },

    en: {
      'app.title': 'Student Course Matching Assistant',
      'app.mark': 'C',
      'app.subtitle': 'GE course selection help for CityUHK undergraduates',
      'app.demoTag': 'demo: synthetic data',
      'app.term': '2026/27 Sem B',
      'app.noCommit': 'we never enrol for you',
      'app.reset': 'Reset demo',
      'app.footer1': 'Prototype v0.1 · sample data only, not real course information · no seat grabbing, no seat lookups, no enrolment on your behalf',
      'app.footer2': 'Students stay in charge: every recommendation opens up to show its reasoning and sources.',
      'app.langSwitch': 'Language',

      'step.1.title': 'Your timetable',
      'step.1.desc': 'import & correct',
      'step.2.title': 'What you need',
      'step.2.desc': 'areas & preferences',
      'step.3.title': 'Candidates',
      'step.3.desc': 'time & requirements',
      'step.4.title': 'Check officially',
      'step.4.desc': 'you decide',
      'step.lockedToast': 'Finish the previous step first',

      's1.h': 'Confirm your timetable',
      's1.hint': 'The tool first reads your enrolled courses, then you correct and lock them. Only after locking is it used for time filtering — it never asks for your student ID or password.',
      's1.notice': 'Imported results may be wrong: check each course code, section and time. A row marked “needs checking” is never treated as confirmed time — candidates that overlap it are only labelled “still to verify”.',
      's1.addTitle': 'Add an enrolled course',
      's1.f.code': 'Course code',
      's1.f.title': 'Course title',
      's1.f.component': 'Component',
      's1.f.start': 'Start',
      's1.f.end': 'End',
      's1.ph.code': 'e.g. GE1401',
      's1.ph.title': 'optional',
      's1.add': 'Add',
      's1.lock': 'Lock timetable and continue',
      's1.locked': 'Timetable locked',
      's1.unlock': 'Unlock to edit',
      's1.uncertain': 'needs checking',
      's1.del': 'Delete',
      's1.empty': 'No enrolled courses yet. Add one below, or click “Reset demo” at the top right to restore the sample timetable.',
      's1.hintOk': '{n} valid course(s). Once locked, this is the baseline for section-level clash checks.',
      's1.hintNeed': 'You need at least one course with weekdays and a full time range before filtering can start.',
      's1.toastNeedDay': 'Pick at least one weekday first',
      's1.toastBadTime': 'End time must be later than start time',
      's1.toastAdded': 'Added — remember to check the time',
      's1.toastLocked': 'Timetable locked. Use “Unlock to edit” to go back.',
      's1.toastUnlocked': 'Unlocked. Regenerate candidates after editing.',
      's1.toastNeedOne': 'You need at least one valid course',

      's2.h': 'Requirements and time preferences',
      's2.hint': 'Only what you actually know. Anything the tool cannot judge is never filled in as “met”.',
      's2.areas': 'Target GE areas',
      's2.areasHint': 'Nothing selected = no area restriction.',
      's2.credits': 'Credits',
      's2.planned': 'Adding this term',
      's2.max': 'Term credit cap',
      's2.creditsHint': 'Enter the cap you confirmed with your school — the tool will not decide it for you.',
      's2.taken': 'Courses already taken',
      's2.takenHint': 'Used only for exclusion checks and spotting areas you already covered. The tool never reads your transcript.',
      's2.takenPh': 'comma separated, e.g. GE2100, MA1508',
      's2.unavail': 'Unavailable hours',
      's2.unavailAdd': '+ Add hours',
      's2.unavailHint': 'Part-time work, commuting, fixed activities. Courses clashing with these are excluded outright.',
      's2.unavailEmpty': 'None set. All hours are treated as available.',
      's2.unavailStart': 'Unavailable from',
      's2.unavailEnd': 'Unavailable until',
      's2.prefs': 'Sorting and buffer',
      's2.sortBy': 'Sort by',
      's2.sort.days': 'Fewest campus days',
      's2.sort.gap': 'Fewest gaps between classes',
      's2.sort.area': 'Prioritise unfilled GE areas',
      's2.buffer': 'Class change buffer (minutes)',
      's2.bufferHint': 'If two classes are closer than this, the row is marked “still to verify” instead of feasible.',
      's2.strict': 'Only show courses whose known conditions are met (hide unverified)',
      's2.foot': 'Results come in three states: known conditions met / still to verify / clearly not eligible. Nothing is ever “guaranteed a seat”.',
      's2.gen': 'Generate candidates',
      's2.toastGenerated': 'Candidates generated from your timetable and preferences',

      's3.h': 'Candidate courses',
      's3.hint': 'Each row is “this course added to your locked timetable on its own”. Adding several at once re-checks the combination.',
      's3.none': 'Tick courses to add them to the shortlist; combination checking only happens after you tick.',
      's3.some': '{n} course(s) shortlisted. Tick one more to see the combination check.',
      's3.many': '{n} course(s) shortlisted. Combined check is below.',
      's3.toStep4': 'See verification checklist',
      's3.toastPickFirst': 'Shortlist at least one course first',

      'col.course': 'Course / section',
      'col.time': 'Class time',
      'col.timeFit': 'Time fit',
      'col.req': 'Requirement fit',
      'col.impact': 'Impact',
      'col.status': 'Status',

      'cand.recommended': 'Section group {label}',
      'cand.noBundle': 'No feasible section group',
      'cand.meta': '{credits} credits · {area}',
      'cand.areaUnknown': 'area unknown',
      'cand.timeFit': '{ok} feasible section group(s)',
      'cand.timeFitConflict': ' · {n} in conflict',
      'cand.timeFitUnknown': ' · {n} unverified',
      'cand.matchesAreas': 'Matches your selected GE area ({area})',
      'cand.matchesAny': 'Matches your selected GE areas',
      'cand.more': '{n} more item(s) to verify',
      'cand.days': '{n} campus days',
      'cand.gap': '{n} min of gaps',

      'detail.bundleCheck': 'Section-group check',
      'detail.reasons': 'Why this is recommended',
      'detail.pending': 'Still to verify (the tool does not decide)',
      'detail.source': 'Source',
      'detail.checkDate': 'checked {date}',
      'detail.open': 'Open official course info ↗',
      'bundle.pick': 'Switch to another feasible group:',
      'bundle.status.ok': 'feasible',
      'bundle.status.adjacent': 'tight buffer',
      'bundle.status.unknown': 'unverified',
      'bundle.status.conflict': 'conflict',

      'state.met': 'conditions met',
      'state.unknown': 'still to verify',
      'state.notMet': 'clearly not eligible',
      'state.timeConflict': 'no clash-free option',

      'stat.candidates': 'candidates',
      'stat.met': 'conditions met',
      'stat.unknown': 'to verify',
      'stat.timeConflict': 'time clash',
      'stat.reqFail': 'requirements not met',
      'stat.hidden': 'hidden by filter',
      'stat.missing': 'with missing data',

      'excl.summary': '{n} excluded (see why)',
      'excl.allConflict': 'every section group clashes',
      'excl.reqFail': 'requirements not met',

      'empty.title': 'No matching courses',
      'empty.hint': 'Three kinds of reasons, so “not found” is never mistaken for “no course”:',
      'empty.toggle': 'why',
      'detail.toggle': 'details',
      'detail.toggleHide': 'hide',

      'combo.title': 'Combined check ({n} courses added together)',
      'combo.okPrefix': 'Every pair re-checked: ',
      'combo.okStrong': 'no clash',
      'combo.okSuffix': '. Combined timetable: {days} campus days, {gap} min of gaps.',
      'combo.bad': '{n} clash(es) found — these cannot be added together:',
      'combo.warn': 'Feasible together is not the same as getting in: seats, eligibility and enrolment happen in the official system.',

      's4.h': 'Verify in the official system',
      's4.hint': 'The tool stops here. Seats, eligibility and final enrolment all happen in the university system.',
      'week.preview': 'Weekly preview',
      'week.locked': 'your timetable',
      'week.pick': 'selected now',
      'week.timeCol': 'Time',
      'final.title': 'Per-course verification checklist',
      'final.seat': 'I checked the remaining seats in the official system',
      'final.qual': 'I confirmed I meet prerequisite / major / year requirements',
      'final.time': 'I confirmed class time, venue and exam arrangements do not clash',
      'final.checkDate': 'info checked {date}',
      'final.open': 'official course info ↗',
      'final.disclaimTitle': 'What you still do — the tool does none of this:',
      'final.disclaimBody': '1) Open the official course information to confirm seats and rooms; 2) check prerequisite, major and year restrictions; 3) submit the enrolment yourself in the official system. This tool does not look up seats, does not grab seats and never enrols for you — the official information always wins.',
      'final.foot': 'The “checked” date comes from the course source and may be out of date.',
      'final.copy': 'Copy checklist',
      'final.emptyTitle': 'Nothing selected yet',
      'final.emptyHint': 'Go back to “Candidate courses”, tick what you want to verify, and the checklist plus weekly view will appear here.',
      'final.okTitle': 'Combined timing check passed',
      'final.okBody': 'The {n} selected courses do not clash; {days} campus days in total.',
      'final.okWarn': 'This is timing only — it does not mean you will get a seat.',
      'final.badTitle': 'There is still a clash',
      'final.badHint': 'Go back and untick one, or switch to another section group.',

      'toast.reset': 'Reset to sample data',
      'toast.copied': 'Checklist copied',
      'toast.copyFail': 'Copy failed — you can select the text manually',
      'toast.copyUnsupported': 'This browser cannot copy automatically',

      'copy.title': 'Course verification checklist (prototype · synthetic sample data)',
      'copy.term': 'Term: {term}',
      'copy.line': '{code} {title} | {bundle} | {times} | info checked {date}',
      'copy.tail': 'To verify yourself: remaining seats, eligibility, class time and venue, enrolment in the official system.',

      'area.english': 'English',
      'area.area1': 'Area 1 · Arts and Humanities',
      'area.area2': 'Area 2 · Societies and Business',
      'area.area3': 'Area 3 · Science and Technology',
      'area.china': 'Chinese Civilisation',

      'day.Mon': 'Mon',
      'day.Tue': 'Tue',
      'day.Wed': 'Wed',
      'day.Thu': 'Thu',
      'day.Fri': 'Fri',
      'day.Sat': 'Sat',
      'channel.Mon': 'Mon',
      'channel.Tue': 'Tue',
      'channel.Wed': 'Wed',
      'channel.Thu': 'Thu',
      'channel.Fri': 'Fri',
      'channel.Sat': 'Sat',

      'date.range': '{from} to {to}',

      'req.missingArea': 'No GE area in the course data, so your remaining requirement cannot be judged',
      'req.outOfScope': 'Outside the GE areas you selected (this course is {area})',
      'req.alreadyTaken': 'You have already taken {code}',
      'req.exclusion': 'Excluded alongside previously taken {code}',
      'req.creditCap': 'With this course you would reach {total} credits, above your cap of {max}',
      'req.prereq': 'The listing requires {code} first — you need to confirm you meet it',
      'req.major': 'Restricted to specified majors/years ({note}) — confirm yourself',
      'req.majorNoNote': 'Restricted to specified majors/years — confirm yourself',
      'req.covered': 'You already covered this area, so repeating it usually will not count towards what remains',
      'req.always': 'Remaining seats and enrolment priority: this tool never looks them up or judges them — verify in the official system',

      'bundle.noSections': 'Section-group data is missing',
      'bundle.missingData': 'Not enough data: {reason}',
      'bundle.sectionNoTime': '{component} {id} time not published',
      'bundle.overlapUncertain': 'Overlaps a timetable row that needs checking, so a clash cannot be ruled out',
      'bundle.overlapping': 'Back to back with the next class (no buffer)',
      'bundle.gap': 'Only {gap} minutes from the neighbouring class (below your {buffer}-minute buffer) — check whether that is enough',
      'conflict.overlap': '{candidate} overlaps {blocked} {blockedTime}',
      'conflict.internal': 'Sections inside this group clash: {a} and {b} both occupy {day} {time}',
      'conflict.kindLocked': 'your locked timetable',
      'conflict.kindUncertain': 'a to-be-checked row',
      'conflict.kindUnavailable': 'your unavailable hours',
      'conflict.kindInternal': 'inside the group',

      'empty.time.title': 'Time clash ({n})',
      'empty.time.detail': 'Every section group of these courses overlaps your locked timetable or unavailable hours — this is about timing, not missing data.',
      'empty.scope.title': 'Scope too narrow ({n})',
      'empty.scope.detail': 'These courses fall outside the GE areas or taken courses you specified. Go back a step and widen the areas.',
      'empty.hidden.title': 'Hidden by “only show met” ({n})',
      'empty.hidden.detail': 'These still have conditions to verify (prerequisite, major restriction, or unpublished section times). Turn the switch off to see them and decide yourself.',
      'empty.data.title': 'Missing data ({n})',
      'empty.data.detail': 'Some courses lack section times or areas, so feasibility cannot be judged. Check the official course information.',
      'empty.none.title': 'No courses match',
      'empty.none.detail': 'Adjust the areas or time preferences and try again.',

      'time.interval': '{day} {start}-{end}'
    }
  };

  var lang = 'zh';

  function setLang(l) {
    lang = (l === 'en' ? 'en' : 'zh');
    return lang;
  }

  function getLang() { return lang; }

  function t(key, params) {
    var d = DICT[lang] || DICT.zh;
    var s = d[key];
    if (s == null) s = DICT.zh[key];
    if (s == null) return key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return params[k] == null ? '' : String(params[k]);
      });
    }
    return s;
  }

  function has(key) {
    return DICT[lang][key] != null;
  }

  // 数据字段可以是字符串，也可以是 { zh, en }
  function pick(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return v[lang] != null ? v[lang] : (v.zh != null ? v.zh : '');
  }

  function dayLabel(day) { return t('day.' + day); }
  function dayChip(day) { return t('channel.' + day); }

  return {
    setLang: setLang,
    getLang: getLang,
    t: t,
    has: has,
    pick: pick,
    dayLabel: dayLabel,
    dayChip: dayChip,
    langs: ['zh', 'en']
  };
});
