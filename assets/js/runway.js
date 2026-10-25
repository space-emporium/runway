/* Savings Runway Calculator UI. All maths lives in core.js. */
(function () {
  'use strict';
  var C = window.RunwayCore, S = window.RunwayStore;
  var KEY = 'runway.calculator.v1';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('runway-form');
  if (!form) return;

  var f = { savings: $('savings'), severance: $('severance'), income: $('income'), expenses: $('expenses'), start: $('start-date') };
  var itemsBox = $('expense-items'), itemsTotal = $('items-total');
  var cut = $('cut'), cutOut = $('cut-out'), cutResult = $('cut-result');
  var results = $('results');

  function todayISO() {
    var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }

  /* ---------- itemized expenses ---------- */
  function addItemRow(name, amount) {
    var row = document.createElement('div');
    row.className = 'item-row';
    var idx = itemsBox.children.length + 1;
    row.innerHTML =
      '<label class="sr-only" for="item-name-' + idx + '">Expense name</label>' +
      '<input type="text" id="item-name-' + idx + '" class="item-name" placeholder="e.g. Rent" value="' + escapeHTML(name || '') + '">' +
      '<label class="sr-only" for="item-amt-' + idx + '">Monthly amount</label>' +
      '<span class="money"><input type="text" inputmode="decimal" id="item-amt-' + idx + '" class="item-amt" placeholder="0" value="' + escapeHTML(amount || '') + '"></span>' +
      '<button type="button" class="btn ghost small remove-item" aria-label="Remove this expense">✕</button>';
    itemsBox.appendChild(row);
    return row;
  }
  function readItems() {
    return Array.prototype.map.call(itemsBox.querySelectorAll('.item-row'), function (r) {
      return { name: r.querySelector('.item-name').value, amount: r.querySelector('.item-amt').value };
    });
  }
  function syncItemsTotal() {
    var items = readItems();
    var total = items.reduce(function (s, it) { return s + C.toNumber(it.amount); }, 0);
    var any = items.some(function (it) { return C.toNumber(it.amount) > 0; });
    itemsTotal.textContent = C.formatMoney(total);
    if (any) { f.expenses.value = String(Math.round(total * 100) / 100); f.expenses.readOnly = true; f.expenses.setAttribute('aria-describedby', 'expenses-hint items-note'); $('items-note').hidden = false; }
    else { f.expenses.readOnly = false; $('items-note').hidden = true; }
  }
  itemsBox.addEventListener('input', function () { syncItemsTotal(); update(); });
  itemsBox.addEventListener('click', function (e) {
    var b = e.target.closest('.remove-item'); if (!b) return;
    b.closest('.item-row').remove(); syncItemsTotal(); update();
  });
  $('add-item').addEventListener('click', function () { addItemRow().querySelector('input').focus(); });

  /* ---------- chart ---------- */
  function renderChart(base, withCut) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var host = $('chart'); host.innerHTML = '';
    var series = withCut && withCut.monthlyCut > 0 ? withCut.schedule : null;
    var n = Math.min(Math.max(base.schedule.length, series ? series.length : 0), 60);
    if (!n) return;
    var W = 720, H = 300, L = 64, R = 12, T = 14, B = 34;
    var max = 0;
    [base.schedule, series || []].forEach(function (s) { s.slice(0, n).forEach(function (p) { max = Math.max(max, p.startBalance); }); });
    max = max || 1;
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var nice = Math.ceil(max / step) * step; if (nice / step <= 2) step /= 2;
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Bar chart of savings balance at the start of each month for ' + n + ' months.');
    function el(tag, attrs, text) {
      var e = document.createElementNS(svgNS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      svg.appendChild(e); return e;
    }
    var plotH = H - T - B, plotW = W - L - R;
    for (var v = 0; v <= nice + 1e-6; v += step) {
      var y = T + plotH - (v / nice) * plotH;
      el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#e5e7eb' });
      el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#4b5563' }, v >= 1000 ? '$' + (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : '$' + v);
    }
    var slot = plotW / n, bw = Math.max(2, slot * 0.7);
    var labelEvery = Math.ceil(n / 12);
    for (var i = 0; i < n; i++) {
      var x = L + i * slot + (slot - bw) / 2;
      if (series && series[i]) {
        var h2 = (series[i].startBalance / nice) * plotH;
        el('rect', { x: x, y: T + plotH - h2, width: bw, height: h2, fill: '#99d5cc', rx: 2 });
      }
      if (base.schedule[i]) {
        var p = base.schedule[i], h = (p.startBalance / nice) * plotH;
        var r = el('rect', { x: x, y: T + plotH - h, width: bw, height: h, fill: '#0f766e', rx: 2 });
        var t = document.createElementNS(svgNS, 'title');
        t.textContent = p.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + ': ' + C.formatMoney(p.startBalance);
        r.appendChild(t);
      }
      if (i % labelEvery === 0) {
        var d = (base.schedule[i] || series[i]).date;
        el('text', { x: L + i * slot + slot / 2, y: H - 12, 'text-anchor': 'middle', 'font-size': 12, fill: '#4b5563' },
          d.toLocaleDateString('en-US', { month: 'short' }) + (d.getMonth() === 0 || i === 0 ? " '" + String(d.getFullYear()).slice(2) : ''));
      }
    }
    el('line', { x1: L, x2: W - R, y1: T + plotH, y2: T + plotH, stroke: '#9ca3af' });
    host.appendChild(svg);
    $('legend-cut').hidden = !series;
    $('chart-note').textContent = (base.indefinite ? 'Your income covers your expenses, so the balance grows. Showing the next 12 months.' :
      (n === 60 ? 'Showing the first 60 months.' : ''));

    // accessible table
    var rows = base.schedule.slice(0, 60).map(function (p) {
      return '<tr><td>' + p.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + '</td><td class="num">' + C.formatMoney(p.startBalance) + '</td><td class="num">' + C.formatMoney(p.endBalance) + '</td></tr>';
    }).join('');
    $('schedule-body').innerHTML = rows;
  }

  /* ---------- main update ---------- */
  function opts(extraCut) {
    return { savings: f.savings.value, severance: f.severance.value, monthlyIncome: f.income.value,
      monthlyExpenses: f.expenses.value, monthlyCut: extraCut || 0, startDate: parseISO(f.start.value) };
  }

  function update() {
    var o = opts(0);
    var hasInput = C.toNumber(o.monthlyExpenses) > 0 || C.toNumber(o.savings) > 0 || C.toNumber(o.severance) > 0;
    save();
    if (!hasInput) { results.hidden = true; return; }
    results.hidden = false;
    var r = C.computeRunway(o);

    $('out-months').textContent = r.indefinite ? 'No end date' : C.formatMonths(r.months);
    $('out-months-sub').textContent = r.indefinite ? (r.veryLong ? 'more than 50 years' : 'income covers expenses') : (C.formatMonths(r.months) === '1' ? 'month' : 'months');
    $('out-days').textContent = r.indefinite ? '∞' : r.days.toLocaleString('en-US');
    $('out-date').textContent = r.indefinite ? '—' : C.formatDate(r.runOutDate);
    $('out-burn').textContent = r.netBurn > 0 ? C.formatMoney(r.netBurn) + ' per month' : 'none — you are breaking even or better';
    $('out-balance').textContent = C.formatMoney(r.startingBalance);

    var msg = $('out-message');
    if (r.indefinite) { msg.className = 'notice good'; msg.textContent = 'Your monthly income covers your monthly expenses, so your savings are not shrinking. Nice.'; }
    else if (r.months < 3) { msg.className = 'notice'; msg.textContent = 'Under 3 months of runway. Try the "what if I cut" slider below or the Budget Trimmer to see which changes help the most.'; }
    else { msg.className = 'notice good'; msg.textContent = 'At this rate your money lasts about ' + C.formatMonths(r.months) + ' months, until around ' + C.formatDate(r.runOutDate) + '.'; }

    // what-if slider
    var exp = C.toNumber(o.monthlyExpenses);
    cut.max = String(Math.max(0, Math.ceil(exp / 25) * 25));
    if (+cut.value > +cut.max) cut.value = cut.max;
    cut.disabled = exp <= 0;
    var c = +cut.value || 0;
    var r2 = C.computeRunway(opts(c));
    cutOut.textContent = C.formatMoney(c) + '/month';
    cut.setAttribute('aria-valuetext', C.formatMoney(c) + ' per month');
    if (c <= 0) cutResult.textContent = 'Drag the slider to see how a monthly cut changes your runway.';
    else if (r.indefinite) cutResult.textContent = 'You already break even; a cut of ' + C.formatMoney(c) + ' adds ' + C.formatMoney(c) + ' to your savings each month.';
    else if (r2.indefinite) cutResult.textContent = 'Cutting ' + C.formatMoney(c) + ' a month means your income covers your expenses: your savings stop shrinking.';
    else cutResult.textContent = 'Cutting ' + C.formatMoney(c) + ' a month stretches your runway from ' + C.formatMonths(r.months) + ' to ' + C.formatMonths(r2.months) +
      ' months (+' + C.formatMonths(r2.months - r.months) + '), lasting until ' + C.formatDate(r2.runOutDate) + '.';

    renderChart(r, c > 0 ? r2 : null);
  }

  /* ---------- persistence (this device only) ---------- */
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      S.set(KEY, { savings: f.savings.value, severance: f.severance.value, income: f.income.value, expenses: f.expenses.value, items: readItems(), cut: cut.value });
      // share basics with the Budget Trimmer
      var p = S.get('runway.profile', {}) || {};
      p.savings = C.toNumber(f.savings.value) + C.toNumber(f.severance.value); p.income = f.income.value;
      S.set('runway.profile', p);
    }, 200);
  }
  function load() {
    var d = S.get(KEY, null);
    f.start.value = todayISO();
    if (d) {
      f.savings.value = d.savings || ''; f.severance.value = d.severance || ''; f.income.value = d.income || ''; f.expenses.value = d.expenses || '';
      (d.items || []).forEach(function (it) { addItemRow(it.name, it.amount); });
      cut.value = d.cut || 0;
    }
    if (!itemsBox.children.length) { addItemRow('Rent / mortgage', ''); addItemRow('Groceries', ''); addItemRow('Utilities & phone', ''); }
    syncItemsTotal();
  }

  form.addEventListener('input', function (e) { if (!itemsBox.contains(e.target)) update(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); update(); results.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  cut.addEventListener('input', update);
  $('reset').addEventListener('click', function () {
    S.remove(KEY);
    ['savings', 'severance', 'income', 'expenses'].forEach(function (k) { f[k].value = ''; });
    itemsBox.innerHTML = ''; addItemRow('Rent / mortgage', ''); addItemRow('Groceries', ''); addItemRow('Utilities & phone', '');
    cut.value = 0; syncItemsTotal(); update(); f.savings.focus();
  });
  $('example').addEventListener('click', function () {
    f.savings.value = '12000'; f.severance.value = ''; f.income.value = '1000';
    itemsBox.innerHTML = ''; addItemRow('Rent / mortgage', ''); addItemRow('Groceries', ''); addItemRow('Utilities & phone', '');
    syncItemsTotal(); f.expenses.value = '3000'; cut.value = 0; update();
  });

  load(); update();
})();
