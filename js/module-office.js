// ============================================================================
// MODULE-OFFICE.JS -- Office dengan sistem tab (SPH, SPK, dst)
// ============================================================================
window.OFFICE_ACTIVE_TAB = 'sph';

window.renderOfficeModule = function(area) {
  const tabs = [
    { key: 'sph', label: 'SPH', icon: 'fa-file-invoice' },
    { key: 'spk', label: 'SPK', icon: 'fa-clipboard-list' },
    { key: 'invoice', label: 'Invoice', icon: 'fa-receipt' },
  ];

  area.innerHTML = `
    <div class="flex gap-2 mb-3 overflow-x-auto">
      ${tabs.map(function(t) {
        const active = window.OFFICE_ACTIVE_TAB === t.key;
        return `<button onclick="ofSwitchTab('${t.key}')" class="shrink-0 px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}"><i class="fas ${t.icon} mr-1.5"></i>${t.label}</button>`;
      }).join('')}
    </div>
    <div id="office-tab-content"></div>`;

  ofRenderActiveTab();
};

window.ofSwitchTab = function(key) {
  window.OFFICE_ACTIVE_TAB = key;
  renderOfficeModule(document.getElementById('content-area'));
};

function ofRenderActiveTab() {
  const tabArea = document.getElementById('office-tab-content');
  if (window.OFFICE_ACTIVE_TAB === 'sph') renderSphModule(tabArea);
  else if (window.OFFICE_ACTIVE_TAB === 'spk') renderSpkModule(tabArea);
  else if (window.OFFICE_ACTIVE_TAB === 'invoice') renderInvoiceModule(tabArea);
}

// ============================================================================
// SPH (Surat Penawaran Harga)
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


// ============================================================================
// UTILITAS BARIS DINAMIS UNTUK SPH -- dipakai juga di modul lain (SPK)
// ============================================================================
window.ofAddSimpleRow = function(containerId, placeholder, value) {
  const area = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center simple-row';
  div.innerHTML = '<input placeholder="' + (placeholder||'') + '" value="' + (value||'') + '" class="erp-input flex-1 i-val">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};
function ofReadSimpleRows(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' .i-val')).map(function(el) { return el.value; }).filter(Boolean);
}

window.sphToggleJenisType = function(jenis) {
  document.getElementById('of-f-jenis-sph-hidden').value = jenis;
  const isKirim = jenis === 'Kirim Barang';
  const isLainnya = jenis === 'Lainnya';
  ['pindahan','kirim','lainnya'].forEach(function(k) {
    const el = document.getElementById('sph-tab-' + k);
    const match = { pindahan: 'Pindahan', kirim: 'Kirim Barang', lainnya: 'Lainnya' }[k];
    const active = match === jenis;
    el.className = 'flex-1 py-2 rounded-lg text-[10px] uppercase font-black cursor-pointer ' + (active ? (k==='lainnya'?'bg-purple-600 text-white':'bg-blue-600 text-white') : 'bg-white text-slate-500 border border-slate-200');
  });
  document.getElementById('sph-section-route-armada').classList.toggle('hidden', isLainnya);
  document.getElementById('sph-section-pindahan').classList.toggle('hidden', isKirim || isLainnya);
  document.getElementById('sph-section-kirim').classList.toggle('hidden', !isKirim);
  document.getElementById('sph-section-lainnya').classList.toggle('hidden', !isLainnya);
  if (isLainnya) window.sphToggleSubkategoriLainnya(document.getElementById('sph-subkategori-lainnya').value);
};

window.sphToggleButuhArmada = function(val) {
  const wrap = document.getElementById('sph-armada-section-wrap');
  const note = document.getElementById('sph-armada-tanpa-note');
  document.getElementById('sph-armada-toggle-ya').className = 'px-2.5 py-1 rounded text-[9px] font-black uppercase border ' + (val==='ya'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-500 border-slate-200');
  document.getElementById('sph-armada-toggle-tidak').className = 'px-2.5 py-1 rounded text-[9px] font-black uppercase border ' + (val==='tidak'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-500 border-slate-200');
  wrap.classList.toggle('hidden', val==='tidak');
  note.classList.toggle('hidden', val!=='tidak');
  if (val === 'tidak') document.getElementById('sph-armada-row-area').innerHTML = '';
};

window.sphAddArmadaRow = function(jenis, jumlah) {
  const area = document.getElementById('sph-armada-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-armada-row';
  div.innerHTML = '<input placeholder="Jenis Armada" value="' + (jenis||'') + '" class="erp-input flex-1 i-jenis">' +
    '<input type="number" placeholder="Jumlah Unit" value="' + (jumlah||1) + '" class="erp-input w-24 i-jumlah">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.sphAddBarangRow = function(jenis, jumlah, berat) {
  const area = document.getElementById('sph-barang-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-barang-row';
  div.innerHTML = '<input placeholder="Jenis Barang" value="' + (jenis||'') + '" class="erp-input flex-1 i-jenis">' +
    '<input type="number" placeholder="Jumlah" value="' + (jumlah||1) + '" class="erp-input w-20 i-jumlah">' +
    '<input placeholder="Estimasi Berat" value="' + (berat||'') + '" class="erp-input w-28 i-berat">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.sphToggleInapBarang = function(checked) {
  document.getElementById('sph-inap-tanggal-area').classList.toggle('hidden', !checked);
};

window.sphAddDiskonRow = function(jenis, nominal) {
  const area = document.getElementById('sph-diskon-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-diskon-row';
  div.innerHTML = '<select class="erp-input flex-1 i-jenis-diskon"><option value="Nominal"' + (jenis==='Nominal'?' selected':'') + '>Nominal (Rp)</option><option value="Persen"' + (jenis==='Persen'?' selected':'') + '>Persen (%)</option></select>' +
    '<input type="number" placeholder="Nominal Diskon" value="' + (nominal||0) + '" class="erp-input flex-1 i-nominal-diskon">' +
    '<button type="button" onclick="this.parentElement.remove(); sphCalculateHargaAkhir();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.sphAddRabRow = function(komponen, jumlah, nominal) {
  const area = document.getElementById('sph-rab-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-rab-row';
  div.innerHTML = '<input placeholder="Komponen" value="' + (komponen||'') + '" class="erp-input" style="width:30%;" onchange="sphRecalcRabTotal()">' +
    '<input type="number" placeholder="Jumlah" value="' + (jumlah||1) + '" class="erp-input" style="width:14%;" oninput="sphRecalcRabTotal()">' +
    '<input type="number" placeholder="Nominal/Unit" value="' + (nominal||0) + '" class="erp-input" style="width:26%;" oninput="sphRecalcRabTotal()">' +
    '<button type="button" onclick="this.parentElement.remove(); sphRecalcRabTotal();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
  window.sphRecalcRabTotal();
};

window.sphRecalcRabTotal = function() {
  let total = 0;
  document.querySelectorAll('.sph-rab-row').forEach(function(r) {
    const inputs = r.querySelectorAll('input[type="number"]');
    total += (Number(inputs[0].value)||0) * (Number(inputs[1].value)||0);
  });
  document.getElementById('sph-rab-total-display').textContent = 'Rp ' + total.toLocaleString('id-ID');
  const hargaField = document.getElementById('of-f-Harga');
  if (document.querySelectorAll('.sph-rab-row').length > 0) {
    hargaField.value = total;
    hargaField.readOnly = true;
    hargaField.style.background = '#f1f5f9';
  } else {
    hargaField.readOnly = false;
    hargaField.style.background = '';
  }
  window.sphCalculateHargaAkhir();
};

window.sphClearRab = function() {
  document.getElementById('sph-rab-row-area').innerHTML = '';
  window.sphRecalcRabTotal();
};

window.sphCalculateHargaAkhir = function() {
  const harga = Number(document.getElementById('of-f-Harga').value) || 0;
  let totalDiskon = 0;
  document.querySelectorAll('.sph-diskon-row').forEach(function(r) {
    const jenis = r.querySelector('.i-jenis-diskon').value;
    const nominal = Number(r.querySelector('.i-nominal-diskon').value) || 0;
    totalDiskon += jenis === 'Persen' ? (harga * nominal / 100) : nominal;
  });
  document.getElementById('of-f-Harga_Setelah_Diskon').value = Math.max(0, harga - totalDiskon);
};

// Sub-kategori Lainnya (Cleaning/Packing/AC/Manual) -- pola SAMA PERSIS
// dengan yang sudah dibangun di module-jadwal.js, cuma prefix ID beda
// ("sph-" bukan "jd-").
window.sphToggleSubkategoriLainnya = function(value) {
  ['cleaning','packing','ac','manual'].forEach(function(k) { document.getElementById('sph-sub-' + k).classList.add('hidden'); });
  if (value === 'Cleaning Service') document.getElementById('sph-sub-cleaning').classList.remove('hidden');
  else if (value === 'Packing Standar' || value === 'Packing Kayu') {
    document.getElementById('sph-sub-packing').classList.remove('hidden');
    document.getElementById('sph-packing-title').textContent = 'Rincian Barang ' + value + ':';
    document.getElementById('sph-packing-kayu-addon').classList.toggle('hidden', value !== 'Packing Kayu');
    if (!document.querySelector('#sph-packing-row-area .sph-packing-row')) window.sphAddPackingRow();
  } else if (value === 'Bongkar Pasang AC') {
    document.getElementById('sph-sub-ac').classList.remove('hidden');
    if (!document.querySelector('#sph-ac-row-area .sph-ac-row')) window.sphAddAcRow();
  } else {
    document.getElementById('sph-sub-manual').classList.remove('hidden');
  }
};
window.sphAddPackingRow = function(nama, dimensi, qty) {
  const area = document.getElementById('sph-packing-row-area');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-packing-row';
  div.innerHTML = '<input placeholder="Nama Barang" value="' + (nama||'') + '" class="erp-input flex-[2] i-nama">' +
    '<input placeholder="Dimensi PxLxT cm" value="' + (dimensi||'') + '" class="erp-input flex-1 i-dimensi">' +
    '<input type="number" placeholder="Qty" value="' + (qty||1) + '" class="erp-input w-16 i-qty">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};
window.sphAddAcRow = function(jenisAc, pk, jenisKerja, qty) {
  const area = document.getElementById('sph-ac-row-area');
  const pkOpts = ['0.5 PK','1 PK','1.5 PK','2 PK','2.5 PK','Lainnya'].map(function(o) { return '<option value="'+o+'"'+(pk===o?' selected':'')+'>'+o+'</option>'; }).join('');
  const kerjaOpts = ['Bongkar','Pasang','Bongkar+Pasang','Cuci'].map(function(o) { return '<option value="'+o+'"'+(jenisKerja===o?' selected':'')+'>'+o+'</option>'; }).join('');
  const div = document.createElement('div');
  div.className = 'flex gap-1.5 items-center sph-ac-row';
  div.innerHTML = '<input placeholder="Jenis Unit" value="' + (jenisAc||'') + '" class="erp-input flex-[2] i-jenis-ac">' +
    '<select class="erp-input flex-1 i-pk">' + pkOpts + '</select><select class="erp-input flex-1 i-jenis-kerja">' + kerjaOpts + '</select>' +
    '<input type="number" placeholder="Qty" value="' + (qty||1) + '" class="erp-input w-14 i-qty">' +
    '<button type="button" onclick="this.parentElement.remove();" class="text-rose-500 text-lg"><i class="fas fa-minus-circle"></i></button>';
  area.appendChild(div);
};

window.sphToggleLayananLainnya = function(checked) {
  document.getElementById('sph-layanan-lainnya-manual').classList.toggle('hidden', !checked);
};

window.sphOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const row = existingRow || {};
  const v = function(f, d) { return row[f] || d || ''; };
  const jenisSph = row.jenis_sph || 'Pindahan';
  const isKirim = jenisSph === 'Kirim Barang';
  const isLainnya = jenisSph === 'Lainnya';
  const checklist = (row.layanan_checklist || '').split('\n').filter(Boolean);
  const layananOpts = ['Jasa Packing Barang Besar Saja','Jasa Packing Barang Keseluruhan','Reposisi dan Penataan Barang Besar','Reposisi/Penataan Keseluruhan Barang','BP Furniture','BP AC','Cuci AC'];
  const subkatOpts = ['Cleaning Service','Packing Standar','Packing Kayu','Bongkar Pasang AC','Lainnya'];

  const html = '<div id="sph-modal" class="erp-modal-overlay"><div class="erp-modal-box" style="max-width:680px;">' +
    '<h3 class="erp-card-title mb-4">' + (isEdit?'Edit':'Buat') + ' SPH</h3><div class="space-y-2.5">' +

    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Nama Customer</label><input id="sf-customer" value="' + v('customer') + '" class="erp-input"></div><div><label class="erp-label">No HP</label><input id="sf-hp" value="' + v('no_hp') + '" class="erp-input"></div></div>' +
    '<div><label class="erp-label">Referensi Customer</label><input id="sf-referensi" value="' + v('referensi_customer') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Tanggal SPH</label><input type="date" id="sf-tanggal" value="' + v('tanggal') + '" class="erp-input"></div>' +

    '<div class="flex gap-2 bg-slate-100 p-1.5 rounded-xl">' +
    '<button type="button" id="sph-tab-pindahan" onclick="sphToggleJenisType(\'Pindahan\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (jenisSph==='Pindahan'?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">A. Pindahan</button>' +
    '<button type="button" id="sph-tab-kirim" onclick="sphToggleJenisType(\'Kirim Barang\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (isKirim?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">B. Kirim Barang</button>' +
    '<button type="button" id="sph-tab-lainnya" onclick="sphToggleJenisType(\'Lainnya\')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black ' + (isLainnya?'bg-purple-600 text-white':'bg-white text-slate-500 border border-slate-200') + '">C. Lainnya</button></div>' +
    '<input type="hidden" id="of-f-jenis-sph-hidden" value="' + jenisSph + '">' +

    // Alamat + armada (Pindahan & Kirim)
    '<div id="sph-section-route-armada" class="space-y-2 ' + (isLainnya?'hidden':'') + '">' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-emerald-600">Alamat Asal:</span><button type="button" onclick="ofAddSimpleRow(\'sph-alamat-asal-row-area\',\'Alamat asal\')" class="text-[9px] text-emerald-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-alamat-asal-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-rose-600">Alamat Tujuan:</span><button type="button" onclick="ofAddSimpleRow(\'sph-alamat-tujuan-row-area\',\'Alamat tujuan\')" class="text-[9px] text-rose-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-alamat-tujuan-row-area" class="space-y-1.5"></div></div>' +
    '</div>' +
    '<div><label class="erp-label">Jumlah Crew Helper</label><input type="number" id="sf-jml-helper" value="' + v('jumlah_helper',2) + '" class="erp-input"></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50">' +
    '<div class="flex justify-between items-center mb-1"><span class="erp-label text-indigo-600">Kebutuhan Armada:</span><div class="flex gap-1"><button type="button" id="sph-armada-toggle-ya" onclick="sphToggleButuhArmada(\'ya\')" class="px-2.5 py-1 rounded text-[9px] font-black uppercase border">Dengan Armada</button><button type="button" id="sph-armada-toggle-tidak" onclick="sphToggleButuhArmada(\'tidak\')" class="px-2.5 py-1 rounded text-[9px] font-black uppercase border">Tanpa Armada</button></div></div>' +
    '<div id="sph-armada-section-wrap"><div class="flex justify-between items-center mb-1"><span class="erp-label text-indigo-600">Armada Ditawarkan:</span><button type="button" onclick="sphAddArmadaRow()" class="text-[9px] text-indigo-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-armada-row-area" class="space-y-1.5"></div></div>' +
    '<p id="sph-armada-tanpa-note" class="text-[9px] text-slate-400 italic hidden">Cukup Kru tanpa armada.</p></div></div>' +

    // Section Pindahan
    '<div id="sph-section-pindahan" class="space-y-2.5 ' + (isKirim||isLainnya?'hidden':'') + '">' +
    '<div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Paket Pindahan</label><select id="sf-paket" class="erp-input">' + ['Ekonomis','Hemat','Premium'].map(function(o) { return '<option value="'+o+'"'+(v('paket_pindahan')===o?' selected':'')+'>'+o+'</option>'; }).join('') + '</select></div>' +
    '<div><label class="erp-label">Jenis Pindahan</label><input id="sf-jenis-pindahan" value="' + v('jenis_pindahan') + '" class="erp-input"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-blue-600">Rincian Jasa Utama:</span><button type="button" onclick="ofAddSimpleRow(\'sph-layanan-row-area\',\'Jasa\')" class="text-[9px] text-blue-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-layanan-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><span class="erp-label text-purple-600">Centang Layanan Tambahan:</span><div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] mt-1">' +
    layananOpts.map(function(o) { return '<label class="flex items-center gap-1.5"><input type="checkbox" class="sph-layanan-check" value="'+o+'" '+(checklist.indexOf(o)!==-1?'checked':'')+'> '+o+'</label>'; }).join('') + '</div></div>' +
    '</div>' +

    // Section Kirim Barang
    '<div id="sph-section-kirim" class="space-y-2.5 ' + (isKirim?'':'hidden') + '">' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-amber-600">Detail Barang:</span><button type="button" onclick="sphAddBarangRow()" class="text-[9px] text-amber-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-barang-row-area" class="space-y-1.5"></div></div>' +
    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><label class="flex items-center gap-1.5 text-[10px] uppercase"><input type="checkbox" id="sph-inap-check" onchange="sphToggleInapBarang(this.checked)" ' + (v('inap_barang')==='Ya'?'checked':'') + '> Barang Perlu Inap</label>' +
    '<div id="sph-inap-tanggal-area" class="grid grid-cols-2 gap-2 mt-2 ' + (v('inap_barang')==='Ya'?'':'hidden') + '"><div><label class="erp-label">Dari</label><input type="date" id="sf-inap-dari" value="' + v('tgl_inap_dari') + '" class="erp-input"></div><div><label class="erp-label">Sampai</label><input type="date" id="sf-inap-sampai" value="' + v('tgl_inap_sampai') + '" class="erp-input"></div></div></div>' +
    '</div>' +

    // Section Lainnya
    '<div id="sph-section-lainnya" class="space-y-2.5 ' + (isLainnya?'':'hidden') + '">' +
    '<div><label class="erp-label">Lokasi Pengerjaan</label><textarea id="sf-lokasi-lainnya" rows="2" class="erp-input">' + (isLainnya?v('lokasi_asal'):'') + '</textarea></div>' +
    '<div><label class="erp-label">Sub-Kategori Layanan</label><select id="sph-subkategori-lainnya" onchange="sphToggleSubkategoriLainnya(this.value)" class="erp-input">' + subkatOpts.map(function(o) { return '<option value="'+o+'"'+(v('subkategori_lainnya')===o?' selected':'')+'>'+o+'</option>'; }).join('') + '</select></div>' +
    '<div id="sph-sub-cleaning" class="space-y-2 border border-cyan-200 bg-cyan-50/40 p-2.5 rounded-lg hidden"><div class="grid grid-cols-2 gap-2"><div><label class="erp-label">Paket</label><select id="sph-cleaning-paket" class="erp-input"><option>General Cleaning</option><option>Deep Cleaning</option></select></div><div><label class="erp-label">Luas (m2)</label><input type="number" id="sph-cleaning-luas" value="45" class="erp-input"></div></div><div><label class="erp-label">Jumlah Ruangan</label><input type="number" id="sph-cleaning-ruangan" value="1" class="erp-input"></div></div>' +
    '<div id="sph-sub-packing" class="space-y-2 border border-purple-200 bg-purple-50/40 p-2.5 rounded-lg hidden"><div class="flex justify-between items-center"><span id="sph-packing-title" class="erp-label text-purple-700">Rincian Barang:</span><button type="button" onclick="sphAddPackingRow()" class="text-[9px] text-purple-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-packing-row-area" class="space-y-1.5"></div><div id="sph-packing-kayu-addon" class="hidden pt-2"><span class="erp-label text-purple-700">Tambahan Material:</span><div class="grid grid-cols-2 gap-1 text-[11px]">' + ['Kardus','Wrapping','Bubble Wrap','Triplek','Pallet'].map(function(o) { return '<label class="flex gap-1.5"><input type="checkbox" class="sph-packing-kayu-addon-check" value="'+o+'"> '+o+'</label>'; }).join('') + '</div></div></div>' +
    '<div id="sph-sub-ac" class="space-y-2 border border-amber-200 bg-amber-50/40 p-2.5 rounded-lg hidden"><div class="flex justify-between items-center"><span class="erp-label text-amber-700">Unit AC:</span><button type="button" onclick="sphAddAcRow()" class="text-[9px] text-amber-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-ac-row-area" class="space-y-1.5"></div></div>' +
    '<div id="sph-sub-manual" class="hidden"><label class="erp-label">Rincian Pekerjaan</label><textarea id="sph-lainnya-manual" rows="3" class="erp-input"></textarea></div>' +
    '</div>' +

    '<div><label class="erp-label">Alat Bantu Kerja</label><input id="sf-alat-bantu" value="' + v('alat_bantu_kerja') + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Layanan Tambahan (Ketik Manual)</label><input id="sf-layanan-tambahan-ket" value="' + v('layanan_tambahan_keterangan') + '" class="erp-input"></div>' +

    '<div class="border border-slate-200 p-2.5 rounded-lg bg-slate-50"><div class="flex justify-between items-center mb-1"><span class="erp-label text-rose-600">Tawaran Diskon:</span><button type="button" onclick="sphAddDiskonRow()" class="text-[9px] text-rose-600 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button></div><div id="sph-diskon-row-area" class="space-y-1.5"></div></div>' +

    '<div class="border-2 border-dashed border-indigo-200 p-2.5 rounded-lg bg-indigo-50/30"><span class="erp-label text-indigo-700"><i class="fas fa-lock mr-1"></i>RAB Internal (Gak Tampil di PDF Customer):</span>' +
    '<div id="sph-rab-row-area" class="space-y-1.5 my-1.5"></div>' +
    '<div class="flex justify-between items-center bg-white border border-indigo-200 rounded p-2"><span class="text-[9px] font-bold">Total RAB: <span id="sph-rab-total-display" class="font-mono text-indigo-700">Rp 0</span></span><div class="flex gap-1"><button type="button" onclick="sphAddRabRow()" class="text-[9px] text-indigo-700 font-bold"><i class="fas fa-plus-circle mr-1"></i>Tambah</button><button type="button" onclick="sphClearRab()" class="text-[9px] text-slate-500 font-bold">Kosongkan</button></div></div></div>' +

    '<div><label class="erp-label">Nominal Harga SPH</label><input type="number" id="of-f-Harga" oninput="sphCalculateHargaAkhir()" value="' + v('harga',0) + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Harga Setelah Diskon (otomatis)</label><input type="number" id="of-f-Harga_Setelah_Diskon" readonly style="background:#fff1f2;" value="' + v('harga_setelah_diskon', v('harga',0)) + '" class="erp-input"></div>' +
    '<div><label class="erp-label">Status</label><select id="sf-status" class="erp-input"><option value="Menunggu Respon"' + (v('status')==='Menunggu Respon'||!v('status')?' selected':'') + '>Menunggu Respon</option><option value="Deal"' + (v('status')==='Deal'?' selected':'') + '>Deal</option><option value="Tidak Ada Respon"' + (v('status')==='Tidak Ada Respon'?' selected':'') + '>Tidak Ada Respon</option></select></div>' +
    '<div><label class="erp-label">Tgl Follow Up</label><input type="date" id="sf-followup" value="' + v('tgl_follow_up') + '" class="erp-input"></div>' +

    '</div><div class="flex gap-2 mt-4"><button onclick="document.getElementById(\'sph-modal\').remove()" class="erp-btn-secondary flex-1">Batal</button>' +
    '<button onclick="sphSubmit(' + (isEdit?"'"+existingRow.no_sph+"'":'null') + ')" class="erp-btn-primary flex-1">Simpan</button></div></div></div>';

  document.body.insertAdjacentHTML('beforeend', html);

  // Isi ulang baris dari data lama (edit) atau default kosong (baru)
  (row.lokasi_asal||'').split('\n').filter(Boolean).forEach(function(t) { window.ofAddSimpleRow('sph-alamat-asal-row-area', 'Alamat asal', t); });
  if (!row.lokasi_asal) window.ofAddSimpleRow('sph-alamat-asal-row-area', 'Alamat asal');
  (row.lokasi_tujuan||'').split('\n').filter(Boolean).forEach(function(t) { window.ofAddSimpleRow('sph-alamat-tujuan-row-area', 'Alamat tujuan', t); });
  if (!row.lokasi_tujuan) window.ofAddSimpleRow('sph-alamat-tujuan-row-area', 'Alamat tujuan');
  (row.jenis_armada||'').split('\n').filter(Boolean).forEach(function(t) { window.sphAddArmadaRow(t, 1); });
  window.sphToggleButuhArmada(row.jenis_armada ? 'ya' : 'ya');
  (row.jenis_layanan||'').split('\n').filter(Boolean).forEach(function(t) { window.ofAddSimpleRow('sph-layanan-row-area', 'Jasa', t); });
  if (!row.jenis_layanan && !isKirim && !isLainnya) window.ofAddSimpleRow('sph-layanan-row-area', 'Jasa');
  (row.jenis_barang||'').split('\n').filter(Boolean).forEach(function(t, i) {
    const jumlahArr = (row.jumlah_barang||'').split('\n');
    window.sphAddBarangRow(t, jumlahArr[i]||1, '');
  });
  if (isKirim && !row.jenis_barang) window.sphAddBarangRow();
  if (isLainnya) { window.sphToggleSubkategoriLainnya(v('subkategori_lainnya') || 'Cleaning Service'); }

  window.sphRecalcRabTotal();
};

window.sphSubmit = async function(noSphExisting) {
  const gv = function(id) { return document.getElementById(id).value; };
  const jenisSph = gv('of-f-jenis-sph-hidden');
  const isKirim = jenisSph === 'Kirim Barang';
  const isLainnya = jenisSph === 'Lainnya';

  let jenisLayanan = '';
  if (isLainnya) {
    const subkat = document.getElementById('sph-subkategori-lainnya').value;
    let lines = [];
    if (subkat === 'Cleaning Service') {
      lines.push('CLEANING|' + document.getElementById('sph-cleaning-paket').value + '|' + document.getElementById('sph-cleaning-luas').value + '|' + document.getElementById('sph-cleaning-ruangan').value);
    } else if (subkat === 'Packing Standar' || subkat === 'Packing Kayu') {
      document.querySelectorAll('#sph-packing-row-area .sph-packing-row').forEach(function(r) { lines.push('PACKING|' + r.querySelector('.i-nama').value + '|' + r.querySelector('.i-dimensi').value + '|' + r.querySelector('.i-qty').value); });
    } else if (subkat === 'Bongkar Pasang AC') {
      document.querySelectorAll('#sph-ac-row-area .sph-ac-row').forEach(function(r) { lines.push('AC|' + r.querySelector('.i-jenis-ac').value + '|' + r.querySelector('.i-pk').value + '|' + r.querySelector('.i-jenis-kerja').value + '|' + r.querySelector('.i-qty').value); });
    } else {
      const manualVal = document.getElementById('sph-lainnya-manual').value.trim();
      if (manualVal) lines.push('MANUAL|' + manualVal);
    }
    jenisLayanan = lines.join('\n');
  } else if (!isKirim) {
    jenisLayanan = ofReadSimpleRows('sph-layanan-row-area').join('\n');
  }

  const checklist = Array.from(document.querySelectorAll('.sph-layanan-check:checked')).map(function(cb) { return cb.value; }).join('\n');
  const rabKomponen = Array.from(document.querySelectorAll('.sph-rab-row')).map(function(r) { return r.querySelectorAll('input')[0].value; }).join('\n');
  const rabJumlah = Array.from(document.querySelectorAll('.sph-rab-row')).map(function(r) { return r.querySelectorAll('input')[1].value; }).join('\n');
  const rabNominal = Array.from(document.querySelectorAll('.sph-rab-row')).map(function(r) { return r.querySelectorAll('input')[2].value; }).join('\n');

  const payload = {
    customer: gv('sf-customer'), no_hp: gv('sf-hp'), referensi_customer: gv('sf-referensi'), tanggal: gv('sf-tanggal'),
    jenis_sph: jenisSph,
    lokasi_asal: isLainnya ? gv('sf-lokasi-lainnya') : ofReadSimpleRows('sph-alamat-asal-row-area').join('\n'),
    lokasi_tujuan: isLainnya ? '' : ofReadSimpleRows('sph-alamat-tujuan-row-area').join('\n'),
    jumlah_helper: Number(gv('sf-jml-helper')) || 0,
    jenis_armada: Array.from(document.querySelectorAll('.sph-armada-row')).map(function(r) { return r.querySelector('.i-jenis').value; }).join('\n'),
    jumlah_armada: Array.from(document.querySelectorAll('.sph-armada-row')).map(function(r) { return r.querySelector('.i-jumlah').value; }).join('\n'),
    paket_pindahan: isKirim||isLainnya ? '' : gv('sf-paket'),
    jenis_pindahan: isKirim||isLainnya ? '' : gv('sf-jenis-pindahan'),
    jenis_layanan: jenisLayanan,
    layanan_checklist: checklist,
    layanan_tambahan_keterangan: gv('sf-layanan-tambahan-ket'),
    jenis_barang: isKirim ? Array.from(document.querySelectorAll('.sph-barang-row')).map(function(r) { return r.querySelector('.i-jenis').value; }).join('\n') : '',
    jumlah_barang: isKirim ? Array.from(document.querySelectorAll('.sph-barang-row')).map(function(r) { return r.querySelector('.i-jumlah').value; }).join('\n') : '',
    estimasi_berat: isKirim ? Array.from(document.querySelectorAll('.sph-barang-row')).map(function(r) { return r.querySelector('.i-berat').value; }).join('\n') : '',
    inap_barang: document.getElementById('sph-inap-check') && document.getElementById('sph-inap-check').checked ? 'Ya' : 'Tidak',
    tgl_inap_dari: gv('sf-inap-dari') || null, tgl_inap_sampai: gv('sf-inap-sampai') || null,
    subkategori_lainnya: isLainnya ? document.getElementById('sph-subkategori-lainnya').value : '',
    alat_bantu_kerja: gv('sf-alat-bantu'),
    harga: Number(gv('of-f-Harga')) || 0,
    harga_setelah_diskon: Number(gv('of-f-Harga_Setelah_Diskon')) || 0,
    rab_komponen: rabKomponen, rab_jumlah: rabJumlah, rab_nominal: rabNominal,
    status: gv('sf-status'), tgl_follow_up: gv('sf-followup') || null,
  };

  let res;
  if (noSphExisting) {
    res = await supabaseClient.from('sph').update(payload).eq('no_sph', noSphExisting);
  } else {
    payload.no_sph = 'ANGKUTKU/SPH/' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    res = await supabaseClient.from('sph').insert(payload);
  }

  if (res.error) { alert('Gagal simpan: ' + res.error.message); return; }
  document.getElementById('sph-modal').remove();
  ofRenderActiveTab();
};


window.sphDelete = async function(noSph) {
  if (!confirm('Hapus SPH ini?')) return;
  const { error } = await supabaseClient.from('sph').delete().eq('no_sph', noSph);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  ofRenderActiveTab();
};
