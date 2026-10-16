/* Ivolera admin gate — muat SEBELUM admin.js.
   - Login sekali per tab (sessionStorage)
   - Verifikasi wajib via server (verifyAdmin)
   - TIDAK pakai alert/confirm/prompt — semua via modal kustom atau toast
*/
(() => {
  'use strict';
  const API = 'https://script.google.com/macros/s/AKfycbzdU4jGMwVdRa5Ud5vNs6E1KLUM_qccojnBC6iu7S9pWVzvdezV-Z4uF6Z5Tg4bjY1V/exec';
  const KEY = 'ivoleraAdminPassword';
  const HDR = { 'Content-Type': 'text/plain;charset=utf-8' };

  const hide = document.createElement('style');
  hide.textContent = '.admin-wrap{display:none!important}';
  document.head.appendChild(hide);

  const css = document.createElement('style');
  css.textContent = `.ivg{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(15,24,23,.75);backdrop-filter:blur(6px)}
  .ivg-card{width:100%;max-width:380px;background:#EFECE9;color:#192524;border-radius:18px;padding:26px;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:'Plus Jakarta Sans',sans-serif}
  .dark .ivg-card{background:#243634;color:#EFECE9}
  .ivg-card h3{margin:0 0 6px;font-size:20px}
  .ivg-card p{margin:0 0 16px;font-size:14px;opacity:.8}
  .ivg-card input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1.5px solid #3C5759;background:transparent;color:inherit;font:inherit}
  .ivg-err{color:#d33;font-size:13px;min-height:18px;margin:8px 0 0}
  .ivg-row{display:flex;gap:10px;margin-top:14px}
  .ivg-btn{flex:1;padding:11px 14px;border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;background:#3C5759;color:#fff}
  .ivg-btn.ghost{background:transparent;color:inherit;border:1.5px solid #3C5759}
  .ivg-btn:disabled{opacity:.6}`;
  document.head.appendChild(css);

  const mask = html => {
    const m = document.createElement('div');
    m.className = 'ivg';
    m.innerHTML = `<div class="ivg-card">${html}</div>`;
    document.body.appendChild(m);
    return m;
  };

  /* Pengganti confirm() — Promise<boolean> */
  window.askConfirm = (msg, { title = 'Konfirmasi', ok = 'Ya, Lanjut', cancel = 'Batal' } = {}) =>
    new Promise(res => {
      const m = mask(`<h3></h3><p></p><div class="ivg-row">
        <button class="ivg-btn ghost" data-c type="button"></button>
        <button class="ivg-btn" data-o type="button"></button></div>`);
      m.querySelector('h3').textContent = title;
      m.querySelector('p').textContent = msg;
      m.querySelector('[data-c]').textContent = cancel;
      m.querySelector('[data-o]').textContent = ok;
      const done = v => {
        m.remove();
        document.removeEventListener('keydown', onKey);
        res(v);
      };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      m.querySelector('[data-c]').onclick = () => done(false);
      m.querySelector('[data-o]').onclick = () => done(true);
    });

  /* POST admin: password otomatis ikut */
  window.adminPost = async payload => {
    const r = await fetch(API, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ ...payload, adminPassword: window.ADMIN_PW || '' })
    });
    const j = await r.json();
    if (!r.ok || j.success === false || j.result === 'error') {
      throw new Error(j.message || 'Permintaan gagal');
    }
    return j.data;
  };

  async function verify(pw) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: HDR,
        body: JSON.stringify({ action: 'verifyAdmin', adminPassword: pw })
      });
      const j = await r.json();
      return r.ok && j.success !== false && j.result !== 'error';
    } catch {
      return null; /* null = gagal koneksi */
    }
  }

  function open(pw) {
    window.ADMIN_PW = pw;
    hide.remove();

    const right = document.querySelector('.header-right');
    if (right && !document.getElementById('btnLogout')) {
      const b = document.createElement('button');
      b.id = 'btnLogout';
      b.type = 'button';
      b.className = 'hd-btn';
      b.textContent = 'Keluar';
      b.onclick = () => {
        try { sessionStorage.removeItem(KEY); } catch {}
        location.reload();
      };
      right.appendChild(b);
    }

    /* ✅ FIX: event dikirim ke document, bukan window */
    document.dispatchEvent(new Event('admin-ready', { bubbles: true }));
  }

  function login(note) {
    const m = mask(`<h3>Admin Undangan.ku</h3>
      <p>Masukkan password admin untuk melanjutkan.</p>
      <input type="password" id="ivgPw" placeholder="Password" autocomplete="current-password">
      <div class="ivg-err" id="ivgErr" role="alert"></div>
      <div class="ivg-row"><button class="ivg-btn" id="ivgGo" type="button">Masuk</button></div>`);

    const pw = m.querySelector('#ivgPw');
    const err = m.querySelector('#ivgErr');
    const go = m.querySelector('#ivgGo');
    if (note) err.textContent = note;
    pw.focus();

    const submit = async () => {
      if (!pw.value) { err.textContent = 'Password wajib diisi.'; return; }
      go.disabled = true;
      go.textContent = 'Memeriksa…';
      err.textContent = '';
      const ok = await verify(pw.value);
      go.disabled = false;
      go.textContent = 'Masuk';
      if (ok === null) { err.textContent = 'Tidak bisa terhubung ke server.'; return; }
      if (!ok) { err.textContent = 'Password salah.'; pw.select(); return; }
      try { sessionStorage.setItem(KEY, pw.value); } catch {}
      m.remove();
      open(pw.value);
    };

    go.onclick = submit;
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  (async () => {
    let saved = null;
    try { saved = sessionStorage.getItem(KEY); } catch {}
    if (saved) {
      const ok = await verify(saved);
      if (ok) return open(saved);
      try { sessionStorage.removeItem(KEY); } catch {}
      return login(ok === null ? 'Tidak bisa terhubung ke server.' : 'Sesi berakhir, masuk lagi.');
    }
    login();
  })();
})();