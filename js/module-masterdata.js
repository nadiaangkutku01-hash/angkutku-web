// ============================================================================
// MODULE-MASTERDATA.JS -- versi 2, dibangun ulang mendekati aslinya di GAS
// ============================================================================
// Fitur baru yang sekarang setara GAS:
// - Link WhatsApp otomatis di semua kolom No. HP/Telepon
// - Kolom "Jumlah Order" (Pelanggan, dihitung dari Invoice) & "Jumlah
//   Trip" (Armada/Mitra, dihitung dari Jadwal yang sudah Selesai)
// - Armada: nama Investor pemilik otomatis (JOIN), kontrak
// - Investor: kolom Jumlah Armada otomatis
// - Karyawan: kontrak otomatis terhitung dari Tgl Bergabung + Durasi
// - SINKRONISASI OTOMATIS Gaji Pokok Karyawan Tetap -> Pengeluaran Tetap
//   Bulanan (persis fitur "celah kebocoran arus kas" yang sudah kita
//   perbaiki di GAS -- supaya Finance gak perlu input manual & gak
//   pernah ada 2 angka beda untuk gaji yang sama)
// - Tab Supplier & Rekanan ditambahkan
//
// BELUM tercakup: tab "Pengguna (Login)" -- di sistem baru ini dikelola
// LANGSUNG lewat Supabase Authentication dashboard, bukan lagi lewat
// modul ini (auto-generate username/password gak relevan lagi karena
// Supabase Auth pakai email+password sendiri).
// ============================================================================

window.MASTERDATA_ACTIVE_TAB = window.MASTERDATA_ACTIVE_TAB || 'pelanggan';

window.renderMasterDataModule = function(area) {
  const tabs = [
    { key: 'pelanggan', label: 'Customer', icon: 'fa-address-book' },
    { key: 'karyawan', label: 'Karyawan', icon: 'fa-users-cog' },
    { key: 'armada', label: 'Armada', icon: 'fa-truck-moving' },
    { key: 'mitra', label: 'Mitra', icon: 'fa-handshake' },
    { key: 'investor', label: 'Investor', icon: 'fa-sack-dollar' },
    { key: 'supplier', label: 'Supplier', icon: 'fa-industry' },
    { key: 'rekanan', label: 'Rekanan', icon: 'fa-people-arrows' },
  ];

  area.innerHTML = '<div class="flex gap-2 mb-3 overflow-x-auto">' +
    tabs.map(function(t) {
      const active = window.MASTERDATA_ACTIVE_TAB === t.key;
      return '<button onclick="mdSwitchTab(\'' + t.key + '\')" class="shrink-0 px-3 py-2 rounded-lg text-xs font-bold ' + (active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500') + '"><i class="fas ' + t.icon + ' mr-1.5"></i>' + t.label + '</button>';
    }).join('') +
    '</div><div id="masterdata-tab-content"></div>';

  mdRenderActiveTab();
};

window.mdSwitchTab = function(key) {
  window.MASTERDATA_ACTIVE_TAB = key;
  renderMasterDataModule(document.getElementById('content-area'));
};

function mdRenderActiveTab() {
  const tabArea = document.getElementById('masterdata-tab-content');
  const map = {
    pelanggan: renderPelangganModule, karyawan: renderKaryawanModule, armada: renderArmadaModule,
    mitra: renderMitraModule, investor: renderInvestorModule, supplier: renderSupplierModule, rekanan: renderRekananModule,
  };
  const fn = map[window.MASTERDATA_ACTIVE_TAB];
  if (fn) fn(tabArea);
}

function mdWaLink(phone) {
  if (!phone) return '-';
  const cleaned = String(phone).replace(/[^0-9]/g, '');
  return '<a href="https://wa.me/' + cleaned + '" target="_blank" class="text-emerald-600 hover:underline font-semibold"><i class="fab fa-whatsapp mr-1"></i>' + phone + '</a>';
}

window.mdEnforcePhone62 = function(el) {
  let digits = el.value.replace(/[^0-9]/g, '');
  if (digits.substring(0, 2) !== '62') digits = digits.charAt(0) === '0' ? ('62' + digits.substring(1)) : ('62' + digits);
  el.value = digits;
};

// ============================================================================
// PELANGGAN
// ============================================================================
window.renderPelangganModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const canInput = window.CURRENT_USER_SESSION.role !== 'Investor';
  const pelangganRes = await supabaseClient.from('pelanggan').select('*').order('created_at', { ascending: false });
  const invoiceRes = await supabaseClient.from('invoice').select('nama_pelanggan');
  const rows = pelangganRes.data;
  const error = pelangganRes.error;
  const invoiceList = invoiceRes.data;
  if (error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + error.message + '</div>'; return; }

  const countOrder = function(nama) {
    if (!nama) return 0;
    const target = String(nama).trim().toLowerCase();
    return (invoiceList || []).filter(function(inv) { return String(inv.nama_pelanggan||'').trim().toLowerCase() === target; }).length;
  };

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-address-book mr-2 text-blue-500"></i>Master Data -- Pelanggan (' + rows.length + ')</h2>' +
    (canInput ? '<button onclick="pelangganOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button>' : '') +
    '</div><div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama Perusahaan</th><th>Jenis</th><th>Kontak</th><th>No Telepon</th><th>Kota</th><th>Jumlah Order</th><th>Dibuat Oleh</th>' + (canInput ? '<th class="text-center">Aksi</th>' : '') + '</tr></thead><tbody>' +
    rows.map(function(r) { return pelangganRowHtml(r, canInput, countOrder(r.nama_perusahaan)); }).join('') +
    '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function pelangganRowHtml(r, canInput, jumlahOrder) {
  return '<tr><td class="font-bold text-slate-700">' + (r.nama_perusahaan||'-') + '</td><td>' + (r.jenis_customer||'-') + '</td><td>' + (r.nama_kontak||'-') + '</td><td>' + mdWaLink(r.no_telepon) + '</td><td>' + (r.kota_domisili||'-') + '</td><td class="text-center font-bold">' + jumlahOrder + '</td><td class="text-slate-400">' + (r.dibuat_oleh||'-') + '</td>' +
    (canInput ? '<td class="text-center"><button onclick=\'pelangganOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="pelangganDelete(\'' + r.id_pelanggan + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td>' : '') + '</tr>';
}

window.pelangganOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f) { return existingRow ? existingRow[f] || '' : ''; };
  const html = '<div id="pelanggan-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Pelanggan</h3><div class="space-y-2.5">' +
    '<input id="f-nama-perusahaan" placeholder="Nama Perusahaan" value="' + v('nama_perusahaan') + '" class="erp-input">' +
    '<div><label class="erp-label">Jenis Customer</label><select id="f-jenis-customer" class="erp-input"><option value="Perorangan"' + (v('jenis_customer')==='Perorangan'?' selected':'') + '>Perorangan</option><option value="Perusahaan"' + (v('jenis_customer')==='Perusahaan'?' selected':'') + '>Perusahaan</option></select></div>' +
    '<input id="f-nama-kontak" placeholder="Nama Kontak" value="' + v('nama_kontak') + '" class="erp-input">' +
    '<input id="f-no-telepon" placeholder="No Telepon (awali 62)" oninput="mdEnforcePhone62(this)" value="' + v('no_telepon') + '" class="erp-input">' +
    '<input id="f-alamat" placeholder="Alamat" value="' + v('alamat') + '" class="erp-input">' +
    '<input id="f-kota" placeholder="Kota Domisili" value="' + v('kota_domisili') + '" class="erp-input">' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'pelanggan-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="pelangganSubmit(' + (isEdit ? "'" + existingRow.id_pelanggan + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.pelangganSubmit = async function(idPelanggan) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { nama_perusahaan: gv('f-nama-perusahaan'), jenis_customer: gv('f-jenis-customer'), nama_kontak: gv('f-nama-kontak'), no_telepon: gv('f-no-telepon'), alamat: gv('f-alamat'), kota_domisili: gv('f-kota') };
  let res;
  if (idPelanggan) res = await supabaseClient.from('pelanggan').update(payload).eq('id_pelanggan', idPelanggan);
  else { payload.id_pelanggan = 'PLG-' + Date.now(); payload.dibuat_oleh = window.CURRENT_USER_SESSION.name; res = await supabaseClient.from('pelanggan').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('pelanggan-modal').remove();
  mdRenderActiveTab();
};

window.pelangganDelete = async function(id) {
  if (!confirm('Hapus data ini?')) return;
  const res = await supabaseClient.from('pelanggan').delete().eq('id_pelanggan', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// KARYAWAN
// ============================================================================
window.renderKaryawanModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const res = await supabaseClient.from('karyawan').select('*').order('created_at', { ascending: false });
  if (res.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + res.error.message + '</div>'; return; }
  const rows = res.data;

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-users-cog mr-2 text-blue-500"></i>Master Data -- Karyawan (' + rows.length + ')</h2><button onclick="karyawanOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama</th><th>Jabatan</th><th>Sistem</th><th>No Telepon</th><th>Gaji Pokok</th><th>Kontrak (s/d)</th><th>Bank</th><th>Status</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(karyawanRowHtml).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function karyawanRowHtml(r) {
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  const badgeClass = r.status === 'Aktif' ? 'erp-badge-success' : 'erp-badge-neutral';
  return '<tr><td class="font-bold text-slate-700">' + (r.nama_karyawan||'-') + '</td><td>' + (r.jabatan||'-') + '</td><td>' + (r.jenis_karyawan||'-') + '</td><td>' + mdWaLink(r.no_telepon) + '</td>' +
    '<td class="font-mono">' + formatRp(r.gaji_pokok) + '</td><td class="font-mono text-slate-500">' + window.formatDateID(r.tgl_selesai_kontrak) + '</td>' +
    '<td>' + (r.nama_bank ? (r.nama_bank + ' - ' + (r.no_rekening||'-')) : '-') + '</td><td><span class="erp-badge ' + badgeClass + '">' + (r.status||'Aktif') + '</span></td>' +
    '<td class="text-center"><button onclick=\'karyawanOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="karyawanDelete(\'' + r.id_karyawan + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.karyawanOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f, d) { return existingRow ? (existingRow[f] || d || '') : (d || ''); };
  const jabatanList = ['Admin','Marketing','Finance','Supervisor','PIC Lapangan','PIC Gudang','Driver','Helper'];
  const jabatanOpts = jabatanList.map(function(j) { return '<option value="' + j + '"' + (v('jabatan')===j?' selected':'') + '>' + j + '</option>'; }).join('');
  let durasiAngka = '';
  if (existingRow && existingRow.durasi_kontrak) {
    const m = existingRow.durasi_kontrak.match(/\d+/);
    durasiAngka = m ? m[0] : '';
  }

  const html = '<div id="karyawan-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Karyawan</h3><div class="space-y-2.5">' +
    '<div><label class="erp-label">Nama</label><input id="kf-nama" value="' + v('nama_karyawan') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Jabatan</label><select id="kf-jabatan" class="erp-input">' + jabatanOpts + '</select></div>' +
    '<div><label class="erp-label">Sistem Perikatan</label><select id="kf-jenis" onchange="toggleKaryawanContractFields(this.value)" class="erp-input"><option value="Tetap"' + (v('jenis_karyawan')==='Tetap'?' selected':'') + '>Tetap</option><option value="Freelance"' + (v('jenis_karyawan')==='Freelance'?' selected':'') + '>Freelance</option></select></div>' +
    '<div><label class="erp-label">No Telepon</label><input id="kf-telepon" oninput="mdEnforcePhone62(this)" value="' + v('no_telepon') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">No KTP</label><input id="kf-ktp" value="' + v('no_ktp') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Alamat</label><input id="kf-alamat" value="' + v('alamat') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Tanggal Bergabung</label><input type="date" id="kf-tglmasuk" onchange="calculateKaryawanContractExpiry()" value="' + v('tanggal_masuk') + '" class="erp-input"></div>' +
    '<div id="karyawan-contract-container"><div><label class="erp-label">Durasi Kontrak (bulan)</label><input type="number" id="kf-durasi-bulan" onchange="calculateKaryawanContractExpiry()" value="' + durasiAngka + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Tgl Selesai Kontrak (otomatis)</label><input type="date" id="kf-tgl-selesai" value="' + v('tgl_selesai_kontrak') + '" class="erp-input" readonly style="background:#f1f5f9;"></div></div>' +
    '<div><label class="erp-label">Nama Bank</label><input id="kf-bank" value="' + v('nama_bank') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">No Rekening</label><input id="kf-rekening" value="' + v('no_rekening') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Gaji Pokok (khusus karyawan Tetap -- otomatis tersinkron ke Pengeluaran Tetap)</label><input type="number" id="kf-gaji" value="' + v('gaji_pokok', 0) + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Status</label><select id="kf-status" class="erp-input"><option value="Aktif"' + (v('status')==='Aktif'?' selected':'') + '>Aktif</option><option value="Nonaktif"' + (v('status')==='Nonaktif'?' selected':'') + '>Nonaktif</option></select></div>' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'karyawan-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="karyawanSubmit(' + (isEdit ? "'" + existingRow.id_karyawan + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  window.toggleKaryawanContractFields(v('jenis_karyawan') || 'Tetap');
};

window.toggleKaryawanContractFields = function(val) {
  const box = document.getElementById('karyawan-contract-container');
  if (!box) return;
  box.style.display = val === 'Tetap' ? '' : 'none';
};

window.calculateKaryawanContractExpiry = function() {
  const startVal = document.getElementById('kf-tglmasuk').value;
  const durVal = parseInt(document.getElementById('kf-durasi-bulan').value, 10);
  const endEl = document.getElementById('kf-tgl-selesai');
  if (!startVal || !durVal) { endEl.value = ''; return; }
  const d = new Date(startVal + 'T00:00:00');
  d.setMonth(d.getMonth() + durVal);
  endEl.value = d.toISOString().slice(0, 10);
};

window.karyawanSubmit = async function(idKaryawan) {
  const gv = function(id) { return document.getElementById(id).value; };
  const durBulan = gv('kf-durasi-bulan');
  const payload = {
    nama_karyawan: gv('kf-nama'), jabatan: gv('kf-jabatan'), jenis_karyawan: gv('kf-jenis'),
    no_telepon: gv('kf-telepon'), no_ktp: gv('kf-ktp'), alamat: gv('kf-alamat'),
    tanggal_masuk: gv('kf-tglmasuk') || null, durasi_kontrak: durBulan ? (durBulan + ' Bulan') : '',
    tgl_selesai_kontrak: gv('kf-tgl-selesai') || null,
    nama_bank: gv('kf-bank'), no_rekening: gv('kf-rekening'),
    gaji_pokok: Number(gv('kf-gaji')) || 0, status: gv('kf-status'),
  };

  let res;
  if (idKaryawan) res = await supabaseClient.from('karyawan').update(payload).eq('id_karyawan', idKaryawan);
  else { payload.id_karyawan = 'KRY-' + Date.now(); res = await supabaseClient.from('karyawan').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }

  await mdSyncGajiPokokKeTetap(Object.assign({ id_karyawan: idKaryawan || payload.id_karyawan }, payload));

  document.getElementById('karyawan-modal').remove();
  mdRenderActiveTab();
};

window.mdSyncGajiPokokKeTetap = async function(karyawanRow) {
  const existingRes = await supabaseClient.from('pengeluaran_tetap').select('*').eq('sumber_karyawan_id', karyawanRow.id_karyawan);
  const existing = (existingRes.data || [])[0];
  const isTetapDenganGaji = karyawanRow.jenis_karyawan === 'Tetap' && Number(karyawanRow.gaji_pokok) > 0;

  if (isTetapDenganGaji) {
    const namaItemBaru = 'Gaji Pokok ' + karyawanRow.nama_karyawan;
    if (existing) {
      const perluUpdate = existing.nominal !== Number(karyawanRow.gaji_pokok) || existing.nama_item !== namaItemBaru || existing.aktif !== 'Ya';
      if (perluUpdate) {
        await supabaseClient.from('pengeluaran_tetap').update({ nama_item: namaItemBaru, nominal: Number(karyawanRow.gaji_pokok), aktif: 'Ya' }).eq('id', existing.id);
      }
    } else {
      await supabaseClient.from('pengeluaran_tetap').insert({
        id: 'PGT-' + Date.now(), nama_item: namaItemBaru, kategori_tujuan: 'kerja',
        nominal: Number(karyawanRow.gaji_pokok), berlaku_sejak: karyawanRow.tanggal_masuk ? String(karyawanRow.tanggal_masuk).slice(0,7) : null,
        jalur_kas_default: 'Cash / Tunai', catatan: 'Otomatis dari Master Data Karyawan -- jangan diubah nominalnya di sini, edit lewat Master Data.',
        aktif: 'Ya', sumber_karyawan_id: karyawanRow.id_karyawan,
      });
    }
  } else if (existing && existing.aktif !== 'Tidak') {
    await supabaseClient.from('pengeluaran_tetap').update({ aktif: 'Tidak' }).eq('id', existing.id);
  }
};

window.karyawanDelete = async function(id) {
  if (!confirm('Hapus karyawan ini? Template Gaji Pokok terkait di Pengeluaran Tetap akan otomatis dinonaktifkan.')) return;
  await supabaseClient.from('pengeluaran_tetap').update({ aktif: 'Tidak' }).eq('sumber_karyawan_id', id);
  const res = await supabaseClient.from('karyawan').delete().eq('id_karyawan', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// ARMADA
// ============================================================================
window.renderArmadaModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const armadaRes = await supabaseClient.from('armada').select('*, investor:investor_id(nama)').order('created_at', { ascending: false });
  const jadwalRes = await supabaseClient.from('jadwal').select('armada_terpilih, status_selesai').eq('status_selesai', 'Selesai');
  if (armadaRes.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + armadaRes.error.message + '</div>'; return; }
  const rows = armadaRes.data;
  const jadwalList = jadwalRes.data;

  const countTrip = function(noPolisi) {
    if (!noPolisi) return 0;
    return (jadwalList || []).filter(function(j) { return j.armada_terpilih === noPolisi; }).length;
  };

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-truck-moving mr-2 text-blue-500"></i>Master Data -- Armada (' + rows.length + ')</h2><button onclick="armadaOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>No Polisi</th><th>Jenis</th><th>Merk</th><th>Tahun</th><th>Status Servis</th><th>Tgl Pajak</th><th>Investor Pemilik</th><th>Jumlah Trip</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(function(r) { return armadaRowHtml(r, countTrip(r.no_polisi)); }).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function armadaRowHtml(r, jumlahTrip) {
  const servisBadge = r.status_servis === 'Perlu Servis' ? 'erp-badge-danger' : 'erp-badge-success';
  return '<tr><td class="font-bold text-slate-700 font-mono">' + (r.no_polisi||'-') + '</td><td>' + (r.jenis_kendaraan||'-') + '</td><td>' + (r.merk||'-') + '</td><td>' + (r.tahun_kendaraan||'-') + '</td>' +
    '<td><span class="erp-badge ' + servisBadge + '">' + (r.status_servis||'Baik') + '</span></td><td class="font-mono text-slate-500">' + window.formatDateID(r.tgl_pajak) + '</td>' +
    '<td>' + ((r.investor && r.investor.nama) || '<span class="text-slate-300 italic">Milik Angkutku</span>') + '</td><td class="text-center font-bold">' + jumlahTrip + '</td>' +
    '<td class="text-center"><button onclick=\'armadaOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="armadaDelete(\'' + r.id_armada + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.armadaOpenForm = async function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f, d) { return existingRow ? (existingRow[f] || d || '') : (d || ''); };
  const invRes = await supabaseClient.from('investor').select('id_investor, nama');
  const investorOptions = '<option value="">-- Milik Angkutku --</option>' + (invRes.data||[]).map(function(inv) { return '<option value="' + inv.id_investor + '"' + (v('investor_id')===inv.id_investor?' selected':'') + '>' + inv.nama + '</option>'; }).join('');

  const html = '<div id="armada-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Armada</h3><div class="space-y-2.5">' +
    '<div><label class="erp-label">No Polisi</label><input id="af-plat" value="' + v('no_polisi') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Jenis Kendaraan</label><input id="af-jenis" value="' + v('jenis_kendaraan') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Merk</label><input id="af-merk" value="' + v('merk') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Tahun Kendaraan</label><input id="af-tahun" value="' + v('tahun_kendaraan') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Status Servis</label><select id="af-status-servis" class="erp-input"><option value="Baik"' + (v('status_servis')==='Baik'?' selected':'') + '>Baik</option><option value="Perlu Servis"' + (v('status_servis')==='Perlu Servis'?' selected':'') + '>Perlu Servis</option></select></div>' +
    '<div><label class="erp-label">Tanggal Pajak</label><input type="date" id="af-tglpajak" value="' + v('tgl_pajak') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Tanggal Servis Terakhir</label><input type="date" id="af-tglservis" value="' + v('tgl_servis') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Investor Pemilik</label><select id="af-investor" class="erp-input">' + investorOptions + '</select></div>' +
    '<div><label class="erp-label">Durasi Kontrak (kalau milik Investor)</label><input id="af-durasi" value="' + v('durasi_kontrak') + '" class="erp-input"></div>' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'armada-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="armadaSubmit(' + (isEdit ? "'" + existingRow.id_armada + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.armadaSubmit = async function(idArmada) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { no_polisi: gv('af-plat'), jenis_kendaraan: gv('af-jenis'), merk: gv('af-merk'), tahun_kendaraan: gv('af-tahun'), status_servis: gv('af-status-servis'), tgl_pajak: gv('af-tglpajak')||null, tgl_servis: gv('af-tglservis')||null, investor_id: gv('af-investor')||null, durasi_kontrak: gv('af-durasi') };
  let res;
  if (idArmada) res = await supabaseClient.from('armada').update(payload).eq('id_armada', idArmada);
  else { payload.id_armada = 'ARM-' + Date.now(); res = await supabaseClient.from('armada').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('armada-modal').remove();
  mdRenderActiveTab();
};

window.armadaDelete = async function(id) {
  if (!confirm('Hapus armada ini?')) return;
  const res = await supabaseClient.from('armada').delete().eq('id_armada', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// MITRA
// ============================================================================
window.renderMitraModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const mitraRes = await supabaseClient.from('mitra').select('*').order('created_at', { ascending: false });
  const jadwalRes = await supabaseClient.from('jadwal').select('armada_terpilih, status_selesai').eq('status_selesai', 'Selesai');
  if (mitraRes.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + mitraRes.error.message + '</div>'; return; }
  const rows = mitraRes.data;
  const jadwalList = jadwalRes.data;
  const countTrip = function(plat) { return (jadwalList||[]).filter(function(j){ return j.armada_terpilih === plat; }).length; };

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-handshake mr-2 text-blue-500"></i>Master Data -- Mitra (' + rows.length + ')</h2><button onclick="mitraOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama</th><th>No HP</th><th>Jenis Armada</th><th>Plat</th><th>Domisili</th><th>Jumlah Trip</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(function(r) { return mitraRowHtml(r, countTrip(r.plat_nomor)); }).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function mitraRowHtml(r, jumlahTrip) {
  return '<tr><td class="font-bold text-slate-700">' + (r.nama_driver||'-') + '</td><td>' + mdWaLink(r.no_hp_driver) + '</td><td>' + (r.jenis_armada||'-') + '</td><td class="font-mono">' + (r.plat_nomor||'-') + '</td><td>' + (r.domisili||'-') + '</td><td class="text-center font-bold">' + jumlahTrip + '</td>' +
    '<td class="text-center"><button onclick=\'mitraOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="mitraDelete(\'' + r.id_mitra + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.mitraOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f) { return existingRow ? existingRow[f] || '' : ''; };
  const html = '<div id="mitra-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Mitra</h3><div class="space-y-2.5">' +
    '<input id="mf-nama" placeholder="Nama Driver" value="' + v('nama_driver') + '" class="erp-input">' +
    '<input id="mf-hp" placeholder="No HP" oninput="mdEnforcePhone62(this)" value="' + v('no_hp_driver') + '" class="erp-input">' +
    '<input id="mf-jenis" placeholder="Jenis Armada" value="' + v('jenis_armada') + '" class="erp-input">' +
    '<input id="mf-plat" placeholder="Plat Nomor" value="' + v('plat_nomor') + '" class="erp-input">' +
    '<input id="mf-alamat" placeholder="Alamat" value="' + v('alamat') + '" class="erp-input">' +
    '<input id="mf-domisili" placeholder="Domisili" value="' + v('domisili') + '" class="erp-input">' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'mitra-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="mitraSubmit(' + (isEdit ? "'" + existingRow.id_mitra + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.mitraSubmit = async function(idMitra) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { nama_driver: gv('mf-nama'), no_hp_driver: gv('mf-hp'), jenis_armada: gv('mf-jenis'), plat_nomor: gv('mf-plat'), alamat: gv('mf-alamat'), domisili: gv('mf-domisili') };
  let res;
  if (idMitra) res = await supabaseClient.from('mitra').update(payload).eq('id_mitra', idMitra);
  else { payload.id_mitra = 'MTR-' + Date.now(); res = await supabaseClient.from('mitra').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('mitra-modal').remove();
  mdRenderActiveTab();
};

window.mitraDelete = async function(id) {
  if (!confirm('Hapus mitra ini?')) return;
  const res = await supabaseClient.from('mitra').delete().eq('id_mitra', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// INVESTOR
// ============================================================================
window.renderInvestorModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const invRes = await supabaseClient.from('investor').select('*');
  const armadaRes = await supabaseClient.from('armada').select('investor_id');
  if (invRes.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + invRes.error.message + '</div>'; return; }
  const rows = invRes.data;
  const armadaList = armadaRes.data;
  const countArmada = function(id) { return (armadaList||[]).filter(function(a){ return a.investor_id === id; }).length; };

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-sack-dollar mr-2 text-blue-500"></i>Master Data -- Investor (' + rows.length + ')</h2><button onclick="investorMdOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama</th><th>No HP</th><th>Bank</th><th>Modal</th><th>Jumlah Armada</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(function(r) { return investorMdRowHtml(r, countArmada(r.id_investor)); }).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function investorMdRowHtml(r, jumlahArmada) {
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  return '<tr><td class="font-bold text-slate-700">' + (r.nama||'-') + '</td><td>' + mdWaLink(r.no_hp) + '</td><td>' + (r.nama_bank ? (r.nama_bank + ' - ' + (r.no_rekening||'-')) : '-') + '</td><td class="font-mono">' + formatRp(r.modal) + '</td><td class="text-center font-bold">' + jumlahArmada + '</td>' +
    '<td class="text-center"><button onclick=\'investorMdOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="investorMdDelete(\'' + r.id_investor + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.investorMdOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f, d) { return existingRow ? (existingRow[f] || d || '') : (d || ''); };
  const html = '<div id="investor-md-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Investor</h3><div class="space-y-2.5">' +
    '<input id="imf-nama" placeholder="Nama" value="' + v('nama') + '" class="erp-input">' +
    '<input id="imf-hp" placeholder="No HP" oninput="mdEnforcePhone62(this)" value="' + v('no_hp') + '" class="erp-input">' +
    '<input id="imf-alamat" placeholder="Alamat" value="' + v('alamat') + '" class="erp-input">' +
    '<input id="imf-bank" placeholder="Nama Bank" value="' + v('nama_bank') + '" class="erp-input">' +
    '<input id="imf-rekening" placeholder="No Rekening" value="' + v('no_rekening') + '" class="erp-input">' +
    '<div><label class="erp-label">Modal</label><input type="number" id="imf-modal" value="' + v('modal', 0) + '" class="erp-input"></div>' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'investor-md-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="investorMdSubmit(' + (isEdit ? "'" + existingRow.id_investor + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.investorMdSubmit = async function(idInvestor) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { nama: gv('imf-nama'), no_hp: gv('imf-hp'), alamat: gv('imf-alamat'), nama_bank: gv('imf-bank'), no_rekening: gv('imf-rekening'), modal: Number(gv('imf-modal')) || 0 };
  let res;
  if (idInvestor) res = await supabaseClient.from('investor').update(payload).eq('id_investor', idInvestor);
  else { payload.id_investor = 'INV-' + Date.now(); res = await supabaseClient.from('investor').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('investor-md-modal').remove();
  mdRenderActiveTab();
};

window.investorMdDelete = async function(id) {
  if (!confirm('Hapus investor ini?')) return;
  const res = await supabaseClient.from('investor').delete().eq('id_investor', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// SUPPLIER
// ============================================================================
window.renderSupplierModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const res = await supabaseClient.from('supplier').select('*');
  if (res.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + res.error.message + '</div>'; return; }
  const rows = res.data;

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-industry mr-2 text-blue-500"></i>Master Data -- Supplier (' + rows.length + ')</h2><button onclick="supplierOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama Supplier</th><th>Alamat</th><th>No HP</th><th>Keterangan</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(supplierRowHtml).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function supplierRowHtml(r) {
  return '<tr><td class="font-bold text-slate-700">' + (r.nama_supplier||'-') + '</td><td>' + (r.alamat||'-') + '</td><td>' + mdWaLink(r.no_hp) + '</td><td>' + (r.keterangan||'-') + '</td>' +
    '<td class="text-center"><button onclick=\'supplierOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="supplierDelete(\'' + r.id_supplier + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.supplierOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f) { return existingRow ? existingRow[f] || '' : ''; };
  const html = '<div id="supplier-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Supplier</h3><div class="space-y-2.5">' +
    '<input id="spf-nama" placeholder="Nama Supplier" value="' + v('nama_supplier') + '" class="erp-input">' +
    '<input id="spf-alamat" placeholder="Alamat" value="' + v('alamat') + '" class="erp-input">' +
    '<input id="spf-hp" placeholder="No HP" oninput="mdEnforcePhone62(this)" value="' + v('no_hp') + '" class="erp-input">' +
    '<input id="spf-ket" placeholder="Keterangan" value="' + v('keterangan') + '" class="erp-input">' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'supplier-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="supplierSubmit(' + (isEdit ? "'" + existingRow.id_supplier + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.supplierSubmit = async function(idSupplier) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { nama_supplier: gv('spf-nama'), alamat: gv('spf-alamat'), no_hp: gv('spf-hp'), keterangan: gv('spf-ket') };
  let res;
  if (idSupplier) res = await supabaseClient.from('supplier').update(payload).eq('id_supplier', idSupplier);
  else { payload.id_supplier = 'SUP-' + Date.now(); res = await supabaseClient.from('supplier').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('supplier-modal').remove();
  mdRenderActiveTab();
};

window.supplierDelete = async function(id) {
  if (!confirm('Hapus supplier ini?')) return;
  const res = await supabaseClient.from('supplier').delete().eq('id_supplier', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// REKANAN
// ============================================================================
window.renderRekananModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';
  const res = await supabaseClient.from('rekanan').select('*');
  if (res.error) { area.innerHTML = '<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ' + res.error.message + '</div>'; return; }
  const rows = res.data;

  area.innerHTML = '<div class="erp-card"><div class="erp-card-header"><h2 class="erp-card-title"><i class="fas fa-people-arrows mr-2 text-blue-500"></i>Master Data -- Rekanan (' + rows.length + ')</h2><button onclick="rekananOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button></div>' +
    '<div class="overflow-x-auto"><table class="erp-table"><thead><tr><th>Nama Perusahaan</th><th>No HP</th><th>Alamat</th><th>Cakupan Area</th><th class="text-center">Aksi</th></tr></thead><tbody>' +
    rows.map(rekananRowHtml).join('') + '</tbody></table></div>' + (rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : '') + '</div>';
};

function rekananRowHtml(r) {
  return '<tr><td class="font-bold text-slate-700">' + (r.nama_perusahaan||'-') + '</td><td>' + mdWaLink(r.no_hp) + '</td><td>' + (r.alamat||'-') + '</td><td>' + (r.cakupan_area||'-') + '</td>' +
    '<td class="text-center"><button onclick=\'rekananOpenForm(' + JSON.stringify(r) + ')\' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button><button onclick="rekananDelete(\'' + r.id_rekanan + '\')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button></td></tr>';
}

window.rekananOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(f) { return existingRow ? existingRow[f] || '' : ''; };
  const html = '<div id="rekanan-modal" class="erp-modal-overlay"><div class="erp-modal-box"><h3 class="erp-card-title mb-4">' + (isEdit ? 'Edit' : 'Tambah') + ' Rekanan</h3><div class="space-y-2.5">' +
    '<input id="rkf-nama" placeholder="Nama Perusahaan" value="' + v('nama_perusahaan') + '" class="erp-input">' +
    '<input id="rkf-hp" placeholder="No HP" oninput="mdEnforcePhone62(this)" value="' + v('no_hp') + '" class="erp-input">' +
    '<input id="rkf-alamat" placeholder="Alamat" value="' + v('alamat') + '" class="erp-input">' +
    '<input id="rkf-cakupan" placeholder="Cakupan Area" value="' + v('cakupan_area') + '" class="erp-input">' +
    '<input id="rkf-ket" placeholder="Keterangan" value="' + v('keterangan') + '" class="erp-input">' +
    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'rekanan-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="rekananSubmit(' + (isEdit ? "'" + existingRow.id_rekanan + "'" : 'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
};

window.rekananSubmit = async function(idRekanan) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = { nama_perusahaan: gv('rkf-nama'), no_hp: gv('rkf-hp'), alamat: gv('rkf-alamat'), cakupan_area: gv('rkf-cakupan'), keterangan: gv('rkf-ket') };
  let res;
  if (idRekanan) res = await supabaseClient.from('rekanan').update(payload).eq('id_rekanan', idRekanan);
  else { payload.id_rekanan = 'REK-' + Date.now(); res = await supabaseClient.from('rekanan').insert(payload); }
  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('rekanan-modal').remove();
  mdRenderActiveTab();
};

window.rekananDelete = async function(id) {
  if (!confirm('Hapus rekanan ini?')) return;
  const res = await supabaseClient.from('rekanan').delete().eq('id_rekanan', id);
  if (res.error) { alert('Gagal hapus: ' + res.error.message); return; }
  mdRenderActiveTab();
};
