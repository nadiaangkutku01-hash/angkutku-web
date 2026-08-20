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
// UTILITAS BARIS TEKS DINAMIS -- pola sama persis window.addSimpleTextRow
// di GAS, dipakai buat Alamat Asal/Tujuan/Armada/Driver/Helper (bisa lebih
// dari 1 baris, disatukan pakai newline saat submit).
// ============================================================================
window.jdAddSimpleTextRow = function(containerId, placeholder, value) {
  const area = document.getElementById(containerId);
  if (!area) return;
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center simple-text-row';
  div.innerHTML = '<input type="text" placeholder="' + (placeholder||'') + '" value="' + (value||'') + '" class="erp-input i-val">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.jdSyncSimpleTextRows = function(containerId, hiddenFieldId) {
  const rows = document.querySelectorAll('#' + containerId + ' .simple-text-row .i-val');
  const values = Array.from(rows).map(function(el) { return el.value; });
  document.getElementById(hiddenFieldId).value = values.join('\n');
};

// ============================================================================
// KATEGORI PEKERJAAN -- Pindahan / Kirim Barang / Lainnya (Cleaning/
// Packing/AC/Manual)
// ============================================================================
window.jdToggleKategoriPekerjaan = function(kategori) {
  document.getElementById('jd-f-kategori').value = kategori === 'Pindahan' ? '' : kategori;
  const isLainnya = kategori === 'Lainnya';

  ['pindahan', 'kirim', 'lainnya'].forEach(function(k) {
    const el = document.getElementById('jd-tab-' + k);
    const match = { pindahan: 'Pindahan', kirim: 'Kirim Barang', lainnya: 'Lainnya' }[k];
    const active = match === kategori;
    el.className = 'flex-1 py-2 rounded-lg text-[10px] uppercase font-black cursor-pointer ' + (active ? (k === 'lainnya' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white') : 'bg-white text-slate-500 border border-slate-200');
  });

  document.getElementById('jd-lainnya-subkategori-wrap').classList.toggle('hidden', !isLainnya);
  document.getElementById('jd-alamat-tujuan-wrap').classList.toggle('hidden', isLainnya);
  document.getElementById('jd-jenislayanan-wrap').classList.toggle('hidden', isLainnya);
  document.getElementById('jd-lainnya-preview-wrap').classList.toggle('hidden', !isLainnya);
  document.getElementById('jd-label-alamat-asal').textContent = isLainnya ? 'Lokasi Pengerjaan:' : 'Alamat Asal:';

  if (isLainnya) window.jdToggleSubkategoriLainnya(document.getElementById('jd-subkategori-lainnya').value);
};

window.jdToggleSubkategoriLainnya = function(value) {
  ['cleaning', 'packing', 'ac', 'manual'].forEach(function(k) { document.getElementById('jd-sub-' + k).classList.add('hidden'); });
  if (value === 'Cleaning Service') document.getElementById('jd-sub-cleaning').classList.remove('hidden');
  else if (value === 'Packing Standar' || value === 'Packing Kayu') {
    document.getElementById('jd-sub-packing').classList.remove('hidden');
    document.getElementById('jd-packing-title').textContent = 'Rincian Barang ' + value + ':';
    document.getElementById('jd-packing-kayu-addon').classList.toggle('hidden', value !== 'Packing Kayu');
    if (!document.querySelector('#jd-packing-row-area .jd-packing-row')) window.jdAddPackingRow();
  } else if (value === 'Bongkar Pasang AC') {
    document.getElementById('jd-sub-ac').classList.remove('hidden');
    if (!document.querySelector('#jd-ac-row-area .jd-ac-row')) window.jdAddAcRow();
  } else {
    document.getElementById('jd-sub-manual').classList.remove('hidden');
  }
};

window.jdAddPackingRow = function(nama, dimensi, qty) {
  const area = document.getElementById('jd-packing-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center jd-packing-row';
  div.innerHTML = '<input placeholder="Nama Barang" value="' + (nama||'') + '" class="erp-input flex-[2] i-nama">' +
    '<input placeholder="Dimensi PxLxT cm" value="' + (dimensi||'') + '" class="erp-input flex-1 i-dimensi">' +
    '<input type="number" placeholder="Qty" value="' + (qty||1) + '" class="erp-input w-16 i-qty">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.jdAddAcRow = function(jenisAc, pk, jenisKerja, qty) {
  const area = document.getElementById('jd-ac-row-area');
  const pkOpts = ['0.5 PK','1 PK','1.5 PK','2 PK','2.5 PK','Lainnya'].map(function(o) { return '<option value="'+o+'"'+(pk===o?' selected':'')+'>'+o+'</option>'; }).join('');
  const kerjaOpts = ['Bongkar','Pasang','Bongkar+Pasang','Cuci'].map(function(o) { return '<option value="'+o+'"'+(jenisKerja===o?' selected':'')+'>'+o+'</option>'; }).join('');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center jd-ac-row';
  div.innerHTML = '<input placeholder="Jenis Unit" value="' + (jenisAc||'') + '" class="erp-input flex-[2] i-jenis-ac">' +
    '<select class="erp-input flex-1 i-pk">' + pkOpts + '</select>' +
    '<select class="erp-input flex-1 i-jenis-kerja">' + kerjaOpts + '</select>' +
    '<input type="number" placeholder="Qty" value="' + (qty||1) + '" class="erp-input w-14 i-qty">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.jdAddAcExtraRow = function(val) {
  const area = document.getElementById('jd-ac-extra-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center jd-ac-extra-row';
  div.innerHTML = '<input placeholder="Contoh: Bobok tembok, isi freon" value="' + (val||'') + '" class="erp-input flex-1 i-extra">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

// Serialisasi Cleaning/Packing/AC/Manual jadi format "TIPE|field..." --
// PERSIS format yang sama dengan SPH/SPK di Views_Office.html, disimpan
// ke kolom jenis_layanan.
window.jdSyncLainnyaFields = function() {
  const subkat = document.getElementById('jd-subkategori-lainnya').value;
  let lines = [];
  if (subkat === 'Cleaning Service') {
    const paket = document.getElementById('jd-cleaning-paket').value;
    const luas = document.getElementById('jd-cleaning-luas').value || '0';
    const ruangan = document.getElementById('jd-cleaning-ruangan').value || '1';
    lines.push('CLEANING|' + paket + '|' + luas + '|' + ruangan);
  } else if (subkat === 'Packing Standar' || subkat === 'Packing Kayu') {
    document.querySelectorAll('#jd-packing-row-area .jd-packing-row').forEach(function(r) {
      lines.push('PACKING|' + r.querySelector('.i-nama').value + '|' + r.querySelector('.i-dimensi').value + '|' + r.querySelector('.i-qty').value);
    });
    if (subkat === 'Packing Kayu') {
      const addons = [];
      document.querySelectorAll('.jd-packing-kayu-addon-check:checked').forEach(function(cb) { addons.push(cb.value); });
      if (addons.length) lines.push('ADDON|' + addons.join(','));
    }
  } else if (subkat === 'Bongkar Pasang AC') {
    document.querySelectorAll('#jd-ac-row-area .jd-ac-row').forEach(function(r) {
      lines.push('AC|' + r.querySelector('.i-jenis-ac').value + '|' + r.querySelector('.i-pk').value + '|' + r.querySelector('.i-jenis-kerja').value + '|' + r.querySelector('.i-qty').value);
    });
    document.querySelectorAll('#jd-ac-extra-row-area .jd-ac-extra-row').forEach(function(r) {
      const val = r.querySelector('.i-extra').value.trim();
      if (val) lines.push('EXTRA|' + val);
    });
  } else {
    const manualVal = document.getElementById('jd-lainnya-manual').value.trim();
    if (manualVal) lines.push('MANUAL|' + manualVal);
  }
  document.getElementById('jd-f-jenis-layanan-hidden').value = lines.join('\n');
};

// Baca balik format "TIPE|field..." pas mode edit -- isi ulang baris
// form biar gak perlu ketik ulang.
window.jdRestoreLainnyaFields = function(subkat, jenisLayananRaw) {
  const lines = (jenisLayananRaw || '').split('\n').filter(Boolean);
  if (subkat === 'Cleaning Service') {
    const cLine = lines.find(function(l) { return l.indexOf('CLEANING|') === 0; });
    if (cLine) {
      const parts = cLine.split('|');
      document.getElementById('jd-cleaning-paket').value = parts[1] || 'General Cleaning';
      document.getElementById('jd-cleaning-luas').value = parts[2] || '0';
      document.getElementById('jd-cleaning-ruangan').value = parts[3] || '1';
    }
  } else if (subkat === 'Packing Standar' || subkat === 'Packing Kayu') {
    const area = document.getElementById('jd-packing-row-area');
    area.innerHTML = '';
    const packingLines = lines.filter(function(l) { return l.indexOf('PACKING|') === 0; });
    if (packingLines.length === 0) window.jdAddPackingRow();
    else packingLines.forEach(function(l) { const p = l.split('|'); window.jdAddPackingRow(p[1], p[2], p[3]); });
    const addonLine = lines.find(function(l) { return l.indexOf('ADDON|') === 0; });
    if (addonLine) {
      const addons = addonLine.split('|')[1].split(',');
      document.querySelectorAll('.jd-packing-kayu-addon-check').forEach(function(cb) { cb.checked = addons.indexOf(cb.value) !== -1; });
    }
  } else if (subkat === 'Bongkar Pasang AC') {
    const acArea = document.getElementById('jd-ac-row-area');
    acArea.innerHTML = '';
    const acLines = lines.filter(function(l) { return l.indexOf('AC|') === 0; });
    if (acLines.length === 0) window.jdAddAcRow();
    else acLines.forEach(function(l) { const p = l.split('|'); window.jdAddAcRow(p[1], p[2], p[3], p[4]); });
    const extraArea = document.getElementById('jd-ac-extra-row-area');
    extraArea.innerHTML = '';
    lines.filter(function(l) { return l.indexOf('EXTRA|') === 0; }).forEach(function(l) { window.jdAddAcExtraRow(l.split('|')[1]); });
  } else {
    const mLine = lines.find(function(l) { return l.indexOf('MANUAL|') === 0; });
    document.getElementById('jd-lainnya-manual').value = mLine ? mLine.split('|').slice(1).join('|') : '';
  }
};

// ============================================================================
// FORM TAMBAH/EDIT -- versi lengkap
// ============================================================================
window.jadwalOpenForm = async function(existingRow) {
  const isEdit = !!existingRow;
  const row = existingRow || {};
  const v = function(f, d) { return row[f] || d || ''; };
  const kategori = row.jenis_spk_kategori || 'Pindahan';
  const isLainnya = kategori === 'Lainnya';
  const subkat = row.subkategori_lainnya || 'Cleaning Service';

  const { data: spkList } = await supabaseClient.from('spk').select('no_spk, nama_pelanggan');
  const spkOptions = '<option value="">-- Tanpa Referensi SPK --</option>' + (spkList||[]).map(function(s) { return '<option value="' + s.no_spk + '"' + (row.no_spk===s.no_spk?' selected':'') + '>' + s.no_spk + ' - ' + s.nama_pelanggan + '</option>'; }).join('');

  const subkatOpts = ['Cleaning Service','Packing Standar','Packing Kayu','Bongkar Pasang AC','Lainnya'].map(function(o) { return '<option value="'+o+'"'+(subkat===o?' selected':'')+'>'+o+'</option>'; }).join('');

  const html = '<div id="jadwal-modal" class="erp-modal-overlay"><div class="erp-modal-box" style="max-width:680px;">' +
    '<h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Jadwal</h3>' +
    '<div class="space-y-2.5">' +
    '<div><label class="erp-label">Tanggal</label><input type="date" id="jf-tanggal" value="' + v('tanggal') + '" class="erp-input"></div>' +
    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Nama Pelanggan</label><input id="jf-nama" value="' + v('nama_pelanggan') + '" class="erp-input"></div><div><label class="erp-label">No HP</label><input id="jf-hp" value="' + v('no_hp') + '" class="erp-input"></div></div>' +

    // Kategori Pekerjaan
    '<div class="flex gap-2 bg-slate-100 p-1.5 rounded-xl">' +
    '<button type="button" id="jd-tab-pindahan" onclick="jdToggleKategoriPekerjaan(\'Pindahan\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (kategori==='Pindahan'?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">A. Pindahan</button>' +
    '<button type="button" id="jd-tab-kirim" onclick="jdToggleKategoriPekerjaan(\'Kirim Barang\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (kategori==='Kirim Barang'?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">B. Kirim Barang</button>' +
    '<button type="button" id="jd-tab-lainnya" onclick="jdToggleKategoriPekerjaan(\'Lainnya\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (isLainnya?'bg-purple-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">C. Lainnya</button>' +
    '</div>' +

    '<div id="jd-lainnya-subkategori-wrap" class="border border-purple-200 bg-purple-50/40 p-2.5 rounded-lg ' + (isLainnya?'':'hidden') + '">' +
    '<label class="erp-label text-purple-700">Sub-Kategori Pekerjaan</label>' +
    '<select id="jd-subkategori-lainnya" onchange="jdToggleSubkategoriLainnya(this.value)" class="erp-input">' + subkatOpts + '</select></div>' +

    // Alamat Asal/Tujuan multi-baris
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span id="jd-label-alamat-asal" class="erp-label text-emerald-600">Alamat Asal:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-asal-row-area\',\'Alamat asal\')" class="text-[9px] text-emerald-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-asal-row-area" class="space-y-1.5"></div></div>' +
    '<div id="jd-alamat-tujuan-wrap" class="border border-slate-200 p-2.5 rounded-lg bg-slate-50 ' + (isLainnya?'hidden':'') + '"><div class="flex justify-between items-center mb-1"><span class="erp-label text-rose-600">Alamat Tujuan:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-tujuan-row-area\',\'Alamat tujuan\')" class="text-[9px] text-rose-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-tujuan-row-area" class="space-y-1.5"></div></div>' +
    '</div>' +

    '<div id="jd-jenislayanan-wrap" class="border border-slate-200 p-2.5 rounded-lg bg-slate-50 ' + (isLainnya?'hidden':'') + '"><div class="flex justify-between items-center mb-1"><span class="erp-label text-blue-600">Jenis Layanan:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-layanan-row-area\',\'Jenis layanan\')" class="text-[9px] text-blue-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-layanan-row-area" class="space-y-1.5"></div></div>' +

    // Sub-form Lainnya: Cleaning / Packing / AC / Manual
    '<div id="jd-lainnya-preview-wrap" class="space-y-3 ' + (isLainnya?'':'hidden') + '">' +
    '<div id="jd-sub-cleaning" class="space-y-2 border border-cyan-200 bg-cyan-50/40 p-2.5 rounded-lg hidden">' +
    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Jenis Paket</label><select id="jd-cleaning-paket" class="erp-input"><option value="General Cleaning">General Cleaning</option><option value="Deep Cleaning">Deep Cleaning</option></select></div>' +
    '<div><label class="erp-label">Luas Area (m2)</label><input type="number" id="jd-cleaning-luas" value="45" class="erp-input"></div></div>' +
    '<div><label class="erp-label">Jumlah Ruangan/Unit</label><input type="number" id="jd-cleaning-ruangan" value="1" class="erp-input"></div></div>' +

    '<div id="jd-sub-packing" class="space-y-2 border border-purple-200 bg-purple-50/40 p-2.5 rounded-lg hidden">' +
    '<div class="flex justify-between items-center"><span id="jd-packing-title" class="erp-label text-purple-700">Rincian Barang:</span><button type="button" onclick="jdAddPackingRow()" class="text-[9px] text-purple-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah Barang</button></div>' +
    '<div id="jd-packing-row-area" class="space-y-1.5"></div>' +
    '<div id="jd-packing-kayu-addon" class="hidden pt-2 border-t border-purple-200"><span class="erp-label text-purple-700">Tambahan Material Peti Kayu:</span><div class="grid grid-cols-2 gap-1 text-[11px] mt-1">' +
    ['Kardus','Wrapping','Bubble Wrap','Triplek','Pallet'].map(function(o) { return '<label class="flex items-center gap-1.5"><input type="checkbox" class="jd-packing-kayu-addon-check" value="'+o+'"> '+o+'</label>'; }).join('') + '</div></div></div>' +

    '<div id="jd-sub-ac" class="space-y-2 border border-amber-200 bg-amber-50/40 p-2.5 rounded-lg hidden">' +
    '<div class="flex justify-between items-center"><span class="erp-label text-amber-700">Rincian Unit AC:</span><button type="button" onclick="jdAddAcRow()" class="text-[9px] text-amber-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah Unit</button></div>' +
    '<div id="jd-ac-row-area" class="space-y-1.5"></div>' +
    '<div class="pt-2 border-t border-amber-200"><div class="flex justify-between items-center"><span class="erp-label text-amber-700">Layanan Tambahan:</span><button type="button" onclick="jdAddAcExtraRow()" class="text-[9px] text-amber-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jd-ac-extra-row-area" class="space-y-1.5"></div></div></div>' +

    '<div id="jd-sub-manual" class="hidden"><label class="erp-label">Rincian Pekerjaan</label><textarea id="jd-lainnya-manual" rows="3" class="erp-input"></textarea></div>' +
    '</div>' +

    // Plotting kru
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50 space-y-2.5">' +
    '<p class="erp-label text-blue-600">Plotting Kru Lapangan:</p>' +
    '<div><div class="flex justify-between items-center mb-1"><span class="erp-label text-indigo-600">Armada:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-armada-row-area\',\'Plat mobil\')" class="text-[9px] text-indigo-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-armada-row-area" class="space-y-1.5"></div></div>' +
    '<div><div class="flex justify-between items-center mb-1"><span class="erp-label text-teal-600">Driver:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-driver-row-area\',\'Nama driver\')" class="text-[9px] text-teal-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-driver-row-area" class="space-y-1.5"></div></div>' +
    '<div><div class="flex justify-between items-center mb-1"><span class="erp-label text-amber-600">Helper:</span><button type="button" onclick="jdAddSimpleTextRow(\'jadwal-helper-row-area\',\'Nama helper\')" class="text-[9px] text-amber-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="jadwal-helper-row-area" class="space-y-1.5"></div></div>' +
    '</div>' +

    '<div><label class="erp-label">Alat Kerja Dibawa</label><input id="jf-alatkerja" value="' + v('alat_kerja_dibawa') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Referensi Customer</label><input id="jf-referensi" value="' + v('referensi_customer') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Catatan</label><input id="jf-catatan" value="' + v('catatan') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">No SPK Turunan (Opsional)</label><select id="jf-no-spk" class="erp-input">' + spkOptions + '</select></div>' +
    '<div><label class="erp-label">Status</label><select id="jf-status" class="erp-input"><option value="Berjalan"' + (v('status_selesai')==='Berjalan'||!v('status_selesai')?' selected':'') + '>Berjalan</option><option value="Selesai"' + (v('status_selesai')==='Selesai'?' selected':'') + '>Selesai</option></select></div>' +

    '<input type="hidden" id="jd-f-kategori" value="' + v('jenis_spk_kategori') + '">' +
    '<input type="hidden" id="jd-f-jenis-layanan-hidden" value="' + v('jenis_layanan') + '">' +
    '</div>' +
    '<div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'jadwal-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="jadwalSubmit(' + (isEdit ? "'" + existingRow.id_order + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div>' +
    '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // Isi ulang baris multi-teks dari data lama (edit) atau 1 baris kosong (baru)
  (row.alamat_asal || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-asal-row-area', 'Alamat asal', t); });
  if (!row.alamat_asal) window.jdAddSimpleTextRow('jadwal-asal-row-area', 'Alamat asal');
  (row.alamat_tujuan || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-tujuan-row-area', 'Alamat tujuan', t); });
  if (!row.alamat_tujuan) window.jdAddSimpleTextRow('jadwal-tujuan-row-area', 'Alamat tujuan');
  if (!isLainnya) {
    (row.jenis_layanan || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-layanan-row-area', 'Jenis layanan', t); });
    if (!row.jenis_layanan) window.jdAddSimpleTextRow('jadwal-layanan-row-area', 'Jenis layanan');
  }
  (row.armada_terpilih || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-armada-row-area', 'Plat mobil', t); });
  if (!row.armada_terpilih) window.jdAddSimpleTextRow('jadwal-armada-row-area', 'Plat mobil');
  (row.driver_terpilih || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-driver-row-area', 'Nama driver', t); });
  if (!row.driver_terpilih) window.jdAddSimpleTextRow('jadwal-driver-row-area', 'Nama driver');
  (row.helper_terpilih || '').split('\n').filter(Boolean).forEach(function(t) { window.jdAddSimpleTextRow('jadwal-helper-row-area', 'Nama helper', t); });
  if (!row.helper_terpilih) window.jdAddSimpleTextRow('jadwal-helper-row-area', 'Nama helper');

  if (isLainnya) {
    window.jdToggleSubkategoriLainnya(subkat);
    window.jdRestoreLainnyaFields(subkat, row.jenis_layanan);
  }
};

window.jadwalSubmit = async function(idOrder) {
  const gv = function(id) { return document.getElementById(id).value; };

  // Sinkronkan SEMUA baris multi-teks + Lainnya sebelum baca nilainya --
  // persis urutan yang sama di GAS.
  const alamatAsal = Array.from(document.querySelectorAll('#jadwal-asal-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');
  const alamatTujuan = Array.from(document.querySelectorAll('#jadwal-tujuan-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');
  const armadaTerpilih = Array.from(document.querySelectorAll('#jadwal-armada-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');
  const driverTerpilih = Array.from(document.querySelectorAll('#jadwal-driver-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');
  const helperTerpilih = Array.from(document.querySelectorAll('#jadwal-helper-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');

  const kategori = gv('jd-f-kategori');
  const isLainnya = kategori === 'Lainnya';
  let jenisLayanan;
  if (isLainnya) {
    window.jdSyncLainnyaFields();
    jenisLayanan = gv('jd-f-jenis-layanan-hidden');
  } else {
    jenisLayanan = Array.from(document.querySelectorAll('#jadwal-layanan-row-area .i-val')).map(function(el) { return el.value; }).filter(Boolean).join('\n');
  }

  const payload = {
    tanggal: gv('jf-tanggal'),
    nama_pelanggan: gv('jf-nama'),
    no_hp: gv('jf-hp'),
    alamat_asal: alamatAsal,
    alamat_tujuan: isLainnya ? '' : alamatTujuan,
    jenis_layanan: jenisLayanan,
    jenis_spk_kategori: kategori,
    subkategori_lainnya: isLainnya ? document.getElementById('jd-subkategori-lainnya').value : '',
    armada_terpilih: armadaTerpilih,
    driver_terpilih: driverTerpilih,
    helper_terpilih: helperTerpilih,
    alat_kerja_dibawa: gv('jf-alatkerja'),
    referensi_customer: gv('jf-referensi'),
    catatan: gv('jf-catatan'),
    no_spk: gv('jf-no-spk') || null,
    status_selesai: gv('jf-status'),
  };

  let res;
  if (idOrder) {
    res = await supabaseClient.from('jadwal').update(payload).eq('id_order', idOrder);
  } else {
    payload.id_order = 'ANGKUTKU-ORD-' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    res = await supabaseClient.from('jadwal').insert(payload);
  }

  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('jadwal-modal').remove();
  renderJadwalModule(document.getElementById('content-area'));
};

window.jadwalDelete = async function(idOrder) {
  if (!confirm('Hapus jadwal ini?')) return;
  const res = await supabaseClient.from('jadwal').delete().eq('id_order', idOrder);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  renderJadwalModule(document.getElementById('content-area'));
};
