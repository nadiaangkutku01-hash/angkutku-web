// ============================================================================
// MODULE-MASTERDATA.JS -- Master Data dengan sistem tab
// ============================================================================
// Sesuai struktur asli GAS: Master Data itu SATU modul dengan beberapa
// sub-tab (Pelanggan, Karyawan, Armada, dst), bukan modul terpisah-pisah.
// File ini jadi "pengatur" tab, logika CRUD tiap tab tetap di file
// masing-masing (module-pelanggan.js dkk) -- gak perlu ditulis ulang.
// ============================================================================

window.MASTERDATA_ACTIVE_TAB = 'pelanggan';

window.renderMasterDataModule = function(area) {
  const tabs = [
    { key: 'pelanggan', label: 'Pelanggan', icon: 'fa-address-book' },
    { key: 'karyawan', label: 'Karyawan', icon: 'fa-users' },
    { key: 'armada', label: 'Armada', icon: 'fa-truck' },
  ];

  area.innerHTML = `
    <div class="flex gap-2 mb-3 overflow-x-auto">
      ${tabs.map(function(t) {
        const active = window.MASTERDATA_ACTIVE_TAB === t.key;
        return `<button onclick="mdSwitchTab('${t.key}')" class="shrink-0 px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}"><i class="fas ${t.icon} mr-1.5"></i>${t.label}</button>`;
      }).join('')}
    </div>
    <div id="masterdata-tab-content"></div>`;

  mdRenderActiveTab();
};

window.mdSwitchTab = function(key) {
  window.MASTERDATA_ACTIVE_TAB = key;
  renderMasterDataModule(document.getElementById('content-area'));
};

function mdRenderActiveTab() {
  const tabArea = document.getElementById('masterdata-tab-content');
  if (window.MASTERDATA_ACTIVE_TAB === 'pelanggan') renderPelangganModule(tabArea);
  else if (window.MASTERDATA_ACTIVE_TAB === 'karyawan') renderKaryawanModule(tabArea);
  else if (window.MASTERDATA_ACTIVE_TAB === 'armada') renderArmadaModule(tabArea);
}

// ============================================================================
// KARYAWAN
// ============================================================================
window.renderKaryawanModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const { data: rows, error } = await supabaseClient.from('karyawan').select('*').order('created_at', { ascending: false });
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-users mr-2 text-blue-500"></i>Master Data -- Karyawan (${rows.length})</h2>
        <button onclick="karyawanOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button>
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr><th>Nama</th><th>Jabatan</th><th>Jenis</th><th>No Telepon</th><th>Gaji Pokok</th><th>Saldo Tabungan</th><th>Status</th><th class="text-center">Aksi</th></tr></thead>
          <tbody>${rows.map(karyawanRowHtml).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : ''}
    </div>`;
};

function karyawanRowHtml(r) {
  const badgeClass = r.status === 'Aktif' ? 'erp-badge-success' : 'erp-badge-neutral';
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  return `<tr>
    <td class="font-bold text-slate-700">${r.nama_karyawan || '-'}</td>
    <td>${r.jabatan || '-'}</td>
    <td>${r.jenis_karyawan || '-'}</td>
    <td>${r.no_telepon || '-'}</td>
    <td class="font-mono">${formatRp(r.gaji_pokok)}</td>
    <td class="font-mono">${formatRp(r.saldo_tabungan)}</td>
    <td><span class="erp-badge ${badgeClass}">${r.status || 'Aktif'}</span></td>
    <td class="text-center">
      <button onclick='karyawanOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="karyawanDelete('${r.id_karyawan}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`;
}

window.karyawanOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const modalHtml = `
    <div id="karyawan-modal" class="erp-modal-overlay">
      <div class="erp-modal-box">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Tambah'} Karyawan</h3>
        <div class="space-y-2.5">
          <div><label class="erp-label">Nama</label><input id="kf-nama" value="${existingRow ? existingRow.nama_karyawan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Jabatan</label><input id="kf-jabatan" value="${existingRow ? existingRow.jabatan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Karyawan</label>
            <select id="kf-jenis" class="erp-input">
              <option value="Tetap" ${existingRow && existingRow.jenis_karyawan === 'Tetap' ? 'selected' : ''}>Tetap</option>
              <option value="Lepas" ${existingRow && existingRow.jenis_karyawan === 'Lepas' ? 'selected' : ''}>Lepas</option>
            </select>
          </div>
          <div><label class="erp-label">No Telepon</label><input id="kf-telepon" value="${existingRow ? existingRow.no_telepon || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">No KTP</label><input id="kf-ktp" value="${existingRow ? existingRow.no_ktp || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Alamat</label><input id="kf-alamat" value="${existingRow ? existingRow.alamat || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Tanggal Masuk</label><input type="date" id="kf-tglmasuk" value="${existingRow ? existingRow.tanggal_masuk || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Nama Bank</label><input id="kf-bank" value="${existingRow ? existingRow.nama_bank || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">No Rekening</label><input id="kf-rekening" value="${existingRow ? existingRow.no_rekening || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Gaji Pokok (khusus karyawan Tetap)</label><input type="number" id="kf-gaji" value="${existingRow ? existingRow.gaji_pokok || 0 : 0}" class="erp-input"></div>
          <div><label class="erp-label">Durasi Kontrak</label><input id="kf-durasi" placeholder="misal: 1 Tahun" value="${existingRow ? existingRow.durasi_kontrak || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Status</label>
            <select id="kf-status" class="erp-input">
              <option value="Aktif" ${existingRow && existingRow.status === 'Aktif' ? 'selected' : ''}>Aktif</option>
              <option value="Nonaktif" ${existingRow && existingRow.status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('karyawan-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="karyawanSubmit(${isEdit ? "'" + existingRow.id_karyawan + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.karyawanSubmit = async function(idKaryawan) {
  const payload = {
    nama_karyawan: document.getElementById('kf-nama').value,
    jabatan: document.getElementById('kf-jabatan').value,
    jenis_karyawan: document.getElementById('kf-jenis').value,
    no_telepon: document.getElementById('kf-telepon').value,
    no_ktp: document.getElementById('kf-ktp').value,
    alamat: document.getElementById('kf-alamat').value,
    tanggal_masuk: document.getElementById('kf-tglmasuk').value || null,
    nama_bank: document.getElementById('kf-bank').value,
    no_rekening: document.getElementById('kf-rekening').value,
    gaji_pokok: Number(document.getElementById('kf-gaji').value) || 0,
    durasi_kontrak: document.getElementById('kf-durasi').value,
    status: document.getElementById('kf-status').value,
  };
  let error;
  if (idKaryawan) {
    ({ error } = await supabaseClient.from('karyawan').update(payload).eq('id_karyawan', idKaryawan));
  } else {
    payload.id_karyawan = 'KRY-' + Date.now();
    ({ error } = await supabaseClient.from('karyawan').insert(payload));
  }
  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('karyawan-modal').remove();
  mdRenderActiveTab();
};

window.karyawanDelete = async function(idKaryawan) {
  if (!confirm('Hapus karyawan ini?')) return;
  const { error } = await supabaseClient.from('karyawan').delete().eq('id_karyawan', idKaryawan);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  mdRenderActiveTab();
};

// ============================================================================
// ARMADA
// ============================================================================
window.renderArmadaModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const { data: rows, error } = await supabaseClient.from('armada').select('*, investor:investor_id(nama)').order('created_at', { ascending: false });
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-truck mr-2 text-blue-500"></i>Master Data -- Armada (${rows.length})</h2>
        <button onclick="armadaOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Tambah</button>
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr><th>No Polisi</th><th>Jenis</th><th>Merk</th><th>Tahun</th><th>Status Servis</th><th>Tgl Pajak</th><th>Investor Pemilik</th><th class="text-center">Aksi</th></tr></thead>
          <tbody>${rows.map(armadaRowHtml).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada data.</div>' : ''}
    </div>`;
};

function armadaRowHtml(r) {
  const servisBadge = r.status_servis === 'Perlu Servis' ? 'erp-badge-danger' : 'erp-badge-success';
  return `<tr>
    <td class="font-bold text-slate-700 font-mono">${r.no_polisi || '-'}</td>
    <td>${r.jenis_kendaraan || '-'}</td>
    <td>${r.merk || '-'}</td>
    <td>${r.tahun_kendaraan || '-'}</td>
    <td><span class="erp-badge ${servisBadge}">${r.status_servis || 'Baik'}</span></td>
    <td class="font-mono text-slate-500">${r.tgl_pajak || '-'}</td>
    <td>${(r.investor && r.investor.nama) || '<span class="text-slate-300 italic">Milik Angkutku</span>'}</td>
    <td class="text-center">
      <button onclick='armadaOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="armadaDelete('${r.id_armada}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`;
}

window.armadaOpenForm = async function(existingRow) {
  const isEdit = !!existingRow;
  // Ambil daftar Investor buat dropdown pemilik
  const { data: investorList } = await supabaseClient.from('investor').select('id_investor, nama');
  const investorOptions = '<option value="">-- Milik Angkutku (bukan investor) --</option>' +
    (investorList || []).map(function(inv) {
      return `<option value="${inv.id_investor}" ${existingRow && existingRow.investor_id === inv.id_investor ? 'selected' : ''}>${inv.nama}</option>`;
    }).join('');

  const modalHtml = `
    <div id="armada-modal" class="erp-modal-overlay">
      <div class="erp-modal-box">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Tambah'} Armada</h3>
        <div class="space-y-2.5">
          <div><label class="erp-label">No Polisi</label><input id="af-plat" value="${existingRow ? existingRow.no_polisi || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Jenis Kendaraan</label><input id="af-jenis" value="${existingRow ? existingRow.jenis_kendaraan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Merk</label><input id="af-merk" value="${existingRow ? existingRow.merk || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Tahun Kendaraan</label><input id="af-tahun" value="${existingRow ? existingRow.tahun_kendaraan || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Status Servis</label>
            <select id="af-status-servis" class="erp-input">
              <option value="Baik" ${existingRow && existingRow.status_servis === 'Baik' ? 'selected' : ''}>Baik</option>
              <option value="Perlu Servis" ${existingRow && existingRow.status_servis === 'Perlu Servis' ? 'selected' : ''}>Perlu Servis</option>
            </select>
          </div>
          <div><label class="erp-label">Tanggal Pajak</label><input type="date" id="af-tglpajak" value="${existingRow ? existingRow.tgl_pajak || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Tanggal Servis Terakhir</label><input type="date" id="af-tglservis" value="${existingRow ? existingRow.tgl_servis || '' : ''}" class="erp-input"></div>
          <div><label class="erp-label">Investor Pemilik</label><select id="af-investor" class="erp-input">${investorOptions}</select></div>
          <div><label class="erp-label">Durasi Kontrak (kalau milik Investor)</label><input id="af-durasi" placeholder="misal: 2 Tahun" value="${existingRow ? existingRow.durasi_kontrak || '' : ''}" class="erp-input"></div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('armada-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="armadaSubmit(${isEdit ? "'" + existingRow.id_armada + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.armadaSubmit = async function(idArmada) {
  const payload = {
    no_polisi: document.getElementById('af-plat').value,
    jenis_kendaraan: document.getElementById('af-jenis').value,
    merk: document.getElementById('af-merk').value,
    tahun_kendaraan: document.getElementById('af-tahun').value,
    status_servis: document.getElementById('af-status-servis').value,
    tgl_pajak: document.getElementById('af-tglpajak').value || null,
    tgl_servis: document.getElementById('af-tglservis').value || null,
    investor_id: document.getElementById('af-investor').value || null,
    durasi_kontrak: document.getElementById('af-durasi').value,
  };
  let error;
  if (idArmada) {
    ({ error } = await supabaseClient.from('armada').update(payload).eq('id_armada', idArmada));
  } else {
    payload.id_armada = 'ARM-' + Date.now();
    ({ error } = await supabaseClient.from('armada').insert(payload));
  }
  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('armada-modal').remove();
  mdRenderActiveTab();
};

window.armadaDelete = async function(idArmada) {
  if (!confirm('Hapus armada ini?')) return;
  const { error } = await supabaseClient.from('armada').delete().eq('id_armada', idArmada);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  mdRenderActiveTab();
};
