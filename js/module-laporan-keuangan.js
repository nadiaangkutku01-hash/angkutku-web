// ============================================================================
// MODULE-LAPORAN-KEUANGAN.JS -- Investor (pembayaran dividen)
// ============================================================================
// RLS (kebijakan investor_select, investor_payment_select) OTOMATIS
// membatasi: Owner/Admin/Finance lihat semua investor + semua riwayat
// bayar, Investor CUMA lihat datanya sendiri. Kode di sini gak perlu
// filter tambahan -- tinggal query apa adanya.
// ============================================================================

window.LAPKEU_ACTIVE_TAB = 'investor';

window.renderLaporanKeuanganModule = function(area) {
  const tabs = [
    { key: 'investor', label: 'Investor', icon: 'fa-hand-holding-dollar' },
  ];

  area.innerHTML = `
    <div class="flex gap-2 mb-3 overflow-x-auto">
      ${tabs.map(function(t) {
        const active = window.LAPKEU_ACTIVE_TAB === t.key;
        return `<button onclick="lkSwitchTab('${t.key}')" class="shrink-0 px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}"><i class="fas ${t.icon} mr-1.5"></i>${t.label}</button>`;
      }).join('')}
    </div>
    <div id="lapkeu-tab-content"></div>`;

  lkRenderActiveTab();
};

window.lkSwitchTab = function(key) {
  window.LAPKEU_ACTIVE_TAB = key;
  renderLaporanKeuanganModule(document.getElementById('content-area'));
};

function lkRenderActiveTab() {
  const tabArea = document.getElementById('lapkeu-tab-content');
  if (window.LAPKEU_ACTIVE_TAB === 'investor') renderInvestorLedgerModule(tabArea);
}

// ============================================================================
// INVESTOR LEDGER
// ============================================================================
window.renderInvestorLedgerModule = async function(area) {
  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat data...</div>';

  const isInvestor = window.CURRENT_USER_SESSION.role === 'Investor';
  const canPay = ['Owner', 'Admin', 'Finance'].indexOf(window.CURRENT_USER_SESSION.role) !== -1;

  const { data: investorList, error } = await supabaseClient.from('investor').select('*, armada(no_polisi, jenis_kendaraan)');
  if (error) { area.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">Gagal memuat: ${error.message}</div>`; return; }

  const { data: paymentList } = await supabaseClient.from('investor_payment').select('*').order('tanggal_bayar', { ascending: false });

  area.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${investorList.map(function(inv) { return investorCardHtml(inv, paymentList || [], canPay); }).join('')}
    </div>
    ${investorList.length === 0 ? '<div class="erp-card p-8 text-center text-slate-400 italic text-xs">Tidak ada data investor yang bisa ditampilkan.</div>' : ''}`;
};

function investorCardHtml(inv, allPayments, canPay) {
  const formatRp = function(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); };
  const myPayments = allPayments.filter(function(p) { return p.investor_id === inv.id_investor; });
  const totalDibayar = myPayments.reduce(function(s, p) { return s + (Number(p.nominal_dibayar) || 0); }, 0);
  const armadaList = (inv.armada || []).map(function(a) { return a.no_polisi; }).join(', ') || '-';

  const historyRows = myPayments.slice(0, 5).map(function(p) {
    return `<tr><td class="py-1 text-slate-500 font-mono">${window.formatDateID(p.tanggal_bayar)}</td><td class="py-1 text-right font-mono font-bold text-emerald-600">${formatRp(p.nominal_dibayar)}</td></tr>`;
  }).join('');

  return `
    <div class="erp-card p-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="font-black text-sm text-slate-800">${inv.nama}</h3>
          <p class="text-[10px] text-slate-400">Armada: ${armadaList}</p>
        </div>
        <span class="erp-badge erp-badge-neutral">${formatRp(inv.modal)} Modal</span>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-2.5 mb-2 flex justify-between items-center">
        <span class="text-[10px] font-bold text-purple-700 uppercase">Total Dibayar (Semua Waktu)</span>
        <span class="font-mono font-black text-purple-700 text-sm">${formatRp(totalDibayar)}</span>
      </div>
      ${historyRows ? `<table class="w-full text-[10px] mb-2"><tbody>${historyRows}</tbody></table>` : '<p class="text-[10px] text-slate-300 italic mb-2">Belum ada riwayat pembayaran.</p>'}
      ${canPay ? `<button onclick="investorPaymentOpenForm('${inv.id_investor}', '${inv.nama.replace(/'/g,"")}')" class="erp-btn-primary w-full text-center"><i class="fas fa-money-check-dollar mr-1"></i>Bayar Dividen</button>` : ''}
    </div>`;
}

window.investorPaymentOpenForm = function(investorId, investorName) {
  const today = new Date().toISOString().slice(0, 10);
  const modalHtml = `
    <div id="investor-payment-modal" class="erp-modal-overlay">
      <div class="erp-modal-box">
        <h3 class="erp-card-title mb-4">Bayar Dividen -- ${investorName}</h3>
        <div class="space-y-2.5">
          <div><label class="erp-label">Tanggal Bayar</label><input type="date" id="ip-tanggal" value="${today}" class="erp-input"></div>
          <div><label class="erp-label">Nominal</label><input type="number" id="ip-nominal" class="erp-input"></div>
          <div><label class="erp-label">Jalur Kas</label><input id="ip-jalur" placeholder="misal: Transfer BCA" class="erp-input"></div>
          <div><label class="erp-label">Catatan</label><input id="ip-catatan" class="erp-input"></div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="document.getElementById('investor-payment-modal').remove()" class="erp-btn-secondary flex-1">Batal</button>
          <button onclick="investorPaymentSubmit('${investorId}')" class="erp-btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.investorPaymentSubmit = async function(investorId) {
  const gv = function(id) { return document.getElementById(id).value; };
  const payload = {
    id: 'DIV-' + Date.now(),
    investor_id: investorId,
    tanggal_bayar: gv('ip-tanggal'),
    nominal_dibayar: Number(gv('ip-nominal')) || 0,
    jalur_kas: gv('ip-jalur'),
    catatan: gv('ip-catatan'),
    dibuat_oleh: window.CURRENT_USER_SESSION.name,
  };

  const { error } = await supabaseClient.from('investor_payment').insert(payload);
  if (error) { alert('Gagal simpan: ' + error.message); return; }

  document.getElementById('investor-payment-modal').remove();
  lkRenderActiveTab();
};
