// ============================================================================
// MODULE-JADWAL.JS -- versi 2, dibangun ulang mendekati aslinya di GAS
// ============================================================================
// Fitur yang SUDAH tercakup (setara GAS): 3-tab (Internal/Mitra/Global),
// badge sumber (Manual/SPH Biasa/Resi Kiriman), toggle status Selesai
// dengan tombol Batalkan, auto-tandai Selesai kalau jadwal sudah lewat
// >1 hari, kirim WhatsApp, filter tanggal/bulan/tahun/armada + pencarian.
//
// BELUM tercakup (menyusul di tahap lanjutan, fitur niche/jarang dipakai):
// form dinamis khusus kategori Kalkulator (Cleaning/Packing/AC dengan
// field berbeda-beda), badge "SPH Kalkulator" (karena modul SPH
// Kalkulator sendiri belum dibangun di sistem baru), tombol generate
// dokumen Cek Alat Kerja otomatis.
// ============================================================================

window.JADWAL_TOP_TAB = window.JADWAL_TOP_TAB || 'internal';
window.JADWAL_FILTERS = window.JADWAL_FILTERS || { search: '', day: '', month: '', year: '', armada: '' };
window._jdCurrentRows = [];

window._jdIsRestrictedRole = function() {
  const role = (window.CURRENT_USER_SESSION && window.CURRENT_USER_SESSION.role) || '';
  return role === 'Driver' || role === 'Helper';
};

window._jdCanInput = function() {
  const role = (window.CURRENT_USER_SESSION && window.CURRENT_USER_SESSION.role) || '';
  return ['Owner', 'Admin', 'Finance'].indexOf(role) !== -1;
};

window.jdSwitchTopTab = function(tab) {
  if (tab === 'mitra' && window._jdIsRestrictedRole()) return;
  window.JADWAL_TOP_TAB = tab;
  window.JADWAL_FILTERS.armada = '';
  renderJadwalModule(document.getElementById('content-area'));
};

window.renderJadwalModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const restricted = window._jdIsRestrictedRole();
  const canInput = window._jdCanInput();

  const [jadwalRes, spkRes, armadaRes, mitraRes] = await Promise.all([
    supabaseClient.from('jadwal').select('*'),
    supabaseClient.from('spk').select('no_spk, sumber_resi, pengerjaan_tipe'),
    supabaseClient.from('armada').select('no_polisi'),
    supabaseClient.from('mitra').select('plat_nomor'),
  ]);

  if (jadwalRes.error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${jadwalRes.error.message}</div>`; return; }

  window._jdCurrentRows = jadwalRes.data || [];
  window._jdSpkRef = spkRes.data || [];
  await window._jdAutoMarkOverdueSelesai(window._jdCurrentRows);

  const armadaPlates = Array.from(new Set(
    (armadaRes.data || []).map(function(a) { return a.no_polisi; })
      .concat((mitraRes.data || []).map(function(m) { return m.plat_nomor; }))
      .filter(Boolean)
  ));

  const addBtnHtml = (restricted || !canInput) ? '' : `<button onclick="jadwalOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Jadwal</button>`;

  const dayOpts = ['<option value="">-- Semua --</option>'].concat(Array.from({length:31}, function(_,i){ const d=String(i+1).padStart(2,'0'); return `<option value="${d}" ${window.JADWAL_FILTERS.day===d?'selected':''}>${d}</option>`; })).join('');
  const monthsList = [['01','Januari'],['02','Februari'],['03','Maret'],['04','April'],['05','Mei'],['06','Juni'],['07','Juli'],['08','Agustus'],['09','September'],['10','Oktober'],['11','November'],['12','Desember']];
  const monthOpts = '<option value="">-- Semua --</option>' + monthsList.map(function(m){return `<option value="${m[0]}" ${window.JADWAL_FILTERS.month===m[0]?'selected':''}>${m[1]}</option>`;}).join('');
  let yearOpts = '<option value="">-- Semua --</option>';
  for (let y = 2026; y <= 2030; y++) yearOpts += `<option value="${y}" ${window.JADWAL_FILTERS.year===String(y)?'selected':''}>${y}</option>`;
  const armadaOpts = '<option value="">-- Semua --</option>' + armadaPlates.map(function(p){return `<option value="${p}" ${window.JADWAL_FILTERS.armada===p?'selected':''}>${p}</option>`;}).join('');

  area.innerHTML = `
    ${restricted ? '<div class="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold p-2.5 rounded-lg mb-3"><i class="fas fa-circle-info mr-1"></i>Menampilkan jadwal yang menugaskan Anda saja.</div>' : ''}
    <div class="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs mb-3 overflow-x-auto">
      <button onclick="jdSwitchTopTab('internal')" class="shrink-0 flex-1 py-2 px-3 rounded-lg text-[11px] uppercase font-black ${window.JADWAL_TOP_TAB==='internal'?'bg-blue-600 text-white':'text-slate-500'}">1. Internal</button>
      ${restricted ? '' : `<button onclick="jdSwitchTopTab('mitra')" class="shrink-0 flex-1 py-2 px-3 rounded-lg text-[11px] uppercase font-black ${window.JADWAL_TOP_TAB==='mitra'?'bg-indigo-600 text-white':'text-slate-500'}">2. Mitra / Rekanan</button>`}
      <button onclick="jdSwitchTopTab('global')" class="shrink-0 flex-1 py-2 px-3 rounded-lg text-[11px] uppercase font-black ${window.JADWAL_TOP_TAB==='global'?'bg-emerald-600 text-white':'text-slate-500'}"><i class="fas fa-layer-group mr-1"></i>3. Semua</button>
    </div>
    <div class="erp-card p-3 mb-3 space-y-2.5">
      <div class="flex flex-wrap gap-2 items-center justify-between">
        <input type="text" placeholder="Cari ID order / rute / driver..." oninput="jdUpdateFilter('search', this.value)" class="erp-input" style="max-width: 280px;">
        ${addBtnHtml}
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
        <div><label class="erp-label">Tanggal</label><select onchange="jdUpdateFilter('day', this.value)" class="erp-input">${dayOpts}</select></div>
        <div><label class="erp-label">Bulan</label><select onchange="jdUpdateFilter('month', this.value)" class="erp-input">${monthOpts}</select></div>
        <div><label class="erp-label">Tahun</label><select onchange="jdUpdateFilter('year', this.value)" class="erp-input">${yearOpts}</select></div>
        <div><label class="erp-label">Armada</label><select onchange="jdUpdateFilter('armada', this.value)" class="erp-input">${armadaOpts}</select></div>
      </div>
    </div>
    <div id="jd-table-area"></div>`;

  jdApplyAllFilters();
};

window._jdAutoMarkOverdueSelesai = async function(rows) {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toUpdate = [];
  (rows || []).forEach(function(r) {
    if (r.status_selesai === 'Selesai' || !r.tanggal) return;
    const jadwalDate = new Date(r.tanggal);
    const diffDays = (todayMidnight - jadwalDate) / 86400000;
    if (diffDays > 1) {
      r.status_selesai = 'Selesai';
      toUpdate.push(r.id_order);
    }
  });
  if (toUpdate.length > 0) {
    await supabaseClient.from('jadwal').update({ status_selesai: 'Selesai' }).in('id_order', toUpdate);
  }
};

window.jdUpdateFilter = function(key, value) {
  window.JADWAL_FILTERS[key] = value;
  jdApplyAllFilters();
};

window.jdApplyAllFilters = function() {
  const f = window.JADWAL_FILTERS;
  const restricted = window._jdIsRestrictedRole();
  let rows = (window._jdCurrentRows || []).slice();

  if (window.JADWAL_TOP_TAB !== 'global') {
    rows = rows.filter(function(r) {
      const spkRef = window._jdSpkRef.find(function(s) { return s.no_spk === r.no_spk; });
      const tipe = spkRef ? (spkRef.pengerjaan_tipe || 'Internal') : 'Internal';
      return window.JADWAL_TOP_TAB === 'internal' ? tipe === 'Internal' : tipe !== 'Internal';
    });
  }

  if (restricted) {
    const myName = window.CURRENT_USER_SESSION.name;
    rows = rows.filter(function(r) { return r.driver_terpilih === myName || r.helper_terpilih === myName; });
  }

  if (f.search) {
    const kw = f.search.toLowerCase().trim();
    rows = rows.filter(function(r) { return Object.values(r).some(function(v) { return String(v||'').toLowerCase().indexOf(kw) !== -1; }); });
  }
  if (f.day || f.month || f.year) {
    rows = rows.filter(function(r) {
      if (!r.tanggal) return false;
      const parts = r.tanggal.split('-');
      const dayOk = f.day ? parts[2] === f.day : true;
      const monthOk = f.month ? parts[1] === f.month : true;
      const yearOk = f.year ? parts[0] === String(f.year) : true;
      return dayOk && monthOk && yearOk;
    });
  }
  if (f.armada) {
    rows = rows.filter(function(r) { return r.armada_terpilih === f.armada; });
  }

  rows.sort(function(a, b) { return String(b.tanggal||'').localeCompare(String(a.tanggal||'')); });
  jdRenderTable(rows);
};

function jdGetSourceInfo(row) {
  if (!row.no_spk) return { label: 'Manual', cls: 'erp-badge-neutral' };
  const spkRef = window._jdSpkRef.find(function(s) { return s.no_spk === row.no_spk; });
  if (spkRef && spkRef.sumber_resi) return { label: 'Resi Kiriman', cls: 'erp-badge-warning' };
  if (spkRef) return { label: 'SPH Biasa (SPK)', cls: 'erp-badge-success' };
  return { label: 'Manual', cls: 'erp-badge-neutral' };
}

function jdRenderTable(rows) {
  const tableArea = document.getElementById('jd-table-area');
  const canInput = window._jdCanInput();

  tableArea.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header"><h2 class="erp-card-title">Jadwal Order (${rows.length})</h2></div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr>
            <th>Tanggal</th><th>Pelanggan</th><th>Rute</th><th>Armada</th><th>Sumber</th><th>Status</th><th class="text-center">Aksi</th>
          </tr></thead>
          <tbody>${rows.map(function(r) { return jdRowHtml(r, canInput); }).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada jadwal.</div>' : ''}
    </div>`;
}

function jdRowHtml(r, canInput) {
  const src = jdGetSourceInfo(r);
  const isSelesai = r.status_selesai === 'Selesai';
  const selesaiCell = isSelesai
    ? `<div class="text-center"><span class="erp-badge erp-badge-success"><i class="fas fa-check-circle mr-1"></i>Selesai</span><br><button onclick="jdToggleSelesai('${r.id_order}', '')" class="text-[8px] text-slate-400 hover:text-rose-500 underline">Batalkan</button></div>`
    : `<button onclick="jdToggleSelesai('${r.id_order}', 'Selesai')" class="bg-slate-200 hover:bg-emerald-600 hover:text-white text-slate-600 font-black px-2 py-1 rounded text-[10px]"><i class="fas fa-check mr-1"></i>Selesai</button>`;

  return `<tr>
    <td class="font-mono text-slate-500">${window.formatDateID(r.tanggal)}</td>
    <td class="font-bold text-slate-700">${r.nama_pelanggan || '-'}</td>
    <td class="text-slate-500">${(r.alamat_asal||'-').slice(0,18)} → ${(r.alamat_tujuan||'-').slice(0,18)}</td>
    <td>${r.armada_terpilih || '-'}</td>
    <td><span class="erp-badge ${src.cls}">${src.label}</span></td>
    <td>${selesaiCell}</td>
    <td class="text-center">
      <button onclick="jdShareWhatsApp('${r.id_order}')" class="text-emerald-600 hover:underline mr-2" title="Kirim WhatsApp"><i class="fab fa-whatsapp"></i></button>
      ${canInput ? `<button onclick='jadwalOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="jadwalDelete('${r.id_order}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`;
}

window.jdToggleSelesai = async function(idOrder, statusBaru) {
  const { error } = await supabaseClient.from('jadwal').update({ status_selesai: statusBaru }).eq('id_order', idOrder);
  if (error) { alert('Gagal: ' + error.message); return; }
  const row = window._jdCurrentRows.find(function(r) { return r.id_order === idOrder; });
  if (row) row.status_selesai = statusBaru;
  jdApplyAllFilters();
};

window.jdShareWhatsApp = function(idOrder) {
  const r = window._jdCurrentRows.find(function(row) { return row.id_order === idOrder; });
  if (!r) return;
  const waBaseUrl = ['https:', '', 'wa.me', ''].join('/');
  const msg = 'Halo, Jadwal Order dengan ID ' + r.id_order + ' untuk ' + window.formatDateID(r.tanggal) + ' sudah siap.\n' +
    'Rute Operasional: ' + (r.alamat_asal||'-') + ' -> ' + (r.alamat_tujuan||'-') + '\n' +
    'Jenis Layanan: ' + (r.jenis_layanan||'-') + '\n' +
    'Armada: ' + (r.armada_terpilih||'-') + '\n' +
    'Alat Kerja Dibawa: ' + (r.alat_kerja_dibawa||'-') + '\n' +
    'Mohon segera dipersiapkan.';
  window.open(waBaseUrl + '?text=' + encodeURIComponent(msg), '_blank');
};

// ============================================================================
// FORM TAMBAH/EDIT
// ============================================================================
window.jadwalOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(field, def) { return existingRow ? (existingRow[field] || def || '') : (def || ''); };

  const modalHtml = `
    <div id="jadwal-modal" class="erp-modal-overlay">
      <div class="erp-modal-box">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Tambah'} Jadwal</h3>
        <div class="space-y-2.5">
          <div><label class="erp-label">Tanggal</label><input type="date" id="jf-tanggal" value="${v('tanggal')}" class="erp-input"></div>
          <div><label class="erp-label">Nama Pelanggan</label><input id="jf-nama" value="${v('nama_pelanggan')}" class="erp-input"></div>
          <div><label class="erp-label">No HP</label><input id="jf-hp" value="${v('no_hp')}" class="erp-input"></div>
          <div><label class="erp-label">Alamat Asal</label><input id="jf-asal" value="${v('alamat_asal')}" class="erp-input"></div>
          <div><label class="erp-label">Alamat Tujuan</label><input id="jf-tujuan" value="${v('alamat_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Armada</label><input id="jf-armada" value="${v('armada_terpilih')}" class="erp-input"></div>
          <div><label class="erp-label">Driver</label><input id="jf-driver" value="${v('driver_terpilih')}" class="erp-input"></div>
          <div><label class="erp-label">Helper</label><input id="jf-helper" value="${v('helper_terpilih')}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Layanan</label><input id="jf-layanan" value="${v('jenis_layanan')}" class="erp-input"></div>
          <div><label class="erp-label">Alat Kerja Dibawa</label><input id="jf-alatkerja" value="${v('alat_kerja_dibawa')}" class="erp-input"></div>
          <div><label class="erp-label">Referensi Customer</label><input id="jf-referensi" value="${v('referensi_customer')}" class="erp-input"></div>
          <div><label class="erp-label">Catatan</label><input id="jf-catatan" value="${v('catatan')}" class="erp-input"></div>
          <div><label class="erp-label">Status</label>
            <select id="jf-status" class="erp-input">
              <option value="Berjalan" ${v('status_selesai')==='Berjalan'||!v('status_selesai')?'selected':''}>Berjalan</option>
              <option value="Selesai" ${v('status_selesai')==='Selesai'?'selected':''}>Selesai</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('jadwal-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="jadwalSubmit(${isEdit ? "'" + existingRow.id_order + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.jadwalSubmit = async function(idOrder) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = {
    tanggal: gv('jf-tanggal'),
    nama_pelanggan: gv('jf-nama'),
    no_hp: gv('jf-hp'),
    alamat_asal: gv('jf-asal'),
    alamat_tujuan: gv('jf-tujuan'),
    armada_terpilih: gv('jf-armada'),
    driver_terpilih: gv('jf-driver'),
    helper_terpilih: gv('jf-helper'),
    jenis_layanan: gv('jf-layanan'),
    alat_kerja_dibawa: gv('jf-alatkerja'),
    referensi_customer: gv('jf-referensi'),
    catatan: gv('jf-catatan'),
    status_selesai: gv('jf-status'),
  };

  let error;
  if (idOrder) {
    ({ error } = await supabaseClient.from('jadwal').update(payload).eq('id_order', idOrder));
  } else {
    payload.id_order = 'ANGKUTKU-ORD-' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    ({ error } = await supabaseClient.from('jadwal').insert(payload));
  }

  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('jadwal-modal').remove();
  renderJadwalModule(document.getElementById('content-area'));
};

window.jadwalDelete = async function(idOrder) {
  if (!confirm('Hapus jadwal ini?')) return;
  const { error } = await supabaseClient.from('jadwal').delete().eq('id_order', idOrder);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  renderJadwalModule(document.getElementById('content-area'));
};
