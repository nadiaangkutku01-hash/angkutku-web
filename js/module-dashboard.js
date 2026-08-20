// ============================================================================
// MODULE-DASHBOARD.JS
// ============================================================================
// Kartu ringkasan ERP (Total Order, SPH Deal, dst) CUMA buat Owner/Admin/
// Finance/Marketing -- persis aturan yang sudah kita tetapkan di sistem
// GAS sebelumnya. RLS di database SUDAH otomatis membatasi Marketing
// cuma lihat SPH/SPK/Invoice miliknya sendiri -- jadi angka yang keluar
// di kartu Marketing OTOMATIS cuma menghitung dokumen dia sendiri, gak
// perlu filter tambahan di kode ini.
// ============================================================================

window.renderDashboardModule = async function(area) {
  const role = window.CURRENT_USER_SESSION.role;
  const showErpCards = ['Owner', 'Admin', 'Finance', 'Marketing'].indexOf(role) !== -1;

  area.innerHTML = '<div class="p-8 text-center"><i class="fas fa-circle-notch fa-spin text-blue-500"></i> Memuat dashboard...</div>';

  if (!showErpCards) {
    area.innerHTML = `<div class="erp-card p-6 text-center text-slate-400 text-xs italic">Selamat datang, ${window.CURRENT_USER_SESSION.name}. Dashboard ringkasan perusahaan gak tersedia untuk Role ${role}.</div>`;
    return;
  }

  // Ambil data dari 3 tabel sekaligus -- RLS otomatis membatasi hasilnya
  // sesuai Role yang login (Marketing cuma lihat miliknya sendiri).
  const [sphRes, spkRes, invoiceRes] = await Promise.all([
    supabaseClient.from('sph').select('status'),
    supabaseClient.from('spk').select('status'),
    supabaseClient.from('invoice').select('status_bayar'),
  ]);

  const sphList = sphRes.data || [];
  const spkList = spkRes.data || [];
  const invoiceList = invoiceRes.data || [];

  const totalOrder = spkList.length;
  const sphDeal = sphList.filter(function(s) { return s.status === 'Deal'; }).length;
  const sphTidakRespon = sphList.filter(function(s) { return s.status === 'Tidak Ada Respon'; }).length;
  const invoiceLunas = invoiceList.filter(function(i) { return i.status_bayar === 'LUNAS'; }).length;
  const invoiceBelumLunas = invoiceList.filter(function(i) { return i.status_bayar !== 'LUNAS'; }).length;

  const cards = [
    { label: 'Total Order', value: totalOrder, icon: 'fa-clipboard-list', color: 'blue' },
    { label: 'SPH Deal', value: sphDeal, icon: 'fa-check-circle', color: 'emerald' },
    { label: 'SPH Tidak Ada Respon', value: sphTidakRespon, icon: 'fa-times-circle', color: 'rose' },
    { label: 'Invoice Lunas', value: invoiceLunas, icon: 'fa-receipt', color: 'emerald' },
    { label: 'Invoice Belum Lunas', value: invoiceBelumLunas, icon: 'fa-hourglass-half', color: 'amber' },
  ];

  area.innerHTML = `
    <div class="mb-4">
      <h2 class="text-sm font-black text-slate-800">Selamat datang, ${window.CURRENT_USER_SESSION.name}</h2>
      <p class="text-[11px] text-slate-400">${role}${role === 'Marketing' ? ' -- angka di bawah cuma menghitung dokumen yang kamu buat sendiri' : ''}</p>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      ${cards.map(dashCardHtml).join('')}
    </div>`;
};

function dashCardHtml(c) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
  };
  return `<div class="erp-card p-4 text-center">
    <div class="w-10 h-10 rounded-xl ${colorMap[c.color]} flex items-center justify-center mx-auto mb-2"><i class="fas ${c.icon}"></i></div>
    <div class="text-2xl font-black text-slate-800">${c.value}</div>
    <div class="text-[10px] text-slate-400 font-bold uppercase mt-1">${c.label}</div>
  </div>`;
}
