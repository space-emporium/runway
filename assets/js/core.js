/*
 * Runway core: pure calculation helpers shared by every tool.
 * No DOM access here, so the same file runs in the browser (window.RunwayCore)
 * and in Node for tests (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RunwayCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_MONTHS = 600; // 50 years: beyond this we just call it "indefinite"

  /** Parse user input like "12,000" or "$3k" into a non-negative number. */
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
    if (v == null) return 0;
    var s = String(v).trim().toLowerCase().replace(/[$,\s]/g, '');
    var mult = 1;
    if (/k$/.test(s)) { mult = 1000; s = s.slice(0, -1); }
    var n = parseFloat(s) * mult;
    return isFinite(n) && n > 0 ? n : 0;
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  /** Add whole months to a date, clamping to the end of shorter months. */
  function addMonths(date, n) {
    var y = date.getFullYear(), m = date.getMonth() + n, d = date.getDate();
    var ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12;
    return new Date(ty, tm, Math.min(d, daysInMonth(ty, tm)));
  }

  function dayDiff(a, b) {
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  /**
   * Core runway maths.
   * balance = savings + severance; burn = expenses - cut - income (per month).
   * months = balance / burn. Returns indefinite:true when income covers costs.
   */
  function computeRunway(opts) {
    opts = opts || {};
    var savings = toNumber(opts.savings);
    var severance = toNumber(opts.severance);
    var expenses = toNumber(opts.monthlyExpenses);
    var income = toNumber(opts.monthlyIncome);
    var cut = Math.min(toNumber(opts.monthlyCut), expenses);
    var start = opts.startDate ? new Date(opts.startDate.getTime()) : new Date();
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    var balance = savings + severance;
    var effectiveExpenses = expenses - cut;
    var burn = effectiveExpenses - income;
    var res = {
      startingBalance: balance, monthlyExpenses: expenses, effectiveExpenses: effectiveExpenses,
      monthlyIncome: income, monthlyCut: cut, netBurn: burn, startDate: start,
      indefinite: false, months: 0, days: 0, runOutDate: start, schedule: []
    };

    if (burn <= 0) {
      res.indefinite = true; res.months = Infinity; res.days = Infinity; res.runOutDate = null;
      for (var i = 0; i < 12; i++) {
        res.schedule.push({ index: i, date: addMonths(start, i), startBalance: balance - burn * i, endBalance: balance - burn * (i + 1) });
      }
      return res;
    }

    var months = balance / burn;
    if (months > MAX_MONTHS) {
      res.indefinite = true; res.months = months; res.days = Infinity; res.runOutDate = null; res.veryLong = true;
    } else {
      res.months = months;
      var whole = Math.floor(months + 1e-9);
      var frac = Math.max(0, months - whole);
      var base = addMonths(start, whole);
      var end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(frac * daysInMonth(base.getFullYear(), base.getMonth())));
      res.runOutDate = end;
      res.days = dayDiff(start, end);
    }

    var count = Math.min(Math.ceil(months - 1e-9), 120);
    var bal = balance;
    for (var j = 0; j < count; j++) {
      var endBal = Math.max(0, bal - burn);
      res.schedule.push({ index: j, date: addMonths(start, j), startBalance: bal, endBalance: endBal });
      bal = endBal;
    }
    res.truncated = Math.ceil(months) > count;
    return res;
  }

  /** Extra months gained by cutting `amount` per month. Infinity if it makes you break even. */
  function monthsGained(opts, amount) {
    var base = computeRunway(opts);
    var o = {}; for (var k in opts) o[k] = opts[k];
    o.monthlyCut = toNumber(opts.monthlyCut) + toNumber(amount);
    var after = computeRunway(o);
    if (base.indefinite) return 0;
    if (after.indefinite) return Infinity;
    return after.months - base.months;
  }

  /**
   * Budget trimmer analysis.
   * items: [{name, category, amount, type:'essential'|'flexible', cut:boolean}]
   */
  function analyzeBudget(items, savings, income, startDate) {
    items = items || [];
    var total = 0, essential = 0, flexible = 0, selectedCut = 0;
    items.forEach(function (it) {
      var a = toNumber(it.amount);
      total += a;
      if (it.type === 'essential') essential += a; else flexible += a;
      if (it.cut) selectedCut += a;
    });
    var base = { savings: savings, monthlyIncome: income, monthlyExpenses: total, startDate: startDate };
    var current = computeRunway(base);
    var withSelected = computeRunway(Object.assign({}, base, { monthlyCut: selectedCut }));
    var barebones = computeRunway(Object.assign({}, base, { monthlyCut: flexible }));
    var perItem = items.map(function (it) {
      return { item: it, amount: toNumber(it.amount), gained: monthsGained(base, it.amount) };
    });
    var byCategory = {};
    items.forEach(function (it) {
      var c = (it.category || 'Other').trim() || 'Other';
      byCategory[c] = (byCategory[c] || 0) + toNumber(it.amount);
    });
    return { total: total, essential: essential, flexible: flexible, selectedCut: selectedCut,
      current: current, withSelected: withSelected, barebones: barebones, perItem: perItem, byCategory: byCategory };
  }

  /** CSV with RFC 4180 quoting, plus a guard against spreadsheet formula injection. */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(rows, columns) {
    var out = [columns.map(function (c) { return csvCell(c.label); }).join(',')];
    rows.forEach(function (r) { out.push(columns.map(function (c) { return csvCell(r[c.key]); }).join(',')); });
    return out.join('\r\n') + '\r\n';
  }

  function formatMoney(n) {
    if (!isFinite(n)) return '—';
    return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  }
  function formatMonths(m) {
    if (m === Infinity) return '∞';
    var r = Math.round(m * 10) / 10;
    return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1));
  }
  function formatDate(d) {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return { toNumber: toNumber, addMonths: addMonths, daysInMonth: daysInMonth, dayDiff: dayDiff,
    computeRunway: computeRunway, monthsGained: monthsGained, analyzeBudget: analyzeBudget,
    csvCell: csvCell, toCSV: toCSV, formatMoney: formatMoney, formatMonths: formatMonths, formatDate: formatDate };
});
