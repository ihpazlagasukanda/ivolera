/* Ivolera order-gate v3 — muat SETELAH order.js.
   Alur: pesan → bayar via WA → admin setujui → isi form (completeOrder).
   Tidak ada alert/confirm/prompt. Semua notifikasi pakai toast/modal kustom.
*/
(() => {
  'use strict';
  const KEY = 'ivolera-order-session';
  const HDR = { 'Content-Type': 'text/plain;charset=utf-8' };
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
  const rp = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
  let sess = get(), timer = null;

  /* ✅ KONFIRMASI MODAL — global, dipakai juga oleh order.js */
  window.askConfirm = (message, {title = 'Konfirmasi', ok = 'Ya, Lanjut', cancel = 'Batal'} = {}) => {
    return new Promise(resolve => {
      let modal = document.getElementById('ivsConfirm');
      if(!modal){
        modal = document.createElement('div');
        modal.id = 'ivsConfirm';
        modal.className = 'confirm-mask';
        modal.innerHTML = `
          <div class="confirm-card" role="dialog" aria-modal="true">
            <h3 class="confirm-title" id="ivsCfmTitle">Konfirmasi</h3>
            <p class="confirm-msg" id="ivsCfmMsg"></p>
            <div class="confirm-actions">
              <button type="button" class="btn btn-ghost" id="ivsCfmCancel"></button>
              <button type="button" class="btn btn-primary" id="ivsCfmOk"></button>
            </div>
          </div>`;
        document.body.appendChild(modal);
      }
      const titleEl = modal.querySelector('#ivsCfmTitle');
      const msgEl = modal.querySelector('#ivsCfmMsg');
      const okBtn = modal.querySelector('#ivsCfmOk');
      const cancelBtn = modal.querySelector('#ivsCfmCancel');

      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = ok;
      cancelBtn.textContent = cancel;

      const close = (v) => {
        modal.classList.remove('open');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => { modal.hidden = true; }, 200);
        resolve(v);
      };
      const onKey = e => { if(e.key === 'Escape') close(false); };

      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('open'));
      okBtn.onclick = () => close(true);
      cancelBtn.onclick = () => close(false);
      modal.onclick = e => { if(e.target === modal) close(false); };
      document.addEventListener('keydown', onKey);
    });
  };

  const st = document.createElement('style');
  st.textContent = `
  .ivs-warn,.ivs-ok{margin:14px 0;padding:12px 14px;border-radius:12px;font-size:14px;text-align:left}
  .ivs-warn{background:rgba(226,194,127,.22);border:1.5px solid #E2C27F}
  .ivs-ok{background:rgba(60,150,100,.16);border:1.5px solid #3c9664}
  .ivs-actions{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .ivs-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .ivs-link{background:none;border:0;color:inherit;opacity:.65;text-decoration:underline;cursor:pointer;font:inherit;font-size:13px;margin-top:14px}
  .confirm-mask{position:fixed;inset:0;background:rgba(15,24,23,.7);backdrop-filter:blur(6px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;opacity:0;transition:.25s}
  .confirm-mask.open{display:flex;opacity:1}
  .confirm-mask[hidden]{display:none!important}
  .confirm-card{background:var(--card,#EFECE9);color:var(--ink,#192524);border-radius:18px;max-width:400px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}
  .dark .confirm-card{background:#243634;color:#EFECE9}
  .confirm-title{margin:0 0 8px;font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700}
  .confirm-msg{margin:0 0 20px;font-size:14px;opacity:.85;line-height:1.5}
  .confirm-actions{display:flex;gap:10px}
  .confirm-actions .btn{flex:1;padding:11px 14px}
  `;
  document.head.appendChild(st);

  const call = async p => {
    const r = await fetch(API, { method: 'POST', headers: HDR, body: JSON.stringify(p) });
    const j = await r.json();
    if (!r.ok || j.success === false || j.result === 'error') throw new Error(j.message || 'Permintaan gagal');
    return j.data;
  };
  const stateOf = o => {
    const p = String(o.statusPembayaran || '').toUpperCase();
    const u = String(o.statusUndangan || '').toUpperCase();
    return u === 'COMPLETED' ? 'done' : (p === 'PAID' && u === 'READY') ? 'ready' : 'locked';
  };
  const waUrl = () => `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent([
    'Halo Admin Ivolera', '', 'Saya sudah membuat pesanan undangan:',
    `• ID pesanan: ${sess.id}`,
    `• Paket: ${sess.paketName} (${rp(sess.harga)})`,
    `• Tema: ${sess.temaName}`, '',
    'Mohon info pembayaran & konfirmasi. Bukti transfer saya lampirkan di chat ini. Terima kasih 🙏'
  ].join('\n'))}`;

  const setForm = on => {
    const a = document.querySelector('.stepper');
    const b = document.querySelector('.form-section');
    if (a) a.style.display = on ? '' : 'none';
    if (b) b.style.display = on ? '' : 'none';
  };
  const bar = show => {
    let b = document.getElementById('ivsBar');
    if (!show) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'ivsBar';
      b.className = 'ivs-ok';
      const stepper = document.querySelector('.stepper');
      if (stepper) stepper.before(b); else document.body.prepend(b);
    }
    b.innerHTML = `✅ Pembayaran disetujui — silakan isi data undangan.
      <div class="ivs-row">
        <a class="btn btn-wa" id="ivsWa" href="${waUrl()}" target="_blank" rel="noopener">Hubungi Admin</a>
        <button type="button" class="btn btn-ghost" id="ivsRefresh">Cek Status</button>
      </div>`;
    document.getElementById('ivsRefresh').onclick = () => refresh(true);
  };
  const newOrder = async () => {
    if (!(await askConfirm('Mulai pesanan baru? Pesanan lama tetap ada di admin, tapi tidak tampil lagi di perangkat ini.', { title: 'Pesanan Baru', ok: 'Ya, Mulai Baru' }))) return;
    try { localStorage.removeItem(KEY); } catch {}
    location.href = location.pathname;
  };

  function render() {
    const box = document.getElementById('paymentInfo');
    if (!box) return;
    if (!sess) { bar(false); setForm(false); return renderStart(box); }
    if (sess.state === 'ready') {
      box.hidden = true; setForm(true); bar(true);
      window.CURRENT_PAKET = sess.paket;
      const t = TEMAS.find(x => x.id === sess.tema);
      window.CURRENT_TEMA = t
        ? { id: t.id, name: t.name, desc: t.desc, tier: t.tier }
        : { id: sess.tema, name: sess.temaName, desc: 'Eksklusif', tier: 'exclusive' };
      if(window.renderPilihanCard) window.renderPilihanCard();
      const ch = document.getElementById('btnChangePaket');
      if (ch) ch.style.display = 'none';
      return;
    }
    bar(false); setForm(false); box.hidden = false;
    const done = sess.state === 'done';
    box.innerHTML = `<div class="success-card">
      <div class="success-icon"><svg class="ic"><use href="#${done ? 'i-check' : 'i-send'}"/></svg></div>
      <h2>${done ? 'Undangan Siap 🎉' : 'Menunggu Pembayaran'}</h2>
      <p>Kode pesanan: <code style="word-break:break-all">${esc(sess.id)}</code><br>${esc(sess.paketName)} · ${esc(sess.temaName)} · ${rp(sess.harga)}</p>
      <p class="note">Simpan kode ini. Jika sesi hilang, masukkan kode di halaman pesanan untuk melanjutkan.
        <button type="button" class="ivs-link" id="ivsCopy" style="margin:0">Salin kode</button></p>
      ${done ? `<div class="ivs-ok">Data undangan sudah terkirim dan undangan aktif.</div>`
        : `<div class="ivs-warn">${sess.contacted
            ? 'Sudah menghubungi admin? Setelah pembayaran disetujui, formulir terbuka otomatis. Tekan <b>Cek Status</b> untuk memeriksa sekarang.'
            : '⚠️ <b>Wajib:</b> hubungi admin untuk pembayaran. Formulir baru terbuka setelah admin menyetujui. Tekan <b>Hubungi Admin</b> lalu kirim bukti transfer.'}</div>`}
      <div class="ivs-actions">
        ${done && sess.slug ? `<a class="btn btn-primary" href="${location.origin}/?invite=${encodeURIComponent(sess.slug)}" target="_blank" rel="noopener">Buka Undangan</a>` : ''}
        <a class="btn btn-wa" id="ivsWa" href="${waUrl()}" target="_blank" rel="noopener">
          <svg class="ic"><use href="#i-wa"/></svg> <span>Hubungi Admin</span>
        </a>
        <button type="button" class="btn btn-ghost" id="ivsRefresh">Cek Status</button>
      </div>
      <button type="button" class="ivs-link" id="ivsNew">Buat pesanan baru</button>
    </div>`;
    document.getElementById('ivsWa').onclick = () => { sess.contacted = true; save(sess); setTimeout(render, 300); };
    document.getElementById('ivsRefresh').onclick = () => refresh(true);
    document.getElementById('ivsNew').onclick = newOrder;
    document.getElementById('ivsCopy').onclick = () => {
      (navigator.clipboard ? navigator.clipboard.writeText(sess.id) : Promise.reject())
        .then(() => toast('Kode pesanan disalin'), () => toast('Gagal menyalin. Kode: ' + sess.id, 'error', 6000));
    };
  }

  function renderStart(box) {
    const p = PAKET_MAP[CURRENT_PAKET] || PAKET_MAP.premium;
    box.hidden = false;
    box.innerHTML = `<div class="success-card"><h2>Mulai Pesanan</h2>
      <p>Paket <b>${esc(p.name)}</b> (${esc(p.price)}) · Tema <b>${esc(CURRENT_TEMA ? CURRENT_TEMA.name : 'belum dipilih')}</b></p>
      <div class="ivs-actions">
        <button type="button" class="btn btn-ghost" id="ivsPick">Ganti Paket &amp; Tema</button>
        <button type="button" class="btn btn-primary" id="ivsOrder">Buat Pesanan</button>
      </div>
      <p class="note">Setelah pesanan dibuat, hubungi admin untuk pembayaran. Formulir terbuka otomatis setelah disetujui.</p>
      <hr style="border:0;border-top:1px solid rgba(128,128,128,.3);margin:18px 0">
      <p class="note"><b>Sudah punya kode pesanan?</b> Masukkan untuk melanjutkan.</p>
      <div class="ivs-row">
        <input id="ivsCode" type="text" placeholder="ORD-…" autocomplete="off" spellcheck="false" style="flex:1;min-width:0;padding:11px 12px;border-radius:10px;border:1.5px solid rgba(128,128,128,.5);background:transparent;color:inherit;font:inherit">
        <button type="button" class="btn btn-ghost" id="ivsRestore">Buka Pesanan</button>
      </div>
      <small id="ivsCodeErr" role="alert" style="display:block;color:#d33;min-height:16px;margin-top:6px"></small></div>`;
    document.getElementById('ivsPick').onclick = () => PilihModal && PilihModal.open();
    const restore = async () => {
      const idEl = document.getElementById('ivsCode');
      const err = document.getElementById('ivsCodeErr');
      const b = document.getElementById('ivsRestore');
      const id = idEl.value.trim().toUpperCase();
      err.textContent = '';
      if (!/^ORD-[A-Z0-9-]{8,}$/.test(id)) {
        err.textContent = 'Format kode salah. Contoh: ORD-xxxxxxxx-xxxx-…';
        return;
      }
      b.disabled = true; b.textContent = 'Memeriksa…';
      try {
        const d = await call({ action: 'getOrder', id });
        const t = TEMAS.find(x => x.id === d.tema);
        sess = {
          id: d.id, paket: d.paket,
          paketName: (PAKET_MAP[d.paket] || {}).name || d.paket,
          tema: d.tema,
          temaName: t ? t.name : (d.tema === 'custom-exclusive' ? 'Custom Desain' : d.tema),
          harga: d.harga, state: stateOf(d), contacted: true, slug: d.slug || ''
        };
        save(sess); render();
        if (sess.state === 'locked') startPoll();
        toast('Pesanan ditemukan ✅');
      } catch (e) {
        b.disabled = false; b.textContent = 'Buka Pesanan';
        err.textContent = e.message || 'Pesanan tidak ditemukan';
      }
    };
    document.getElementById('ivsRestore').onclick = restore;
    document.getElementById('ivsCode').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); restore(); }
    });
    document.getElementById('ivsOrder').onclick = async e => {
      if (!CURRENT_TEMA) {
        toast('Pilih tema dulu', 'error');
        return PilihModal && PilihModal.open();
      }
      const b = e.currentTarget;
      b.disabled = true; b.textContent = 'Membuat pesanan…';
      try {
        const d = await call({ action: 'createOrder', paket: CURRENT_PAKET, tema: CURRENT_TEMA.id });
        sess = {
          id: d.id, paket: d.paket,
          paketName: (PAKET_MAP[d.paket] || {}).name || d.paket,
          tema: d.tema, temaName: CURRENT_TEMA.name,
          harga: d.harga, state: 'locked', contacted: false, slug: ''
        };
        save(sess); render(); startPoll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Pesanan dibuat. Silakan hubungi admin.');
      } catch (err) {
        b.disabled = false; b.textContent = 'Buat Pesanan';
        toast(err.message, 'error', 5000);
      }
    };
  }

  async function refresh(manual) {
    if (!sess) return;
    const btn = document.getElementById('ivsRefresh');
    if (manual && btn) { btn.disabled = true; btn.textContent = 'Memeriksa…'; }
    try {
      const d = await call({ action: 'getOrder', id: sess.id });
      const was = sess.state;
      sess.state = stateOf(d);
      sess.slug = d.slug || sess.slug;
      sess.harga = d.harga || sess.harga;
      sess.paket = d.paket || sess.paket;
      sess.tema = d.tema || sess.tema;
      save(sess);
      if (sess.state !== 'locked') stopPoll();
      if (was !== sess.state || manual) render();
      if (sess.state === 'ready' && was === 'locked') toast('Pembayaran disetujui ✅ Silakan isi data undangan.');
      else if (manual) toast(
        sess.state === 'locked' ? 'Belum disetujui. Pastikan sudah menghubungi admin.' : 'Status diperbarui ✅',
        sess.state === 'locked' ? 'error' : 'ok', 4500
      );
    } catch (e) {
      if (manual) {
        render();
        toast(navigator.onLine ? e.message : 'Tidak ada koneksi internet.', 'error', 5000);
      }
    }
  }
  const stopPoll = () => { clearInterval(timer); timer = null; };
  const startPoll = () => {
    stopPoll();
    timer = setInterval(() => {
      if (!document.hidden && sess && sess.state === 'locked') refresh(false);
    }, 30000);
  };

  /* Form lama diarahkan ke completeOrder */
  const ob = window.buildPayload;
  window.buildPayload = async function () {
    const p = await ob();
    p.action = 'completeOrder';
    p.orderId = sess.id;
    return p;
  };

  /* ✅ FIX: showPayment override — jangan hapus order session */
  window.showPayment = function (res) {
    const d = (res && res.data) || {};
    sess.state = 'done';
    if (d.slug) sess.slug = d.slug;
    save(sess); stopPoll(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const orp = window.renderPilihanCard;
  window.renderPilihanCard = function () { orp(); if (!sess) render(); };

  function renderConflict(box, q) {
    const t = TEMAS.find(x => x.id === q.tema);
    const p = PAKET_MAP[q.paket] || PAKET_MAP[CURRENT_PAKET];
    bar(false); setForm(false); box.hidden = false;
    box.innerHTML = `<div class="success-card"><h2>Anda Punya Pesanan Berjalan</h2>
      <p>Pesanan lama: <b>${esc(sess.paketName)} · ${esc(sess.temaName)}</b><br>
         Pilihan baru: <b>${esc(p.name)} · ${esc(t ? t.name : (q.tema || '-'))}</b></p>
      <div class="ivs-actions">
        <button type="button" class="btn btn-primary" id="ivsKeep">Lanjutkan Pesanan Lama</button>
        <button type="button" class="btn btn-ghost" id="ivsSwitch">Buat Pesanan Baru</button>
      </div></div>`;
    document.getElementById('ivsKeep').onclick = () => {
      history.replaceState(null, '', location.pathname);
      render(); refresh(false);
      if (sess.state === 'locked') startPoll();
    };
    document.getElementById('ivsSwitch').onclick = async () => {
      if (sess.state !== 'done' && !(await askConfirm(
        'Pesanan lama tidak akan tampil lagi di perangkat ini. Simpan ID pesanan lama: ' + sess.id,
        { title: 'Ganti Pesanan', ok: 'Ya, Buat Baru' }
      ))) return;
      try { localStorage.removeItem(KEY); } catch {}
      sess = null; render();
    };
  }

  /* Sesi lama versi 1 (tanpa state) tidak valid */
  if (sess && !sess.state) {
    try { localStorage.removeItem(KEY); } catch {}
    sess = null;
  }
  /* Pilihan paket/tema dari URL berbeda dengan sesi → jangan buka form lama */
  const qs = new URLSearchParams(location.search);
  const qq = { tema: (qs.get('tema') || '').toLowerCase(), paket: (qs.get('paket') || '').toLowerCase() };
  const differs = sess && ((qq.tema && qq.tema !== sess.tema) || (qq.paket && qq.paket !== sess.paket));
  if (differs && sess.state === 'done') {
    try { localStorage.removeItem(KEY); } catch {}
    sess = null;
  } else if (differs) {
    const box = document.getElementById('paymentInfo');
    if (box) { renderConflict(box, qq); return; }
  }

  render();
  if (sess) { refresh(false); if (sess.state === 'locked') startPoll(); }
})();