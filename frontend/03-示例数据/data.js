/*
 * 合成示例数据（不是真实 CityUHK 课程资料）
 * Synthetic sample data — not real course information.
 * ------------------------------------------------------------
 * 用途：在没有真实课程池之前，让界面能完整跑通流程与反例演示。
 * 接真实数据时：保持字段结构不变，替换 courses / importedSchedule 即可。
 *
 * 语言相关字段用 { zh, en } 两套文字；area 用与语言无关的键
 * （english / area1 / area2 / area3 / china），显示名由 i18n.js 提供，
 * 这样切换语言不会影响判定逻辑。
 */
(function (root, factory) {
  'use strict';
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.CM_DATA = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FULL = ['2027-01-11', '2027-04-24']; // full term
  var H1 = ['2027-01-11', '2027-02-20'];   // first half
  var H2 = ['2027-02-22', '2027-04-24'];   // second half

  function S(id, component, days, start, end, range) {
    return { id: id, component: component, days: days, start: start, end: end, dateRange: range || FULL };
  }

  var SOURCE = {
    name: { zh: '示例课程资料（合成）', en: 'Sample course data (synthetic)' },
    url: 'https://www.cityu.edu.hk/',
    retrievedAt: '2026-11-10'
  };

  var courses = [
    {
      code: 'GE1401',
      title: { zh: '学术英语写作（示例）', en: 'Academic English Writing (sample)' },
      area: 'english',
      credits: 3,
      desc: {
        zh: '整班匹配演示：Lecture 时间可行，但 Tutorial 有两个班别，其中一个与你的 CS2334 撞堂。',
        en: 'Section-group demo: the lecture fits, but one of two tutorials clashes with your CS2334.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon'], '16:00', '17:50'),
        S('T1', 'Tutorial', ['Tue'], '16:00', '17:50'),
        S('T2', 'Tutorial', ['Tue'], '11:00', '12:50'),
        S('T3', 'Tutorial', ['Thu'], '16:00', '17:50')
      ],
      bundles: [
        { id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] },
        { id: 'L1+T2', label: 'L1 (Lecture) + T2 (Tutorial)', sections: ['L1', 'T2'] },
        { id: 'L1+T3', label: 'L1 (Lecture) + T3 (Tutorial)', sections: ['L1', 'T3'] }
      ]
    },
    {
      code: 'GE2101',
      title: { zh: '全球商业环境（示例）', en: 'Global Business Environment (sample)' },
      area: 'area2',
      credits: 3,
      desc: {
        zh: '常规可行候选，用于观察「安排影响」（是否新增到校日、课间空档）。',
        en: 'A plain feasible candidate, useful for watching schedule impact (extra campus days, gaps).'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: ['GE2100'], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon', 'Wed'], '11:00', '12:50'),
        S('T1', 'Tutorial', ['Thu'], '14:00', '14:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2201',
      title: { zh: '创业与创新（示例）', en: 'Entrepreneurship and Innovation (sample)' },
      area: 'area2',
      credits: 3,
      desc: {
        zh: '资格待确认反例：只面向指定主修/年级，需你自行核实。',
        en: 'Unverified-eligibility example: restricted to certain majors/years, you must confirm.'
      },
      source: SOURCE,
      conditions: {
        prereq: null, exclusions: [], majorRestricted: true,
        note: { zh: '限商学院主修', en: 'business majors only' }
      },
      sections: [
        S('L1', 'Lecture', ['Fri'], '10:00', '12:50'),
        S('T1', 'Tutorial', ['Fri'], '15:00', '15:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2301',
      title: { zh: '天文与宇宙（示例）', en: 'Astronomy and the Universe (sample)' },
      area: 'area3',
      credits: 3,
      desc: {
        zh: '先修条件待确认反例：资料写明需先修课程，但无法自动判断你是否已满足。',
        en: 'Unverified-prerequisite example: a prerequisite is listed but cannot be checked automatically.'
      },
      source: SOURCE,
      conditions: { prereq: 'PHY1001', exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Tue', 'Thu'], '15:00', '16:50'),
        S('T1', 'Tutorial', ['Mon'], '16:00', '16:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2318',
      title: { zh: '科学与技术社会（示例）', en: 'Science, Technology and Society (sample)' },
      area: 'area3',
      credits: 3,
      desc: {
        zh: '时间冲突反例：整班时间都与已锁定课表重叠，应进入「排除列表」并写明撞哪一节。',
        en: 'Time-clash example: every section overlaps the locked timetable, so it belongs in the excluded list with the exact overlap shown.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon'], '09:00', '10:50'),
        S('T1', 'Tutorial', ['Mon'], '11:00', '11:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2410',
      title: { zh: '伦理与社会（示例）', en: 'Ethics and Society (sample)' },
      area: 'area1',
      credits: 3,
      desc: {
        zh: '相邻无缓冲演示：Lecture 16:50 结束，Tutorial 17:00 开始，间隔 10 分钟。',
        en: 'Tight-buffer demo: the lecture ends 16:50 and the tutorial starts 17:00 — a 10-minute gap.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Fri'], '14:00', '16:50'),
        S('T1', 'Tutorial', ['Fri'], '17:00', '17:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2504',
      title: { zh: '音乐与身心健康（示例）', en: 'Music and Wellbeing (sample)' },
      area: 'area1',
      credits: 3,
      desc: {
        zh: '整班失败反例：Lecture 可行，但唯一 Tutorial 与 CS2334 撞堂，整班不能用。',
        en: 'Whole-group failure example: the lecture fits, but the only tutorial clashes with CS2334, so the group is unusable.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Tue'], '09:00', '10:50'),
        S('T1', 'Tutorial', ['Tue'], '11:00', '11:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2601',
      title: { zh: '城市与可持续发展（示例）', en: 'Cities and Sustainability (sample)' },
      area: 'area3',
      credits: 3,
      desc: {
        zh: '资料不足反例：Tutorial 时间尚未公布，只能标「待确认」，不能当作可行。',
        en: 'Missing-data example: the tutorial time is not published, so it can only be “unverified”, never feasible.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon'], '13:00', '14:50'),
        S('T1', 'Tutorial', [], '', '')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2701',
      title: { zh: '数字人文（示例）', en: 'Digital Humanities (sample)' },
      area: 'area1',
      credits: 3,
      desc: {
        zh: '后半学期课程：与后半学期的 CB2601 同一时段，因此冲突。',
        en: 'Second-half course: same slot as your second-half CB2601, so it clashes.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon'], '14:00', '15:50', H2),
        S('T1', 'Tutorial', ['Thu'], '10:00', '10:50', H2)
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2750',
      title: { zh: '艺术与科技（示例）', en: 'Art and Technology (sample)' },
      area: 'area1',
      credits: 3,
      desc: {
        zh: '前半学期课程：与后半学期的 CB2601 同一时段，但上课日期不重叠，所以不冲突。',
        en: 'First-half course: same slot as your second-half CB2601, but the teaching dates do not overlap, so no clash.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Mon'], '14:00', '15:50', H1),
        S('T1', 'Tutorial', ['Thu'], '10:00', '10:50', H1)
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2801',
      title: { zh: '心理学导论（示例）', en: 'Introduction to Psychology (sample)' },
      area: 'area2',
      credits: 3,
      desc: {
        zh: '晚间课：用于观察排序偏好（尽量少到校天数 / 减少课间空档）。',
        en: 'Evening course: useful for watching the sorting preferences.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Wed'], '18:00', '20:50'),
        S('T1', 'Tutorial', ['Mon'], '18:00', '18:50')
      ],
      bundles: [{ id: 'L1+T1', label: 'L1 (Lecture) + T1 (Tutorial)', sections: ['L1', 'T1'] }]
    },
    {
      code: 'GE2901',
      title: { zh: '数据与决策（示例）', en: 'Data and Decisions (sample)' },
      area: null,
      credits: 3,
      desc: {
        zh: '类别资料缺失反例：课程资料中没有 GE 类别，必须标「待确认」，不能默认符合。',
        en: 'Missing-area example: the listing has no GE area, so it must stay “unverified” instead of defaulting to met.'
      },
      source: SOURCE,
      conditions: { prereq: null, exclusions: [], majorRestricted: false, note: null },
      sections: [
        S('L1', 'Lecture', ['Thu'], '09:00', '10:50')
      ],
      bundles: [{ id: 'L1', label: 'L1 (Lecture)', sections: ['L1'] }]
    }
  ];

  var importedSchedule = [
    {
      id: 'e1', code: 'MA1508',
      title: { zh: '线性代数（示例）', en: 'Linear Algebra (sample)' },
      component: 'Lecture', days: ['Mon', 'Wed'], start: '09:00', end: '10:50',
      dateRange: FULL, confidence: 'confirmed'
    },
    {
      id: 'e2', code: 'CS2334',
      title: { zh: '数据结构（示例）', en: 'Data Structures (sample)' },
      component: 'Lecture', days: ['Tue', 'Thu'], start: '11:00', end: '12:50',
      dateRange: FULL, confidence: 'confirmed'
    },
    {
      id: 'e3', code: 'PED1305',
      title: { zh: '体育：羽毛球（示例）', en: 'Physical Education: Badminton (sample)' },
      component: 'Activity', days: ['Wed'], start: '16:00', end: '17:50',
      dateRange: FULL, confidence: 'confirmed'
    },
    {
      id: 'e4', code: 'CB2601',
      title: { zh: '商业沟通（示例）', en: 'Business Communication (sample)' },
      component: 'Lecture', days: ['Mon'], start: '14:00', end: '15:50',
      dateRange: H2, confidence: 'confirmed'
    }
  ];

  return {
    meta: {
      school: { zh: 'CityUHK（示例）', en: 'CityUHK (sample)' },
      term: '2026/27 Semester B',
      termDates: FULL,
      version: 'v0.1'
    },
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    terms: { FULL: FULL, H1: H1, H2: H2 },
    areas: ['english', 'area1', 'area2', 'area3', 'china'],
    defaults: {
      plannedCredits: 9,
      maxCredits: 15,
      bufferMin: 10,
      takenCodes: [],
      sortBy: 'days'
    },
    courses: courses,
    importedSchedule: importedSchedule
  };
});
