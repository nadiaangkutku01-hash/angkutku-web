// ============================================================================
// MODULE-JADWAL.JS
// ============================================================================
// Pola beda dari Pelanggan: SEMUA Role yang punya akses boleh LIHAT
// (Driver/Helper/PIC Lapangan termasuk), tapi INPUT/EDIT/HAPUS cuma
// Owner/Admin/Finance -- RLS (kebijakan jadwal_insert/update/delete)
// yang menegakkan ini di level database, kode di sini cuma nyembunyiin
// tombol biar UI-nya rapi (gak nunjukin tombol yang nanti ditolak RLS).
// ============================================================================

window.renderJadwalModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const canInput = ['Owner', 'Admin', 'Finance'].indexOf(window.CURRENT_USER_SESSION.role) !== -1;

  const { data: rows, error } = await supabaseClient.from('jadwal').select('*').order('tanggal', { ascending: false });

  if (error) {
    area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat data: ${error.message}</div>`;
    return;
  }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-calendar mr-2 text-blue-500"></i>Jadwal Order (${rows.length})</h2>
        ${canInput ? `<button onclick="jadwalOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah Jadwal</button>` : '<span class="text-[10px] text-slate-400 italic">Lihat saja -- input cuma Owner/Admin/Finance</span>'}
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr>
            <th>Tanggal</th>
            <th>Pelanggan</th>
            <th>No HP</th>
            <th>Rute</th>
            <th>Jenis Layanan</th>
            <th>Armada</th>
            <th>Status</th>
            ${canInput ? '<th class="text-center">Aksi</th>' : ''}
          </tr></thead>
          <tbody>${rows.map(function(r) { return jadwalRowHtml(r, canInput); }).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada jadwal.</div>' : ''}
    </div>`;
};

function jadwalRowHtml(r, canInput) {
  const badgeClass = r.status_selesai === 'Selesai' ? 'erp-badge-success' : 'erp-badge-warning';
  return `<tr>
    <td class="font-mono text-slate-500">${window.formatDateID(r.tanggal)}</td>
    <td class="font-bold text-slate-700">${r.nama_pelanggan || '-'}</td>
    <td>${r.no_hp || '-'}</td>
    <td class="text-slate-500">${(r.alamat_asal || '-').slice(0,20)} → ${(r.alamat_tujuan || '-').slice(0,20)}</td>
    <td>${r.jenis_layanan || '-'}</td>
    <td>${r.armada_terpilih || '-'}</td>
    <td><span class="erp-badge ${badgeClass}">${r.status_selesai || 'Berjalan'}</span></td>
    ${canInput ? `<td class="text-center">
      <button onclick='jadwalOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="jadwalDelete('${r.id_order}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>` : ''}
  </tr>`;
}

window.jadwalOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const modalHtml = `
    <div id="jadwal-modal" class="erp-modal-overlay">
      <div class="erp-modal-box">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Tambah'} Jadwal</h3>
        <div class="space-y-2.5">
          <div><label class="erp-label">Tanggal</label><input type="date" id="jf-tanggal" value="${existingRow ? existingRow.tanggal || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Nama Pelanggan</label><input id="jf-nama" value="${existingRow ? existingRow.nama_pelanggan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">No HP</label><input id="jf-hp" value="${existingRow ? existingRow.no_hp || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Alamat Asal</label><input id="jf-asal" value="${existingRow ? existingRow.alamat_asal || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Alamat Tujuan</label><input id="jf-tujuan" value="${existingRow ? existingRow.alamat_tujuan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Armada</label><input id="jf-armada" value="${existingRow ? existingRow.armada_terpilih || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Layanan</label><input id="jf-layanan" placeholder="misal: Pindahan Rumah" value="${existingRow ? existingRow.jenis_layanan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Alat Kerja Dibawa</label><input id="jf-alatkerja" placeholder="misal: Hand pallet, Trolley" value="${existingRow ? existingRow.alat_kerja_dibawa || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Referensi Customer (kalau ada)</label><input id="jf-referensi" value="${existingRow ? existingRow.referensi_customer || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Catatan</label><input id="jf-catatan" value="${existingRow ? existingRow.catatan || '' : ''}" class="erp-input"></div>
          <div>
            <label class="erp-label">Status</label>
            <select id="jf-status" class="erp-input">
              <option value="Berjalan" ${existingRow && existingRow.status_selesai === 'Berjalan' ? 'selected' : ''}>Berjalan</option>
              <option value="Selesai" ${existingRow && existingRow.status_selesai === 'Selesai' ? 'selected' : ''}>Selesai</option>
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
  const payload = {
    tanggal: document.getElementById('jf-tanggal').value,
    nama_pelanggan: document.getElementById('jf-nama').value,
    no_hp: document.getElementById('jf-hp').value,
    alamat_asal: document.getElementById('jf-asal').value,
    alamat_tujuan: document.getElementById('jf-tujuan').value,
    armada_terpilih: document.getElementById('jf-armada').value,
    jenis_layanan: document.getElementById('jf-layanan').value,
    alat_kerja_dibawa: document.getElementById('jf-alatkerja').value,
    referensi_customer: document.getElementById('jf-referensi').value,
    catatan: document.getElementById('jf-catatan').value,
    status_selesai: document.getElementById('jf-status').value,
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
