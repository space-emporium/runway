// Run: node tests/core.test.js   (no dependencies)
const assert = require('assert');
const C = require('../assets/js/core.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); } }
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const start = new Date(2026, 9, 25); // Oct 25 2026

console.log('computeRunway');
t('$12k savings, $3k expenses, $1k income => 6 months', () => {
  const r = C.computeRunway({ savings: 12000, monthlyExpenses: 3000, monthlyIncome: 1000, startDate: start });
  close(r.months, 6); assert.strictEqual(r.netBurn, 2000); assert.strictEqual(r.schedule.length, 6);
  assert.strictEqual(r.runOutDate.toDateString(), new Date(2027, 3, 25).toDateString());
  assert.strictEqual(r.days, 182);
  assert.strictEqual(r.schedule[5].endBalance, 0); assert.strictEqual(r.schedule[0].startBalance, 12000);
});
t('severance is added to the balance', () => close(C.computeRunway({ savings: 10000, severance: 5000, monthlyExpenses: 3000, startDate: start }).months, 5));
t('string inputs with $ and commas', () => close(C.computeRunway({ savings: '$12,000', monthlyExpenses: '3,000', monthlyIncome: '1000' }).months, 6));
t('"3k" shorthand', () => close(C.computeRunway({ savings: '9k', monthlyExpenses: '3k' }).months, 3));
t('fractional months: $10k / $4k = 2.5 months, date ~mid-month', () => {
  const r = C.computeRunway({ savings: 10000, monthlyExpenses: 4000, startDate: new Date(2026, 0, 1) });
  close(r.months, 2.5); assert.strictEqual(r.schedule.length, 3); assert.strictEqual(r.schedule[2].endBalance, 0);
  assert.strictEqual(r.runOutDate.getMonth(), 2); assert.ok(r.runOutDate.getDate() >= 15 && r.runOutDate.getDate() <= 17);
});
t('income >= expenses => indefinite', () => {
  const r = C.computeRunway({ savings: 5000, monthlyExpenses: 2000, monthlyIncome: 2000 });
  assert.ok(r.indefinite); assert.strictEqual(r.months, Infinity); assert.strictEqual(r.schedule.length, 12);
});
t('zero savings => 0 months', () => { const r = C.computeRunway({ savings: 0, monthlyExpenses: 2000 }); close(r.months, 0); assert.strictEqual(r.schedule.length, 0); });
t('negative inputs are treated as 0', () => close(C.computeRunway({ savings: 6000, monthlyExpenses: 2000, monthlyIncome: -500 }).months, 3));
t('monthly cut: $500 cut on 12k/3k/1k => 8 months', () => close(C.computeRunway({ savings: 12000, monthlyExpenses: 3000, monthlyIncome: 1000, monthlyCut: 500 }).months, 8));
t('cut cannot exceed expenses', () => assert.strictEqual(C.computeRunway({ savings: 1, monthlyExpenses: 100, monthlyCut: 999 }).monthlyCut, 100));
t('monthsGained: $500 cut => +2 months', () => close(C.monthsGained({ savings: 12000, monthlyExpenses: 3000, monthlyIncome: 1000 }, 500), 2));
t('monthsGained: cut to break even => Infinity', () => assert.strictEqual(C.monthsGained({ savings: 12000, monthlyExpenses: 3000, monthlyIncome: 1000 }, 2000), Infinity));
t('end-of-month start date clamps (Jan 31 + 1 month = Feb 28)', () => assert.strictEqual(C.addMonths(new Date(2027, 0, 31), 1).toDateString(), new Date(2027, 1, 28).toDateString()));
t('very long runway (>50 yrs) reported as indefinite', () => assert.ok(C.computeRunway({ savings: 1e9, monthlyExpenses: 100 }).indefinite));

console.log('analyzeBudget');
const items = [
  { name: 'Rent', category: 'Housing', amount: 1500, type: 'essential' },
  { name: 'Food', category: 'Food', amount: 500, type: 'essential' },
  { name: 'Eating out', category: 'Food', amount: 300, type: 'flexible', cut: true },
  { name: 'Streaming', category: 'Subscriptions', amount: 200, type: 'flexible' }
];
t('totals and split', () => { const a = C.analyzeBudget(items, 12000, 500); assert.strictEqual(a.total, 2500); assert.strictEqual(a.essential, 2000); assert.strictEqual(a.flexible, 500); assert.strictEqual(a.selectedCut, 300); });
t('runway today = 12000 / (2500-500) = 6', () => close(C.analyzeBudget(items, 12000, 500).current.months, 6));
t('with ticked cut = 12000 / 1700', () => close(C.analyzeBudget(items, 12000, 500).withSelected.months, 12000 / 1700));
t('bare-bones = 12000 / 1500 = 8', () => close(C.analyzeBudget(items, 12000, 500).barebones.months, 8));
t('per-item gain for Streaming ($200) = 12000/1800 - 6', () => close(C.analyzeBudget(items, 12000, 500).perItem[3].gained, 12000 / 1800 - 6));
t('category totals', () => { const a = C.analyzeBudget(items, 12000, 0); assert.strictEqual(a.byCategory.Food, 800); assert.strictEqual(a.byCategory.Housing, 1500); });
t('empty budget', () => { const a = C.analyzeBudget([], 1000, 0); assert.strictEqual(a.total, 0); assert.ok(a.current.indefinite); });

console.log('CSV');
const cols = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
t('plain', () => assert.strictEqual(C.toCSV([{ a: 'x', b: 'y' }], cols), 'A,B\r\nx,y\r\n'));
t('quotes, commas, newlines escaped', () => assert.strictEqual(C.toCSV([{ a: 'He said "hi"', b: 'a,b\nc' }], cols), 'A,B\r\n"He said ""hi""","a,b\nc"\r\n'));
t('formula injection neutralised', () => assert.strictEqual(C.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'));
t('missing values => empty cells', () => assert.strictEqual(C.toCSV([{ a: 'x' }], cols), 'A,B\r\nx,\r\n'));

console.log('formatting');
t('formatMoney', () => { assert.strictEqual(C.formatMoney(12000), '$12,000'); assert.strictEqual(C.formatMoney(-50.4), '-$50'); });
t('formatMonths', () => { assert.strictEqual(C.formatMonths(6), '6'); assert.strictEqual(C.formatMonths(6.666), '6.7'); assert.strictEqual(C.formatMonths(Infinity), '∞'); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
