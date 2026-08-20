// ============================================================================
// MODULE-OFFICE-SPK.JS -- SPK (Surat Perintah Kerja)
// ============================================================================
// Field driver_terpilih/helper_terpilih di database disimpan sebagai
// JSON array of ID (bisa banyak orang per SPK) -- di form ini pakai
// <select multiple> yang otomatis convert ke/dari JSON array.
// ============================================================================

window.renderSpkModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const { data: rows, error } = await supabaseClient.from('spk').select('*').order('tanggal', { ascending: false });
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-clipboard-list mr-2 text-blue-500"></i>Office -- SPK (${rows.length})</h2>
        <button onclick="spkOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Buat SPK</button>
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr>
            <th>No SPK</th><th>Tanggal</th><th>Pelanggan</th><th>No SPH Terkait</th>
            <th>Armada</th><th>Pengerjaan</th><th>Status</th><th class="text-center">Aksi</th>
          </tr></thead>
          <tbody>${rows.map(spkRowHtml).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada SPK.</div>' : ''}
    </div>`;
};

function spkRowHtml(r) {
  const statusBadge = r.status === 'Selesai' ? 'erp-badge-success' : 'erp-badge-warning';
  return `<tr>
    <td class="font-mono text-slate-500">${r.no_spk || '-'}</td>
    <td class="font-mono text-slate-500">${window.formatDateID(r.tanggal)}</td>
    <td class="font-bold text-slate-700">${r.nama_pelanggan || '-'}</td>
    <td class="font-mono text-slate-400">${r.no_sph || '-'}</td>
    <td>${r.armada_terpilih || '-'}</td>
    <td>${r.pengerjaan_tipe || 'Internal'}</td>
    <td><span class="erp-badge ${statusBadge}">${r.status || 'Berjalan'}</span></td>
    <td class="text-center">
      <button onclick='spkOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="spkDelete('${r.no_spk}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`;
}

window.spkOpenForm = async function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(field, def) { return existingRow ? (existingRow[field] || def || '') : (def || ''); };

  // Ambil daftar SPH (buat link opsional) dan Karyawan (buat driver/helper)
  const { data: sphList } = await supabaseClient.from('sph').select('no_sph, customer');
  const { data: karyawanList } = await supabaseClient.from('karyawan').select('id_karyawan, nama_karyawan').eq('status', 'Aktif');

  const sphOptions = '<option value="">-- Tanpa SPH (buat manual) --</option>' +
    (sphList || []).map(function(s) { return `<option value="${s.no_sph}" ${v('no_sph')===s.no_sph?'selected':''}>${s.no_sph} -- ${s.customer}</option>`; }).join('');

  const driverTerpilihArr = existingRow && existingRow.driver_terpilih ? JSON.parse(existingRow.driver_terpilih) : [];
  const helperTerpilihArr = existingRow && existingRow.helper_terpilih ? JSON.parse(existingRow.helper_terpilih) : [];
  const karyawanOptionsDriver = (karyawanList || []).map(function(k) { return `<option value="${k.id_karyawan}" ${driverTerpilihArr.indexOf(k.id_karyawan)!==-1?'selected':''}>${k.nama_karyawan}</option>`; }).join('');
  const karyawanOptionsHelper = (karyawanList || []).map(function(k) { return `<option value="${k.id_karyawan}" ${helperTerpilihArr.indexOf(k.id_karyawan)!==-1?'selected':''}>${k.nama_karyawan}</option>`; }).join('');

  const modalHtml = `
    <div id="spk-modal" class="erp-modal-overlay">
      <div class="erp-modal-box" style="max-width: 640px;">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Buat'} SPK</h3>
        <div class="grid grid-cols-2 gap-2.5">
          <div><label class="erp-label">Tanggal</label><input type="date" id="kf-tanggal" value="${v('tanggal')}" class="erp-input"></div>
          <div><label class="erp-label">No SPH Terkait</label><select id="kf-no-sph" class="erp-input">${sphOptions}</select></div>
          <div class="col-span-2"><label class="erp-label">Nama Pelanggan</label><input id="kf-nama" value="${v('nama_pelanggan')}" class="erp-input"></div>
          <div><label class="erp-label">No HP</label><input id="kf-hp" value="${v('no_hp')}" class="erp-input"></div>
          <div><label class="erp-label">Referensi Customer</label><input id="kf-referensi" value="${v('referensi_customer')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Alamat Asal</label><input id="kf-alamat-asal" value="${v('alamat_asal')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Alamat Tujuan</label><input id="kf-alamat-tujuan" value="${v('alamat_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Pengerjaan</label>
            <select id="kf-pengerjaan" class="erp-input">
              <option value="Internal" ${v('pengerjaan_tipe')==='Internal'||!v('pengerjaan_tipe')?'selected':''}>Internal (Armada Angkutku)</option>
              <option value="Mitra" ${v('pengerjaan_tipe')==='Mitra'?'selected':''}>Mitra</option>
              <option value="Rekanan" ${v('pengerjaan_tipe')==='Rekanan'?'selected':''}>Rekanan</option>
            </select>
          </div>
          <div><label class="erp-label">Armada Terpilih (No Polisi)</label><input id="kf-armada" value="${v('armada_terpilih')}" class="erp-input"></div>
          <div class="col-span-2">
            <label class="erp-label">Driver (bisa pilih lebih dari 1, tahan Ctrl)</label>
            <select id="kf-driver" class="erp-input" multiple style="height: 80px;">${karyawanOptionsDriver}</select>
          </div>
          <div class="col-span-2">
            <label class="erp-label">Helper (bisa pilih lebih dari 1, tahan Ctrl)</label>
            <select id="kf-helper" class="erp-input" multiple style="height: 80px;">${karyawanOptionsHelper}</select>
          </div>
          <div><label class="erp-label">Jenis Layanan</label><input id="kf-jenis-layanan" value="${v('jenis_layanan')}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Barang</label><input id="kf-jenis-barang" value="${v('jenis_barang')}" class="erp-input"></div>
          <div><label class="erp-label">Jumlah Barang</label><input id="kf-jml-barang" value="${v('jumlah_barang')}" class="erp-input"></div>
          <div><label class="erp-label">Alat Bantu Kerja</label><input id="kf-alat-bantu" value="${v('alat_bantu_kerja')}" class="erp-input"></div>
          <div><label class="erp-label">Nominal Armada Angkutku</label><input type="number" id="kf-nominal-angkutku" value="${v('nominal_armada_angkutku', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Nominal Armada Mitra</label><input type="number" id="kf-nominal-mitra" value="${v('nominal_armada_mitra', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Nama Rekanan (kalau pengerjaan Rekanan)</label><input id="kf-rekanan" value="${v('rekanan_nama')}" class="erp-input"></div>
          <div><label class="erp-label">Status</label>
            <select id="kf-status" class="erp-input">
              <option value="Berjalan" ${v('status')==='Berjalan'||!v('status')?'selected':''}>Berjalan</option>
              <option value="Selesai" ${v('status')==='Selesai'?'selected':''}>Selesai</option>
            </select>
          </div>
          <div class="col-span-2"><label class="erp-label">Catatan</label><input id="kf-catatan" value="${v('catatan')}" class="erp-input"></div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('spk-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="spkSubmit(${isEdit ? "'" + existingRow.no_spk + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.spkSubmit = async function(noSpkExisting) {
  const gv = function(id) { return document.getElementById(id).value; };
  const gvMulti = function(id) { return Array.from(document.getElementById(id).selectedOptions).map(function(o) { return o.value; }); };

  const payload = {
    tanggal: gv('kf-tanggal'),
    no_sph: gv('kf-no-sph') || null,
    nama_pelanggan: gv('kf-nama'),
    no_hp: gv('kf-hp'),
    referensi_customer: gv('kf-referensi'),
    alamat_asal: gv('kf-alamat-asal'),
    alamat_tujuan: gv('kf-alamat-tujuan'),
    pengerjaan_tipe: gv('kf-pengerjaan'),
    armada_terpilih: gv('kf-armada'),
    driver_terpilih: JSON.stringify(gvMulti('kf-driver')),
    helper_terpilih: JSON.stringify(gvMulti('kf-helper')),
    jenis_layanan: gv('kf-jenis-layanan'),
    jenis_barang: gv('kf-jenis-barang'),
    jumlah_barang: gv('kf-jml-barang'),
    alat_bantu_kerja: gv('kf-alat-bantu'),
    nominal_armada_angkutku: Number(gv('kf-nominal-angkutku')) || 0,
    nominal_armada_mitra: Number(gv('kf-nominal-mitra')) || 0,
    rekanan_nama: gv('kf-rekanan'),
    status: gv('kf-status'),
    catatan: gv('kf-catatan'),
  };

  let error;
  if (noSpkExisting) {
    ({ error } = await supabaseClient.from('spk').update(payload).eq('no_spk', noSpkExisting));
  } else {
    payload.no_spk = 'ANGKUTKU-SPK-' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    ({ error } = await supabaseClient.from('spk').insert(payload));
  }

  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('spk-modal').remove();
  ofRenderActiveTab();
};

window.spkDelete = async function(noSpk) {
  if (!confirm('Hapus SPK ini?')) return;
  const { error } = await supabaseClient.from('spk').delete().eq('no_spk', noSpk);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  ofRenderActiveTab();
};
