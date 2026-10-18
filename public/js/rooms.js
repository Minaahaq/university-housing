/* global firebase, fbClient, api, __core */
'use strict';

/* ==========================================
   State
   ========================================== */
const roomsState = {
  rooms: [],
  buildings: [],
  students: [],
  stats: null,
  counts: { students: 0, workers: 0, permits: 0, payments: 0 },
  ui: {
    search: '',
    building: '',
    status: '',
  },
  currentRoom: null,
};

/* ==========================================
   Boot
   ========================================== */
(async function boot() {
  const { loader, requireSession, hydrateUser, initShell } = window.__core;

  loader.show('جارٍ الاتصال...', 5);

  try {
    loader.progress(15, 'جارٍ التحقق من الجلسة...');
    const session = await requireSession();
    if (!session) return;

    hydrateUser(session.profile);
    initShell();
    document.getElementById('app').hidden = false;

    loader.progress(40, 'جارٍ تحميل البيانات...');
    await loadAll();

    loader.progress(85, 'جارٍ التجهيز...');
    renderAll();

    loader.progress(100, 'اكتمل ✓');
    setTimeout(() => loader.hide(), 300);
  } catch (err) {
    console.error(err);
    loader.error(err.message || 'حدث خطأ');
  }
})();

async function loadAll() {
  const { apiGet } = window.__core;
  const [roomsRes, buildingsRes, studentsRes, statsRes, workersRes, permitsRes, paymentsRes] = await Promise.all([
    apiGet('/api/rooms/rooms').catch(() => ({ data: [] })),
    apiGet('/api/rooms/buildings').catch(() => ({ data: [] })),
    apiGet('/api/students?limit=1000').catch(() => ({ data: [] })),
    apiGet('/api/rooms/stats').catch(() => ({ data: null })),
    apiGet('/api/workers?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/permits?limit=1').catch(() => ({ data: [] })),
    apiGet('/api/payments?limit=1').catch(() => ({ data: [] })),
  ]);

  roomsState.rooms = roomsRes.data || [];
  roomsState.buildings = buildingsRes.data || [];
  roomsState.students = studentsRes.data || [];
  roomsState.stats = statsRes.data;
  roomsState.counts = {
    students: roomsState.students.length,
    workers: (workersRes.data || []).length,
    permits: (permitsRes.data || []).length,
    payments: (paymentsRes.data || []).length,
  };
}

/* ==========================================
   Render
   ========================================== */
function renderAll() {
  renderNavBadges();
  renderKpis();
  renderBuildingChips();
  renderFloorPlan();
}

function renderNavBadges() {
  const { $ } = window.__core;
  const map = {
    navStudentsBadge: roomsState.counts.students,
    navRoomsBadge: roomsState.rooms.length,
    navWorkersBadge: roomsState.counts.workers,
    navPermitsBadge: roomsState.counts.permits,
    navPaymentsBadge: roomsState.counts.payments,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = $(id);
    if (el) el.textContent = val;
  });
}

function renderKpis() {
  const { $ } = window.__core;
  const s = roomsState.stats || {};
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  set('kpiBuildings', s.buildings || 0);
  set('kpiRooms', s.rooms || 0);
  set('kpiAvailable', s.availableBeds || 0);
  set('kpiOccupancy', (s.occupancyRate || 0) + '%');

  const fill = $('occupancyFill');
  if (fill) fill.style.width = (s.occupancyRate || 0) + '%';
}

function renderBuildingChips() {
  const { $, esc } = window.__core;
  const container = $('buildingChips');
  if (!container) return;

  const buildings = roomsState.buildings;

  container.innerHTML = `
    <button class="chip ${!roomsState.ui.building ? 'active' : ''}" data-building="">كل المباني</button>
    ${buildings.map(b => `
      <button class="chip ${roomsState.ui.building === b.id ? 'active' : ''}" data-building="${esc(b.id)}">
        ${esc(b.name)}
      </button>
    `).join('')}
  `;

  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      roomsState.ui.building = chip.dataset.building;
      renderBuildingChips();
      renderFloorPlan();
    });
  });
}

function getFilteredRooms() {
  const { search, building, status } = roomsState.ui;
  const q = search.toLowerCase();

  return roomsState.rooms.filter(r => {
    if (building && r.buildingId !== building) return false;
    if (status && r.status !== status) return false;
    if (q) {
      const hay = [r.roomNumber, r.buildingName, r.wing, r.floor].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderFloorPlan() {
  const { $, esc } = window.__core;
  const container = $('floorPlan');
  if (!container) return;

  const filtered = getFilteredRooms();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="floor-plan-empty">
        <div class="empty-icon">🏠</div>
        <h3>${roomsState.rooms.length === 0 ? 'لا توجد غرف بعد' : 'لا توجد نتائج'}</h3>
        <p>${roomsState.rooms.length === 0 ? 'ابدأ بإضافة مبنى ثم غرفة' : 'جرّب تعديل البحث أو الفلاتر'}</p>
        ${roomsState.rooms.length === 0 ? '<button class="btn primary" data-action="add-room">➕ إضافة غرفة</button>' : ''}
      </div>`;
    return;
  }

  // Group by building, then by floor
  const byBuilding = {};
  filtered.forEach(r => {
    const bId = r.buildingId || 'unknown';
    if (!byBuilding[bId]) {
      byBuilding[bId] = {
        building: roomsState.buildings.find(b => b.id === bId) || { name: r.buildingName || 'غير محدد' },
        floors: {},
      };
    }
    const floorKey = r.floor || 'غير محدد';
    if (!byBuilding[bId].floors[floorKey]) {
      byBuilding[bId].floors[floorKey] = [];
    }
    byBuilding[bId].floors[floorKey].push(r);
  });

  const floorOrder = { 'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4 };

  container.innerHTML = Object.values(byBuilding).map(b => {
    const buildingName = b.building.name || 'غير محدد';
    const totalRooms = Object.values(b.floors).reduce((s, f) => s + f.length, 0);

    const floorsHtml = Object.entries(b.floors)
      .sort(([a], [b]) => (floorOrder[a] || 99) - (floorOrder[b] || 99))
      .map(([floorName, rooms]) => `
        <div class="floor-row">
          <div class="floor-label">${esc(floorName)}</div>
          <div class="rooms-wrap">
            ${rooms.map(r => {
              const cls = r.status === 'صيانة' ? 'maintenance' :
                (r.occupantCount >= r.capacity ? 'full' : 'available');
              return `
                <button class="room-tile ${cls}" data-room-id="${esc(r.id)}" title="غرفة ${esc(r.roomNumber)}">
                  <div class="room-num">${esc(r.roomNumber)}</div>
                  <div class="room-occupancy">${r.occupantCount}/${r.capacity}</div>
                  <div class="room-status-dot"></div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `).join('');

    return `
      <div class="building-block">
        <div class="building-header">
          <h3>${esc(buildingName)}</h3>
          <span class="building-count">${totalRooms} غرفة</span>
        </div>
        ${floorsHtml}
      </div>
    `;
  }).join('');

  // Bind room tile clicks
  container.querySelectorAll('.room-tile').forEach(tile => {
    tile.addEventListener('click', () => openRoomSheet(tile.dataset.roomId));
  });

  container.querySelectorAll('[data-action="add-room"]').forEach(btn => {
    btn.addEventListener('click', () => openRoomModal('add'));
  });
}

/* ==========================================
   Bottom Sheet — Room Details
   ========================================== */
async function openRoomSheet(roomId) {
  const { $, apiGet, esc } = window.__core;

  const sheet = $('roomSheet');
  const backdrop = $('sheetBackdrop');
  const body = $('sheetBody');
  const actions = $('sheetActions');

  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">جارٍ التحميل...</div>';
  actions.innerHTML = '';
  sheet.classList.add('open');
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res = await apiGet(`/api/rooms/rooms/${roomId}`);
    const room = res.data;
    roomsState.currentRoom = room;

    $('sheetTitle').textContent = `غرفة ${room.roomNumber}`;
    $('sheetSubtitle').textContent = `${room.buildingName || '—'} · جناح ${room.wing} · الدور ${room.floor}`;

    const occupants = room.occupantsData || [];
    const canAssign = room.occupantCount < room.capacity && room.status !== 'صيانة';
    const availableStudents = roomsState.students.filter(s => s.roomId !== room.id);

    body.innerHTML = `
      <div class="sheet-section">
        <h4>معلومات الغرفة</h4>
        <div class="sheet-info-grid">
          <div class="sheet-info-item">
            <div class="lbl">النوع</div>
            <div class="val">${esc(room.roomType || '—')}</div>
          </div>
          <div class="sheet-info-item">
            <div class="lbl">السعة</div>
            <div class="val">${room.capacity}</div>
          </div>
          <div class="sheet-info-item">
            <div class="lbl">المقيمون</div>
            <div class="val">${room.occupantCount}</div>
          </div>
          <div class="sheet-info-item">
            <div class="lbl">الحالة</div>
            <div class="val">${esc(room.status)}</div>
          </div>
        </div>
      </div>

      <div class="sheet-section">
        <h4>الطلاب المقيمون (${occupants.length})</h4>
        ${occupants.length
          ? occupants.map(s => `
              <div class="student-row">
                <div class="initial">${esc((s.name || '؟').charAt(0))}</div>
                <div class="name">${esc(s.name)}</div>
                <button class="btn sm danger" data-unassign="${esc(s.id)}">إخلاء</button>
              </div>
            `).join('')
          : '<p style="margin:0;color:var(--muted);font-size:13px;text-align:center;padding:12px">لا يوجد طلاب</p>'}
      </div>

      ${canAssign ? `
        <div class="sheet-section">
          <h4>تسكين طالب</h4>
          <div class="assign-form">
            <select id="assignStudentSelect">
              <option value="">اختر طالبًا...</option>
              ${availableStudents.map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.roomId ? ' (مسكن)' : ''}</option>`).join('')}
            </select>
            <button class="btn primary" id="assignBtn">تسكين</button>
          </div>
        </div>
      ` : ''}
    `;

    actions.innerHTML = `
      <button class="btn" data-action="edit">✏️ تعديل</button>
      <button class="btn danger" data-action="delete">🗑️ حذف</button>
    `;

    // Bind
    body.querySelectorAll('[data-unassign]').forEach(btn => {
      btn.addEventListener('click', () => unassignStudent(btn.dataset.unassign));
    });
    $('assignBtn')?.addEventListener('click', () => {
      const sid = $('assignStudentSelect').value;
      if (sid) assignStudent(sid);
    });
    actions.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      closeSheet();
      openRoomModal('edit', room);
    });
    actions.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteRoom(room));

  } catch (err) {
    body.innerHTML = `<div style="color:#f87171;padding:16px">${err.message}</div>`;
  }
}

function closeSheet() {
  const { $ } = window.__core;
  $('roomSheet')?.classList.remove('open');
  $('sheetBackdrop')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ==========================================
   Assign / Unassign
   ========================================== */
async function assignStudent(studentId) {
  const { apiPost, toast, actionOverlay } = window.__core;
  const room = roomsState.currentRoom;
  if (!room) return;

  actionOverlay.show('جارٍ التسكين...');
  try {
    await apiPost(`/api/rooms/rooms/${room.id}/assign`, { studentId });
    await loadAll();
    renderAll();
    closeSheet();
    toast('تم تسكين الطالب', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

async function unassignStudent(studentId) {
  const { apiPost, toast, actionOverlay, confirmModal } = window.__core;
  const room = roomsState.currentRoom;
  if (!room) return;

  const ok = await confirmModal('تأكيد الإخلاء', 'هل تريد إخلاء هذا الطالب؟');
  if (!ok) return;

  actionOverlay.show('جارٍ الإخلاء...');
  try {
    await apiPost(`/api/rooms/rooms/${room.id}/unassign`, { studentId });
    await loadAll();
    renderAll();
    closeSheet();
    toast('تم إخلاء الطالب', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Room Modal
   ========================================== */
function populateBuildingSelect() {
  const { $, esc } = window.__core;
  const sel = $('rfBuilding');
  if (!sel) return;
  sel.innerHTML = roomsState.buildings.length
    ? roomsState.buildings.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')
    : '<option value="">— لا يوجد مبانٍ —</option>';
}

function openRoomModal(mode = 'add', room = null) {
  const { $ } = window.__core;
  populateBuildingSelect();
  $('roomForm').reset();
  $('rfId').value = '';

  if (mode === 'edit' && room) {
    $('roomModalTitle').textContent = 'تعديل غرفة';
    $('rfId').value = room.id;
    $('rfBuilding').value = room.buildingId || '';
    $('rfWing').value = room.wing || 'أ';
    $('rfFloor').value = room.floor || 'الأول';
    $('rfNumber').value = room.roomNumber || '';
    $('rfCapacity').value = room.capacity || 2;
    $('rfStatus').value = room.status || 'متاحة';
  } else {
    $('roomModalTitle').textContent = 'إضافة غرفة';
  }

  $('roomModal').classList.add('open');
  $('roomModalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRoomModal() {
  const { $ } = window.__core;
  $('roomModal')?.classList.remove('open');
  $('roomModalBackdrop')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function saveRoom() {
  const { $, val, apiPost, apiPut, toast, actionOverlay } = window.__core;
  const id = val('rfId');
  const payload = {
    buildingId: val('rfBuilding'),
    wing: val('rfWing'),
    floor: val('rfFloor'),
    roomNumber: val('rfNumber'),
    capacity: Number(val('rfCapacity')),
    roomType: val('rfCapacity') === '1' ? 'فردية' :
             val('rfCapacity') === '2' ? 'ثنائية' :
             val('rfCapacity') === '3' ? 'ثلاثية' : 'رباعية',
    status: val('rfStatus'),
  };

  if (!payload.buildingId) { toast('اختر مبنى', 'error'); return; }
  if (!payload.roomNumber) { toast('أدخل رقم الغرفة', 'error'); return; }

  actionOverlay.show(id ? 'جارٍ التحديث...' : 'جارٍ الإضافة...');
  try {
    if (id) await apiPut(`/api/rooms/rooms/${id}`, payload);
    else await apiPost('/api/rooms/rooms', payload);
    await loadAll();
    renderAll();
    closeRoomModal();
    toast(id ? 'تم التحديث' : 'تم إضافة الغرفة', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

async function deleteRoom(room) {
  const { apiDel, toast, actionOverlay, confirmModal } = window.__core;
  const ok = await confirmModal('تأكيد الحذف', `حذف الغرفة ${room.roomNumber}؟ لا يمكن التراجع.`);
  if (!ok) return;

  actionOverlay.show('جارٍ الحذف...');
  try {
    await apiDel(`/api/rooms/rooms/${room.id}`);
    await loadAll();
    renderAll();
    closeSheet();
    toast('تم حذف الغرفة', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Building Modal
   ========================================== */
function openBuildingModal() {
  const { $ } = window.__core;
  $('buildingForm').reset();
  $('bfFloors').value = 4;
  $('buildingModal').classList.add('open');
  $('buildingModalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('bfName')?.focus(), 200);
}

function closeBuildingModal() {
  const { $ } = window.__core;
  $('buildingModal')?.classList.remove('open');
  $('buildingModalBackdrop')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function saveBuilding() {
  const { $, val, apiPost, toast, actionOverlay } = window.__core;
  const name = val('bfName');
  const floors = Number(val('bfFloors')) || 1;

  if (!name || name.length < 2) {
    toast('اسم المبنى مطلوب', 'error');
    $('bfName')?.focus();
    return;
  }

  actionOverlay.show('جارٍ الإضافة...');
  try {
    await apiPost('/api/rooms/buildings', { name, floors });
    await loadAll();
    renderAll();
    closeBuildingModal();
    toast('تم إضافة المبنى', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    actionOverlay.hide();
  }
}

/* ==========================================
   Events
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
  const { $ } = window.__core;

  // Add buttons
  $('addRoomBtn')?.addEventListener('click', () => openRoomModal('add'));
  $('addBuildingBtn')?.addEventListener('click', openBuildingModal);

  // Refresh
  $('refreshBtn')?.addEventListener('click', async () => {
    const { toast } = window.__core;
    try {
      await loadAll();
      renderAll();
      toast('تم تحديث البيانات', 'success');
    } catch (err) {
      toast(err.message || 'فشل التحديث', 'error');
    }
  });

  // Sheet close
  $('closeSheet')?.addEventListener('click', closeSheet);
  $('sheetBackdrop')?.addEventListener('click', closeSheet);

  // Room modal close
  $('closeRoomModal')?.addEventListener('click', closeRoomModal);
  $('roomModalBackdrop')?.addEventListener('click', closeRoomModal);
  $('cancelRoomModal')?.addEventListener('click', closeRoomModal);
  $('saveRoomBtn')?.addEventListener('click', saveRoom);
  $('roomForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveRoom(); });

  // Building modal close
  $('closeBuildingModal')?.addEventListener('click', closeBuildingModal);
  $('buildingModalBackdrop')?.addEventListener('click', closeBuildingModal);
  $('cancelBuildingModal')?.addEventListener('click', closeBuildingModal);
  $('saveBuildingBtn')?.addEventListener('click', saveBuilding);
  $('buildingForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveBuilding(); });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      closeRoomModal();
      closeBuildingModal();
    }
  });

  // Search
  let searchTimeout;
  $('roomSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      roomsState.ui.search = e.target.value;
      renderFloorPlan();
    }, 200);
  });

  // Status toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      roomsState.ui.status = btn.dataset.status || '';
      renderFloorPlan();
    });
  });
});
