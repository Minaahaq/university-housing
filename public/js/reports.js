/* global Chart, fbClient, api, __core */
'use strict';

const reportsState = {
  students: [],
  payments: [],
  rooms: [],
  buildings: [],
  stats: null,
  charts: {},
  currentTab: 'financial',
  period: 'all',
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    const session = await requireSession();
    if (!session) return;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(40, 'جارٍ تحميل البيانات...');
    await loadData();

    loader.progress(80, 'جارٍ تجهيز الرسوم...');
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
  const [studentsRes, paymentsRes, roomsRes, buildingsRes, workersRes, permitsRes] = await Promise.all([
    apiGet('/api/students?limit=2000').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=2000').catch(() => ({ data: [] })),
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
    apiGet('/api/rooms/buildings').catch(() => ({ data: [] })),
    apiGet('/api/workers?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
  ]);
  reportsState.students = studentsRes.data || [];
  reportsState.payments = paymentsRes.data || [];
  reportsState.rooms = roomsRes.data || [];
  reportsState.buildings = buildingsRes.data || [];

  // Nav badges
  const { $ } = window.__core;
  $('navStudentsBadge').textContent = reportsState.students.length;
  $('navRoomsBadge').textContent = reportsState.rooms.length;
  $('navWorkersBadge').textContent = (workersRes.data || []).length;
  $('navPermitsBadge').textContent = (permitsRes.data || []).length;
  $('navPaymentsBadge').textContent = reportsState.payments.length;
}

/* ==========================================
   Period filter
   ========================================== */
function getFilteredPayments() {
  const { period } = reportsState;
  const now = new Date();
  let fromDate = null;

  if (period === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === '3months') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (period === 'year') {
    fromDate = new Date(now.getFullYear(), 0, 1);
  }

  if (!fromDate) return reportsState.payments;
  return reportsState.payments.filter(p => {
    const d = new Date(p.date || p.createdAt || 0);
    return d >= fromDate;
  });
}

/* ==========================================
   Charts — helpers
   ========================================== */
function destroyChart(key) {
  if (reportsState.charts[key]) {
    reportsState.charts[key].destroy();
    delete reportsState.charts[key];
  }
}

function chartColors() {
  return {
    purple: '#635bff',
    purpleSoft: 'rgba(99,91,255,.2)',
    green: '#4ade80',
    greenSoft: 'rgba(74,222,128,.2)',
    amber: '#fbbf24',
    amberSoft: 'rgba(251,191,36,.2)',
    red: '#f87171',
    redSoft: 'rgba(248,113,113,.2)',
    blue: '#60a5fa',
    blueSoft: 'rgba(96,165,250,.2)',
    grid: 'rgba(255,255,255,.06)',
    text: '#a1a1aa',
  };
}

function defaultChartOptions() {
  const c = chartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: c.text,
          font: { family: 'Inter, Cairo, sans-serif', size: 12 },
          padding: 12,
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
    scales: {
      x: {
        ticks: { color: c.text, font: { size: 11 } },
        grid: { color: c.grid },
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
   Financial Report
   ========================================== */
function renderFinancial() {
  const { $, money } = window.__core;
  const payments = getFilteredPayments();

  const totalDue = payments.reduce((a, p) => a + Number(p.due || 0), 0);
  const totalPaid = payments.reduce((a, p) => a + Number(p.paid || 0), 0);
  const overdue = totalDue - totalPaid;
  const rate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  $('kpiPaid').innerHTML = `${money(totalPaid)} <small>ج</small>`;
  $('kpiDue').innerHTML = `${money(totalDue)} <small>ج</small>`;
  $('kpiOverdue').innerHTML = `${money(overdue)} <small>ج</small>`;
  $('kpiRate').textContent = `${rate}%`;

  // Revenue by month
  const monthsData = {};
  payments.forEach(p => {
    const d = new Date(p.date || p.createdAt || 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthsData[key]) monthsData[key] = { due: 0, paid: 0 };
    monthsData[key].due += Number(p.due || 0);
    monthsData[key].paid += Number(p.paid || 0);
  });

  const sortedMonths = Object.keys(monthsData).sort().slice(-12);
  const labels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
  });
  const dues = sortedMonths.map(m => monthsData[m].due);
  const paids = sortedMonths.map(m => monthsData[m].paid);

  const c = chartColors();
  destroyChart('revenue');
  reportsState.charts.revenue = new Chart($('chartRevenue'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'المطلوب', data: dues, borderColor: c.purple,
          backgroundColor: c.purpleSoft, fill: true, tension: .35, borderWidth: 2, pointRadius: 0 },
        { label: 'المحصّل', data: paids, borderColor: c.green,
          backgroundColor: c.greenSoft, fill: true, tension: .35, borderWidth: 2, pointRadius: 0 },
      ],
    },
    options: defaultChartOptions(),
  });

  // Payment status pie
  const paidCount = payments.filter(p => Number(p.paid) >= Number(p.due)).length;
  const partialCount = payments.filter(p => Number(p.paid) > 0 && Number(p.paid) < Number(p.due)).length;
  const unpaidCount = payments.filter(p => !Number(p.paid)).length;

  destroyChart('status');
  reportsState.charts.status = new Chart($('chartPaymentStatus'), {
    type: 'doughnut',
    data: {
      labels: ['مدفوع', 'جزئي', 'غير مدفوع'],
      datasets: [{
        data: [paidCount, partialCount, unpaidCount],
        backgroundColor: [c.green, c.amber, c.red],
        borderColor: '#0a0a0a',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom',
          labels: { color: c.text, font: { size: 12 }, padding: 12 } },
      },
    },
  });

  // Monthly table
  const rows = sortedMonths.slice(-12).reverse().map(m => {
    const d = monthsData[m];
    const [y, mo] = m.split('-');
    const monthName = new Date(y, mo - 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const rem = d.due - d.paid;
    const rateM = d.due > 0 ? Math.round((d.paid / d.due) * 100) : 0;
    return `<tr>
      <td>${monthName}</td>
      <td>${money(d.due)} ج</td>
      <td>${money(d.paid)} ج</td>
      <td><span class="chip ${rem > 0 ? 'red' : 'green'}">${money(rem)} ج</span></td>
      <td>${rateM}%</td>
    </tr>`;
  }).join('');

  $('financialRows').innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">لا توجد بيانات</td></tr>';
}

/* ==========================================
   Occupancy Report
   ========================================== */
function renderOccupancy() {
  const { $ } = window.__core;
  const rooms = reportsState.rooms;
  const buildings = reportsState.buildings;

  const totalCap = rooms.reduce((a, r) => a + Number(r.capacity || 0), 0);
  const totalOcc = rooms.reduce((a, r) => a + Number(r.occupantCount || 0), 0);
  const available = totalCap - totalOcc;
  const rate = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0;

  $('kpiBuildings').textContent = buildings.length;
  $('kpiAvailable').textContent = available;
  $('kpiOccupied').textContent = totalOcc;
  $('kpiOccupancy').textContent = `${rate}%`;

  const c = chartColors();

  // Occupancy by building
  const buildingMap = {};
  rooms.forEach(r => {
    const key = r.buildingName || 'غير محدد';
    if (!buildingMap[key]) buildingMap[key] = { cap: 0, occ: 0 };
    buildingMap[key].cap += Number(r.capacity || 0);
    buildingMap[key].occ += Number(r.occupantCount || 0);
  });

  const bLabels = Object.keys(buildingMap);
  const bAvail = bLabels.map(k => buildingMap[k].cap - buildingMap[k].occ);
  const bOcc = bLabels.map(k => buildingMap[k].occ);

  destroyChart('buildingOcc');
  reportsState.charts.buildingOcc = new Chart($('chartBuildingOccupancy'), {
    type: 'bar',
    data: {
      labels: bLabels,
      datasets: [
        { label: 'مشغول', data: bOcc, backgroundColor: c.purple, borderRadius: 6 },
        { label: 'متاح', data: bAvail, backgroundColor: c.green, borderRadius: 6 },
      ],
    },
    options: {
      ...defaultChartOptions(),
      scales: {
        x: { stacked: true, ticks: { color: c.text }, grid: { display: false } },
        y: { stacked: true, ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true },
      },
    },
  });

  // Room status pie
  const availableCount = rooms.filter(r => r.status === 'متاحة' || (r.occupantCount < r.capacity && r.status !== 'صيانة')).length;
  const fullCount = rooms.filter(r => r.occupantCount >= r.capacity && r.status !== 'صيانة').length;
  const maintCount = rooms.filter(r => r.status === 'صيانة').length;

  destroyChart('roomStatus');
  reportsState.charts.roomStatus = new Chart($('chartRoomStatus'), {
    type: 'doughnut',
    data: {
      labels: ['متاحة', 'مشغولة', 'صيانة'],
      datasets: [{
        data: [availableCount, fullCount, maintCount],
        backgroundColor: [c.green, c.red, c.amber],
        borderColor: '#0a0a0a',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 12 }, padding: 12 } } },
    },
  });
}

/* ==========================================
   Students Report
   ========================================== */
function renderStudents() {
  const { $ } = window.__core;
  const students = reportsState.students;

  const residents = students.filter(s => s.status === 'مقيم').length;
  const travelers = students.filter(s => s.status === 'مسافر' || s.status === 'إجازة').length;
  const withdrawn = students.filter(s => s.status === 'منسحب').length;

  $('kpiTotalStudents').textContent = students.length;
  $('kpiResidents').textContent = residents;
  $('kpiTravelers').textContent = travelers;
  $('kpiWithdrawn').textContent = withdrawn;

  const c = chartColors();

  // By status
  destroyChart('studentStatus');
  reportsState.charts.studentStatus = new Chart($('chartStudentStatus'), {
    type: 'doughnut',
    data: {
      labels: ['مقيم', 'مسافر', 'إجازة', 'منسحب'],
      datasets: [{
        data: [
          residents,
          students.filter(s => s.status === 'مسافر').length,
          students.filter(s => s.status === 'إجازة').length,
          withdrawn,
        ],
        backgroundColor: [c.green, c.amber, c.blue, c.red],
        borderColor: '#0a0a0a',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 12 }, padding: 12 } } },
    },
  });

  // By college
  const collegeMap = {};
  students.forEach(s => {
    const k = s.college || 'غير محدد';
    collegeMap[k] = (collegeMap[k] || 0) + 1;
  });
  const sorted = Object.entries(collegeMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  destroyChart('studentCollege');
  reportsState.charts.studentCollege = new Chart($('chartStudentCollege'), {
    type: 'bar',
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{
        label: 'عدد الطلاب',
        data: sorted.map(x => x[1]),
        backgroundColor: c.purple,
        borderRadius: 6,
      }],
    },
    options: {
      ...defaultChartOptions(),
      indexAxis: 'y',
    },
  });
}

/* ==========================================
   Render All
   ========================================== */
function renderAll() {
  renderFinancial();
  renderOccupancy();
  renderStudents();
}

/* ==========================================
   CSV Export
   ========================================== */
function exportCSV() {
  const { toast } = window.__core;
  let csv = '';
  let filename = '';

  if (reportsState.currentTab === 'financial') {
    const payments = getFilteredPayments();
    const rows = [['الطالب', 'الشهر', 'المطلوب', 'المدفوع', 'المتبقي', 'التاريخ']];
    payments.forEach(p => {
      rows.push([p.studentId, p.month, p.due, p.paid,
        (p.due - p.paid), p.date || '']);
    });
    csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    filename = 'تقرير-مالي.csv';
  } else if (reportsState.currentTab === 'occupancy') {
    const rows = [['المبنى', 'الجناح', 'الدور', 'الغرفة', 'السعة', 'المقيمون', 'الحالة']];
    reportsState.rooms.forEach(r => {
      rows.push([r.buildingName, r.wing, r.floor, r.roomNumber,
        r.capacity, r.occupantCount, r.status]);
    });
    csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    filename = 'تقرير-إشغال.csv';
  } else {
    const rows = [['الاسم', 'الكلية', 'الفرقة', 'الحالة', 'الغرفة']];
    reportsState.students.forEach(s => {
      rows.push([s.name, s.college, s.year, s.status, s.room || '']);
    });
    csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    filename = 'تقرير-طلاب.csv';
  }

  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تصدير CSV', 'success');
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  // Tabs
  document.querySelectorAll('.reports-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      reportsState.currentTab = tab;
      document.querySelectorAll('.reports-tabs button').forEach(b =>
        b.classList.toggle('active', b === btn));
      document.querySelectorAll('.report-panel').forEach(p =>
        p.classList.toggle('active', p.id === tab));
    });
  });

  // Period
  $('filterPeriod')?.addEventListener('change', (e) => {
    reportsState.period = e.target.value;
    renderAll();
  });

  // Refresh
  $('refreshBtn')?.addEventListener('click', async () => {
    const { loader } = window.__core;
    loader.show('جارٍ التحديث...', 30);
    await loadData();
    loader.progress(80, 'جارٍ التحديث...');
    renderAll();
    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  });

  // Export
  $('exportBtn')?.addEventListener('click', exportCSV);

  // Print
  $('printBtn')?.addEventListener('click', () => window.print());
});
