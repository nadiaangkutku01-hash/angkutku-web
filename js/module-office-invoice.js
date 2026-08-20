// ============================================================================
// MODULE-OFFICE-INVOICE.JS -- Invoice
// ============================================================================
// Baris jasa (detail_layanan_json) disimpan sebagai array JSON di
// database. PENTING: semua field baris jasa (nama, deskripsi, qty,
// keterangan, harga) punya trigger "oninput" yang langsung hitung ulang
// total -- INI PERBAIKAN dari bug yang pernah ditemukan di sistem GAS
// lama, di mana field Nama/Deskripsi/Keterangan TIDAK punya trigger,
// jadi edit ke field itu gak pernah ikut tersimpan. Di sini SEMUA field
// baris jasa konsisten punya trigger, gak ada yang terlewat.
// ============================================================================

window.renderInvoiceModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const { data: rows, error } = await supabaseClient.from('invoice').select('*').order('tanggal', { ascending: false });
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  area.innerHTML = `
    <div class="erp-card">
      <div class="erp-card-header">
        <h2 class="erp-card-title"><i class="fas fa-receipt mr-2 text-blue-500"></i>Office -- Invoice (${rows.length})</h2>
        <button onclick="invoiceOpenForm()" class="erp-btn-primary"><i class="fas fa-plus mr-1"></i>Buat Invoice</button>
      </div>
      <div class="overflow-x-auto">
        <table class="erp-table">
          <thead><tr>
            <th>No Invoice</th><th>Tanggal</th><th>Pelanggan</th><th>Total</th><th>DP</th><th>Sisa</th><th>Status Bayar</th><th class="text-center">Aksi</th>
          </tr></thead>
          <tbody>${rows.map(invoiceRowHtml).join('')}</tbody>
        </table>
      </div>
      ${rows.length === 0 ? '<div class="p-8 text-center text-slate-400 italic text-xs">Belum ada Invoice.</div>' : ''}
    </div>`;
};

function invoiceRowHtml(r) {
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  const sisa = (Number(r.harga_akhir) || 0) - (Number(r.total_dp) || 0) - (Number(r.nominal_pelunasan_diterima) || 0);
  const statusBadge = r.status_bayar === 'LUNAS' ? 'erp-badge-success' : 'erp-badge-warning';
  return `<tr>
    <td class="font-mono text-slate-500">${r.no_invoice || '-'}</td>
    <td class="font-mono text-slate-500">${window.formatDateID(r.tanggal)}</td>
    <td class="font-bold text-slate-700">${r.nama_pelanggan || '-'}</td>
    <td class="font-mono">${formatRp(r.harga_akhir)}</td>
    <td class="font-mono">${formatRp(r.total_dp)}</td>
    <td class="font-mono ${sisa>0?'text-amber-600 font-bold':'text-slate-400'}">${formatRp(sisa)}</td>
    <td><span class="erp-badge ${statusBadge}">${r.status_bayar || 'BELUM LUNAS'}</span></td>
    <td class="text-center">
      <button onclick='invoiceOpenForm(${JSON.stringify(r)})' class="text-amber-600 hover:underline mr-2"><i class="fas fa-edit"></i></button>
      <button onclick="invoiceDelete('${r.no_invoice}')" class="text-rose-600 hover:underline"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`;
}

window.invoiceOpenForm = function(existingRow) {
  const isEdit = !!existingRow;
  const v = function(field, def) { return existingRow ? (existingRow[field] || def || '') : (def || ''); };

  const detailRows = existingRow && existingRow.detail_layanan_json ? JSON.parse(existingRow.detail_layanan_json) : [];

  const modalHtml = `
    <div id="invoice-modal" class="erp-modal-overlay">
      <div class="erp-modal-box" style="max-width: 680px;">
        <h3 class="erp-card-title mb-4">${isEdit ? 'Edit' : 'Buat'} Invoice</h3>
        <input type="hidden" id="if-no-sph" value="${v('no_sph')}">
        <div class="grid grid-cols-2 gap-2.5 mb-3">
          <div><label class="erp-label">Tanggal</label><input type="date" id="if-tanggal" value="${v('tanggal')}" class="erp-input"></div>
          <div><label class="erp-label">No HP</label><input id="if-hp" value="${v('no_hp')}" class="erp-input"></div>
          <div class="col-span-2"><label class="erp-label">Nama Pelanggan</label><input id="if-nama" list="of-datalist-pelanggan-inv" oninput="ofAutoLookupHpByNama(this.value,'if-hp')" value="${v('nama_pelanggan')}" class="erp-input"><datalist id="of-datalist-pelanggan-inv">${(window._ofPelangganCache||[]).map(function(p) { return '<option value="'+p.nama_perusahaan+'">'; }).join('')}</datalist></div>
          <div class="col-span-2"><label class="erp-label">Alamat</label><input id="if-alamat" value="${v('alamat')}" class="erp-input"></div>
        </div>

        <label class="erp-label mb-1 block">Rincian Jasa</label>
        <div id="invoice-item-rows" class="space-y-2 mb-2"></div>
        <button type="button" onclick="invoiceAddItemRow()" class="text-[11px] text-blue-600 font-bold mb-3"><i class="fas fa-plus-circle mr-1"></i>Tambah Baris Jasa</button>

        <div class="grid grid-cols-2 gap-2.5 mb-3 pt-3 border-t border-slate-100">
          <div><label class="erp-label">Total Harga (otomatis)</label><input type="number" id="if-total-harga" value="${v('total_harga', 0)}" class="erp-input" readonly style="background:#f1f5f9;"></div>
          <div><label class="erp-label">Diskon</label><input type="number" id="if-diskon" value="${v('diskon', 0)}" class="erp-input" oninput="invoiceRecalcTotal()"></div>
          <div><label class="erp-label">PPN</label><input type="number" id="if-ppn" value="${v('ppn', 0)}" class="erp-input" oninput="invoiceRecalcTotal()"></div>
          <div><label class="erp-label">Harga Akhir (otomatis)</label><input type="number" id="if-harga-akhir" value="${v('harga_akhir', 0)}" class="erp-input" readonly style="background:#f1f5f9;"></div>
          <div><label class="erp-label">Total DP Diterima</label><input type="number" id="if-total-dp" value="${v('total_dp', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Nominal Pelunasan Diterima</label><input type="number" id="if-pelunasan" value="${v('nominal_pelunasan_diterima', 0)}" class="erp-input"></div>
          <div><label class="erp-label">Metode Pembayaran</label><input id="if-metode-bayar" value="${v('metode_pembayaran')}" class="erp-input"></div>
          <div><label class="erp-label">Status Bayar</label>
            <select id="if-status-bayar" class="erp-input">
              <option value="BELUM LUNAS" ${v('status_bayar')==='BELUM LUNAS'||!v('status_bayar')?'selected':''}>BELUM LUNAS</option>
              <option value="LUNAS" ${v('status_bayar')==='LUNAS'?'selected':''}>LUNAS</option>
            </select>
          </div>
        </div>

        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('invoice-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="invoiceSubmit(${isEdit ? "'" + existingRow.no_invoice + "'" : 'null'})" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Isi baris jasa yang sudah ada (kalau edit), atau 1 baris kosong (kalau buat baru)
  if (detailRows.length > 0) {
    detailRows.forEach(function(item) { invoiceAddItemRow(item); });
  } else {
    invoiceAddItemRow();
  }
};

window.invoiceAddItemRow = function(existingItem) {
  const rowArea = document.getElementById('invoice-item-rows');
  const rowId = 'item-' + Date.now() + Math.random().toString(36).slice(2, 6);
  const nama = existingItem ? existingItem.nama || '' : '';
  const qty = existingItem ? existingItem.qty || 1 : 1;
  const harga = existingItem ? existingItem.harga || 0 : 0;

  const rowHtml = `
    <div class="flex gap-2 items-start bg-slate-50 p-2 rounded-lg invoice-item-row" data-row-id="${rowId}">
      <input placeholder="Nama Jasa" value="${nama}" oninput="invoiceRecalcTotal()" class="erp-input flex-1 i-nama">
      <input type="number" placeholder="Qty" value="${qty}" oninput="invoiceRecalcTotal()" class="erp-input w-16 i-qty">
      <input type="number" placeholder="Harga Satuan" value="${harga}" oninput="invoiceRecalcTotal()" class="erp-input w-28 i-harga">
      <button type="button" onclick="this.closest('.invoice-item-row').remove(); invoiceRecalcTotal();" class="text-rose-500 mt-2"><i class="fas fa-minus-circle"></i></button>
    </div>`;
  rowArea.insertAdjacentHTML('beforeend', rowHtml);
  invoiceRecalcTotal();
};

// SATU fungsi ini dipanggil dari SEMUA field baris jasa (nama, qty,
// harga) DAN dari field Diskon/PPN -- gak ada 1 pun field yang
// terlewat gak punya trigger, beda dari bug yang pernah ada di sistem
// lama.
window.invoiceRecalcTotal = function() {
  let totalHarga = 0;
  document.querySelectorAll('.invoice-item-row').forEach(function(rowEl) {
    const qty = Number(rowEl.querySelector('.i-qty').value) || 0;
    const harga = Number(rowEl.querySelector('.i-harga').value) || 0;
    totalHarga += qty * harga;
  });

  const diskon = Number(document.getElementById('if-diskon').value) || 0;
  const ppn = Number(document.getElementById('if-ppn').value) || 0;
  const hargaAkhir = totalHarga - diskon + ppn;

  document.getElementById('if-total-harga').value = totalHarga;
  document.getElementById('if-harga-akhir').value = hargaAkhir;
};

window.invoiceSubmit = async function(noInvoiceExisting) {
  const gv = function(id) { return document.getElementById(id).value; };

  const detailLayanan = Array.from(document.querySelectorAll('.invoice-item-row')).map(function(rowEl) {
    return {
      nama: rowEl.querySelector('.i-nama').value,
      qty: Number(rowEl.querySelector('.i-qty').value) || 0,
      harga: Number(rowEl.querySelector('.i-harga').value) || 0,
    };
  });

  const payload = {
    tanggal: gv('if-tanggal'),
    no_hp: gv('if-hp'),
    nama_pelanggan: gv('if-nama'),
    alamat: gv('if-alamat'),
    no_sph: gv('if-no-sph') || null,
    detail_layanan_json: JSON.stringify(detailLayanan),
    total_harga: Number(gv('if-total-harga')) || 0,
    diskon: Number(gv('if-diskon')) || 0,
    ppn: Number(gv('if-ppn')) || 0,
    harga_akhir: Number(gv('if-harga-akhir')) || 0,
    total_dp: Number(gv('if-total-dp')) || 0,
    nominal_pelunasan_diterima: Number(gv('if-pelunasan')) || 0,
    metode_pembayaran: gv('if-metode-bayar'),
    status_bayar: gv('if-status-bayar'),
  };

  let error;
  if (noInvoiceExisting) {
    ({ error } = await supabaseClient.from('invoice').update(payload).eq('no_invoice', noInvoiceExisting));
  } else {
    payload.no_invoice = 'ANGKUTKU/INV/' + Date.now();
    payload.dibuat_oleh = window.CURRENT_USER_SESSION.name;
    ({ error } = await supabaseClient.from('invoice').insert(payload));
  }

  if (error) { alert('Gagal simpan: ' + error.message); return; }
  document.getElementById('invoice-modal').remove();
  ofRenderActiveTab();
};

window.invoiceDelete = async function(noInvoice) {
  if (!confirm('Hapus Invoice ini?')) return;
  const { error } = await supabaseClient.from('invoice').delete().eq('no_invoice', noInvoice);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  ofRenderActiveTab();
};
