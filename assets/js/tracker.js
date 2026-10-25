/* Job Search Tracker UI. Applications are stored only in this browser (localStorage). */
(function () {
  'use strict';
  var C = window.RunwayCore, S = window.RunwayStore;
  var KEY = 'runway.jobs.v1';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('tracker')) return;
  var STATUSES = ['Wishlist', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'];
  var jobs = S.get(KEY, []) || [];
  var editingId = null;
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var form = $('job-form');

  $('j-status').innerHTML = STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
  $('filter').innerHTML = '<option value="">All statuses</option>' + STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('');
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  $('j-date').value = today(); $('j-status').value = 'Applied';

  function save() { S.set(KEY, jobs); }
  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function safeURL(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  function render() {
    var counts = {}; STATUSES.forEach(function (s) { counts[s] = 0; });
    jobs.forEach(function (j) { counts[j.status] = (counts[j.status] || 0) + 1; });
    $('counts').innerHTML = '<span class="pill">Total ' + jobs.length + '</span>' + STATUSES.map(function (s) {
      return counts[s] ? '<span class="pill ' + s.toLowerCase() + '">' + s + ' ' + counts[s] + '</span>' : '';
    }).join('');

    var q = $('search').value.trim().toLowerCase(), fs = $('filter').value;
    var list = jobs.filter(function (j) {
      return (!fs || j.status === fs) && (!q || (j.company + ' ' + j.role + ' ' + j.nextStep + ' ' + j.notes).toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    var body = $('jobs-body');
    if (!jobs.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No applications yet. Add your first one above. Everything stays in this browser.</td></tr>'; return; }
    if (!list.length) { body.innerHTML = '<tr><td colspan="6" class="empty">No applications match your filter.</td></tr>'; return; }
    body.innerHTML = list.map(function (j) {
      var url = safeURL(j.link);
      var company = url ? '<a href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer nofollow">' + escapeHTML(j.company) + '</a>' : escapeHTML(j.company);
      var due = j.nextDate ? '<div class="small muted">by ' + fmtDate(j.nextDate) + (j.nextDate < today() && ['Rejected', 'Offer', 'Ghosted'].indexOf(j.status) === -1 ? ' <strong style="color:#b42318">(overdue)</strong>' : '') + '</div>' : '';
      return '<tr data-id="' + j.id + '"><td><strong>' + company + '</strong>' + (j.notes ? '<div class="small muted">' + escapeHTML(j.notes) + '</div>' : '') + '</td>' +
        '<td>' + escapeHTML(j.role) + '</td><td style="white-space:nowrap">' + fmtDate(j.date) + '</td>' +
        '<td><label class="sr-only" for="st-' + j.id + '">Status for ' + escapeHTML(j.company) + '</label><select class="quick-status" id="st-' + j.id + '">' +
        STATUSES.map(function (s) { return '<option' + (s === j.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
        '<td>' + escapeHTML(j.nextStep) + due + '</td>' +
        '<td style="white-space:nowrap"><button type="button" class="btn ghost small edit">Edit</button> <button type="button" class="btn ghost small del" aria-label="Delete ' + escapeHTML(j.company) + '">✕</button></td></tr>';
    }).join('');
  }

  function readForm() {
    return { company: $('j-company').value.trim(), role: $('j-role').value.trim(), date: $('j-date').value, status: $('j-status').value,
      nextStep: $('j-next').value.trim(), nextDate: $('j-next-date').value, link: $('j-link').value.trim(), notes: $('j-notes').value.trim() };
  }
  function resetForm() {
    form.reset(); editingId = null; $('j-date').value = today(); $('j-status').value = 'Applied';
    $('submit-job').textContent = 'Add application'; $('cancel-edit').hidden = true; $('form-title').textContent = 'Add an application';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = readForm();
    if (!d.company || !d.role) { $('form-error').textContent = 'Company and role are required.'; (d.company ? $('j-role') : $('j-company')).focus(); return; }
    $('form-error').textContent = '';
    if (editingId) { var j = jobs.filter(function (x) { return x.id === editingId; })[0]; if (j) Object.assign(j, d); }
    else { d.id = uid(); d.created = new Date().toISOString(); jobs.push(d); }
    save(); resetForm(); render(); $('status-msg').textContent = 'Saved.';
  });
  $('cancel-edit').addEventListener('click', resetForm);

  $('jobs-body').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    var j = jobs.filter(function (x) { return x.id === tr.dataset.id; })[0]; if (!j) return;
    if (e.target.closest('.del')) {
      if (!confirm('Delete the application for ' + j.role + ' at ' + j.company + '?')) return;
      jobs = jobs.filter(function (x) { return x !== j; }); save(); render(); $('status-msg').textContent = 'Deleted.';
    } else if (e.target.closest('.edit')) {
      editingId = j.id;
      $('j-company').value = j.company; $('j-role').value = j.role; $('j-date').value = j.date; $('j-status').value = j.status;
      $('j-next').value = j.nextStep || ''; $('j-next-date').value = j.nextDate || ''; $('j-link').value = j.link || ''; $('j-notes').value = j.notes || '';
      $('submit-job').textContent = 'Save changes'; $('cancel-edit').hidden = false; $('form-title').textContent = 'Edit application';
      form.scrollIntoView({ behavior: 'smooth' }); $('j-company').focus();
    }
  });
  $('jobs-body').addEventListener('change', function (e) {
    if (!e.target.classList.contains('quick-status')) return;
    var id = e.target.closest('tr').dataset.id;
    jobs.forEach(function (j) { if (j.id === id) j.status = e.target.value; });
    save(); render();
  });
  $('search').addEventListener('input', render);
  $('filter').addEventListener('change', render);

  var COLS = [
    { key: 'company', label: 'Company' }, { key: 'role', label: 'Role' }, { key: 'date', label: 'Date applied' }, { key: 'status', label: 'Status' },
    { key: 'nextStep', label: 'Next step' }, { key: 'nextDate', label: 'Next step date' }, { key: 'link', label: 'Link' }, { key: 'notes', label: 'Notes' }
  ];
  $('export-csv').addEventListener('click', function () {
    if (!jobs.length) { $('status-msg').textContent = 'Nothing to export yet.'; return; }
    var csv = '\ufeff' + C.toCSV(jobs, COLS);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'job-applications-' + today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('status-msg').textContent = 'Exported ' + jobs.length + ' applications.';
  });
  $('clear-jobs').addEventListener('click', function () {
    if (!jobs.length) return;
    if (!confirm('Delete all ' + jobs.length + ' applications from this browser? Export a CSV first if you want a copy.')) return;
    jobs = []; save(); render();
  });

  render();
})();
