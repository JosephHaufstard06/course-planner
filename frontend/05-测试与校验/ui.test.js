/*
 * 交互回归测试（开发用，中英双语各跑一遍）
 * 在真实 Chrome 里用 DOM.click() 走完整个流程，验证状态切换与文案语言。
 * 用法：先启动 chrome --headless --remote-debugging-port=9222，再执行
 *   node 05-测试与校验/ui.test.js
 */
'use strict';

const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGE = pathToFileURL(path.resolve(__dirname, '..', '01-页面与界面', 'index.html')).href;

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9222, path }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

let pass = 0, fail = 0;
let send, evalJs, go;

function check(name, actual, expected) {
  const okv = JSON.stringify(actual) === JSON.stringify(expected);
  if (okv) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual)); }
}

const T = {
  zh: {
    base: PAGE,
    title: '学生选课匹配助手',
    step1: '确认你的课表',
    lock: '锁定课表，进入下一步',
    met: '已知条件符合',
    unknown: '仍有条件待核实',
    thu: '周四',
    conflictRe: '周一 09:00-10:50 与「MA1508',
    emptyTitle: '没有匹配到课程',
    hiddenStat: '因开关被隐藏',
    dropReason: '组合可行 ≠ 都能选上'
  },
  en: {
    base: PAGE,
    title: 'Student Course Matching Assistant',
    step1: 'Confirm your timetable',
    lock: 'Lock timetable and continue',
    met: 'conditions met',
    unknown: 'still to verify',
    thu: 'Thu',
    conflictRe: 'Mon 09:00-10:50 overlaps MA1508',
    emptyTitle: 'No matching courses',
    hiddenStat: 'hidden by filter',
    dropReason: 'Feasible together'
  }
};

async function runLang(lang) {
  const L = T[lang];
  console.log('\n===== [' + lang + '] 主流程 =====');

  await go(L.base + '?stage=1&lang=' + lang);

  check('页面语言标记为 ' + lang, await evalJs(`document.documentElement.lang`), lang);
  check('标题已本地化', await evalJs(`document.title`), L.title);
  check('第一步标题正确', await evalJs(`document.querySelector('[data-i18n="s1.h"]').textContent`), L.step1);
  check('锁定按钮文案正确', await evalJs(`document.getElementById('lockBtn').textContent`), L.lock);
  check('初始只有步骤一面板可见',
    await evalJs(`[].filter.call(document.querySelectorAll('.panel'),p=>!p.hidden).map(p=>p.id)`), ['panel-1']);
  check('课表识别出 4 门已选课程', await evalJs(`document.querySelectorAll('.sch-card').length`), 4);

  const chipBefore = await evalJs(`document.querySelectorAll('.sch-card')[0].querySelectorAll('.chip-on').length`);
  await evalJs(`document.querySelectorAll('.sch-card')[0].querySelectorAll('[data-act="eDay"]')[0].click()`);
  check('点星期芯片能取消选中',
    await evalJs(`document.querySelectorAll('.sch-card')[0].querySelectorAll('.chip-on').length`), chipBefore - 1);
  await evalJs(`document.querySelectorAll('.sch-card')[0].querySelectorAll('[data-act="eDay"]')[0].click()`);

  await evalJs(`document.getElementById('lockBtn').click()`);
  check('锁定后进入第二步',
    await evalJs(`[].filter.call(document.querySelectorAll('.panel'),p=>!p.hidden).map(p=>p.id)`), ['panel-2']);

  await evalJs(`document.getElementById('genBtn').click()`);
  check('生成后进入第三步',
    await evalJs(`[].filter.call(document.querySelectorAll('.panel'),p=>!p.hidden).map(p=>p.id)`), ['panel-3']);
  check('候选课程数 9', await evalJs(`document.querySelectorAll('.cand').length`), 9);
  check('每行主列都是三态标签之一', await evalJs(
    `[].every.call(document.querySelectorAll('.cand-main .badge'),b=>${JSON.stringify([L.met, L.unknown])}.indexOf(b.textContent)>-1)`
  ), true);
  check('排除列表 3 门', await evalJs(`document.querySelectorAll('.ex-item').length`), 3);
  check('排除原因能定位到具体班别与时段',
    await evalJs(`document.getElementById('excludedWrap').textContent.indexOf(${JSON.stringify(L.conflictRe)}) > -1`), true);
  check('资料来源与核对日期可见',
    await evalJs(`/2026-11-10/.test(document.getElementById('candidateWrap').textContent)`), true);
  check('每行都可展开查看依据',
    await evalJs(`document.querySelectorAll('.cand details.cand-detail').length === document.querySelectorAll('.cand').length`), true);

  await evalJs(`document.querySelector('.cand[data-code="GE1401"] details.cand-detail').open = true`);
  check('多可行班别的课程提供切换下拉',
    await evalJs(`document.querySelectorAll('.cand[data-code="GE1401"] select[data-act="pickBundle"] option').length`), 2);
  await evalJs(`(function(){var s=document.querySelector('.cand[data-code="GE1401"] select[data-act="pickBundle"]');s.value='L1+T3';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check('切换班别后推荐班别跟着变',
    await evalJs(`document.querySelector('.cand[data-code="GE1401"] .c-sub').textContent.indexOf('T3') > -1`), true);
  check('切换班别后上课时间跟着变',
    await evalJs(`/${L.thu}\\s*16:00-17:50/.test(document.querySelector('.cand[data-code="GE1401"] .tt-list').textContent)`), true);

  check('未选课时没有组合面板', await evalJs(`document.querySelectorAll('#comboWrap .combo').length`), 0);
  await evalJs(`document.querySelector('.cand[data-code="GE1401"] input[type=checkbox]').click()`);
  await evalJs(`document.querySelector('.cand[data-code="GE2101"] input[type=checkbox]').click()`);
  check('勾选两门后出现组合复核', await evalJs(`document.querySelectorAll('#comboWrap .combo.is-ok').length`), 1);
  check('组合面板提示不保证能选上',
    await evalJs(`document.getElementById('comboWrap').textContent.indexOf(${JSON.stringify(L.dropReason)}) > -1`), true);

  await evalJs(`document.getElementById('toStep4').click()`);
  check('进入核实清单',
    await evalJs(`[].filter.call(document.querySelectorAll('.panel'),p=>!p.hidden).map(p=>p.id)`), ['panel-4']);
  check('周课表画出 11 个时间块', await evalJs(`document.querySelectorAll('.wg-block').length`), 11);
  check('核实清单列出 2 门', await evalJs(`document.querySelectorAll('.final-item').length`), 2);
  check('每门 3 项人工核实勾选框',
    await evalJs(`document.querySelectorAll('.final-item')[0].querySelectorAll('.checklist input').length`), 3);
  await evalJs(`document.querySelectorAll('.final-item')[0].querySelectorAll('.checklist input')[0].click()`);
  check('核实勾选框可交互',
    await evalJs(`document.querySelectorAll('.final-item')[0].querySelectorAll('.checklist input')[0].checked`), true);

  const other = lang === 'zh' ? 'en' : 'zh';
  await evalJs(`document.querySelector('#langSwitch [data-lang="${other}"]').click()`);
  check('切换语言后文档语言变了', await evalJs(`document.documentElement.lang`), other);
  check('切换语言后清单没有丢', await evalJs(`document.querySelectorAll('.final-item').length`), 2);
  await evalJs(`document.querySelector('#langSwitch [data-lang="${lang}"]').click()`);
  check('切回原语言', await evalJs(`document.documentElement.lang`), lang);

  await go(L.base + '?stage=3&lang=' + lang);
  await evalJs(`document.querySelector('.cand[data-code="GE1401"] input[type=checkbox]').click()`);
  await evalJs(`document.querySelector('.cand[data-code="GE2301"] input[type=checkbox]').click()`);
  check('检出组合冲突并标红', await evalJs(`document.querySelectorAll('#comboWrap .combo.is-bad').length`), 1);
  check('冲突说明含具体时段',
    await evalJs(`/16:00-17:50|16:00-16:50|15:00-16:50/.test(document.getElementById('comboWrap').textContent)`), true);

  await go(L.base + '?stage=2&lang=' + lang);
  await evalJs(`(function(){var cs=document.querySelectorAll('#areaChips .chip');for(var i=0;i<4;i++)cs[i].click();})()`);
  check('只留下一个类别', await evalJs(`document.querySelectorAll('#areaChips .chip-on').length`), 1);
  await evalJs(`document.getElementById('strictOnly').click()`);
  await evalJs(`document.getElementById('genBtn').click()`);
  check('出现空结果说明', await evalJs(`document.querySelectorAll('#candidateWrap .empty-state').length`), 1);
  check('空结果标题已本地化',
    await evalJs(`document.querySelector('#candidateWrap .empty-state h3').textContent`), L.emptyTitle);
  check('空结果给出多类原因',
    await evalJs(`document.querySelectorAll('#candidateWrap .empty-item').length >= 2`), true);
  check('汇总条显示被隐藏门数',
    await evalJs(`document.getElementById('resultSummary').textContent.indexOf(${JSON.stringify(L.hiddenStat)}) > -1`), true);

  await go(L.base + '?stage=3&lang=' + lang);
  await evalJs(`document.querySelector('[data-step="1"]').click()`);
  await evalJs(`document.getElementById('unlockBtn').click()`);
  check('解锁后第 3 步重新锁住',
    await evalJs(`document.querySelector('[data-step="3"]').classList.contains('step-locked')`), true);

  if (lang === 'en') {
    await go(L.base + '?stage=4&lang=en');
    check('英文界面正文里没有漏翻的中文', await evalJs(`(function(){
      var sw = document.getElementById('langSwitch');
      var txt = document.body.innerText;
      if (sw) txt = txt.replace(sw.innerText, '');
      return /[\\u4e00-\\u9fff]/.test(txt) ? (txt.match(/[\\u4e00-\\u9fff]{1,12}/g) || []).slice(0, 6).join(' | ') : '';
    })()`), '');
  }
}

async function main() {
  const targets = await getJson('/json/list');
  const page = targets.filter((t) => t.type === 'page')[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  send = function (method, params) {
    return new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    });
  };

  evalJs = async function (expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('页面异常: ' + (d.exception && d.exception.description || d.text));
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  go = async function (url) {
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 900));
  };

  await send('Page.enable');
  await send('Runtime.enable');

  await runLang('zh');
  await runLang('en');

  ws.close();
  console.log('\n------------------------------');
  console.log('交互测试通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('测试脚本出错：' + e.message); process.exit(2); });
