'use strict';
/* =====================================================================
   Ivolera — order.js (CUSTOMER FORM) v6
   - Fix bug: draft kosong tidak trigger prompt
   - Semua confirm() → askConfirm()
   - No alert/prompt
   ===================================================================== */
const API = 'https://script.google.com/macros/s/AKfycbx6c_a04kR_7EBxOTpcRDP9gMoG7bVtgvzQs7_eZzLt8gQyCULH9QY388KaGS2BceZp/exec';
const ADMIN_WA = '6289609289911'; // 🚨 GANTI
const MAX = { galeri: 20, rangkaian: 10, cerita: 10, rekening: 5 };
const MB = 1048576;
const DRAFT_KEY = 'ivolera-order-draft-v2';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const form = $('undanganForm');
const g = id => { const el = $(id); return el ? el.value.trim() : ''; };

let attempted = false, dirty = false, busy = false, submitted = false;
let currentStep = 0;
const TOTAL_STEPS = 9;

/* =====================================================================
   PAKET & TEMA
   ===================================================================== */
const PAKET_MAP = {
  basic:     { name:'Basic',     price:'Rp49.000',  priceNum:49000 },
  premium:   { name:'Premium',   price:'Rp99.000',  priceNum:99000 },
  exclusive: { name:'Exclusive', price:'Rp199.000', priceNum:199000 }
};
const TEMAS = [
  { id:'sage-elegance',  name:'Sage Elegance',  desc:'Klasik · Natural',  tier:'basic',   bg:'linear-gradient(180deg,#D1EBDB,#EFECE9)', ink:'#192524', deco:'🌿' },
  { id:'deep-teal',      name:'Deep Teal',      desc:'Mewah · Klasik',    tier:'basic',   bg:'linear-gradient(180deg,#3C5759,#192524)', ink:'#EFECE9', deco:'✦' },
  { id:'forest-royale',  name:'Forest Royale',  desc:'Elegan · Bold',     tier:'basic',   bg:'linear-gradient(180deg,#0F1817,#243634)', ink:'#EFECE9', deco:'🌲' },
  { id:'golden-cream',   name:'Golden Cream',   desc:'Modern · Hangat',   tier:'basic',   bg:'linear-gradient(180deg,#FAF3E3,#E8D5A8)', ink:'#192524', deco:'🌅' },
  { id:'rose-blush',     name:'Rose Blush',     desc:'Feminin · Lembut',  tier:'premium', bg:'linear-gradient(180deg,#F4D7DD,#E8B4C0)', ink:'#192524', deco:'🌸' },
  { id:'lavender-dream', name:'Lavender Dream', desc:'Tenang · Elegan',   tier:'premium', bg:'linear-gradient(180deg,#E4DBF0,#C9B8E0)', ink:'#192524', deco:'💜' },
  { id:'ocean-calm',     name:'Ocean Calm',     desc:'Sejuk · Modern',    tier:'premium', bg:'linear-gradient(180deg,#B8D8E8,#7BAAC9)', ink:'#192524', deco:'🌊' },
  { id:'midnight-luxe',  name:'Midnight Luxe',  desc:'Gelap · Mewah',     tier:'premium', bg:'linear-gradient(180deg,#1A1F2E,#0A0E18)', ink:'#E2C27F', deco:'✨' },
  { id:'terracotta',     name:'Terracotta',     desc:'Earthy · Hangat',   tier:'premium', bg:'linear-gradient(180deg,#E5BFA0,#C68B5C)', ink:'#3D2418', deco:'🏺' },
  { id:'pearl-minimal',  name:'Pearl Minimal',  desc:'Bersih · Simple',   tier:'premium', bg:'linear-gradient(180deg,#F5F3EF,#E3DED5)', ink:'#192524', deco:'◯' },
  { id:'emerald-royal',  name:'Emerald Royal',  desc:'Berani · Mewah',    tier:'premium', bg:'linear-gradient(180deg,#1E5945,#0E2E22)', ink:'#E2C27F', deco:'👑' },
  { id:'crystal-white',  name:'Crystal White',  desc:'Modern · Kristal',  tier:'premium', bg:'linear-gradient(180deg,#FFFFFF,#E8EDF0)', ink:'#192524', deco:'💎' }
];

let CURRENT_PAKET = 'premium';
let CURRENT_TEMA = null;

/* Baca paket dari URL atau localStorage */
(function readPaket(){
  const url = new URLSearchParams(location.search);
  let key = (url.get('paket') || '').toLowerCase();
  if(!PAKET_MAP[key]){
    try{
      const saved = JSON.parse(localStorage.getItem('ivolera-paket') || 'null');
      if(saved && PAKET_MAP[saved.key]) key = saved.key;
    }catch(e){}
  }
  if(!PAKET_MAP[key]) key = 'premium';
  CURRENT_PAKET = key;
  try{
    localStorage.setItem('ivolera-paket', JSON.stringify({
      key, name:PAKET_MAP[key].name, price:PAKET_MAP[key].price,
      priceNum:PAKET_MAP[key].priceNum, ts:Date.now()
    }));
  }catch(e){}
})();

/* Baca tema dari URL atau localStorage */
(function readTema(){
  const url = new URLSearchParams(location.search);
  const temaParam = (url.get('tema') || '').toLowerCase();
  let tema = null;

  if(temaParam){
    const found = TEMAS.find(t => t.id === temaParam);
    if(found) tema = { id:found.id, name:found.name, desc:found.desc, tier:found.tier };
    else if(temaParam === 'custom-exclusive') tema = { id:'custom-exclusive', name:'Custom Desain', desc:'Eksklusif', tier:'exclusive' };
  }
  if(!tema){
    try{
      const saved = JSON.parse(localStorage.getItem('ivolera-tema') || 'null');
      if(saved && saved.id) tema = saved;
    }catch(e){}
  }
  if(tema) CURRENT_TEMA = tema;
})();

function renderPilihanCard(){
  const card = $('paketCard');
  if(!card) return;
  const info = PAKET_MAP[CURRENT_PAKET] || PAKET_MAP.premium;
  const nEl = $('paketName'); if(nEl) nEl.textContent = info.name;
  const pEl = $('paketPrice'); if(pEl) pEl.textContent = info.price;
  const tnEl = $('paketTemaName');
  const tdEl = $('paketTemaDesc');
  if(tnEl) tnEl.textContent = CURRENT_TEMA ? CURRENT_TEMA.name : 'Belum dipilih';
  if(tdEl) tdEl.textContent = CURRENT_TEMA ? (CURRENT_TEMA.desc || '') : 'Klik "Ganti" untuk memilih tema';
  card.hidden = false;
}
window.renderPilihanCard = renderPilihanCard;

/* ===================== WIZARD ===================== */
const STEP_TITLES = ['Data umum','Mempelai pria','Mempelai wanita','Akad nikah','Resepsi','Live streaming','Love story','Galeri foto','Rekening'];

function setStep(n){
  currentStep = Math.max(0, Math.min(TOTAL_STEPS-1, n));
  document.querySelectorAll('.step-content').forEach(c => c.classList.toggle('active', +c.dataset.stepContent === currentStep));
  document.querySelectorAll('.step').forEach((li,i) => {
    li.classList.toggle('active', i === currentStep);
    li.classList.toggle('done', i < currentStep);
    const btn = li.querySelector('.step-btn');
    if(i === currentStep) btn.setAttribute('aria-current','step'); else btn.removeAttribute('aria-current');
  });
  const pct = (currentStep / (TOTAL_STEPS-1)) * 100;
  const sp = $('stepperProgress'); if(sp) sp.style.width = pct + '%';
  const mp = $('miniProgress'); if(mp) mp.style.width = pct + '%';
  const meta = $('stepMeta'); if(meta) meta.textContent = `Langkah ${currentStep+1} dari ${TOTAL_STEPS} — ${STEP_TITLES[currentStep]}`;
  const pill = $('stepsPill'); if(pill) pill.textContent = `Langkah ${currentStep+1} dari ${TOTAL_STEPS}`;

  const prev = $('btnPrev');
  if(prev) prev.style.visibility = currentStep === 0 ? 'hidden' : 'visible';

  const isLast = currentStep === TOTAL_STEPS - 1;
  const next = $('btnNext');
  if(next) next.hidden = isLast;

  const subTop = $('btnSubmitTop');
  if(subTop) subTop.hidden = !isLast;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  markErrorsOnStepper();
  saveDraft();
}
function markErrorsOnStepper(){
  document.querySelectorAll('.step').forEach((li,i) => {
    const content = document.querySelector(`[data-step-content="${i}"]`);
    li.classList.toggle('has-error', !!(content && content.querySelector('.invalid')));
  });
}
function validateStep(n){
  const content = document.querySelector(`[data-step-content="${n}"]`);
  if(!content) return [];
  const els = [...content.querySelectorAll('input,select,textarea')].filter(e => (e.id && R[e.id]) || e.dataset.rule);
  const bad = [];
  els.forEach(el => { const m = validateEl(el, true); if(m) bad.push(el); });
  return bad;
}
function nextStep(){
  attempted = true;
  const bad = validateStep(currentStep);
  if(bad.length){
    refreshTabs();
    bad[0].scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>bad[0].focus({preventScroll:true}),300);
    toast(`${bad.length} isian perlu diperbaiki`, 'error', 4000);
    return;
  }
  attempted = false;
  if(currentStep < TOTAL_STEPS-1) setStep(currentStep+1);
}
function prevStep(){ if(currentStep > 0) setStep(currentStep-1); }

/* ===================== VALIDATOR ===================== */
const NAME = /^\p{L}[\p{L}\s.'’-]*$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const len = (l,min,max) => v => v.length<min?`${l} minimal ${min} karakter`:v.length>max?`${l} maksimal ${max} karakter`:'';
const name = l => v => len(l,2,60)(v) || (NAME.test(v)?'':`${l} hanya boleh huruf, spasi, titik, apostrof, atau tanda hubung`);
const gelar = v => len('Gelar',1,40)(v) || (/^[\p{L}\s.,'-]+$/u.test(v)?'':'Gelar hanya boleh huruf, titik, dan koma');
const urlv = (l,test,hint) => v => {
  let u; try{u=new URL(v);}catch{return `${l} bukan URL yang valid (contoh: https://...)`;}
  if(!/^https?:$/.test(u.protocol)) return `${l} harus diawali http:// atau https://`;
  return test && !test(u) ? hint : '';
};
const maps = urlv('Link Maps', u => /(^|\.)(google\.[a-z.]+|goo\.gl|g\.co)$/.test(u.hostname), 'Gunakan link Google Maps');
const timeV = v => TIME.test(v)?'':'Format jam salah. Gunakan 24 jam, contoh 08:00';
const endV = startId => v => {
  if(/^selesai$/i.test(v)) return '';
  if(!TIME.test(v)) return 'Isi jam (contoh 10:00) atau ketik "Selesai"';
  const s = $(startId).value;
  return s && TIME.test(s) && v <= s ? 'Jam selesai harus setelah jam mulai' : '';
};
const localToday = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const dateV = v => {
  if(isNaN(Date.parse(v))) return 'Tanggal tidak valid';
  if(v < localToday()) return 'Tanggal tidak boleh sebelum hari ini';
  return +v.slice(0,4) > new Date().getFullYear()+5 ? 'Tanggal terlalu jauh (maks. 5 tahun ke depan)' : '';
};

const R = {};
R.slug = ['Slug URL',1,
  v => len('Slug',3,60)(v) || (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)?'':'Hanya huruf kecil, angka, dan tanda hubung (contoh: dinda-rifki)'),
  {placeholder:'dinda-rifki',maxlength:60,autocapitalize:'none',autocomplete:'off',spellcheck:'false'},
  'Huruf kecil, angka, tanda hubung. Menjadi alamat link undangan.'];
R.musik = ['URL musik',0, urlv('URL musik', u => /\.mp3$/i.test(u.pathname), 'Link harus mengarah ke file .mp3'),
  {placeholder:'https://contoh.com/lagu.mp3'}, 'Opsional. Link langsung ke file .mp3'];

for(const s of ['Pria','Wanita']){
  const l = s.toLowerCase();
  R['nama'+s] = [`Nama lengkap ${l}`,1,name(`Nama ${l}`),{maxlength:60,autocomplete:'off',placeholder:'Nama lengkap'}];
  R['gelar'+s] = ['Gelar',0,gelar,{maxlength:40,placeholder:'S.Kom., M.T.'},'Opsional'];
  R['urutan'+s] = ['Urutan anak',0,
    v => len('Urutan anak',3,40)(v) || (/^[\p{L}\d\s-]+$/u.test(v)?'':'Hanya huruf/angka (contoh: Putra pertama)'),
    {maxlength:40,placeholder:s==='Pria'?'Putra pertama':'Putri kedua'},'Opsional'];
  R['instagram'+s] = ['Instagram',0,
    v => /^[a-z0-9._]{1,30}$/i.test(v)?'':'Username tidak valid',
    {maxlength:60,placeholder:'username',autocapitalize:'none',autocomplete:'off'},'Opsional, tanpa @'];
  R['namaBapak'+s] = ['Nama bapak',0,name('Nama bapak'),{maxlength:60,placeholder:'Nama ayah'},'Opsional'];
  R['namaIbu'+s] = ['Nama ibu',0,name('Nama ibu'),{maxlength:60,placeholder:'Nama ibu'},'Opsional'];
  R['foto'+s] = [`Foto mempelai ${l}`,1,()=>'',{accept:'image/jpeg,image/png,image/webp'},'JPG/PNG/WebP, maks. 15 MB'];
}
for(const A of ['Akad','Resepsi']){
  const a = A.toLowerCase();
  R['tanggal'+A] = [`Tanggal ${a}`,1, A==='Akad'?dateV: v => dateV(v) || (g('tanggalAkad') && v < g('tanggalAkad') ? 'Tanggal resepsi tidak boleh sebelum tanggal akad' : '')];
  R[`jam${A}Mulai`] = [`Jam mulai ${a}`,1,timeV,{},'Format 24 jam, contoh 08:00'];
  R[`jam${A}Selesai`] = [`Jam selesai ${a}`,1,endV(`jam${A}Mulai`),{placeholder:'10:00 atau Selesai',maxlength:8,inputmode:'numeric'},'Isi jam atau klik "Selesai"'];
  R['lokasi'+A] = [`Lokasi ${a}`,1,len('Lokasi',3,80),{maxlength:80,placeholder:'Nama gedung / tempat'}];
  R['alamat'+A] = [`Alamat ${a}`,1,len('Alamat',10,200),{maxlength:200,placeholder:'Jalan, nomor, kelurahan, kota'},'Minimal 10 karakter'];
  R['maps'+A] = ['Link Maps',0,maps,{placeholder:'https://maps.app.goo.gl/...'},'Opsional'];
}
R.livePlatform = ['Platform live', () => !!g('liveLink'), len('Platform',2,30),
  {maxlength:30,placeholder:'YouTube',list:'platformList'},'Opsional'];
R.liveLink = ['Link live', () => !!g('livePlatform'), urlv('Link live'),
  {placeholder:'https://youtube.com/live/...'},'Wajib diisi jika platform diisi'];

const BANK = ['BCA','BRI','BNI','Mandiri','BSI','CIMB Niaga','Permata','Danamon','BTN','Jago','SeaBank','Jenius','GoPay','OVO','DANA','ShopeePay','LinkAja'];
const EW = ['GoPay','OVO','DANA','ShopeePay','LinkAja'];
const RR = {
  'rang.jam': ['Jam',1,timeV],
  'rang.acara': ['Nama acara',1,len('Nama acara',3,60),{placeholder:'Contoh: Akad Nikah',maxlength:60}],
  'cer.tahun': ['Waktu',1,len('Waktu',2,30),{placeholder:'2019 / Maret 2019',maxlength:30}],
  'cer.judul': ['Judul',1,len('Judul',3,60),{placeholder:'Pertemuan pertama',maxlength:60}],
  'cer.isi': ['Cerita',1,len('Cerita',10,600),{placeholder:'Tulis cerita singkat…',maxlength:600,rows:3}],
  'rek.bank': ['Bank / E-wallet',1,()=>''],
  'rek.nomor': ['Nomor rekening',1,(v,el)=>{
    const b = el.closest('.dyn-item').querySelector('[data-rule="rek.bank"]').value;
    if(!/^\d+$/.test(v)) return 'Nomor hanya boleh angka';
    if(EW.includes(b)) return /^(08|62)\d{8,13}$/.test(v)?'':'Nomor e-wallet harus nomor HP (08xx atau 62xx)';
    return /^\d{5,20}$/.test(v)?'':'Nomor rekening harus 5–20 digit';
  },{inputmode:'numeric',maxlength:20,placeholder:'1234567890'}],
  'rek.nama': ['Atas nama',1,name('Atas nama'),{maxlength:60,placeholder:'Nama sesuai rekening'}]
};
const ROWS = {
  rangkaian:{list:'rangkaianList',max:MAX.rangkaian,f:[['jam','rang.jam','time'],['acara','rang.acara','text']]},
  cerita:{list:'storyList',max:MAX.cerita,f:[['tahun','cer.tahun','text'],['judul','cer.judul','text'],['isi','cer.isi','textarea','col-full']]},
  rekening:{list:'rekeningList',max:MAX.rekening,f:[['bank','rek.bank','select'],['nomor','rek.nomor','text'],['nama','rek.nama','text']]}
};
const DEP = {jamAkadMulai:['jamAkadSelesai'],jamResepsiMulai:['jamResepsiSelesai'],tanggalAkad:['tanggalResepsi'],livePlatform:['liveLink'],liveLink:['livePlatform']};
const SEL = /^jam(Akad|Resepsi)Selesai$/;

/* ===================== ENGINE VALIDASI ===================== */
const rule = el => (el.id && R[el.id]) || (el.dataset && el.dataset.rule && RR[el.dataset.rule]) || null;
const val = el => el.type === 'file' ? ((F[el.id.slice(4)] || {}).src ? '1' : '') : el.value.trim();
const fields = () => [...Object.keys(R).map($), ...form.querySelectorAll('[data-rule]')];

function setErr(el, m){
  const r = rule(el) || [];
  el.classList.toggle('invalid', !!m);
  el.setAttribute('aria-invalid', m ? 'true' : 'false');

  const wrap = el.closest('.input-affix');
  const parent = el.closest('.form-group');

  if(parent){
    const candidates = [];
    if(wrap && wrap.nextElementSibling && wrap.nextElementSibling.classList.contains('msg'))
      candidates.push(wrap.nextElementSibling);
    if(el.nextElementSibling && el.nextElementSibling.classList.contains('msg'))
      candidates.push(el.nextElementSibling);
    candidates.slice(1).forEach(x => x.remove());
  }

  let s = null;
  if(wrap && wrap.nextElementSibling && wrap.nextElementSibling.classList.contains('msg')){
    s = wrap.nextElementSibling;
  } else if(el.nextElementSibling && el.nextElementSibling.classList.contains('msg')){
    s = el.nextElementSibling;
  } else {
    s = mk('small','msg');
    s.setAttribute('role','alert');
    if(wrap) wrap.after(s); else el.after(s);
  }

  s.textContent = m || r[4] || '';
  s.classList.toggle('err', !!m);

  if(wrap) wrap.classList.toggle('invalid', !!m);
}
function validateEl(el, show=true){
  const r = rule(el); if(!r) return '';
  const v = val(el), rq = typeof r[1] === 'function' ? r[1]() : r[1];
  let m = '';
  if(!v){ if(rq) m = `${r[0]} wajib ${el.type==='file'?'diunggah':el.tagName==='SELECT'?'dipilih':'diisi'}`; }
  else m = r[2] ? r[2](v, el) : '';
  if(show) setErr(el, m);
  return m;
}
function validateAll(show){
  const bad = [];
  fields().forEach(el => { if(!el) return; const m = validateEl(el, show); if(m) bad.push({el,m}); });
  return bad.sort((a,b)=> (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1));
}
function refreshTabs(){ markErrorsOnStepper(); }

function sanitize(t){
  if(t.id === 'slug'){ t.value = t.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-{2,}/g,'-'); }
  else if(t.dataset.rule === 'rek.nomor') t.value = t.value.replace(/\D/g,'').slice(0,20);
  else if(SEL.test(t.id)){
    if(/[a-z]/i.test(t.value)) t.value = t.value.replace(/[^a-z]/gi,'').slice(0,7);
    else { const d = t.value.replace(/\D/g,'').slice(0,4); t.value = d.length > 2 ? d.slice(0,2)+':'+d.slice(2) : d; }
  }
}
function tidy(t){
  if(t.id === 'slug') t.value = t.value.replace(/^-+|-+$/g,'');
  else if(/^instagram/.test(t.id)) t.value = t.value.replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/[/?].*$/,'').replace(/^@+/,'').trim();
  else if(SEL.test(t.id) && /^selesai$/i.test(t.value)) t.value = 'Selesai';
  else if(t.type==='text' || t.type==='url' || t.tagName==='TEXTAREA') t.value = t.value.replace(/\s+/g,' ').trim();
}
function touchCheck(t, force){
  if(!rule(t) || !(force || t.dataset.t || attempted)) return;
  validateEl(t);
  (DEP[t.id]||[]).forEach(d => { const x = $(d); if(x && (x.dataset.t || attempted)) validateEl(x); });
  if(t.dataset.rule === 'rek.bank'){
    const n = t.closest('.dyn-item').querySelector('[data-rule="rek.nomor"]');
    if(n && (n.dataset.t || attempted)) validateEl(n);
  }
  if(attempted) refreshTabs();
}
form.addEventListener('input', e => {
  const t = e.target; if(!t.matches('input,select,textarea') || t.type === 'file') return;
  dirty = true; sanitize(t); touchCheck(t); saveDraft();
});
form.addEventListener('change', e => {
  const t = e.target;
  if(t.tagName === 'SELECT' || t.type === 'date' || t.type === 'time'){ dirty = true; touchCheck(t, true); saveDraft(); }
});
form.addEventListener('focusout', e => {
  const t = e.target; if(!rule(t) || t.type === 'file') return;
  tidy(t); t.dataset.t = 1; touchCheck(t);
  if(t.id === 'namaPria' || t.id === 'namaWanita'){
    const s = $('slug'), w = id => g(id).split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
    if((!s.value) && w('namaPria') && w('namaWanita')) s.value = `${w('namaPria')}-${w('namaWanita')}`;
  }
});

/* ===================== FOTO ===================== */
const F = { Pria:{file:null,url:null,src:null}, Wanita:{file:null,url:null,src:null} };
let G = [];

async function prep(file){
  if(!/^image\/(jpe?g|png|webp)$/.test(file.type)) throw new Error(`"${file.name}": format harus JPG, PNG, atau WebP`);
  if(file.size > 15*MB) throw new Error(`"${file.name}": ukuran melebihi 15 MB`);
  let out = file;
  try{
    const bmp = await createImageBitmap(file), s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = mk('canvas'); c.width = Math.round(bmp.width*s); c.height = Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob = await new Promise(r => c.toBlob(r,'image/jpeg',.82));
    if(blob) out = new File([blob], file.name.replace(/\.\w+$/,'')+'.jpg', {type:'image/jpeg'});
  }catch{}
  if(out.size > 5*MB) throw new Error(`"${file.name}": masih di atas 5 MB setelah dikompres`);
  return out;
}
function fileToBase64(file){
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = () => { const parts = r.result.split(','); res({base64:parts[1],type:file.type,name:file.name}); };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
function renderFoto(s){
  const box = $('preview'+s), st = F[s];
  if(!box) return;
  box.innerHTML = '';
  if(!st.src) return;
  box.innerHTML = `<div class="pv"><img src="${esc(st.src)}" alt="Foto ${s.toLowerCase()}"><button type="button" class="btn-remove" aria-label="Hapus foto">×</button></div>`;
  box.querySelector('button').onclick = () => {
    if(st.file) URL.revokeObjectURL(st.src);
    F[s] = {file:null,url:null,src:null}; renderFoto(s); dirty = true;
    const el = $('foto'+s); el.dataset.t = 1; validateEl(el); if(attempted) refreshTabs();
  };
}
async function setFoto(s, file){
  if(!file) return;
  try{
    const f = await prep(file);
    if(F[s].file) URL.revokeObjectURL(F[s].src);
    F[s] = {file:f,url:null,src:URL.createObjectURL(f)};
    dirty = true;
  }catch(err){ toast(err.message,'error',5000); }
  renderFoto(s);
  const el = $('foto'+s); el.dataset.t = 1; validateEl(el); if(attempted) refreshTabs();
}
function renderG(){
  const grid = $('galeriPreview'); if(!grid) return;
  grid.innerHTML = '';
  G.forEach((it,i) => {
    const d = mk('div','galeri-item',`<img src="${esc(it.src)}" alt="Foto ${i+1}"><button type="button" class="btn-remove" aria-label="Hapus foto ${i+1}">×</button>`);
    d.querySelector('button').onclick = () => { if(it.file) URL.revokeObjectURL(it.src); G.splice(i,1); renderG(); dirty = true; };
    grid.append(d);
  });
  if(G.length < MAX.galeri){
    const a = mk('button','galeri-add','<svg class="ic"><use href="#i-plus"/></svg>Tambah');
    a.type = 'button'; a.onclick = () => $('galeriFiles').click();
    grid.append(a);
  }
  const gc = $('galeriCount'); if(gc) gc.textContent = `${G.length} / ${MAX.galeri}`;
}
async function addG(files){
  if(!files.length) return;
  const room = MAX.galeri - G.length, errs = []; let ok = 0;
  if(room <= 0) return toast(`Galeri penuh (maks. ${MAX.galeri} foto).`,'error');
  if(files.length > room) errs.push(`Maksimal ${MAX.galeri} foto, ${files.length-room} tidak ditambahkan`);
  for(const f of files.slice(0, room)){
    try{ const p = await prep(f); G.push({file:p,src:URL.createObjectURL(p)}); ok++; }
    catch(e){ errs.push(e.message); }
  }
  renderG(); dirty = dirty || ok > 0;
  if(errs.length) toast(errs[0],'error',6000);
  else toast(`${ok} foto ditambahkan`);
}
['Pria','Wanita'].forEach(s => { const el = $('foto'+s); if(el) el.addEventListener('change', e => { const f = e.target.files[0]; e.target.value=''; setFoto(s, f); }); });
{ const el = $('galeriFiles'); if(el) el.addEventListener('change', e => { const fs = [...e.target.files]; e.target.value=''; addG(fs); }); }
{ const el = $('btnAddFoto'); if(el) el.onclick = () => $('galeriFiles').click(); }
const gp = $('galeriPreview');
if(gp){
  ['dragenter','dragover'].forEach(ev => gp.addEventListener(ev, e => { e.preventDefault(); gp.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => gp.addEventListener(ev, () => gp.classList.remove('drag')));
  gp.addEventListener('drop', e => { e.preventDefault(); addG([...e.dataTransfer.files]); });
}

/* ===================== BARIS DINAMIS ===================== */
function addRow(kind, d = {}, focus){
  const c = ROWS[kind], list = $(c.list);
  if(!list) return null;
  if(list.children.length >= c.max){ toast(`Maksimal ${c.max} item`,'error'); return null; }
  const it = mk('div','dyn-item'), grid = mk('div','dyn-grid');
  c.f.forEach(([k,rk,t,cls]) => {
    const r = RR[rk], w = mk('div','dyn-f '+(cls||''),`<label>${r[0]} <span class="req">*</span></label>`);
    let e;
    if(t === 'select'){ e = mk('select'); e.innerHTML = '<option value="">Pilih…</option>' + BANK.map(b=>`<option>${b}</option>`).join(''); }
    else if(t === 'textarea') e = mk('textarea');
    else { e = mk('input'); e.type = t; }
    e.dataset.rule = rk; e.dataset.k = k;
    Object.entries(r[3]||{}).forEach(([a,v]) => e.setAttribute(a,v));
    e.value = d[k] || '';
    w.append(e); grid.append(w); setErr(e,'');
  });
  const x = mk('button','btn-remove','×'); x.type = 'button'; x.setAttribute('aria-label','Hapus');
  x.onclick = () => { it.remove(); dirty = true; if(attempted) refreshTabs(); };
  it.append(x, grid); list.append(it);
  if(focus) it.querySelector('input,select,textarea').focus();
  return it;
}
function addRangkaian(){ addRow('rangkaian',{},true); dirty = true; }
function addStory(){ addRow('cerita',{},true); dirty = true; }
function addRekening(){ addRow('rekening',{},true); dirty = true; }
window.addRangkaian = addRangkaian; window.addStory = addStory; window.addRekening = addRekening;

/* ===================== TOAST ===================== */
let tt;
function toast(m, type='ok', ms=3500){
  const t = $('toast'); if(!t) return;
  t.textContent = m;
  t.className = 'toast show' + (type==='error'?' error':'');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), ms);
}
window.toast = toast;

/* =====================================================================
   PAYLOAD
   ===================================================================== */
async function buildPayload(){
  const payload = {
    action: 'create',
    paket: CURRENT_PAKET,
    tema: CURRENT_TEMA ? CURRENT_TEMA.id : null,
    slug: g('slug'),
    musik: g('musik'),
    rangkaian: rows('rangkaianList'),
    pria: person('Pria'),
    wanita: person('Wanita'),
    akad: acara('Akad'),
    resepsi: acara('Resepsi'),
    live: {platform: g('livePlatform'), link: g('liveLink')},
    cerita: rows('storyList'),
    rekening: rows('rekeningList')
  };
  if(F.Pria.file)   payload.pria.foto   = await fileToBase64(F.Pria.file);
  if(F.Wanita.file) payload.wanita.foto = await fileToBase64(F.Wanita.file);
  const newGaleri = G.filter(x => x.file);
  if(newGaleri.length){
    payload.galeriFiles = [];
    for(const it of newGaleri) payload.galeriFiles.push(await fileToBase64(it.file));
  }
  return payload;
}
window.buildPayload = buildPayload;

const person = s => ({
  nama: g('nama'+s), gelar: g('gelar'+s), urutan: g('urutan'+s),
  instagram: g('instagram'+s), bapak: g('namaBapak'+s), ibu: g('namaIbu'+s),
  foto: null
});
const acara = a => ({
  tanggal: g('tanggal'+a), jamMulai: g(`jam${a}Mulai`), jamSelesai: g(`jam${a}Selesai`),
  lokasi: g('lokasi'+a), alamat: g('alamat'+a), maps: g('maps'+a)
});
const rows = id => {
  const el = $(id); if(!el) return [];
  return [...el.children].map(it =>
    Object.fromEntries([...it.querySelectorAll('[data-k]')].map(e => [e.dataset.k, e.value.trim()]))
  );
};

async function sendJSON(payload){
  const res = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); }catch{ throw {status:res.status, raw:text}; }
  if(!res.ok || json.success === false || json.result === 'error') throw {status:res.status, json};
  return json;
}

function setBtn(loading, p){
  const b = $('btnSubmitTop'); if(!b) return;
  b.disabled = loading;
  const span = b.querySelector('span');
  if(!span) return;
  if(loading){
    span.textContent = p < 100 ? `Mengunggah… ${p}%` : 'Memproses…';
  } else {
    span.textContent = 'Kirim';
  }
}

/* ===================== SUBMIT ===================== */
form.addEventListener('submit', async e => {
  e.preventDefault();
  if(busy) return;

  if(currentStep !== TOTAL_STEPS - 1){
    toast('Selesaikan semua langkah dulu', 'error', 4000);
    setStep(TOTAL_STEPS - 1);
    return;
  }

  attempted = true;
  const bad = validateAll(true); refreshTabs();
  if(bad.length){
    const stepIdx = bad[0].el.closest('.step-content')?.dataset.stepContent;
    if(stepIdx != null) setStep(+stepIdx);
    setTimeout(()=>bad[0].el.scrollIntoView({behavior:'smooth',block:'center'}),200);
    return toast(`${bad.length} isian belum benar. ${bad[0].m}`,'error',5000);
  }

  busy = true;
  setBtn(true, 0);
  try{
    const payload = await buildPayload();
    setBtn(true, 100);
    const res = await sendJSON(payload);
    toast('Data berhasil dikirim! Mengarahkan ke WhatsApp…');
    clearDraft();
    submitted = true;
    dirty = false;
    attempted = false;
    busy = false;
    setTimeout(() => showPayment(res), 1000);
  }catch(err){
    busy = false; setBtn(false);
    if(!navigator.onLine) return toast('Tidak ada koneksi internet.','error',6000);
    const j = err.json || {};
    toast(`Gagal mengirim: ${j.message || 'Error '+(err.status||'?')}`,'error',6000);
  }
});

/* ===================== SUKSES + WA ===================== */
window.showPayment = function(res){
  const stepper = document.querySelector('.stepper'); if(stepper) stepper.style.display = 'none';
  const fs = document.querySelector('.form-section'); if(fs) fs.style.display = 'none';
  const card = $('paymentInfo');
  if(card){ card.hidden = false; card.scrollIntoView({behavior:'smooth',block:'start'}); }

  const id = (res && (res.id || (res.data && res.data.id))) || '(baru)';
  const nama = `${g('namaPria')} & ${g('namaWanita')}`;
  const slug = g('slug');
  const tglAkad = g('tanggalAkad');
  const paketInfo = PAKET_MAP[CURRENT_PAKET] || PAKET_MAP.premium;

  const pesan = [
    `Halo Admin Ivolera`,
    ``,
    `Saya sudah selesai mengisi data undangan pernikahan:`,
    ``,
    `-- *Detail Pesanan*`,
    `• Nama pasangan: ${nama}`,
    `• Slug undangan: /?invite=${slug}`,
    `• Tanggal akad: ${tglAkad}`,
    `• ID pengajuan: ${id}`,
    ``,
    `-- *Paket yang dipilih*`,
    `• Paket: ${paketInfo.name}`,
    `• Harga: ${paketInfo.price}`,
    `• Tema: ${CURRENT_TEMA ? CURRENT_TEMA.name : '(belum dipilih)'}`,
    ``,
    `Mohon info selanjutnya untuk proses konfirmasi & pembayaran.`,
    `Terima kasih 🙏`
  ].join('\n');
  const url = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(pesan)}`;
  const wa = $('waLink');
  if(wa) wa.href = url;
  setTimeout(() => { window.location.href = url; }, 2500);
};

/* ===================== DRAFT — FIX KOSONG ===================== */
let draftTimer;

function isEmptyDraft(obj){
  if(!obj || typeof obj !== 'object') return true;
  for(const [k, v] of Object.entries(obj)){
    if(k.startsWith('_')) continue;
    if(k === 'paket' || k === 'tema') continue;
    if(typeof v === 'string' && v.trim() !== '') return false;
  }
  return true;
}

function saveDraft(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try{
      const data = {
        paket: CURRENT_PAKET,
        tema: CURRENT_TEMA ? CURRENT_TEMA.id : null,
        slug: g('slug'), musik: g('musik'),
        namaPria: g('namaPria'), gelarPria: g('gelarPria'), urutanPria: g('urutanPria'),
        instagramPria: g('instagramPria'), namaBapakPria: g('namaBapakPria'), namaIbuPria: g('namaIbuPria'),
        namaWanita: g('namaWanita'), gelarWanita: g('gelarWanita'), urutanWanita: g('urutanWanita'),
        instagramWanita: g('instagramWanita'), namaBapakWanita: g('namaBapakWanita'), namaIbuWanita: g('namaIbuWanita'),
        tanggalAkad: g('tanggalAkad'), jamAkadMulai: g('jamAkadMulai'), jamAkadSelesai: g('jamAkadSelesai'),
        lokasiAkad: g('lokasiAkad'), alamatAkad: g('alamatAkad'), mapsAkad: g('mapsAkad'),
        tanggalResepsi: g('tanggalResepsi'), jamResepsiMulai: g('jamResepsiMulai'), jamResepsiSelesai: g('jamResepsiSelesai'),
        lokasiResepsi: g('lokasiResepsi'), alamatResepsi: g('alamatResepsi'), mapsResepsi: g('mapsResepsi'),
        livePlatform: g('livePlatform'), liveLink: g('liveLink'),
        _step: currentStep, _ts: Date.now()
      };

      /* ✅ FIX: Kalau draft kosong (semua field blank), JANGAN simpan */
      if(isEmptyDraft(data)){
        try{ localStorage.removeItem(DRAFT_KEY); }catch{}
        return;
      }

      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      const hint = $('autosaveHint');
      if(hint) hint.textContent = '💾 Draft tersimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    }catch{}
  }, 800);
}
function clearDraft(){ try{ localStorage.removeItem(DRAFT_KEY); }catch{} }

async function loadDraft(){
  try{
    const raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);

    /* ✅ FIX: Kalau kosong/cuma metadata, hapus & jangan prompt */
    if(!d || typeof d !== 'object'){ localStorage.removeItem(DRAFT_KEY); return false; }
    if(Date.now() - (d._ts||0) > 7*24*3600*1000){ localStorage.removeItem(DRAFT_KEY); return false; }
    if(isEmptyDraft(d)){ localStorage.removeItem(DRAFT_KEY); return false; }

    /* ✅ FIX: Baru prompt kalau draft benar-benar berisi */
    const ok = await askConfirm(
      'Ada draft yang belum disimpan. Lanjutkan mengisi draft?',
      { title: 'Lanjutkan Draft?', ok: 'Ya, Lanjutkan', cancel: 'Hapus Draft' }
    );
    if(!ok){ clearDraft(); return false; }

    Object.entries(d).forEach(([k,v]) => {
      if(k.startsWith('_')) return;
      if(k === 'paket' || k === 'tema') return;
      const el = $(k); if(el && typeof v === 'string') el.value = v;
    });
    if(d.paket && PAKET_MAP[d.paket]) CURRENT_PAKET = d.paket;
    if(d.tema){
      const t = TEMAS.find(x => x.id === d.tema);
      if(t) CURRENT_TEMA = { id:t.id, name:t.name, desc:t.desc, tier:t.tier };
      else if(d.tema === 'custom-exclusive') CURRENT_TEMA = { id:'custom-exclusive', name:'Custom Desain', desc:'Eksklusif', tier:'exclusive' };
    }
    renderPilihanCard();
    if(d._step != null) setStep(+d._step);
    toast('Draft dimuat');
    submitted = false;
    return true;
  }catch{ return false; }
}

/* ===================== RESET ===================== */
async function resetForm(){
  const ok = await askConfirm(
    'Reset semua isian? Data yang belum dikirim akan hilang.',
    { title: 'Reset Form?', ok: 'Ya, Reset', cancel: 'Batal' }
  );
  if(!ok) return;

  form.reset();
  ['rangkaianList','storyList','rekeningList'].forEach(i => { const el=$(i); if(el) el.innerHTML=''; });
  G.forEach(x => x.file && URL.revokeObjectURL(x.src)); G = [];
  ['Pria','Wanita'].forEach(s => {
    if(F[s].file) URL.revokeObjectURL(F[s].src);
    F[s] = {file:null,url:null,src:null}; renderFoto(s);
  });
  fields().forEach(el => { if(el){ el.classList.remove('invalid'); delete el.dataset.t; setErr(el,''); } });
  attempted = dirty = false;
  submitted = false;
  renderG(); refreshTabs(); setStep(0); clearDraft();
  toast('Form direset');
}
{ const el = $('btnReset'); if(el) el.onclick = resetForm; }

/* stepper klik */
document.querySelectorAll('.step-btn').forEach((b,i) => {
  b.addEventListener('click', () => {
    const stepLi = document.querySelector(`.step[data-step="${i}"]`);
    if(i <= currentStep || stepLi.classList.contains('done')){ setStep(i); }
    else {
      const bad = validateStep(currentStep);
      if(!bad.length) setStep(i);
      else toast('Lengkapi dulu langkah ini','error');
    }
  });
});
{ const p = $('btnPrev'); if(p) p.onclick = prevStep; }
{ const n = $('btnNext'); if(n) n.onclick = nextStep; }

addEventListener('beforeunload', e => {
  if(submitted) return;
  if(dirty){ e.preventDefault(); e.returnValue = ''; }
});

/* ===================== INIT ===================== */
(function init(){
  submitted = false;
  Object.keys(R).forEach(id => {
    const el = $(id), r = R[id];
    if(!el) return;
    Object.entries(r[3]||{}).forEach(([a,v]) => el.setAttribute(a,v));
    const lb = el.closest('.form-group')?.querySelector('label');
    if(lb){
      const base = lb.textContent.replace(/\s*\*\s*$/,'').replace(/\s+/g,' ').trim();
      lb.innerHTML = esc(base) + (r[1] === 1 ? ' <span class="req">*</span>' : '');
    }
    setErr(el,'');
  });
  renderFoto('Pria'); renderFoto('Wanita'); renderG();
  renderPilihanCard();
  setStep(0);
  setTimeout(() => { loadDraft(); }, 300);
})();