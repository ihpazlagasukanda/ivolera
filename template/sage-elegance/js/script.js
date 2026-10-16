'use strict';

const API = 'https://script.google.com/macros/s/AKfycbx6c_a04kR_7EBxOTpcRDP9gMoG7bVtgvzQs7_eZzLt8gQyCULH9QY388KaGS2BceZp/exec';

const THEME_ID = 'sage-elegance';
let APP_DATA = null;
let SCROLL_CONTAINER = null;

/* Cek apakah ini demo — kalau ya, disable RSVP & gift */
const IS_DEMO = (function(){
  const params = new URLSearchParams(location.search);
  return params.get('demo') === '1'
    || sessionStorage.getItem('ivolera-is-demo') === '1';
})();

/* ===================== HELPERS ===================== */
function getSlugFromURL(){
  const p = new URLSearchParams(location.search);
  return (p.get('invite') || p.get('slug') || p.get('id') || '').trim();
}

function fmtTanggal(s){
  if(!s) return '';
  try{
    const d = new Date(s);
    if(isNaN(d)) return s;
    return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  }catch(e){ return s; }
}

function fmtJam(s){
  if(s === null || s === undefined || s === '') return '';
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if(m && !str.includes('T') && !str.includes('-')){
    return String(m[1]).padStart(2,'0') + ':' + m[2];
  }
  try{
    const d = new Date(s);
    if(!isNaN(d.getTime())){
      const hh = String(d.getUTCHours()).padStart(2,'0');
      const mm = String(d.getUTCMinutes()).padStart(2,'0');
      return `${hh}:${mm}`;
    }
  }catch(e){}
  return '';
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function isDesktop(){ return window.innerWidth > 768; }

function parseTanggal(s){
  if(!s) return null;
  if(s instanceof Date && !isNaN(s.getTime())) return s;
  const str = String(s).trim();
  let d = new Date(str);
  if(!isNaN(d.getTime())) return d;
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){
    const dd = parseInt(m[1],10), mm = parseInt(m[2],10) - 1, yy = parseInt(m[3],10);
    const yyyy = yy < 100 ? (yy < 50 ? 2000 + yy : 1900 + yy) : yy;
    d = new Date(yyyy, mm, dd);
    if(!isNaN(d.getTime())) return d;
  }
  const bulanID = {
    januari:0, februari:1, maret:2, april:3, mei:4, juni:5,
    juli:6, agustus:7, september:8, oktober:9, november:10, desember:11,
    jan:0, feb:1, mar:2, apr:3, jun:5, jul:6, agu:7, agt:7, sep:8, okt:9, nov:10, des:11
  };
  m = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if(m){
    const dd = parseInt(m[1],10);
    const mm = bulanID[m[2].toLowerCase()];
    const yy = parseInt(m[3],10);
    if(mm !== undefined){
      d = new Date(yy, mm, dd);
      if(!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function initialsOf(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  if(parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = [
  '#5F7059','#8A5D44','#8A6F3D','#A87672',
  '#6E5F55','#4A5844','#7A5B6E','#6B7A85'
];
function avatarColor(name){
  let h = 0;
  const s = String(name || '');
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* =====================================================================
   IMAGE LOADER — andal dengan onload / onerror + retry
   ===================================================================== */
function loadImage(imgEl, src, opts){
  opts = opts || {};
  if(!imgEl || !src) {
    if(imgEl && imgEl.closest('[id$="Wrap"]')) imgEl.closest('[id$="Wrap"]').hidden = true;
    return;
  }

  let attempts = 0;
  const maxAttempts = 2;

  function tryLoad(){
    attempts++;
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      imgEl.src = src;
      imgEl.classList.add('loaded');
      imgEl.removeAttribute('style');
      if(imgEl.closest('[id$="Wrap"]')) imgEl.closest('[id$="Wrap"]').hidden = false;
    };
    probe.onerror = () => {
      if(attempts < maxAttempts){
        setTimeout(tryLoad, 800);
      } else {
        const wrap = imgEl.closest('[id$="Wrap"]');
        if(wrap) wrap.hidden = true;
      }
    };
    probe.src = src;
  }
  tryLoad();
}

/* =====================================================================
   MAPPING API → TEMPLATE
   ===================================================================== */
function mapApiToTemplate(apiData){
  const pria   = apiData.pria   || {};
  const wanita = apiData.wanita || {};
  const akad   = apiData.akad   || {};
  const resepsi= apiData.resepsi|| {};

  return {
    meta: {
      title: `${pria.nama || 'Pria'} & ${wanita.nama || 'Wanita'} — Undangan Pernikahan`,
      monogram: (((pria.nama || '').charAt(0) + (wanita.nama || '').charAt(0))).toUpperCase() || 'IV'
    },
    couple: {
      groom: {
        shortName: (pria.nama || '').split(' ')[0] || 'Pria',
        fullName: pria.nama || 'Pria',
        about: pria.gelar || pria.urutan || '',
        parents: `Putra dari ${pria.bapak || '-'} & ${pria.ibu || '-'}`,
        photo: pria.foto || ''
      },
      bride: {
        shortName: (wanita.nama || '').split(' ')[0] || 'Wanita',
        fullName: wanita.nama || 'Wanita',
        about: wanita.gelar || wanita.urutan || '',
        parents: `Putri dari ${wanita.bapak || '-'} & ${wanita.ibu || '-'}`,
        photo: wanita.foto || ''
      }
    },
    event: {
      akadDate: akad.tanggal || '',
      resepsiDate: resepsi.tanggal || '',
      displayDate: fmtTanggal(akad.tanggal || resepsi.tanggal),
      location: akad.lokasi || resepsi.lokasi || '',
      akad: {
        title: 'Akad Nikah',
        time: (function(){
          const tgl = fmtTanggal(akad.tanggal);
          const jm = fmtJam(akad.jamMulai);
          const js = fmtJam(akad.jamSelesai);
          let s = tgl;
          if(jm && js) s += ` · ${jm} - ${js}`;
          else if(jm) s += ` · ${jm}`;
          return s;
        })(),
        venue: akad.lokasi || '',
        address: akad.alamat || '',
        mapsUrl: akad.maps || '#'
      },
      resepsi: {
        title: 'Resepsi',
        time: (function(){
          const tgl = fmtTanggal(resepsi.tanggal);
          const jm = fmtJam(resepsi.jamMulai);
          const js = fmtJam(resepsi.jamSelesai);
          let s = tgl;
          if(jm && js) s += ` · ${jm} - ${js}`;
          else if(jm) s += ` · ${jm}`;
          return s;
        })(),
        venue: resepsi.lokasi || '',
        address: resepsi.alamat || '',
        mapsUrl: resepsi.maps || '#'
      }
    },
    loveStory: (apiData.cerita || []).map(c => ({
      year: c.tahun || '',
      title: c.judul || '',
      desc: c.isi || ''
    })),
    gallery: (apiData.galeri || []).map((src, i) => ({
      src: src,
      alt: `Foto ${i + 1}`
    })),
    gift: (function(){
      const r = (apiData.rekening && apiData.rekening[0]) || {};
      return {
        bank: r.bank || '-',
        accountNumber: r.nomor || '-',
        accountHolder: r.nama || '-'
      };
    })(),
    theme: { musicPath: apiData.musik || '' },
    defaultWishes: []
  };
}

/* =====================================================================
   LOAD DATA
   ===================================================================== */
(async function loadData(){
  const slug = getSlugFromURL();

  if(!slug){
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;font-family:'DM Sans',sans-serif;background:#FAF8F5;color:#494441">
        <div>
          <div style="font-size:48px;margin-bottom:16px;opacity:.4">🔗</div>
          <h1 style="margin-bottom:8px;font-family:'Cormorant Garamond',serif;font-weight:500">Link Tidak Valid</h1>
          <p style="color:#9B8980;font-size:14px">Link undangan tidak menyertakan slug.</p>
        </div>
      </div>`;
    return;
  }

  let data = null;

  try{
    const cached = sessionStorage.getItem('ivolera-invitation');
    const ts = parseInt(sessionStorage.getItem('ivolera-invitation-ts') || '0', 10);
    if(cached && (Date.now() - ts) < 5 * 60 * 1000){
      const parsed = JSON.parse(cached);
      if(parsed && parsed.slug && String(parsed.slug).toLowerCase() === slug.toLowerCase()){
        data = parsed;
      }
    }
  }catch(e){}

  if(!data){
    try{
      const url = `${API}?action=get&slug=${encodeURIComponent(slug)}&tema=${encodeURIComponent(THEME_ID)}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      const j = await res.json();

      if(j.result === 'error' || j.success === false){
        throw new Error(j.message || 'Undangan tidak ditemukan');
      }

      data = j.data;
      if(!data && j.result === 'success') data = j;

      if(Array.isArray(data)){
        data = data.find(x => String(x.slug).toLowerCase() === slug.toLowerCase());
      }

      if(!data || !data.pria){
        throw new Error('Data undangan tidak lengkap');
      }

      try{
        sessionStorage.setItem('ivolera-invitation', JSON.stringify(data));
        sessionStorage.setItem('ivolera-invitation-ts', Date.now());
      }catch(e){}

    }catch(err){
      const loader = document.getElementById('loader');
      if(loader) loader.remove();
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;font-family:'DM Sans',sans-serif;background:#FAF8F5;color:#494441">
          <div>
            <div style="font-size:48px;margin-bottom:16px;opacity:.4">💌</div>
            <h1 style="margin-bottom:8px;font-family:'Cormorant Garamond',serif;font-weight:500;font-size:24px">Undangan Tidak Ditemukan</h1>
            <p style="color:#9B8980;font-size:14px;line-height:1.6">${esc(err.message || 'Silakan coba lagi.')}</p>
          </div>
        </div>`;
      return;
    }
  }

  APP_DATA = mapApiToTemplate(data);
  initApp(APP_DATA);
})();

/* =====================================================================
   INIT
   ===================================================================== */
function initApp(data){
  updateScrollContainer();
  populateAllContent(data);
  initOpeningVideo();
  initHeroVideo();
  initOpening(data);
  initScrollReveal();
  initBottomNav();
  initCountdown(data.event.akadDate, data.event.resepsiDate);
  initGallery();
  loadWishes();
  initRSVP();
  initGiftCopy();
  initHoverMimic();
  initFloaters();

  const loader = document.getElementById('loader');
  if(loader){
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 1000);
  }

  window.addEventListener('resize', () => {
    updateScrollContainer();
    initScrollReveal();
    initHoverMimic();
  });
}

function updateScrollContainer(){
  SCROLL_CONTAINER = isDesktop() ? document.getElementById('invitationScroll') : null;
}

/* =====================================================================
   FLOATING DECORATIONS
   ===================================================================== */
function initFloaters(){
  const container = document.getElementById('floatDecor');
  if(!container) return;

  const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(prefersReduce) return;

  const SVG_BUTTERFLY = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#A87672" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 6c-2-3-6-3-7 0s1 6 4 6c-3 0-5 3-4 6s5 3 7 0c2 3 6 3 7 0s-1-6-4-6c3 0 5-3 4-6s-5-3-7 0z"/>
    <path d="M12 6v12"/>
  </svg>`;
  const SVG_BIRD = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8A6F3D" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 14c3-1 5-2 7-5 1-2 3-3 5-2 1-2 3-2 5-1"/>
    <path d="M15 7c-1 2-2 4-4 5"/>
  </svg>`;

  const symbols = ['❀','✿','❁','✾'];

  function spawnPetal(){
    const el = document.createElement('div');
    el.className = 'floater petal';
    el.textContent = symbols[Math.floor(Math.random()*symbols.length)];
    el.style.left = Math.random()*100 + 'vw';
    el.style.fontSize = (10 + Math.random()*8) + 'px';
    el.style.animationDuration = (14 + Math.random()*10) + 's';
    el.style.animationDelay = (Math.random()*4) + 's';
    el.style.color = Math.random() > .5 ? '#E8D4D0' : '#E5D8CB';
    container.appendChild(el);
    setTimeout(() => el.remove(), 30000);
  }
  function spawnLeaf(){
    const el = document.createElement('div');
    el.className = 'floater leaf';
    el.textContent = '❧';
    el.style.left = Math.random()*100 + 'vw';
    el.style.fontSize = (10 + Math.random()*6) + 'px';
    el.style.animationDuration = (16 + Math.random()*10) + 's';
    el.style.animationDelay = (Math.random()*5) + 's';
    el.style.color = Math.random() > .5 ? '#A8B5A0' : '#C9A68F';
    container.appendChild(el);
    setTimeout(() => el.remove(), 34000);
  }
  function spawnButterfly(){
    const el = document.createElement('div');
    el.className = 'floater butterfly';
    el.innerHTML = SVG_BUTTERFLY;
    el.style.left = (5 + Math.random()*70) + 'vw';
    el.style.top = (15 + Math.random()*60) + 'vh';
    el.style.animationDuration = (9 + Math.random()*4) + 's';
    el.style.animationDelay = (Math.random()*6) + 's';
    container.appendChild(el);
    setTimeout(() => el.remove(), 22000);
  }
  function spawnBird(){
    const el = document.createElement('div');
    el.className = 'floater bird';
    el.innerHTML = SVG_BIRD;
    el.style.left = '-30px';
    el.style.top = (5 + Math.random()*25) + 'vh';
    el.style.animationDuration = (12 + Math.random()*6) + 's';
    el.style.animationDelay = (Math.random()*8) + 's';
    container.appendChild(el);
    setTimeout(() => el.remove(), 24000);
  }

  for(let i = 0; i < 6; i++) setTimeout(spawnPetal, i * 600);
  for(let i = 0; i < 2; i++) setTimeout(spawnButterfly, 1200 + i * 3000);
  for(let i = 0; i < 2; i++) setTimeout(spawnBird, 2000 + i * 4000);
  for(let i = 0; i < 3; i++) setTimeout(spawnLeaf, 800 + i * 1800);

  setInterval(spawnPetal, 4500);
  setInterval(spawnLeaf, 7000);
  setInterval(spawnButterfly, 12000);
  setInterval(spawnBird, 14000);
}

/* =====================================================================
   GALLERY AUTO-COLUMN PICKER
   Pilih 3 atau 4 kolom sesuai jumlah foto biar nol slot kosong
   ===================================================================== */
function pickGalleryCols(n){
  if(n <= 1) return 1;
  if(n === 2) return 2;
  if(n === 3) return 3;
  if(n === 4) return 4;

  /* Prioritas: kalau habis dibagi 4 → 4 kolom PAS */
  if(n % 4 === 0) return 4;
  /* Kalau habis dibagi 3 → 3 kolom PAS */
  if(n % 3 === 0) return 3;

  /* Sisa: pilih yang paling sedikit slot kosongnya */
  const rem4 = (4 - (n % 4)) % 4;   // sisa kalau 4 kolom
  const rem3 = (3 - (n % 3)) % 3;   // sisa kalau 3 kolom
  return rem3 < rem4 ? 3 : 4;
}

/* =====================================================================
   POPULATE
   ===================================================================== */
function populateAllContent(data){
  const { meta, couple, event, loveStory, gallery, gift, theme, defaultWishes } = data;

  document.title = meta.title;

  const oNames = document.getElementById('openingNames');
  if(oNames) oNames.innerHTML = `${esc(couple.bride.shortName)} <span class="amp">&amp;</span> ${esc(couple.groom.shortName)}`;

  const oDate = document.getElementById('openingDate');
  if(oDate) oDate.textContent = event.displayDate;

  const openingGuest = document.getElementById('openingGuest');
  const openingGuestName = document.getElementById('openingGuestName');
  if(openingGuest && openingGuestName){
    const params = new URLSearchParams(location.search);
    const guest = (params.get('to') || '').trim();
    if(guest){
      openingGuestName.textContent = guest;
      openingGuest.hidden = false;
    } else {
      openingGuest.hidden = true;
    }
  }

  const hMon = document.getElementById('heroMonogram');
  if(hMon) hMon.textContent = meta.monogram;

  const hNames = document.getElementById('heroNames');
  if(hNames) hNames.innerHTML = `${esc(couple.bride.shortName)} <span class="hero-amp">&amp;</span> ${esc(couple.groom.shortName)}`;

  const hDate = document.getElementById('heroDate');
  if(hDate) hDate.innerHTML = `${esc(event.displayDate)}<br>${esc(event.location)}`;

  /* Couple — pakai loadImage untuk background */
  const coupleGrid = document.getElementById('coupleGrid');
  if(coupleGrid){
    coupleGrid.innerHTML = `
      <div class="couple-card">
        <div class="couple-photo-wrap">
          <div class="couple-photo" id="groomPhoto" data-src="${esc(couple.groom.photo)}"></div>
        </div>
        <div class="couple-name">${esc(couple.groom.fullName)}</div>
        <div class="couple-sub">${esc(couple.groom.about)}</div>
        <div class="couple-desc">${esc(couple.groom.parents)}</div>
      </div>
      <div class="couple-and">&amp;</div>
      <div class="couple-card">
        <div class="couple-photo-wrap">
          <div class="couple-photo" id="bridePhoto" data-src="${esc(couple.bride.photo)}"></div>
        </div>
        <div class="couple-name">${esc(couple.bride.fullName)}</div>
        <div class="couple-sub">${esc(couple.bride.about)}</div>
        <div class="couple-desc">${esc(couple.bride.parents)}</div>
      </div>`;

    ['groomPhoto','bridePhoto'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      const src = el.dataset.src;
      if(!src) return;
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => {
        el.style.backgroundImage = `url('${src}')`;
        el.classList.add('loaded');
      };
      probe.onerror = () => { /* biarkan cream background */ };
      probe.src = src;
    });
  }

  /* Love Story */
  const storyStage = document.getElementById('timelineContainer');
  if(storyStage){
    if(loveStory.length){
      storyStage.innerHTML = loveStory.map((item, i) => {
        const isRight = i % 2 === 1;
        const num = String(i + 1).padStart(2, '0');
        return `
          <div class="story-item reveal">
            <div class="story-marker">
              <svg viewBox="0 0 24 24">
                <path d="M12 21s-6-5.5-6-10a6 6 0 0112 0c0 4.5-6 10-6 10z"/>
                <circle cx="12" cy="11" r="2.2"/>
              </svg>
              <span class="marker-num">${num}</span>
            </div>
            <div class="story-body ${isRight ? 'right' : ''}">
              <span class="story-year">${esc(item.year)}</span>
              <h3 class="story-title">${esc(item.title)}</h3>
              <p class="story-desc">${esc(item.desc)}</p>
            </div>
          </div>`;
      }).join('');
    } else {
      const sec = document.getElementById('love-story');
      if(sec) sec.style.display = 'none';
    }
  }

  /* Event */
  const eventGrid = document.getElementById('eventGrid');
  if(eventGrid){
    const cards = [];

    if(event.akad && (event.akad.time || event.akad.venue)){
      cards.push(`
        <div class="event-card">
          <h3>${esc(event.akad.title)}</h3>
          <div class="divider"></div>
          <div class="event-time">${esc(event.akad.time)}</div>
          <div class="event-place">${esc(event.akad.venue)}<br>${esc(event.akad.address)}</div>
          ${event.akad.mapsUrl && event.akad.mapsUrl !== '#' ? `<a class="btn" href="${esc(event.akad.mapsUrl)}" target="_blank" rel="noopener">Lihat Peta</a>` : ''}
        </div>`);
    }

    if(event.resepsi && (event.resepsi.time || event.resepsi.venue)){
      cards.push(`
        <div class="event-card">
          <h3>${esc(event.resepsi.title)}</h3>
          <div class="divider"></div>
          <div class="event-time">${esc(event.resepsi.time)}</div>
          <div class="event-place">${esc(event.resepsi.venue)}<br>${esc(event.resepsi.address)}</div>
          ${event.resepsi.mapsUrl && event.resepsi.mapsUrl !== '#' ? `<a class="btn" href="${esc(event.resepsi.mapsUrl)}" target="_blank" rel="noopener">Lihat Peta</a>` : ''}
        </div>`);
    }

    eventGrid.innerHTML = cards.join('');
  }

  /* Gallery */
  const galleryGrid = document.getElementById('galleryGrid');
  if(galleryGrid){
    if(gallery.length){
      galleryGrid.innerHTML = gallery.map(item => `
        <div class="g-item"><img data-src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy"></div>
      `).join('');

      /* Lazy load via probe */
      galleryGrid.querySelectorAll('img[data-src]').forEach(imgEl => {
        const src = imgEl.dataset.src;
        if(!src) return;
        const probe = new Image();
        probe.referrerPolicy = 'no-referrer';
        probe.onload = () => {
          imgEl.src = src;
          imgEl.classList.add('loaded');
        };
        probe.onerror = () => {
          const item = imgEl.closest('.g-item');
          if(item) item.style.display = 'none';
        };
        probe.src = src;
      });
    } else {
      const sec = document.getElementById('gallery');
      if(sec) sec.style.display = 'none';
    }
  }

  /* ============================================================
     COUNTDOWN PHOTO — ambil galeri pertama
     ============================================================ */
  const countdownPhoto = document.getElementById('countdownPhoto');
  const countdownWrap = document.getElementById('countdownPhotoWrap');
  if(countdownPhoto && countdownWrap){
    if(gallery.length){
      countdownWrap.hidden = false;
      loadImage(countdownPhoto, gallery[0].src);
    } else {
      countdownWrap.hidden = true;
    }
  }

  /* ============================================================
     CLOSING PHOTO — ambil galeri terakhir (fallback ke galeri 1)
     ============================================================ */
  const closingPhoto = document.getElementById('closingPhoto');
  const closingWrap = document.getElementById('closingPhotoWrap');
  if(closingPhoto && closingWrap){
    let pick = null;
    if(gallery.length >= 2){
      pick = gallery[gallery.length - 1];
    } else if(gallery.length === 1){
      pick = gallery[0];
    }
    if(pick){
      closingWrap.hidden = false;
      loadImage(closingPhoto, pick.src);
    } else {
      closingWrap.hidden = true;
    }
  }

  /* Gift */
  const gBank = document.getElementById('giftBank');
  if(gBank) gBank.textContent = gift.bank;

  const gNum = document.getElementById('giftNum');
  if(gNum) gNum.textContent = String(gift.accountNumber || '').replace(/(\d{4})/g, '$1 ').trim();

  const gName = document.getElementById('giftName');
  if(gName) gName.textContent = `a.n. ${gift.accountHolder}`;

  const giftSec = document.getElementById('gift');
  if(giftSec && (!gift.accountNumber || gift.accountNumber === '-')){
    giftSec.style.display = 'none';
  }

  /* Music */
  const musicSourceEl = document.getElementById('musicSource');
  const bgMusicEl = document.getElementById('bgMusic');
  if(theme && theme.musicPath && musicSourceEl && bgMusicEl){
    musicSourceEl.src = theme.musicPath;
    bgMusicEl.load();
  }
  if(bgMusicEl){
    bgMusicEl.setAttribute('playsinline', '');
    bgMusicEl.playsInline = true;
  }

  /* Closing names */
  const closing = document.getElementById('closingNames');
  if(closing) closing.innerHTML = `${esc(couple.bride.shortName)} <span class="hero-amp">&amp;</span> ${esc(couple.groom.shortName)}`;

  /* Default wishes */
  const wishList = document.getElementById('wishList');
  if(wishList && defaultWishes && defaultWishes.length){
    wishList.innerHTML = defaultWishes.map(w => renderWishItem(w)).join('');
  }
}

/* =====================================================================
   RENDER WISH ITEM
   ===================================================================== */
function renderWishItem(w){
  const name = w.nama || w.name || 'Tamu Undangan';
  const status = w.hadir || w.status || 'Hadir';
  const text = w.pesan || w.body || '';
  const initial = initialsOf(name);
  const color = avatarColor(name);

  let statusClass = 'hadir';
  const s = String(status).toLowerCase();
  if(s.includes('tidak')) statusClass = 'tidak-hadir';
  else if(s.includes('belum')) statusClass = 'belum-pasti';

  return `
    <div class="wish">
      <div class="wish-avatar" style="background:${color}">${esc(initial)}</div>
      <div class="wish-body">
        <div class="wish-head">
          <span class="wish-name">${esc(name)}</span>
          <span class="wish-status ${statusClass}">${esc(status)}</span>
        </div>
        ${text ? `<p class="wish-text">${esc(text)}</p>` : ''}
      </div>
    </div>`;
}

/* =====================================================================
   OPENING VIDEO
   ===================================================================== */
function initOpeningVideo(){
  const video = document.getElementById('openingVideo');
  if(!video) return;

  video.autoplay = false;
  video.loop = false;
  video.muted = true;
  video.volume = 0;

  function pauseAtStart(){
    try{
      video.pause();
      if(video.readyState >= 1) video.currentTime = 0;
    }catch(e){}
  }

  video.addEventListener('loadedmetadata', pauseAtStart);
  video.addEventListener('loadeddata', pauseAtStart);
  video.addEventListener('canplay', pauseAtStart);
  video.addEventListener('play', () => {
    try{
      video.pause();
      if(video.readyState >= 1) video.currentTime = 0;
    }catch(e){}
  });

  if(video.readyState >= 1) pauseAtStart();

  video.addEventListener('error', () => {
    video.style.display = 'none';
  });
}

/* =====================================================================
   HERO VIDEO
   ===================================================================== */
function initHeroVideo(){
  const video = document.getElementById('heroVideo');
  if(!video) return;

  video.autoplay = false;
  video.loop = false;
  video.muted = true;
  video.volume = 0;

  try{ video.pause(); }catch(e){}

  video.addEventListener('error', () => {
    video.style.display = 'none';
  });

  window.playHeroVideo = function(){
    try{
      video.currentTime = 0;
      const p = video.play();
      if(p !== undefined){
        p.catch(() => {});
      }
      video.addEventListener('ended', function onEnded(){
        video.removeEventListener('ended', onEnded);
        try{ video.pause(); }catch(e){}
      }, { once: true });
    }catch(e){}
  };
}

/* =====================================================================
   OPENING + MUSIC — versi FINAL yang lebih robust
   ===================================================================== */
function initOpening(data){
  const opening     = document.getElementById('opening');
  const openingBtn  = document.getElementById('openingBtn');
  const bottomnav   = document.getElementById('bottomnav');
  const musicToggle = document.getElementById('musicToggle');
  const bgMusic     = document.getElementById('bgMusic');

  if(!opening || !openingBtn) return;

  document.body.style.overflow = 'hidden';

  /* ============================================================
     1. PERSIAPAN AUDIO
     ============================================================ */
  if(bgMusic){
    bgMusic.volume = 0.5;
    bgMusic.muted = false;
    bgMusic.setAttribute('playsinline', '');
    bgMusic.setAttribute('webkit-playsinline', '');
    bgMusic.playsInline = true;

    /* Mulai buffer audio */
    try{ bgMusic.load(); }catch(e){}

    /* Track state */
    bgMusic.addEventListener('play', () => {
      if(musicToggle) musicToggle.classList.add('playing');
    });
    bgMusic.addEventListener('pause', () => {
      if(musicToggle) musicToggle.classList.remove('playing');
    });
    bgMusic.addEventListener('error', () => {
      console.warn('❌ Audio error:', bgMusic.error);
    });
  }

  /* ============================================================
     2. FUNGSI UNLOCK AUDIO
     Trik: play() dengan volume 0 → langsung pause
     Setelah berhasil, hapus semua listener
     ============================================================ */
  let audioUnlocked = false;

function unlockAudio(){
  if(audioUnlocked || !bgMusic) return;
  if(!bgMusic.paused) return;  /* ← skip kalau musik sudah play */

  const src = bgMusic.querySelector('source');
  const hasSrc = (bgMusic.src && bgMusic.src !== location.href)
                 || (src && src.src);
  if(!hasSrc) return;

  const originalVolume = bgMusic.volume;
  bgMusic.volume = 0;

  const p = bgMusic.play();
  if(p !== undefined){
    p.then(() => {
      bgMusic.pause();
      bgMusic.currentTime = 0;
      bgMusic.volume = originalVolume;
      audioUnlocked = true;
      removeUnlockListeners();
      console.log('✅ Audio unlocked');
    }).catch(() => {
      bgMusic.volume = originalVolume;
    });
  }
}

/* ⚠️ JANGAN pakai 'click' — konflik dengan tombol Buka Undangan */
const unlockEvents = ['touchstart', 'touchend', 'keydown'];

function removeUnlockListeners(){
  unlockEvents.forEach(evt => {
    document.removeEventListener(evt, unlockAudio);
  });
}

unlockEvents.forEach(evt => {
  document.addEventListener(evt, unlockAudio, { passive: true });
});

  /* ============================================================
     3. FUNGSI PLAY MUSIK — synchronous + cek readyState
     ============================================================ */
  function playMusicSync(){
    if(!bgMusic) return;

    const src = bgMusic.querySelector('source');
    const hasSrc = (bgMusic.src && bgMusic.src !== location.href)
                   || (src && src.src);
    if(!hasSrc){
      console.warn('⚠️ Musik belum diset src-nya');
      return;
    }

    bgMusic.volume = 0.5;
    bgMusic.muted = false;

    /* ✅ Panggil play() LANGSUNG di dalam event handler (synchronous) */
    const p = bgMusic.play();

    if(p !== undefined){
      p.then(() => {
        if(musicToggle) musicToggle.classList.add('playing');
        console.log('✅ Musik berhasil diputar');
      }).catch(err => {
        console.warn('⚠️ Musik gagal diputar:', err.message);
        if(musicToggle) musicToggle.classList.remove('playing');

        /* Retry sekali lagi setelah interaksi user */
        const retry = () => {
          bgMusic.play().then(() => {
            if(musicToggle) musicToggle.classList.add('playing');
          }).catch(() => {});
        };
        document.addEventListener('click', retry, { once: true });
        document.addEventListener('touchend', retry, { once: true });
      });
    }
  }

  /* ============================================================
     4. KLIK TOMBOL "BUKA UNDANGAN"
     ============================================================ */
  openingBtn.addEventListener('click', () => {
    /* ✅ Play music SYNCHRONOUSLY (di dalam event handler) */
    playMusicSync();

    /* Pause & hapus video opening */
    const openingVideo = document.getElementById('openingVideo');
    if(openingVideo){
      try{ openingVideo.pause(); }catch(e){}
      openingVideo.remove();
    }

    /* Play hero video */
    if(typeof window.playHeroVideo === 'function'){
      window.playHeroVideo();
    }

    /* Sembunyikan opening */
    opening.classList.add('hidden');
    if(bottomnav)   bottomnav.classList.add('show');
    if(musicToggle) musicToggle.classList.add('show');

    document.body.style.overflow = '';

    setTimeout(() => {
      if(opening.parentNode) opening.remove();
    }, 1600);
  });

  /* ============================================================
     5. MUSIC TOGGLE (tombol manual)
     ============================================================ */
  if(musicToggle){
    musicToggle.addEventListener('click', () => {
      if(!bgMusic) return;
      if(bgMusic.paused){
        bgMusic.play().then(() => {
          musicToggle.classList.add('playing');
        }).catch(() => {});
      } else {
        bgMusic.pause();
        musicToggle.classList.remove('playing');
      }
    });
  }
}

/* =====================================================================
   SCROLL REVEAL
   ===================================================================== */
function initScrollReveal(){
  const revealEls = document.querySelectorAll('.reveal:not(.in), .vine:not(.in)');
  if(!revealEls.length) return;

  const root = isDesktop() ? document.getElementById('invitationScroll') : null;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, root: root });

  revealEls.forEach(el => io.observe(el));
}

/* =====================================================================
   BOTTOM NAV
   ===================================================================== */
function initBottomNav(){
  const navLinks = document.querySelectorAll('.nav-item');
  if(!navLinks.length) return;

  const sections = [...navLinks].map(a => document.querySelector(a.getAttribute('href')));

  function getScrollTop(){
    return isDesktop() && SCROLL_CONTAINER ? SCROLL_CONTAINER.scrollTop : window.scrollY;
  }

  function updateActive(){
    let idx = 0;
    const st = getScrollTop() + 200;
    sections.forEach((s, i) => {
      if(s && st >= s.offsetTop) idx = i;
    });
    navLinks.forEach(a => a.classList.remove('active'));
    if(navLinks[idx]) navLinks[idx].classList.add('active');
  }

  const scrollTarget = isDesktop() && SCROLL_CONTAINER ? SCROLL_CONTAINER : window;
  scrollTarget.addEventListener('scroll', updateActive, { passive: true });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if(href && href.startsWith('#')){
        e.preventDefault();
        const targetEl = document.querySelector(href);
        if(!targetEl) return;
        if(isDesktop() && SCROLL_CONTAINER){
          SCROLL_CONTAINER.scrollTo({ top: targetEl.offsetTop, behavior: 'smooth' });
        } else {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  setTimeout(updateActive, 100);
}

/* =====================================================================
   COUNTDOWN
   ===================================================================== */
function initCountdown(akadDateStr, resepsiDateStr){
  const els = {
    d: document.getElementById('cdDays'),
    h: document.getElementById('cdHours'),
    m: document.getElementById('cdMinutes'),
    s: document.getElementById('cdSeconds')
  };
  if(!els.d || !els.h || !els.m || !els.s) return;

  function setZero(){
    els.d.textContent = '00';
    els.h.textContent = '00';
    els.m.textContent = '00';
    els.s.textContent = '00';
  }

  function normalizeDate(d){
    if(!d) return null;
    const td = new Date(d.getTime());
    if(td.getHours() === 0 && td.getMinutes() === 0 && td.getSeconds() === 0){
      td.setHours(0, 0, 0, 0);
    }
    return td;
  }

  const akadDate    = normalizeDate(parseTanggal(akadDateStr));
  const resepsiDate = normalizeDate(parseTanggal(resepsiDateStr));

  const now = Date.now();
  let target = null;
  let targetLabel = '';

  if(akadDate && akadDate.getTime() > now){
    target = akadDate.getTime();
    targetLabel = 'Akad';
  } else if(resepsiDate && resepsiDate.getTime() > now){
    target = resepsiDate.getTime();
    targetLabel = 'Resepsi';
  }

  if(!target){ setZero(); return; }

  let intervalId = null;

  function tick(){
    const nowMs = Date.now();
    const diff = Math.max(0, target - nowMs);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    els.d.textContent = String(d).padStart(2, '0');
    els.h.textContent = String(h).padStart(2, '0');
    els.m.textContent = String(m).padStart(2, '0');
    els.s.textContent = String(s).padStart(2, '0');

    if(diff <= 0){
      if(targetLabel === 'Akad' && resepsiDate && resepsiDate.getTime() > nowMs){
        target = resepsiDate.getTime();
        targetLabel = 'Resepsi';
        return;
      }
      setZero();
      if(intervalId){ clearInterval(intervalId); intervalId = null; }
    }
  }

  tick();
  intervalId = setInterval(tick, 1000);
}

/* =====================================================================
   GALLERY LIGHTBOX
   ===================================================================== */
function initGallery(){
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const galleryGrid = document.getElementById('galleryGrid');
  if(!lightbox || !lightboxImg || !galleryGrid) return;

  galleryGrid.addEventListener('click', (e) => {
    const img = e.target.closest('.g-item img');
    if(img && img.src){
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
    }
  });

  lightbox.addEventListener('click', (e) => {
    if(e.target === lightbox || e.target.classList.contains('close')){
      lightbox.classList.remove('open');
    }
  });

  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') lightbox.classList.remove('open');
  });
}

/* =====================================================================
   RSVP
   ===================================================================== */
function initRSVP(){
  const rsvpForm = document.getElementById('rsvpForm');
  const rsvpMsg  = document.getElementById('rsvp-msg');
  if(!rsvpForm) return;

  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = (document.getElementById('name').value || '').trim() || 'Tamu Undangan';
    const wish = (document.getElementById('wish').value || '').trim();
    const attendEl = rsvpForm.querySelector('input[name="attend"]:checked');
    const attend = attendEl ? attendEl.value : 'Hadir';
    const slug = getSlugFromURL();

    const submitBtn = rsvpForm.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = 'Mengirim…';
    }

    if(rsvpMsg){
      rsvpMsg.style.display = 'block';
      rsvpMsg.textContent = 'Mengirim…';
    }

    try{
      const res = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({
          action: 'rsvp',
          slug: slug,
          nama: name,
          hadir: attend,
          pesan: wish
        })
      });

      const j = await res.json();

      if(j.result !== 'success'){
        throw new Error(j.message || 'Gagal mengirim');
      }

      if(rsvpMsg){
        rsvpMsg.textContent = 'Terima kasih, konfirmasi Anda sudah terkirim.';
      }

      rsvpForm.reset();

      await loadWishes();

      setTimeout(() => {
        if(rsvpMsg) rsvpMsg.style.display = 'none';
      }, 4500);

    }catch(err){
      if(rsvpMsg){
        rsvpMsg.textContent = 'Gagal mengirim. Coba lagi sebentar.';
        setTimeout(() => { rsvpMsg.style.display = 'none'; }, 4500);
      }
    }finally{
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

/* =====================================================================
   COPY GIFT
   ===================================================================== */
function initGiftCopy(){
  const copyBtn = document.getElementById('copyBtn');
  const giftNum = document.getElementById('giftNum');
  if(!copyBtn || !giftNum) return;

  copyBtn.addEventListener('click', async () => {
    const num = giftNum.textContent.replace(/\s/g, '');
    try{ await navigator.clipboard.writeText(num); }catch(err){}
    copyBtn.textContent = 'Tersalin!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Salin Nomor Rekening';
      copyBtn.classList.remove('copied');
    }, 2400);
  });
}

/* =====================================================================
   HOVER MIMIC
   ===================================================================== */
function initHoverMimic(){
  const selector = '.couple-card, .story-item, .event-card, .g-item, .wish, .gift-card';
  const els = document.querySelectorAll(selector);
  if(!els.length) return;

  const root = isDesktop() ? document.getElementById('invitationScroll') : null;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      entry.target.classList.toggle('in-view', entry.isIntersecting);
    });
  }, {
    threshold: 0.4,
    rootMargin: '-10% 0px -10% 0px',
    root: root
  });

  els.forEach(el => io.observe(el));
}

/* =====================================================================
   LOAD WISHES
   ===================================================================== */
async function loadWishes(){
  const wishList = document.getElementById('wishList');
  if(!wishList) return;

  const slug = getSlugFromURL();
  if(!slug) return;

  try{
    const url = `${API}?action=wishes&slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, { headers: { 'Accept':'application/json' } });
    const j = await res.json();

    if(j.result !== 'success' || !Array.isArray(j.data) || !j.data.length){
      wishList.innerHTML = `<p style="text-align:center;color:var(--charcoal-soft);font-size:.82rem;font-style:italic;">Jadilah yang pertama memberikan doa &amp; ucapan.</p>`;
      return;
    }

    wishList.innerHTML = j.data.map(w => renderWishItem(w)).join('');
  }catch(err){
    wishList.innerHTML = `<p style="text-align:center;color:var(--charcoal-soft);font-size:.82rem;font-style:italic;">Gagal memuat ucapan.</p>`;
  }
}