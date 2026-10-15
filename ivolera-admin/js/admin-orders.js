/* Ivolera panel pesanan — muat SETELAH admin.js.
   Tanpa prompt/confirm/alert — semua via askConfirm/toast.
*/
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const root = $('viewDashboard'); if (!root) return;
  const PAID = /^(paid|approved|lunas)$/i;

  const section = document.createElement('section');
  section.className = 'panel';
  section.style.marginBottom = '20px';
  section.innerHTML = `
    <div class="panel-head">
      <div class="panel-title">
        <h2>Pesanan Pembayaran</h2>
        <p class="panel-sub" id="ivOrdersSub">Memuat…</p>
      </div>
      <div class="panel-actions">
        <button class="btn-add-new" id="ivOrdersRefresh" type="button">Muat Ulang</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID Pesanan</th><th>Paket</th><th>Tema</th><th>Harga</th>
          <th>Pembayaran</th><th>Aksi</th>
        </tr></thead>
        <tbody id="ivOrdersBody">
          <tr><td colspan="6" class="empty-row">Memuat…</td></tr>
        </tbody>
      </table>
    </div>`;
  root.insertBefore(section, root.firstChild);

  async function load() {
    $('ivOrdersSub').textContent = 'Memuat…';
    try {
      const data = await adminPost({ action: 'listOrders' });
      $('ivOrdersSub').textContent = `${data.length} pesanan`;
      $('ivOrdersBody').innerHTML = data.length
        ? data.map(o => `<tr>
            <td><code>${esc(o.id)}</code></td>
            <td>${esc(o.paket)}</td>
            <td>${esc(o.tema)}</td>
            <td>Rp${Number(o.harga || 0).toLocaleString('id-ID')}</td>
            <td>${esc(o.statusPembayaran)}</td>
            <td>${PAID.test(o.statusPembayaran)
              ? esc(o.statusUndangan || 'Disetujui')
              : `<button class="act-btn" data-approve="${esc(o.id)}" type="button">Setujui Pembayaran</button>`}
            </td>
          </tr>`).join('')
        : '<tr><td colspan="6" class="empty-row">Belum ada pesanan.</td></tr>';
    } catch (e) {
      $('ivOrdersSub').textContent = 'Gagal memuat';
      $('ivOrdersBody').innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
    }
  }

  $('ivOrdersRefresh').addEventListener('click', load);

  $('ivOrdersBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-approve]');
    if (!b) return;
    const id = b.dataset.approve;
    if (!(await askConfirm(`Setujui pembayaran pesanan ${id}?`, { ok: 'Setujui' }))) return;
    b.disabled = true;
    try {
      await adminPost({ action: 'approveOrder', id });
      toast('Pembayaran disetujui. Status pelanggan otomatis berubah.');
      load();
    } catch (err) {
      b.disabled = false;
      toast(err.message || 'Gagal menyetujui pembayaran.', 'error', 5000);
    }
  });

  /* ✅ FIX: dengarkan di document (bukan window) */
  document.addEventListener('admin-ready', load, { once: true });
  if (window.ADMIN_PW) load();
})();