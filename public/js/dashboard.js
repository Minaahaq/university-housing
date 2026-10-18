/* global Chart, firebase, fbClient, api, __core */
'use strict';

/* ==========================================
   State
   ========================================== */
const dashState = {
  students: [],
  payments: [],
  rooms: [],
  permits: [],
  workers: [],
  stats: null,
  period: 'month',
  charts: {},
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell, apiGet } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    loader.progress(15, 'جارٍ التحقق من الجلسة...');
    const session = await requireSession();
    if (!session) return;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    // Welcome subtitle
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
    const subtitle = document.getElementById('welcomeSubtitle');
    if (subtitle) {
      subtitle.textContent = `${greeting}، ${session.profile.fullName || 'أهلاً بك'}`;
    }

    loader.progress(40, 'جارٍ تحميل البيانات...');
    await loadData();

    loader.progress(85, 'جارٍ تجهيز الرسوم...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

async function loadData() {
  const { apiGet } = window.__core;

  const [studentsRes, paymentsRes, roomsRes, permitsRes, workersRes, statsRes] = await Promise.all([
    apiGet('/api/students?limit=2000').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=2000').catch(() => ({ data: [] })),
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=500').catch(() => ({ data: [] })),
    apiGet('/api/workers?limit=500').catch(() => ({ data: [] })),
    apiGet('/api/rooms/stats').catch(() => ({ data: null })),
  ]);

  dashState.students = studentsRes.data || [];
  dashState.payments = paymentsRes.data || [];
  dashState.rooms = roomsRes.data || [];
  dashState.permits = permitsRes.data || [];
  dashState.workers = workersRes.data || [];
  dashState.stats = statsRes.data;
}

/* ==========================================
   Helpers
   ========================================== */
function getPeriodPayments() {
  const { period } = dashState;
  const now = new Date();
  let fromDate = null;

  if (period === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === '3months') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (period === 'year') {
    fromDate = new Date(now.getFullYear(), 0, 1);
  }

  if (!fromDate) return dashState.payments;
  return dashState.payments.filter(p => {
    const d = new Date(p.date || p.createdAt || 0);
    return d >= fromDate;
  });
}

function destroyChart(key) {
  if (dashState.charts[key]) {
    dashState.charts[key].destroy();
    delete dashState.charts[key];
  }
}

function chartColors() {
  return {
    purple: '#635bff',
    purpleSoft: 'rgba(99,91,255,.15)',
    green: '#4ade80',
    greenSoft: 'rgba(74,222,128,.15)',
    amber: '#fbbf24',
    blue: '#60a5fa',
    red: '#f87171',
    grid: 'rgba(255,255,255,.06)',
    text: '#a1a1aa',
  };
}

function chartOptions() {
  const c = chartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#a1a1aa',
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Cairo, Inter, sans-serif', size: 12 },
        bodyFont: { family: 'Cairo, Inter, sans-serif', size: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: c.text, font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        ticks: { color: c.text, font: { size: 11 } },
        grid: { color: c.grid },
        beginAtZero: true,
      },
    },
  };
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderKpis();
  renderRevenueChart();
  renderStudentsChart();
  renderRecentPayments();
  renderOverdueStudents();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const map = {
    navStudentsBadge: dashState.students.length,
    navRoomsBadge: dashState.rooms.length,
    navWorkersBadge: dashState.workers.length,
    navPermitsBadge: dashState.permits.length,
    navPaymentsBadge: dashState.payments.length,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = $(id);
    if (el) el.textContent = val;
  });
}

function renderKpis() {
  const { $, money } = window.__core;

  const students = dashState.students;
  const residents = students.filter(s => s.status === 'مقيم').length;

  const payments = getPeriodPayments();
  const totalDue = payments.reduce((a, p) => a + Number(p.due || 0), 0);
  const totalPaid = payments.reduce((a, p) => a + Number(p.paid || 0), 0);
  const overdue = totalDue - totalPaid;

  const stats = dashState.stats || {};
  const occupancy = stats.occupancyRate || 0;
  const available = stats.availableBeds || 0;

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  set('kpiStudents', students.length);
  set('kpiResidents', residents);
  set('kpiOccupancy', occupancy + '%');
  set('kpiAvailable', available);
  set('kpiOverdue', money(overdue));
  set('kpiPaid', money(totalPaid));
}

function renderRevenueChart() {
  const { $ } = window.__core;
  const canvas = $('chartRevenue');
  if (!canvas) return;

  const payments = dashState.payments;
  const monthsData = {};

  payments.forEach(p => {
    const d = new Date(p.date || p.createdAt || 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthsData[key]) monthsData[key] = { due: 0, paid: 0 };
    monthsData[key].due += Number(p.due || 0);
    monthsData[key].paid += Number(p.paid || 0);
  });

  const sortedMonths = Object.keys(monthsData).sort().slice(-6);
  const labels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleDateString('ar-EG', { month: 'short' });
  });
  const dues = sortedMonths.map(m => monthsData[m].due);
  const paids = sortedMonths.map(m => monthsData[m].paid);

  const c = chartColors();
  destroyChart('revenue');
  dashState.charts.revenue = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'المطلوب',
          data: dues,
          borderColor: c.purple,
          backgroundColor: c.purpleSoft,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: c.purple,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        },
        {
          label: 'المدفوع',
          data: paids,
          borderColor: c.green,
          backgroundColor: c.greenSoft,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: c.green,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
        },
      ],
    },
    options: chartOptions(),
  });
}

function renderStudentsChart() {
  const { $ } = window.__core;
  const canvas = $('chartStudents');
  if (!canvas) return;

  const statuses = ['مقيم', 'مسافر', 'إجازة', 'منسحب'];
  const counts = statuses.map(st => dashState.students.filter(s => s.status === st).length);

  const c = chartColors();
  destroyChart('students');
  dashState.charts.students = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: statuses,
      datasets: [{
        data: counts,
        backgroundColor: [c.green, c.amber, c.blue, c.red],
        borderColor: '#0a0a0a',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: c.text,
            font: { family: 'Cairo, Inter, sans-serif', size: 12 },
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a1a1aa',
          padding: 10,
          cornerRadius: 8,
        },
      },
    },
  });
}

function renderRecentPayments() {
  const { $, esc, money } = window.__core;
  const el = $('recentPayments');
  if (!el) return;

  const studentName = (id) => dashState.students.find(s => s.id === id)?.name || 'طالب محذوف';

  const recent = [...dashState.payments]
    .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
    .slice(0, 5);

  if (!recent.length) {
    el.innerHTML = `<div class="list-empty"><div class="ico">💳</div><p>لا توجد مدفوعات بعد</p></div>`;
    return;
  }

  el.innerHTML = recent.map(p => {
    const name = studentName(p.studentId);
    const initial = (name || '؟').trim().charAt(0);
    const date = p.date ? new Date(p.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '-';
    return `
      <div class="list-item">
        <div class="avatar">${esc(initial)}</div>
        <div class="info">
          <div class="name">${esc(name)}</div>
          <div class="meta">${esc(p.month || '-')} · ${esc(date)}</div>
        </div>
        <div class="amount green">${money(p.paid)} ج</div>
      </div>`;
  }).join('');
}

function renderOverdueStudents() {
  const { $, esc, money } = window.__core;
  const el = $('overdueStudents');
  if (!el) return;

  const studentName = (id) => dashState.students.find(s => s.id === id)?.name || 'طالب محذوف';

  const overdue = dashState.payments
    .filter(p => Number(p.due || 0) - Number(p.paid || 0) > 0)
    .sort((a, b) => (Number(b.due || 0) - Number(b.paid || 0)) - (Number(a.due || 0) - Number(a.paid || 0)))
    .slice(0, 5);

  if (!overdue.length) {
    el.innerHTML = `<div class="list-empty"><div class="ico">✅</div><p>لا توجد متأخرات — ممتاز!</p></div>`;
    return;
  }

  el.innerHTML = overdue.map(p => {
    const name = studentName(p.studentId);
    const initial = (name || '؟').trim().charAt(0);
    const rem = Number(p.due || 0) - Number(p.paid || 0);
    return `
      <div class="list-item">
        <div class="avatar red">${esc(initial)}</div>
        <div class="info">
          <div class="name">${esc(name)}</div>
          <div class="meta">${esc(p.month || '-')}</div>
        </div>
        <div class="amount red">${money(rem)} ج</div>
      </div>`;
  }).join('');
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  // Period filter
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dashState.period = btn.dataset.period;
      renderKpis();
    });
  });

  // Refresh
  $('refreshBtn')?.addEventListener('click', async () => {
    const { loader, toast } = window.__core;
    const btn = $('refreshBtn');
    if (btn) btn.disabled = true;
    try {
      await loadData();
      renderAll();
      toast('تم تحديث البيانات', 'success');
    } catch (err) {
      toast(err.message || 'فشل التحديث', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
