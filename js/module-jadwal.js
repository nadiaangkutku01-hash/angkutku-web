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
    <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-sm font-black text-slate-800"><i class="fas fa-calendar mr-2 text-blue-500"></i>Jadwal Order (${rows.length})</h2>
        ${canInput ? `<button onclick="jadwalOpenForm()" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg"><i class="fas fa-plus mr-1"></i>Tambah Jadwal</button>` : '<span class="text-[10px] text-slate-400 italic">Lihat saja -- input cuma Owner/Admin/Finance</span>'}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="bg-slate-50 text-slate-400 uppercase text-[9px]">
            <th class="p-3 text-left">Tanggal</th>
            <th class="p-3 text-left">Pelanggan</th>
            <th class="p-3 text-left">Rute</th>
            <th class="p-3 text-left">Armada</th>
            <th class="p-3 text-left">Status</th>
            ${canInput ? '<th class="p-3 text-center">Aksi</th>' : ''}
          </tr></thead>
          <tbody>${rows.map(function(r) { return jadwalRowHtml(r, canInput); }).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada jadwal.</div>' : ''}
    </div>`;
};

function jadwalRowHtml(r, canInput) {
  const statusColor = r.status_selesai === 'Selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200';
  return `<tr class="border-t border-slate-100 hover:bg-slate-50">
    <td class="p-3 font-mono text-slate-500">${r.tanggal || '-'}</td>
    <td class="p-3 font-bold text-slate-700">${r.nama_pelanggan || '-'}</td>
    <td class="p-3 text-slate-500">${(r.alamat_asal || '-').slice(0,20)} → ${(r.alamat_tujuan || '-').slice(0,20)}</td>
    <td class="p-3">${r.armada_terpilih || '-'}</td>
    <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColor}">${r.status_selesai || 'Berjalan'}</span></td>
    ${canInput ? `<td class="p-3 text-center">
      <button onclick='jadwalOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="jadwalDelete('${r.id_order}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>` : ''}
  </tr>`;
}

window.jadwalOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const modalHtml = `
    <div id="jadwal-modal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 class="text-sm font-black text-slate-800 mb-4">${isEdit ? 'Edit' : 'Tambah'} Jadwal</h3>
        <div class="space-y-2.5">
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">Tanggal</label><input type="date" id="jf-tanggal" value="${existingRow ? existingRow.tanggal || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">Nama Pelanggan</label><input id="jf-nama" value="${existingRow ? existingRow.nama_pelanggan || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">No HP</label><input id="jf-hp" value="${existingRow ? existingRow.no_hp || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">Alamat Asal</label><input id="jf-asal" value="${existingRow ? existingRow.alamat_asal || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">Alamat Tujuan</label><input id="jf-tujuan" value="${existingRow ? existingRow.alamat_tujuan || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div><label class="text-[9px] uppercase text-slate-400 font-bold">Armada</label><input id="jf-armada" value="${existingRow ? existingRow.armada_terpilih || '' : ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"></div>
          <div>
            <label class="text-[9px] uppercase text-slate-400 font-bold">Status</label>
            <select id="jf-status" class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm">
              <option value="Berjalan" ${existingRow && existingRow.status_selesai === 'Berjalan' ? 'selected' : ''}>Berjalan</option>
              <option value="Selesai" ${existingRow && existingRow.status_selesai === 'Selesai' ? 'selected' : ''}>Selesai</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('jadwal-modal').remove()" class="flex-1 bg-slate-100 text-slate-600 font-bold text-xs py-2.5 rounded-lg">Batal</button>
          <button onclick="jadwalSubmit(${isEdit ? "'" + existingRow.id_order + "'" : 'null'})" class="flex-1 bg-blue-600 text-white font-bold text-xs py-2.5 rounded-lg">Simpan</button>
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
    status_selesai: document.getElementById('jf-status').value,
  };

  let error;
  if (idOrder) {
    ({ error } = await supabaseClient.from('jadwal').update(payload).eq('id_order', idOrder));
  } else {
    payload.id_order = 'ANGKUTKU-ORD-' + Date.now();
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
