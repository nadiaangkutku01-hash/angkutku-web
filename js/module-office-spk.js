// ============================================================================
// MODULE-OFFICE-SPK.JS -- versi 2, diperkaya + auto-fill lengkap dari SPH
// ============================================================================
// Cakupan yang SUDAH dibangun (setara GAS): kategori Pindahan/Kirim
// Barang/Lainnya, alamat multi-baris dengan Lantai+Akses per baris,
// Paket/Jenis Pindahan, checklist Layanan Tambahan, detail Barang
// Kiriman + Inap, sub-kategori Lainnya (dikunci, dibawa dari SPH),
// Kendaraan Tipe (Armada/Manual/Tanpa), auto-fill LENGKAP begitu pilih
// referensi SPH.
//
// SENGAJA DILEWATI (niche, disepakati di awal): sub-form Rekanan
// Ekspedisi (JNE/J&T dst), pemecahan nominal Angkutku vs Mitra,
// penugasan Layanan Tambahan per-item (siapa kerjakan apa).
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

window.spkToggleJenisType = function(jenis) {
  document.getElementById('of-f-jenis-spk-hidden').value = jenis;
  const isKirim = jenis === 'Kirim Barang';
  const isLainnya = jenis === 'Lainnya';
  ['pindahan','kirim','lainnya'].forEach(function(k) {
    const el = document.getElementById('spk-tab-' + k);
    const match = { pindahan: 'Pindahan', kirim: 'Kirim Barang', lainnya: 'Lainnya' }[k];
    const active = match === jenis;
    el.className = 'flex-1 py-2 rounded-lg text-[10px] uppercase font-black cursor-pointer ' + (active ? (k==='lainnya'?'bg-purple-600 text-white':'bg-blue-600 text-white') : 'bg-white text-slate-500 border border-slate-200');
  });
  document.getElementById('spk-section-pindahan').classList.toggle('hidden', isKirim || isLainnya);
  document.getElementById('spk-section-kirim').classList.toggle('hidden', !isKirim);
  document.getElementById('spk-section-lainnya').classList.toggle('hidden', !isLainnya);
  document.getElementById('spk-kendaraan-opsi-wrap').classList.toggle('hidden', !(isKirim || isLainnya));
};

window.spkAddAlamatPindahanRow = function(containerId, alamat, lantai, akses) {
  const area = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'p-2 border border-slate-200 rounded-md bg-white space-y-1 spk-alamat-pin-row';
  div.innerHTML = '<input placeholder="Alamat lengkap" value="' + (alamat||'') + '" class="erp-input i-alamat">' +
    '<div class="flex gap-1.5"><input placeholder="Lantai" value="' + (lantai||'') + '" class="erp-input flex-1 i-lantai"><input placeholder="Akses kendaraan" value="' + (akses||'') + '" class="erp-input flex-1 i-akses">' +
    '<button type="button" onclick="this.closest(\'.spk-alamat-pin-row\').remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button></div>';
  area.appendChild(div);
};
function spkReadAlamatPindahanRows(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' .spk-alamat-pin-row')).map(function(r) {
    return { alamat: r.querySelector('.i-alamat').value, lantai: r.querySelector('.i-lantai').value, akses: r.querySelector('.i-akses').value };
  }).filter(function(x) { return x.alamat; });
}

window.spkAddAlamatKirimRow = function(containerId, isAsal, alamat, nama) {
  const area = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'p-2 border border-slate-200 rounded-md bg-white space-y-1 spk-alamat-kirim-row';
  div.innerHTML = '<input placeholder="Alamat lengkap" value="' + (alamat||'') + '" class="erp-input i-alamat">' +
    '<div class="flex gap-1.5"><input placeholder="Nama ' + (isAsal?'Pengirim':'Penerima') + '" value="' + (nama||'') + '" class="erp-input flex-1 i-nama">' +
    '<button type="button" onclick="this.closest(\'.spk-alamat-kirim-row\').remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button></div>';
  area.appendChild(div);
};
function spkReadAlamatKirimRows(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' .spk-alamat-kirim-row')).map(function(r) {
    return { alamat: r.querySelector('.i-alamat').value, nama: r.querySelector('.i-nama').value };
  }).filter(function(x) { return x.alamat; });
}

window.spkAddBarangRow = function(jenis, jumlah, ket) {
  const area = document.getElementById('spk-barang-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center spk-barang-row';
  div.innerHTML = '<input placeholder="Jenis Barang" value="' + (jenis||'') + '" class="erp-input flex-1 i-jenis">' +
    '<input type="number" placeholder="Jumlah" value="' + (jumlah||1) + '" class="erp-input w-20 i-jumlah">' +
    '<input placeholder="Keterangan" value="' + (ket||'') + '" class="erp-input flex-1 i-ket">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.spkToggleInapBarang = function(checked) {
  document.getElementById('spk-inap-tanggal-area').classList.toggle('hidden', !checked);
};

window.spkToggleKendaraanTipe = function(val) {
  document.getElementById('spk-kendaraan-manual-input').classList.toggle('hidden', val !== 'manual');
};

window.spkOpenForm = async function(existingRow) {
  const isEdit = !!existingRow;
  const row = existingRow || {};
  const v = function(f, d) { return row[f] || d || ''; };
  const jenisSpk = row.jenis_spk_kategori || 'Pindahan';
  const isKirim = jenisSpk === 'Kirim Barang';
  const isLainnya = jenisSpk === 'Lainnya';

  const { data: sphList } = await supabaseClient.from('sph').select('*').eq('status', 'Deal');
  const { data: karyawanList } = await supabaseClient.from('karyawan').select('id_karyawan, nama_karyawan').eq('status', 'Aktif');
  const sphOptions = '<option value="">-- Tanpa Referensi SPH --</option>' + (sphList||[]).map(function(s) { return '<option value="' + s.no_sph + '"' + (row.no_sph===s.no_sph?' selected':'') + '>' + s.no_sph + ' - ' + s.customer + '</option>'; }).join('');

  const driverTerpilihArr = row.driver_terpilih ? JSON.parse(row.driver_terpilih) : [];
  const helperTerpilihArr = row.helper_terpilih ? JSON.parse(row.helper_terpilih) : [];
  const karyawanOptionsDriver = (karyawanList||[]).map(function(k) { return '<option value="'+k.id_karyawan+'"'+(driverTerpilihArr.indexOf(k.id_karyawan)!==-1?' selected':'')+'>'+k.nama_karyawan+'</option>'; }).join('');
  const karyawanOptionsHelper = (karyawanList||[]).map(function(k) { return '<option value="'+k.id_karyawan+'"'+(helperTerpilihArr.indexOf(k.id_karyawan)!==-1?' selected':'')+'>'+k.nama_karyawan+'</option>'; }).join('');

  const layananOpts = ['Jasa Packing Barang Besar Saja','Jasa Packing Barang Keseluruhan','Reposisi dan Penataan Barang Besar','Reposisi/Penataan Keseluruhan Barang','BP Furniture','BP AC','Cuci AC'];
  const checklist = (row.layanan_checklist || '').split('\n').filter(Boolean);

  const html = '<div id="spk-modal" class="erp-modal-overlay"><div class="erp-modal-box" style="max-width:680px;">' +
    '<h3 class="erp-card-title mb-4">' + (isEdit?'Edit':'Buat') + ' SPK</h3><div class="space-y-2.5">' +

    '<div><label class="erp-label">Referensi No SPH (Opsional)</label><select id="kf-no-sph" onchange="spkAutofillFromSph(this.value)" class="erp-input">' + sphOptions + '</select></div>' +
    '<div><label class="erp-label">Tanggal</label><input type="date" id="kf-tanggal" value="' + v('tanggal') + '" class="erp-input"></div>' +
    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Nama Pelanggan</label><input id="kf-nama" value="' + v('nama_pelanggan') + '" class="erp-input"></div><div><label class="erp-label">No HP</label><input id="kf-hp" value="' + v('no_hp') + '" class="erp-input"></div></div>' +
    '<div><label class="erp-label">Referensi Customer</label><input id="kf-referensi" value="' + v('referensi_customer') + '" class="erp-input"></div>' +

    '<div class="flex gap-2 bg-slate-100 p-1.5 rounded-xl">' +
    '<button type="button" id="spk-tab-pindahan" onclick="spkToggleJenisType(\'Pindahan\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (!isKirim&&!isLainnya?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">A. Pindahan</button>' +
    '<button type="button" id="spk-tab-kirim" onclick="spkToggleJenisType(\'Kirim Barang\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (isKirim?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">B. Kirim Barang</button>' +
    '<button type="button" id="spk-tab-lainnya" onclick="spkToggleJenisType(\'Lainnya\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (isLainnya?'bg-purple-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">C. Lainnya</button></div>' +
    '<input type="hidden" id="of-f-jenis-spk-hidden" value="' + jenisSpk + '">' +

    '<div id="spk-section-pindahan" class="space-y-2.5 ' + (isKirim||isLainnya?'hidden':'') + '">' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-emerald-600">Asal Bongkar:</span><button type="button" onclick="spkAddAlamatPindahanRow(\'spk-pin-asal-row-area\')" class="text-[9px] text-emerald-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-pin-asal-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-rose-600">Tujuan Bongkar:</span><button type="button" onclick="spkAddAlamatPindahanRow(\'spk-pin-tujuan-row-area\')" class="text-[9px] text-rose-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-pin-tujuan-row-area" class="space-y-1.5"></div></div>' +
    '</div>' +
    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Paket Pindahan</label><select id="kf-paket" class="erp-input">' + ['Ekonomis','Hemat','Premium'].map(function(o) { return '<option value="'+o+'"'+(v('paket_pindahan')===o?' selected':'')+'>'+o+'</option>'; }).join('') + '</select></div>' +
    '<div><label class="erp-label">Jenis Pindahan</label><input id="kf-jenis-pindahan" value="' + v('jenis_pindahan') + '" class="erp-input"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-blue-600">Jenis Layanan:</span><button type="button" onclick="ofAddSimpleRow(\'spk-layanan-row-area\',\'Jasa\')" class="text-[9px] text-blue-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-layanan-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><span class="erp-label text-purple-600">Centang Layanan Tambahan:</span><div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] mt-1">' +
    layananOpts.map(function(o) { return '<label class="flex items-center gap-1.5"><input type="checkbox" class="spk-layanan-check" value="'+o+'" '+(checklist.indexOf(o)!==-1?'checked':'')+'> '+o+'</label>'; }).join('') + '</div></div>' +
    '</div>' +

    '<div id="spk-section-kirim" class="space-y-2.5 ' + (isKirim?'':'hidden') + '">' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-emerald-600">Asal + Pengirim:</span><button type="button" onclick="spkAddAlamatKirimRow(\'spk-kirim-asal-row-area\', true)" class="text-[9px] text-emerald-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-kirim-asal-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-rose-600">Tujuan + Penerima:</span><button type="button" onclick="spkAddAlamatKirimRow(\'spk-kirim-tujuan-row-area\', false)" class="text-[9px] text-rose-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-kirim-tujuan-row-area" class="space-y-1.5"></div></div>' +
    '</div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-amber-600">Detail Barang:</span><button type="button" onclick="spkAddBarangRow()" class="text-[9px] text-amber-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="spk-barang-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><label class="flex items-center gap-1.5 text-[10px] uppercase"><input type="checkbox" id="spk-inap-check" onchange="spkToggleInapBarang(this.checked)" ' + (v('inap_barang')==='Ya'?'checked':'') + '> Barang Perlu Inap</label>' +
    '<div id="spk-inap-tanggal-area" class="grid grid-cols-2 gap-2 mt-2 ' + (v('inap_barang')==='Ya'?'':'hidden') + '"><div><label class="erp-label">Dari</label><input type="date" id="kf-inap-dari" value="' + v('tgl_inap_dari') + '" class="erp-input"></div><div><label class="erp-label">Sampai</label><input type="date" id="kf-inap-sampai" value="' + v('tgl_inap_sampai') + '" class="erp-input"></div></div></div>' +
    '</div>' +

    '<div id="spk-section-lainnya" class="space-y-2.5 ' + (isLainnya?'':'hidden') + '">' +
    '<div><label class="erp-label">Lokasi Pengerjaan</label><textarea id="spk-lokasi-lainnya" rows="2" class="erp-input">' + (isLainnya?v('alamat_asal'):'') + '</textarea></div>' +
    '<div><label class="erp-label">Sub-Kategori (dibawa dari SPH)</label><input id="spk-subkategori-lainnya-display" value="' + v('subkategori_lainnya') + '" readonly style="background:#f1f5f9;" class="erp-input"></div>' +
    '<div id="spk-lainnya-preview" class="border border-purple-200 bg-purple-50/40 p-2.5 rounded-lg text-[11px] text-slate-600">' + (v('detail_layanan')||'-') + '</div>' +
    '</div>' +

    '<div><label class="erp-label">Alat Bantu Kerja</label><input id="kf-alat-bantu" value="' + v('alat_bantu_kerja') + '" class="erp-input"></div>' +

    '<div id="spk-kendaraan-opsi-wrap" class="border border-purple-200 bg-purple-50/40 p-2.5 rounded-lg space-y-1.5 ' + (isKirim||isLainnya?'':'hidden') + '">' +
    '<label class="erp-label text-purple-700">Kebutuhan Kendaraan</label>' +
    '<select id="kf-kendaraan-tipe" onchange="spkToggleKendaraanTipe(this.value)" class="erp-input"><option value="armada"' + (v('kendaraan_tipe')==='armada'||!v('kendaraan_tipe')?' selected':'') + '>Pakai Armada</option><option value="manual"' + (v('kendaraan_tipe')==='manual'?' selected':'') + '>Kendaraan Lain</option><option value="tanpa"' + (v('kendaraan_tipe')==='tanpa'?' selected':'') + '>Tanpa Kendaraan</option></select>' +
    '<input id="spk-kendaraan-manual-input" placeholder="cth: Motor - L 1234 XY" value="' + v('kendaraan_manual') + '" class="erp-input ' + (v('kendaraan_tipe')==='manual'?'':'hidden') + '">' +
    '</div>' +

    '<div><label class="erp-label">Armada Terpilih (No Polisi)</label><input id="kf-armada" value="' + v('armada_terpilih') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Driver (bisa pilih lebih dari 1)</label><select id="kf-driver" class="erp-input" multiple style="height:80px;">' + karyawanOptionsDriver + '</select></div>' +
    '<div><label class="erp-label">Helper (bisa pilih lebih dari 1)</label><select id="kf-helper" class="erp-input" multiple style="height:80px;">' + karyawanOptionsHelper + '</select></div>' +

    '<div><label class="erp-label">Pengerjaan</label><select id="kf-pengerjaan" class="erp-input"><option value="Internal"' + (v('pengerjaan_tipe')==='Internal'||!v('pengerjaan_tipe')?' selected':'') + '>Internal</option><option value="Mitra"' + (v('pengerjaan_tipe')==='Mitra'?' selected':'') + '>Mitra</option><option value="Rekanan"' + (v('pengerjaan_tipe')==='Rekanan'?' selected':'') + '>Rekanan</option></select></div>' +
    '<div><label class="erp-label">Nominal Armada Angkutku</label><input type="number" id="kf-nominal-angkutku" value="' + v('nominal_armada_angkutku',0) + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Nominal Armada Mitra</label><input type="number" id="kf-nominal-mitra" value="' + v('nominal_armada_mitra',0) + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Nama Rekanan</label><input id="kf-rekanan" value="' + v('rekanan_nama') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Status</label><select id="kf-status" class="erp-input"><option value="Berjalan"' + (v('status')==='Berjalan'||!v('status')?' selected':'') + '>Berjalan</option><option value="Selesai"' + (v('status')==='Selesai'?' selected':'') + '>Selesai</option></select></div>' +
    '<div><label class="erp-label">Catatan</label><input id="kf-catatan" value="' + v('catatan') + '" class="erp-input"></div>' +

    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'spk-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="spkSubmit(' + (isEdit?"'"+existingRow.no_spk+"'":'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';

  document.body.insertAdjacentHTML('beforeend', html);

  if (!isKirim && !isLainnya) {
    const asalList = (row.alamat_asal||'').split('\n'), lantaiAsal = (row.lantai_asal||'').split('\n'), aksesAsal = (row.akses_asal||'').split('\n');
    asalList.forEach(function(a, i) { if (a) window.spkAddAlamatPindahanRow('spk-pin-asal-row-area', a, lantaiAsal[i], aksesAsal[i]); });
    if (!row.alamat_asal) window.spkAddAlamatPindahanRow('spk-pin-asal-row-area');
    const tujuanList = (row.alamat_tujuan||'').split('\n'), lantaiTujuan = (row.lantai_tujuan||'').split('\n'), aksesTujuan = (row.akses_tujuan||'').split('\n');
    tujuanList.forEach(function(a, i) { if (a) window.spkAddAlamatPindahanRow('spk-pin-tujuan-row-area', a, lantaiTujuan[i], aksesTujuan[i]); });
    if (!row.alamat_tujuan) window.spkAddAlamatPindahanRow('spk-pin-tujuan-row-area');
    (row.jenis_layanan||'').split('\n').filter(Boolean).forEach(function(t) { window.ofAddSimpleRow('spk-layanan-row-area', 'Jasa', t); });
    if (!row.jenis_layanan) window.ofAddSimpleRow('spk-layanan-row-area', 'Jasa');
  } else if (isKirim) {
    const asalList = (row.alamat_asal||'').split('\n'), pengirim = (row.nama_pengirim||'').split('\n');
    asalList.forEach(function(a, i) { if (a) window.spkAddAlamatKirimRow('spk-kirim-asal-row-area', true, a, pengirim[i]); });
    if (!row.alamat_asal) window.spkAddAlamatKirimRow('spk-kirim-asal-row-area', true);
    const tujuanList = (row.alamat_tujuan||'').split('\n'), penerima = (row.nama_penerima||'').split('\n');
    tujuanList.forEach(function(a, i) { if (a) window.spkAddAlamatKirimRow('spk-kirim-tujuan-row-area', false, a, penerima[i]); });
    if (!row.alamat_tujuan) window.spkAddAlamatKirimRow('spk-kirim-tujuan-row-area', false);
    const barangList = (row.jenis_barang||'').split('\n'), jumlahList = (row.jumlah_barang||'').split('\n'), ketList = (row.keterangan_barang||'').split('\n');
    barangList.forEach(function(b, i) { if (b) window.spkAddBarangRow(b, jumlahList[i], ketList[i]); });
    if (!row.jenis_barang) window.spkAddBarangRow();
  }
};

window.spkAutofillFromSph = async function(noSph) {
  if (!noSph) return;
  const { data: sph } = await supabaseClient.from('sph').select('*').eq('no_sph', noSph).single();
  if (!sph) return;

  document.getElementById('kf-nama').value = sph.customer || '';
  document.getElementById('kf-hp').value = sph.no_hp || '';
  document.getElementById('kf-referensi').value = sph.referensi_customer || '';
  document.getElementById('kf-alat-bantu').value = sph.alat_bantu_kerja || '';

  const isKirim = sph.jenis_sph === 'Kirim Barang';
  const isLainnya = sph.jenis_sph === 'Lainnya';
  window.spkToggleJenisType(isLainnya ? 'Lainnya' : (isKirim ? 'Kirim Barang' : 'Pindahan'));

  if (isLainnya) {
    document.getElementById('spk-lokasi-lainnya').value = sph.lokasi_asal || '';
    document.getElementById('spk-subkategori-lainnya-display').value = sph.subkategori_lainnya || '';
    document.getElementById('spk-lainnya-preview').textContent = sph.jenis_layanan || '-';
  } else if (isKirim) {
    document.getElementById('spk-kirim-asal-row-area').innerHTML = '';
    (sph.lokasi_asal||'').split('\n').filter(Boolean).forEach(function(a) { window.spkAddAlamatKirimRow('spk-kirim-asal-row-area', true, a, ''); });
    if (!sph.lokasi_asal) window.spkAddAlamatKirimRow('spk-kirim-asal-row-area', true);
    document.getElementById('spk-kirim-tujuan-row-area').innerHTML = '';
    (sph.lokasi_tujuan||'').split('\n').filter(Boolean).forEach(function(a) { window.spkAddAlamatKirimRow('spk-kirim-tujuan-row-area', false, a, ''); });
    if (!sph.lokasi_tujuan) window.spkAddAlamatKirimRow('spk-kirim-tujuan-row-area', false);
    document.getElementById('spk-barang-row-area').innerHTML = '';
    const barangList = (sph.jenis_barang||'').split('\n').filter(Boolean);
    const jumlahList = (sph.jumlah_barang||'').split('\n');
    if (barangList.length) barangList.forEach(function(b, i) { window.spkAddBarangRow(b, jumlahList[i], ''); });
    else window.spkAddBarangRow();
  } else {
    document.getElementById('spk-pin-asal-row-area').innerHTML = '';
    const asalList = (sph.lokasi_asal||'').split('\n'), lantaiAsal = (sph.lantai_asal||'').split('\n'), aksesAsal = (sph.akses_asal||'').split('\n');
    asalList.forEach(function(a, i) { if (a) window.spkAddAlamatPindahanRow('spk-pin-asal-row-area', a, lantaiAsal[i], aksesAsal[i]); });
    if (!document.querySelector('#spk-pin-asal-row-area .spk-alamat-pin-row')) window.spkAddAlamatPindahanRow('spk-pin-asal-row-area');

    document.getElementById('spk-pin-tujuan-row-area').innerHTML = '';
    const tujuanList = (sph.lokasi_tujuan||'').split('\n'), lantaiTujuan = (sph.lantai_tujuan||'').split('\n'), aksesTujuan = (sph.akses_tujuan||'').split('\n');
    tujuanList.forEach(function(a, i) { if (a) window.spkAddAlamatPindahanRow('spk-pin-tujuan-row-area', a, lantaiTujuan[i], aksesTujuan[i]); });
    if (!document.querySelector('#spk-pin-tujuan-row-area .spk-alamat-pin-row')) window.spkAddAlamatPindahanRow('spk-pin-tujuan-row-area');

    document.getElementById('kf-paket').value = sph.paket_pindahan || 'Ekonomis';
    document.getElementById('kf-jenis-pindahan').value = sph.jenis_pindahan || '';

    document.getElementById('spk-layanan-row-area').innerHTML = '';
    (sph.jenis_layanan||'').split('\n').filter(Boolean).forEach(function(t) { window.ofAddSimpleRow('spk-layanan-row-area', 'Jasa', t); });
    if (!sph.jenis_layanan) window.ofAddSimpleRow('spk-layanan-row-area', 'Jasa');

    const savedChecklist = (sph.layanan_checklist||'').split('\n').filter(Boolean);
    document.querySelectorAll('.spk-layanan-check').forEach(function(cb) { cb.checked = savedChecklist.indexOf(cb.value) !== -1; });
  }

  if (!String(sph.jenis_armada||'').trim() && (isKirim || isLainnya)) {
    document.getElementById('kf-kendaraan-tipe').value = 'tanpa';
  }
};

window.spkSubmit = async function(noSpkExisting) {
  const gv = function(id) { return document.getElementById(id).value; };
  const gvMulti = function(id) { return Array.from(document.getElementById(id).selectedOptions).map(function(o) { return o.value; }); };
  const jenisSpk = gv('of-f-jenis-spk-hidden');
  const isKirim = jenisSpk === 'Kirim Barang';
  const isLainnya = jenisSpk === 'Lainnya';

  let alamatAsal = '', alamatTujuan = '', lantaiAsal = '', lantaiTujuan = '', aksesAsal = '', aksesTujuan = '';
  let jenisBarang = '', jumlahBarang = '', ketBarang = '', namaPengirim = '', namaPenerima = '';

  if (isLainnya) {
    alamatAsal = gv('spk-lokasi-lainnya');
  } else if (isKirim) {
    const asalRows = spkReadAlamatKirimRows('spk-kirim-asal-row-area');
    const tujuanRows = spkReadAlamatKirimRows('spk-kirim-tujuan-row-area');
    alamatAsal = asalRows.map(function(r) { return r.alamat; }).join('\n');
    namaPengirim = asalRows.map(function(r) { return r.nama; }).join('\n');
    alamatTujuan = tujuanRows.map(function(r) { return r.alamat; }).join('\n');
    namaPenerima = tujuanRows.map(function(r) { return r.nama; }).join('\n');
    const barangRows = Array.from(document.querySelectorAll('.spk-barang-row'));
    jenisBarang = barangRows.map(function(r) { return r.querySelector('.i-jenis').value; }).join('\n');
    jumlahBarang = barangRows.map(function(r) { return r.querySelector('.i-jumlah').value; }).join('\n');
    ketBarang = barangRows.map(function(r) { return r.querySelector('.i-ket').value; }).join('\n');
  } else {
    const asalRows = spkReadAlamatPindahanRows('spk-pin-asal-row-area');
    const tujuanRows = spkReadAlamatPindahanRows('spk-pin-tujuan-row-area');
    alamatAsal = asalRows.map(function(r) { return r.alamat; }).join('\n');
    lantaiAsal = asalRows.map(function(r) { return r.lantai; }).join('\n');
    aksesAsal = asalRows.map(function(r) { return r.akses; }).join('\n');
    alamatTujuan = tujuanRows.map(function(r) { return r.alamat; }).join('\n');
    lantaiTujuan = tujuanRows.map(function(r) { return r.lantai; }).join('\n');
    aksesTujuan = tujuanRows.map(function(r) { return r.akses; }).join('\n');
  }

  const jenisLayanan = isLainnya ? '' : ofReadSimpleRows('spk-layanan-row-area').join('\n');
  const checklist = Array.from(document.querySelectorAll('.spk-layanan-check:checked')).map(function(cb) { return cb.value; }).join('\n');

  const payload = {
    no_sph: gv('kf-no-sph') || null,
    tanggal: gv('kf-tanggal'),
    nama_pelanggan: gv('kf-nama'),
    no_hp: gv('kf-hp'),
    referensi_customer: gv('kf-referensi'),
    jenis_spk_kategori: jenisSpk,
    alamat_asal: alamatAsal, alamat_tujuan: alamatTujuan,
    lantai_asal: lantaiAsal, lantai_tujuan: lantaiTujuan,
    akses_asal: aksesAsal, akses_tujuan: aksesTujuan,
    paket_pindahan: isKirim||isLainnya ? '' : gv('kf-paket'),
    jenis_pindahan: isKirim||isLainnya ? '' : gv('kf-jenis-pindahan'),
    jenis_layanan: jenisLayanan,
    layanan_checklist: checklist,
    jenis_barang: jenisBarang, jumlah_barang: jumlahBarang, keterangan_barang: ketBarang,
    nama_pengirim: namaPengirim, nama_penerima: namaPenerima,
    inap_barang: document.getElementById('spk-inap-check') && document.getElementById('spk-inap-check').checked ? 'Ya' : 'Tidak',
    tgl_inap_dari: gv('kf-inap-dari') || null, tgl_inap_sampai: gv('kf-inap-sampai') || null,
    subkategori_lainnya: isLainnya ? gv('spk-subkategori-lainnya-display') : '',
    alat_bantu_kerja: gv('kf-alat-bantu'),
    kendaraan_tipe: (isKirim||isLainnya) ? gv('kf-kendaraan-tipe') : 'armada',
    kendaraan_manual: gv('spk-kendaraan-manual-input') || '',
    armada_terpilih: gv('kf-armada'),
    driver_terpilih: JSON.stringify(gvMulti('kf-driver')),
    helper_terpilih: JSON.stringify(gvMulti('kf-helper')),
    pengerjaan_tipe: gv('kf-pengerjaan'),
    nominal_armada_angkutku: Number(gv('kf-nominal-angkutku')) || 0,
    nominal_armada_mitra: Number(gv('kf-nominal-mitra')) || 0,
    rekanan_nama: gv('kf-rekanan'),
    status: gv('kf-status'),
    catatan: gv('kf-catatan'),
  };

  let res;
  if (noSpkExisting) {
    res = await supabaseClient.from('spk').update(payload).eq('no_spk', noSpkExisting);
  } else {
    payload.no_spk = 'ANGKUTKU-SPK-' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    res = await supabaseClient.from('spk').insert(payload);
  }

  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('spk-modal').remove();
  ofRenderActiveTab();
};

window.spkDelete = async function(noSpk) {
  if (!confirm('Hapus SPK ini?')) return;
  const { error } = await supabaseClient.from('spk').delete().eq('no_spk', noSpk);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  ofRenderActiveTab();
};
