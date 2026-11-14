/*
 * 布局体检脚本（开发用，不属于交付页面）
 * 通过 Chrome DevTools Protocol 在真实浏览器里测量：
 *   - 是否有元素溢出视口（right > innerWidth）
 *   - 是否有容器内容被裁切（scrollWidth > clientWidth 且不可滚动）
 *   - 各步骤的候选行数、可见面板
 * 用法：先启动 chrome --headless --remote-debugging-port=9222，再执行
 *   node 05-测试与校验/diag.js zh 1 2 3 4
 *   node 05-测试与校验/diag.js en 1 2 3 4
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

const MEASURE = `(function () {
  var vw = window.innerWidth;
  var sw = document.documentElement.scrollWidth;
  var over = [], cut = [];
  function inScrollable(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && p.scrollWidth > p.clientWidth + 2) return true;
      p = p.parentElement;
    }
    return false;
  }
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var r = el.getBoundingClientRect();
    var tag = el.tagName + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
    if (r.width > 0 && (r.right > vw + 2 || r.left < -2) && !inScrollable(el)) {
      over.push(tag + '@' + Math.round(r.left) + '..' + Math.round(r.right));
    }
    var cs2 = getComputedStyle(el);
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && cs2.overflowX === 'visible' && !inScrollable(el)) {
      cut.push(tag + ' ' + el.scrollWidth + '>' + el.clientWidth);
    }
  }
  var panels = [];
  var ps = document.querySelectorAll('.panel');
  for (var j = 0; j < ps.length; j++) if (!ps[j].hidden) panels.push(ps[j].id);
  return JSON.stringify({
    vw: vw, docScrollWidth: sw,
    overflowCount: over.length, overflow: over.slice(0, 6),
    clippedCount: cut.length, clipped: cut.slice(0, 6),
    candidates: document.querySelectorAll('.cand').length,
    excludedItems: document.querySelectorAll('.ex-item').length,
    weekBlocks: document.querySelectorAll('.wg-block').length,
    visiblePanels: panels
  });
})()`;

async function main() {
  const args = process.argv.slice(2);
  const langArg = (args[0] === 'zh' || args[0] === 'en') ? args.shift() : null;
  const stages = args.length ? args : ['1', '2', '3', '4'];
  const targets = await getJson('/json/list');
  const page = targets.filter((t) => t.type === 'page')[0];
  if (!page) throw new Error('没有找到可用的页面目标');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  function send(method, params) {
    return new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  const sizes = [
    { name: 'desktop-1360', width: 1360, height: 1000, mobile: false },
    { name: 'tablet-820', width: 820, height: 1000, mobile: false },
    { name: 'phone-390', width: 390, height: 844, mobile: true }
  ];

  let bad = 0;
  for (const st of stages) {
    const url = PAGE + '?stage=' + st + (langArg ? '&lang=' + langArg : '');
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 900));
    for (const sz of sizes) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: sz.width, height: sz.height, deviceScaleFactor: 1, mobile: sz.mobile
      });
      await new Promise((r) => setTimeout(r, 350));
      const res = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
      const out = res.result && res.result.result && res.result.result.value;
      const data = out ? JSON.parse(out) : { error: 'no value' };
      const isBad = data.overflowCount > 0 || data.clippedCount > 0 || (data.docScrollWidth - data.vw > 2);
      if (isBad) bad++;
      console.log(
        'stage ' + st + ' @ ' + sz.name + ' (' + sz.width + 'px)  ' + (isBad ? '⚠' : '✓') +
        '  溢出=' + data.overflowCount + ' 裁切=' + data.clippedCount +
        ' 文档宽=' + data.docScrollWidth + ' 候选=' + data.candidates +
        ' 排除=' + data.excludedItems + ' 周课表格=' + data.weekBlocks +
        ' 可见面板=' + JSON.stringify(data.visiblePanels)
      );
      if (isBad) {
        console.log('    溢出元素: ' + JSON.stringify(data.overflow));
        console.log('    被裁切元素: ' + JSON.stringify(data.clipped));
      }
    }
    await send('Emulation.clearDeviceMetricsOverride', {});
  }
  ws.close();
  console.log(bad === 0 ? '\n布局体检通过：没有横向溢出或内容裁切。' : '\n发现 ' + bad + ' 处需要修的布局问题。');
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => { console.error('诊断失败：' + e.message); process.exit(2); });
