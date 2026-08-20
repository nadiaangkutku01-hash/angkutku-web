// ============================================================================
// MODULE-OFFICE.JS -- SPH (Surat Penawaran Harga)
// ============================================================================
// Pola sama dengan Pelanggan: Owner/Admin/Finance/Supervisor lihat
// semua, Marketing CUMA dokumen yang dia buat sendiri (RLS kebijakan
// sph_select yang menegakkan -- kode ini cuma nyembunyiin tombol INPUT
// biar rapi, BUKAN filter data, karena filter datanya sudah otomatis
// dari RLS begitu query dijalankan).
// ============================================================================

window.renderSphModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const { data: rows, error } = await supabaseClient.from('sph').select('*').order('tanggal', { ascending: false });
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-file-invoice mr-2 text-blue-500"></i>Office -- SPH (${rows.length})</h2>
        <button onclick="sphOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Buat SPH</button>
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr>
            <th>No SPH</th><th>Tanggal</th><th>Customer</th><th>No HP</th><th>Jenis Layanan</th>
            <th>Harga</th><th>Status</th><th>Status Deal</th><th class="text-center">Aksi</th>
          </tr></thead>
          <tbody>${rows.map(sphRowHtml).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada SPH (atau memang gak ada yang bisa kamu lihat sesuai hak aksesmu).</div>' : ''}
    </div>`;
};

function sphRowHtml(r) {
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  const statusBadge = r.status === 'Deal' ? 'erp-badge-success' : (r.status === 'Tidak Ada Respon' ? 'erp-badge-danger' : 'erp-badge-warning');
  const dealBadge = r.status_deal_final === 'Deal' ? 'erp-badge-success' : 'erp-badge-neutral';
  return `<tr>
    <td class="font-mono text-slate-500">${r.no_sph || '-'}</td>
    <td class="font-mono text-slate-500">${window.formatDateID(r.tanggal)}</td>
    <td class="font-bold text-slate-700">${r.customer || '-'}</td>
    <td>${r.no_hp || '-'}</td>
    <td>${r.jenis_layanan || '-'}</td>
    <td class="font-mono">${formatRp(r.harga_setelah_diskon || r.harga)}</td>
    <td><span class="erp-badge ${statusBadge}">${r.status || '-'}</span></td>
    <td><span class="erp-badge ${dealBadge}">${r.status_deal_final || 'Belum'}</span></td>
    <td class="text-center">
      <button onclick='sphOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="sphDelete('${r.no_sph}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`;
}

window.sphOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(field, def) { return existingRow ? (existingRow[field] || def || '') : (def || ''); };

  const modalHtml = `
    <div id="sph-modal" class="erp-modal-overlay">
      <div class="erp-modal-box" style="max-width: 640px;">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Buat'} SPH</h3>
        <div class="grid grid-cols-2 gap-2.5">
          <div><label class="erp-label">Tanggal</label><input type="date" id="sf-tanggal" value="${v('tanggal')}" class="erp-input"></div>
          <div><label class="erp-label">Jenis SPH</label>
            <select id="sf-jenis-sph" class="erp-input">
              <option value="Pindahan" ${v('jenis_sph')==='Pindahan'?'selected':''}>Pindahan</option>
              <option value="Cleaning" ${v('jenis_sph')==='Cleaning'?'selected':''}>Cleaning</option>
              <option value="Lainnya" ${v('jenis_sph')==='Lainnya'?'selected':''}>Lainnya</option>
            </select>
          </div>
          <div class="col-span-2"><label class="erp-label">Nama Customer</label><input id="sf-customer" value="${v('customer')}" class="erp-input"></div>
          <div><label class="erp-label">No HP</label><input id="sf-hp" value="${v('no_hp')}" class="erp-input"></div>
          <div><label class="erp-label">Referensi Customer</label><input id="sf-referensi" value="${v('referensi_customer')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Lokasi Asal</label><input id="sf-lokasi-asal" value="${v('lokasi_asal')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Lokasi Tujuan</label><input id="sf-lokasi-tujuan" value="${v('lokasi_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Lantai Asal</label><input id="sf-lantai-asal" value="${v('lantai_asal')}" class="erp-input"></div>
          <div><label class="erp-label">Lantai Tujuan</label><input id="sf-lantai-tujuan" value="${v('lantai_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Akses Asal</label><input id="sf-akses-asal" value="${v('akses_asal')}" class="erp-input"></div>
          <div><label class="erp-label">Akses Tujuan</label><input id="sf-akses-tujuan" value="${v('akses_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Akses Tangga Asal</label><input id="sf-tangga-asal" value="${v('akses_tangga_asal')}" class="erp-input"></div>
          <div><label class="erp-label">Akses Tangga Tujuan</label><input id="sf-tangga-tujuan" value="${v('akses_tangga_tujuan')}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Armada</label><input id="sf-jenis-armada" value="${v('jenis_armada')}" class="erp-input"></div>
          <div><label class="erp-label">Jumlah Armada</label><input type="number" id="sf-jml-armada" value="${v('jumlah_armada', 1)}" class="erp-input"></div>
          <div><label class="erp-label">Jumlah Helper</label><input type="number" id="sf-jml-helper" value="${v('jumlah_helper', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Layanan</label><input id="sf-jenis-layanan" value="${v('jenis_layanan')}" class="erp-input"></div>
          <div><label class="erp-label">Paket Pindahan</label><input id="sf-paket" value="${v('paket_pindahan')}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Barang</label><input id="sf-jenis-barang" value="${v('jenis_barang')}" class="erp-input"></div>
          <div><label class="erp-label">Jumlah Barang</label><input id="sf-jml-barang" value="${v('jumlah_barang')}" class="erp-input"></div>
          <div><label class="erp-label">Estimasi Berat</label><input id="sf-berat" value="${v('estimasi_berat')}" class="erp-input"></div>
          <div><label class="erp-label">Alat Bantu Kerja</label><input id="sf-alat-bantu" value="${v('alat_bantu_kerja')}" class="erp-input"></div>
          <div><label class="erp-label">Harga (sebelum diskon)</label><input type="number" id="sf-harga" value="${v('harga', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Diskon</label>
            <select id="sf-diskon-jenis" class="erp-input">
              <option value="" ${!v('diskon_jenis')?'selected':''}>-- Tidak Ada --</option>
              <option value="Nominal" ${v('diskon_jenis')==='Nominal'?'selected':''}>Nominal (Rp)</option>
              <option value="Persen" ${v('diskon_jenis')==='Persen'?'selected':''}>Persen (%)</option>
            </select>
          </div>
          <div><label class="erp-label">Nominal Diskon</label><input type="number" id="sf-diskon-nominal" value="${v('diskon_nominal', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Harga Setelah Diskon</label><input type="number" id="sf-harga-final" value="${v('harga_setelah_diskon', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Status</label>
            <select id="sf-status" class="erp-input">
              <option value="Menunggu Respon" ${v('status')==='Menunggu Respon'||!v('status')?'selected':''}>Menunggu Respon</option>
              <option value="Deal" ${v('status')==='Deal'?'selected':''}>Deal</option>
              <option value="Tidak Ada Respon" ${v('status')==='Tidak Ada Respon'?'selected':''}>Tidak Ada Respon</option>
            </select>
          </div>
          <div><label class="erp-label">Tgl Follow Up</label><input type="date" id="sf-followup" value="${v('tgl_follow_up')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Layanan Tambahan (Keterangan)</label><input id="sf-layanan-tambahan-ket" value="${v('layanan_tambahan_keterangan')}" class="erp-input"></div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('sph-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="sphSubmit(${isEdit ? "'" + existingRow.no_sph + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.sphSubmit = async function(noSphExisting) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = {
    tanggal: gv('sf-tanggal'),
    jenis_sph: gv('sf-jenis-sph'),
    customer: gv('sf-customer'),
    no_hp: gv('sf-hp'),
    referensi_customer: gv('sf-referensi'),
    lokasi_asal: gv('sf-lokasi-asal'),
    lokasi_tujuan: gv('sf-lokasi-tujuan'),
    lantai_asal: gv('sf-lantai-asal'),
    lantai_tujuan: gv('sf-lantai-tujuan'),
    akses_asal: gv('sf-akses-asal'),
    akses_tujuan: gv('sf-akses-tujuan'),
    akses_tangga_asal: gv('sf-tangga-asal'),
    akses_tangga_tujuan: gv('sf-tangga-tujuan'),
    jenis_armada: gv('sf-jenis-armada'),
    jumlah_armada: Number(gv('sf-jml-armada')) || 0,
    jumlah_helper: Number(gv('sf-jml-helper')) || 0,
    jenis_layanan: gv('sf-jenis-layanan'),
    paket_pindahan: gv('sf-paket'),
    jenis_barang: gv('sf-jenis-barang'),
    jumlah_barang: gv('sf-jml-barang'),
    estimasi_berat: gv('sf-berat'),
    alat_bantu_kerja: gv('sf-alat-bantu'),
    harga: Number(gv('sf-harga')) || 0,
    diskon_jenis: gv('sf-diskon-jenis'),
    diskon_nominal: Number(gv('sf-diskon-nominal')) || 0,
    harga_setelah_diskon: Number(gv('sf-harga-final')) || 0,
    status: gv('sf-status'),
    tgl_follow_up: gv('sf-followup') || null,
    layanan_tambahan_keterangan: gv('sf-layanan-tambahan-ket'),
  };

  let error;
  if (noSphExisting) {
    ({ error } = await supabaseClient.from('sph').update(payload).eq('no_sph', noSphExisting));
  } else {
    payload.no_sph = 'ANGKUTKU/SPH/' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    ({ error } = await supabaseClient.from('sph').insert(payload));
  }

  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('sph-modal').remove();
  renderSphModule(document.getElementById('content-area'));
};

window.sphDelete = async function(noSph) {
  if (!confirm('Hapus SPH ini?')) return;
  const { error } = await supabaseClient.from('sph').delete().eq('no_sph', noSph);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  renderSphModule(document.getElementById('content-area'));
};
