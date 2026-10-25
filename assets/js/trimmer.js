/* Budget Trimmer UI. Data stays in this browser's localStorage. */
(function () {
  'use strict';
  var C = window.RunwayCore, S = window.RunwayStore;
  var KEY = 'runway.trimmer.v1';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('trimmer')) return;

  var CATEGORIES = ['Housing', 'Utilities', 'Food', 'Transport', 'Insurance', 'Health', 'Debt', 'Subscriptions', 'Kids & family', 'Personal', 'Other'];
  var state = S.get(KEY, null);
  if (!state) {
    var p = S.get('runway.profile', {}) || {};
    state = { savings: p.savings ? String(p.savings) : '', income: p.income || '', items: [] };
  }
  var uid = function () { return Math.random().toString(36).slice(2, 10); };
  state.items.forEach(function (it) { if (!it.id) it.id = uid(); });

  var tbody = $('items-body'), savings = $('t-savings'), income = $('t-income');
  savings.value = state.savings || ''; income.value = state.income || '';

  var dl = $('cat-list');
  dl.innerHTML = CATEGORIES.map(function (c) { return '<option value="' + c + '">'; }).join('');

  function save() { S.set(KEY, state); }

  function gainedText(g, current) {
    if (current.indefinite) return '—';
    if (g === Infinity) return 'Break even';
    if (g <= 0) return '+0';
    var days = Math.round(g * 30.44);
    return '+' + C.formatMonths(g) + ' mo' + (g < 1 ? ' (' + days + ' days)' : '');
  }

  function renderRows() {
    if (!state.items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No expenses yet. Add your first one above, or <button type="button" class="btn secondary small" id="load-sample">load an example budget</button></td></tr>';
      $('load-sample').addEventListener('click', loadSample);
      return;
    }
    tbody.innerHTML = state.items.map(function (it, i) {
      var n = i + 1;
      return '<tr data-id="' + it.id + '">' +
        '<td><label class="sr-only" for="n-' + n + '">Expense</label><input type="text" id="n-' + n + '" data-f="name" value="' + escapeHTML(it.name) + '"></td>' +
        '<td><label class="sr-only" for="c-' + n + '">Category</label><input type="text" id="c-' + n + '" data-f="category" list="cat-list" value="' + escapeHTML(it.category) + '"></td>' +
        '<td class="num"><label class="sr-only" for="a-' + n + '">Monthly amount</label><span class="money"><input type="text" inputmode="decimal" id="a-' + n + '" data-f="amount" value="' + escapeHTML(it.amount) + '" style="min-width:90px"></span></td>' +
        '<td><label class="sr-only" for="t-' + n + '">Type</label><select id="t-' + n + '" data-f="type"><option value="essential"' + (it.type === 'essential' ? ' selected' : '') + '>Essential</option><option value="flexible"' + (it.type !== 'essential' ? ' selected' : '') + '>Flexible</option></select></td>' +
        '<td class="num gained"></td>' +
        '<td style="text-align:center"><input type="checkbox" data-f="cut" id="x-' + n + '" aria-label="Simulate cutting ' + escapeHTML(it.name || 'this expense') + '"' + (it.cut ? ' checked' : '') + '></td>' +
        '<td><button type="button" class="btn ghost small del" aria-label="Delete ' + escapeHTML(it.name || 'expense') + '">✕</button></td></tr>';
    }).join('');
  }

  function renderSummary() {
    var a = C.analyzeBudget(state.items, C.toNumber(savings.value), C.toNumber(income.value));
    $('s-total').textContent = C.formatMoney(a.total);
    $('s-split').textContent = C.formatMoney(a.essential) + ' essential · ' + C.formatMoney(a.flexible) + ' flexible';
    var none = !a.total;
    var rw = function (r) { return none ? '—' : r.indefinite ? 'No end date' : C.formatMonths(r.months) + ' months'; };
    var rs = function (r) { return none ? 'add expenses below' : r.indefinite ? 'income covers expenses' : 'until ' + C.formatDate(r.runOutDate); };
    $('s-current').textContent = rw(a.current); $('s-current-sub').textContent = rs(a.current);
    $('s-selected').textContent = rw(a.withSelected);
    $('s-selected-sub').textContent = a.selectedCut > 0 ? 'cutting ' + C.formatMoney(a.selectedCut) + '/mo · ' + rs(a.withSelected) : 'tick “Cut?” on any row';
    $('s-bare').textContent = rw(a.barebones); $('s-bare-sub').textContent = 'essentials only · ' + rs(a.barebones);

    // per-row gain
    Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-id]'), function (tr, i) {
      var cell = tr.querySelector('.gained'); if (cell && a.perItem[i]) cell.textContent = gainedText(a.perItem[i].gained, a.current);
    });

    // top cuts
    var top = a.perItem.filter(function (p) { return p.item.type !== 'essential' && p.amount > 0; })
      .sort(function (x, y) { return y.amount - x.amount; }).slice(0, 5);
    var noFin = !C.toNumber(savings.value);
    $('top-cuts').innerHTML = noFin ? '<li class="muted">Enter your savings above to see how much time each cut buys.</li>' :
      top.length ? top.map(function (p) {
        return '<li><strong>' + escapeHTML(p.item.name || 'Unnamed') + '</strong> (' + C.formatMoney(p.amount) + '/mo): ' + gainedText(p.gained, a.current).replace('mo', 'months') + '</li>';
      }).join('') : '<li class="muted">Mark some expenses as “Flexible” to see which cuts buy the most time.</li>';

    // categories
    var cats = Object.keys(a.byCategory).sort(function (x, y) { return a.byCategory[y] - a.byCategory[x]; });
    $('cat-breakdown').innerHTML = cats.map(function (c) {
      var pct = a.total ? Math.round(a.byCategory[c] / a.total * 100) : 0;
      return '<li><span style="display:flex;justify-content:space-between;gap:1rem"><span>' + escapeHTML(c) + '</span><span>' + C.formatMoney(a.byCategory[c]) + ' · ' + pct + '%</span></span>' +
        '<span aria-hidden="true" style="display:block;height:6px;background:#e5e7eb;border-radius:4px;margin:.2rem 0 .6rem"><span style="display:block;height:6px;width:' + pct + '%;background:#0f766e;border-radius:4px"></span></span></li>';
    }).join('') || '<li class="muted">No expenses yet.</li>';
  }

  function find(id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; }

  tbody.addEventListener('input', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    var it = find(tr.dataset.id), k = e.target.dataset.f; if (!it || !k) return;
    it[k] = k === 'cut' ? e.target.checked : e.target.value;
    save(); renderSummary();
  });
  tbody.addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    var it = find(tr.dataset.id), k = e.target.dataset.f; if (!it || !k) return;
    it[k] = k === 'cut' ? e.target.checked : e.target.value; save(); renderSummary();
  });
  tbody.addEventListener('click', function (e) {
    var b = e.target.closest('.del'); if (!b) return;
    var id = b.closest('tr').dataset.id;
    state.items = state.items.filter(function (x) { return x.id !== id; });
    save(); renderRows(); renderSummary();
  });
  [savings, income].forEach(function (el) {
    el.addEventListener('input', function () { state.savings = savings.value; state.income = income.value; save(); renderSummary(); });
  });

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('new-name').value.trim(), amt = $('new-amount').value.trim();
    if (!name) { $('new-name').focus(); $('add-error').textContent = 'Please name the expense.'; return; }
    if (!(C.toNumber(amt) > 0)) { $('new-amount').focus(); $('add-error').textContent = 'Please enter a monthly amount above $0.'; return; }
    $('add-error').textContent = '';
    state.items.push({ id: uid(), name: name, category: $('new-cat').value.trim() || 'Other', amount: amt, type: $('new-type').value, cut: false });
    save(); renderRows(); renderSummary();
    e.target.reset(); $('new-name').focus();
  });

  function loadSample() {
    state.items = [
      ['Rent', 'Housing', 1600, 'essential'], ['Groceries', 'Food', 450, 'essential'], ['Electric & gas', 'Utilities', 120, 'essential'],
      ['Phone', 'Utilities', 70, 'essential'], ['Car insurance', 'Insurance', 110, 'essential'], ['Eating out', 'Food', 280, 'flexible'],
      ['Streaming services', 'Subscriptions', 45, 'flexible'], ['Gym membership', 'Health', 60, 'flexible'], ['Rideshare & taxis', 'Transport', 90, 'flexible'],
      ['Shopping', 'Personal', 150, 'flexible']
    ].map(function (r) { return { id: uid(), name: r[0], category: r[1], amount: String(r[2]), type: r[3], cut: false }; });
    if (!savings.value) { savings.value = '12000'; state.savings = '12000'; }
    save(); renderRows(); renderSummary();
  }
  $('clear-all').addEventListener('click', function () {
    if (!confirm('Delete all expenses from this browser? This cannot be undone.')) return;
    state.items = []; save(); renderRows(); renderSummary();
  });

  renderRows(); renderSummary();
})();
