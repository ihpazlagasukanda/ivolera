'use strict';
/* =====================================================================
   Undangan.ku Admin — v8
   - Fix bug: draft kosong tidak trigger prompt
   - Semua confirm() → askConfirm() (modal kustom)
   - Semua alert() → toast()
   - adminPassword otomatis di payload
   - admin-ready event di document (bukan window)
   ===================================================================== */

const API = 'https://script.google.com/macros/s/AKfycbzdU4jGMwVdRa5Ud5vNs6E1KLUM_qccojnBC6iu7S9pWVzvdezV-Z4uF6Z5Tg4bjY1V/exec';
const INVITE_URL = s => `${location.origin}/?invite=${s}`;
const MAX = { galeri: 20, rangkaian: 10, cerita: 10, rekening: 5 };
const MB = 1048576;
const DRAFT_KEY = 'undanganku-draft-v3';
const FETCH_TIMEOUT = 15000;

/* DOM helpers */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const g = id => { const el = $(id); return el ? el.value.trim() : ''; };

/* State */
let editing = false, attempted = false, dirty = false, busy = false;
let submitted = false, ROWSDATA = [];
let currentStep = 0;
let editingPaket = null, editingTema = null;
const TOTAL_STEPS = 9;
const form = $('undanganForm');

/* =====================================================================
   VIEW SWITCHER
   ===================================================================== */
function showView(name){
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = $('view' + name.charAt(0).toUpperCase() + name.slice(1));
  if(view) view.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}
function goDashboard(){
  showView('dashboard');
  const sub = $('headerSub'); if(sub) sub.textContent = 'Dashboard';
}
function goForm(){
  showView('form');
  const sub = $('headerSub'); if(sub) sub.textContent = editing ? 'Edit Undangan' : 'Buat Undangan Baru';
}

/* =====================================================================
   UTIL
   ===================================================================== */
function titleCaseSlug(s){
  if(!s) return '—';
  return String(s).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function labelPaket(key){
  if(!key) return '—';
  const map = { basic:'Basic', premium:'Premium', exclusive:'Exclusive' };
  return map[String(key).toLowerCase()] || titleCaseSlug(key);
}
function jamToInput(v){
  if(!v) return '';
  const s = String(v).trim();
  if(/^\d{2}:\d{2}$/.test(s)) return s;
  if(/^selesai$/i.test(s)) return 'Selesai';
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
function jamToTimeInput(v){
  const s = jamToInput(v);
  return /^\d{2}:\d{2}$/.test(s) ? s : '';
}

/* =====================================================================
   WIZARD
   ===================================================================== */
const STEP_TITLES = ['Data umum','Mempelai pria','Mempelai wanita','Akad nikah','Resepsi','Live streaming','Love story','Galeri foto','Rekening'];

function setStep(n){
  currentStep = Math.max(0, Math.min(TOTAL_STEPS-1, n));
  $$('.step-content').forEach(c => c.classList.toggle('active', +c.dataset.stepContent === currentStep));
  $$('.step').forEach((li,i) => {
    li.classList.toggle('active', i === currentStep);
    li.classList.toggle('done', i < currentStep);
    const btn = li.querySelector('.step-btn');
    if(i === currentStep) btn.setAttribute('aria-current','step'); else btn.removeAttribute('aria-current');
  });
  const pct = (currentStep / (TOTAL_STEPS-1)) * 100;
  const prog = $('stepperProgress'); if (prog) prog.style.width = pct + '%';
  const meta = $('stepMeta');
  if (meta) meta.textContent = `Langkah ${currentStep+1} dari ${TOTAL_STEPS} — ${STEP_TITLES[currentStep]}`;
  const prev = $('btnPrev'); if(prev) prev.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
  const isLast = currentStep === TOTAL_STEPS - 1;
  const next = $('btnNext'); if(next) next.hidden = isLast;
  const submit = $('btnSubmit'); if(submit) submit.hidden = !isLast;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  markErrorsOnStepper();
  saveDraft();
}

function markErrorsOnStepper(){
  $$('.step').forEach((li,i) => {
    const content = document.querySelector(`[data-step-content="${i}"]`);
    const hasErr = content && content.querySelector('.invalid');
    li.classList.toggle('has-error', !!hasErr);
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
    markErrorsOnStepper();
    bad[0].scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>bad[0].focus({preventScroll:true}),300);
    toast(`${bad.length} isian perlu diperbaiki`, 'error', 4000);
    return;
  }
  attempted = false;
  if(currentStep < TOTAL_STEPS-1) setStep(currentStep+1);
}
function prevStep(){ if(currentStep > 0) setStep(currentStep-1); }

/* =====================================================================
   VALIDATOR
   ===================================================================== */
const NAME = /^\p{L}[\p{L}\s.'’-]*$/u;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const len = (l,min,max) => v => v.length<min?`${l} minimal ${min} karakter`:v.length>max?`${l} maksimal ${max} karakter`:'';
const name = l => v => len(l,2,60)(v) || (NAME.test(v)?'':`${l} hanya boleh huruf, spasi, titik, apostrof, atau tanda hubung`);
const gelar = v => len('Gelar',1,40)(v) || (/^[\p{L}\s.,'-]+$/u.test(v)?'':'Gelar hanya boleh huruf, titik, dan koma');
const urlv = (l,test,hint) => v => {
  let u; try{u=new URL(v);}catch{return `${l} bukan URL yang valid`;}
  if(!/^https?:$/.test(u.protocol)) return `${l} harus diawali http:// atau https://`;
  return test && !test(u) ? hint : '';
};
const maps = urlv('Link Maps', u => /(^|\.)(google\.[a-z.]+|goo\.gl|g\.co)$/.test(u.hostname), 'Gunakan link Google Maps');
const timeV = v => TIME.test(v)?'':'Format jam salah. Gunakan 24 jam, contoh 08:00';
const endV = startId => v => {
  if(/^selesai$/i.test(v)) return '';
  if(!TIME.test(v)) return 'Isi jam (contoh 10:00) atau ketik "Selesai"';
  const s = ($(startId) || {}).value || '';
  return s && TIME.test(s) && v <= s ? 'Jam selesai harus setelah jam mulai' : '';
};
const localToday = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const dateV = v => {
  if(isNaN(Date.parse(v))) return 'Tanggal tidak valid';
  if(!editing && v < localToday()) return 'Tanggal tidak boleh sebelum hari ini';
  return +v.slice(0,4) > new Date().getFullYear()+5 ? 'Tanggal terlalu jauh (maks. 5 tahun ke depan)' : '';
};

const R = {};
R.slug = ['Slug URL',1,
  v => len('Slug',3,60)(v) || (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)?'':'Hanya huruf kecil, angka, dan tanda hubung (contoh: dinda-rifki)'),
  {placeholder:'dinda-rifki',maxlength:60,autocapitalize:'none',autocomplete:'off',spellcheck:'false'}];
R.musik = ['URL musik',0, urlv('URL musik', u => /\.mp3$/i.test(u.pathname), 'Link harus mengarah ke file .mp3'),
  {placeholder:'https://contoh.com/lagu.mp3'}];

for(const s of ['Pria','Wanita']){
  const l = s.toLowerCase();
  R['nama'+s] = [`Nama lengkap ${l}`,1,name(`Nama ${l}`),{maxlength:60,autocomplete:'off',placeholder:'Nama lengkap'}];
  R['gelar'+s] = ['Gelar',0,gelar,{maxlength:40,placeholder:'S.Kom., M.T.'}];
  R['urutan'+s] = ['Urutan anak',0,
    v => len('Urutan anak',3,40)(v) || (/^[\p{L}\d\s-]+$/u.test(v)?'':'Hanya huruf/angka'),
    {maxlength:40,placeholder: s==='Pria'?'Putra pertama':'Putri kedua'}];
  R['instagram'+s] = ['Instagram',0,
    v => /^[a-z0-9._]{1,30}$/i.test(v)?'':'Username tidak valid',
    {maxlength:60,placeholder:'username',autocapitalize:'none',autocomplete:'off'}];
  R['namaBapak'+s] = ['Nama bapak',0,name('Nama bapak'),{maxlength:60,placeholder:'Nama ayah'}];
  R['namaIbu'+s] = ['Nama ibu',0,name('Nama ibu'),{maxlength:60,placeholder:'Nama ibu'}];
  R['foto'+s] = [`Foto mempelai ${l}`,1,()=>'',{accept:'image/jpeg,image/png,image/webp'}];
}
for(const A of ['Akad','Resepsi']){
  const a = A.toLowerCase();
  R['tanggal'+A] = [`Tanggal ${a}`,1, A==='Akad'?dateV: v => dateV(v) || (g('tanggalAkad') && v < g('tanggalAkad') ? 'Tanggal resepsi tidak boleh sebelum tanggal akad' : '')];
  R[`jam${A}Mulai`] = [`Jam mulai ${a}`,1,timeV];
  R[`jam${A}Selesai`] = [`Jam selesai ${a}`,1,endV(`jam${A}Mulai`),{placeholder:'10:00 atau Selesai',maxlength:8,inputmode:'numeric'}];
  R['lokasi'+A] = [`Lokasi ${a}`,1,len('Lokasi',3,80),{maxlength:80,placeholder:'Nama gedung / tempat'}];
  R['alamat'+A] = [`Alamat ${a}`,1,len('Alamat',10,200),{maxlength:200,placeholder:'Jalan, nomor, kelurahan, kota'}];
  R['maps'+A] = ['Link Maps',0,maps,{placeholder:'https://maps.app.goo.gl/...'}];
}
R.livePlatform = ['Platform live', () => !!g('liveLink'), len('Platform',2,30),
  {maxlength:30,placeholder:'YouTube',list:'platformList'}];
R.liveLink = ['Link live', () => !!g('livePlatform'), urlv('Link live'),
  {placeholder:'https://youtube.com/live/...'}];

const BANK = ['BCA','BRI','BNI','Mandiri','BSI','CIMB Niaga','Permata','Danamon','BTN','Jago','SeaBank','Jenius','GoPay','OVO','DANA','ShopeePay','LinkAja'];
const EW = ['GoPay','OVO','DANA','ShopeePay','LinkAja'];
const RR = {
  'rang.jam': ['Jam',1,timeV],
  'rang.acara': ['Nama acara',1,len('Nama acara',3,60),{placeholder:'Contoh: Akad Nikah',maxlength:60}],
  'cer.tahun': ['Waktu',1,len('Waktu',2,30),{placeholder:'2019 / Maret 2019',maxlength:30}],
  'cer.judul': ['Judul',1,len('Judul',3,60),{placeholder:'Pertemuan pertama',maxlength:60}],
  'cer.isi': ['Cerita',1,len('Cerita',10,600),{placeholder:'Tulis cerita singkat…',maxlength:600}],
  'rek.bank': ['Bank / E-wallet',1,()=>''],
  'rek.nomor': ['Nomor rekening',1,(v,el)=>{
    const b = el.closest('.dyn-item').querySelector('[data-rule="rek.bank"]').value;
    if(!/^\d+$/.test(v)) return 'Nomor hanya boleh angka';
    if(EW.includes(b)) return /^(08|62)\d{8,13}$/.test(v)?'':'Nomor e-wallet harus nomor HP';
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

/* =====================================================================
   VALIDATION ENGINE
   ===================================================================== */
const rule = el => (el.id && R[el.id]) || (el.dataset && el.dataset.rule && RR[el.dataset.rule]) || null;
const val = el => el.type === 'file' ? ((F[el.id.slice(4)] || {}).src ? '1' : '') : el.value.trim();
const fields = () => [...Object.keys(R).map($), ...form.querySelectorAll('[data-rule]')];

function setErr(el, m){
  const r = rule(el) || [];
  el.classList.toggle('invalid', !!m);
  el.setAttribute('aria-invalid', m?'true':'false');

  const parent = el.closest('.form-group') || el.closest('.dyn-f');
  if(!parent) return;

  parent.querySelectorAll(':scope > .msg').forEach(x => x.remove());

  const text = m || (r[4] || '');
  const msg = mk('small','msg');
  msg.setAttribute('role','alert');
  msg.textContent = text;
  msg.classList.toggle('err', !!m);
  if(!text) msg.style.display = 'none';

  const wrap = el.closest('.input-affix');
  if(wrap && wrap.parentElement === parent){
    wrap.after(msg);
  } else if(el.parentElement === parent){
    el.after(msg);
  } else {
    parent.append(msg);
  }

  if(el.closest('.input-affix')){
    el.closest('.input-affix').classList.toggle('invalid', !!m);
  }
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

function sanitize(t){
  if(t.id === 'slug'){ t.dataset.auto=''; t.value = t.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-{2,}/g,'-'); }
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
  if(attempted) markErrorsOnStepper();
}

form.addEventListener('input', e => {
  const t = e.target; if(!t.matches('input,select,textarea') || t.type === 'file') return;
  dirty = true; sanitize(t); touchCheck(t);
});
form.addEventListener('change', e => {
  const t = e.target;
  if(t.tagName === 'SELECT' || t.type === 'date' || t.type === 'time'){ dirty = true; touchCheck(t, true); }
});
form.addEventListener('focusout', e => {
  const t = e.target; if(!rule(t) || t.type === 'file') return;
  tidy(t); t.dataset.t = 1; touchCheck(t);
  if(t.id === 'namaPria' || t.id === 'namaWanita'){
    const s = $('slug'), w = id => g(id).split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
    if((!s.value || s.dataset.auto) && w('namaPria') && w('namaWanita')){
      s.value = `${w('namaPria')}-${w('namaWanita')}`; s.dataset.auto='1';
    }
  }
});

/* =====================================================================
   FOTO
   ===================================================================== */
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
    const el = $('foto'+s); el.dataset.t = 1; validateEl(el); if(attempted) markErrorsOnStepper();
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
  const el = $('foto'+s); el.dataset.t = 1; validateEl(el); if(attempted) markErrorsOnStepper();
}
function renderG(){
  const grid = $('galeriPreview'); if(!grid) return;
  grid.innerHTML = '';
  G.forEach((it,i) => {
    const d = mk('div','galeri-item',`<img src="${esc(it.src)}" alt="Foto ${i+1}"><button type="button" class="btn-remove" aria-label="Hapus foto">×</button>`);
    d.querySelector('button').onclick = () => { if(it.file) URL.revokeObjectURL(it.src); G.splice(i,1); renderG(); dirty = true; };
    grid.append(d);
  });
  if(G.length < MAX.galeri){
    const a = mk('button','galeri-add','<svg class="ic"><use href="#i-plus"/></svg>Tambah');
    a.type = 'button';
    a.onclick = () => $('galeriFiles').click();
    grid.append(a);
  }
  const gc = $('galeriCount'); if(gc) gc.textContent = `${G.length} / ${MAX.galeri}`;
}
async function addG(files){
  if(!files.length) return;
  const room = MAX.galeri - G.length, errs = []; let ok = 0;
  if(room <= 0) return toast(`Galeri penuh (maks. ${MAX.galeri} foto).`,'error');
  if(files.length > room) errs.push(`Maksimal ${MAX.galeri} foto`);
  for(const f of files.slice(0, room)){
    try{ const p = await prep(f); G.push({file:p,src:URL.createObjectURL(p)}); ok++; }
    catch(e){ errs.push(e.message); }
  }
  renderG(); dirty = dirty || ok > 0;
  if(errs.length) toast(errs[0],'error',5000);
  else toast(`${ok} foto ditambahkan`);
}
['Pria','Wanita'].forEach(s => {
  const el = $('foto'+s);
  if(el) el.addEventListener('change', e => { const f = e.target.files[0]; e.target.value=''; setFoto(s, f); });
});
{
  const el = $('galeriFiles');
  if(el) el.addEventListener('change', e => { const fs = [...e.target.files]; e.target.value=''; addG(fs); });
}
{ const el = $('btnAddFoto'); if(el) el.onclick = () => $('galeriFiles').click(); }
{
  const gp = $('galeriPreview');
  if(gp){
    ['dragenter','dragover'].forEach(ev => gp.addEventListener(ev, e => { e.preventDefault(); gp.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev => gp.addEventListener(ev, () => gp.classList.remove('drag')));
    gp.addEventListener('drop', e => { e.preventDefault(); addG([...e.dataTransfer.files]); });
  }
}

/* =====================================================================
   DYNAMIC ROWS
   ===================================================================== */
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
    w.append(e); grid.append(w);
  });
  const x = mk('button','btn-remove','×'); x.type = 'button'; x.setAttribute('aria-label','Hapus');
  x.onclick = () => { it.remove(); dirty = true; if(attempted) markErrorsOnStepper(); };
  it.append(x, grid); list.append(it);
  if(focus) it.querySelector('input,select,textarea').focus();
  return it;
}
function addRangkaian(){ addRow('rangkaian',{},true); dirty = true; }
function addStory(){ addRow('cerita',{},true); dirty = true; }
function addRekening(){ addRow('rekening',{},true); dirty = true; }
window.addRangkaian = addRangkaian; window.addStory = addStory; window.addRekening = addRekening;

/* =====================================================================
   TOAST
   ===================================================================== */
let toastTimer;
function toast(m, type='ok', ms=3500){
  const t = $('toast'); if(!t) return;
  t.textContent = m;
  t.className = 'toast show' + (type==='error'?' error':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
window.toast = toast;

/* =====================================================================
   FETCH WITH TIMEOUT
   ===================================================================== */
async function fetchJSON(url, opts = {}){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try{
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const text = await res.text();
    let json;
    try{ json = JSON.parse(text); }catch{ throw {status:res.status, raw:text.slice(0,200)}; }
    if(!res.ok) throw {status:res.status, json};
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

/* =====================================================================
   PAYLOAD & SEND (adminPassword auto-attached)
   ===================================================================== */
async function buildPayload(){
  const payload = {
    action: editing ? 'update' : 'create',
    id: $('editId').value || null,
    paket: editing ? (editingPaket || 'premium') : 'premium',
    tema: editing ? (editingTema || null) : null,
    slug: g('slug'),
    musik: g('musik'),
    rangkaian: rows('rangkaianList'),
    pria: person('Pria'),
    wanita: person('Wanita'),
    akad: acara('Akad'),
    resepsi: acara('Resepsi'),
    live: {platform: g('livePlatform'), link: g('liveLink')},
    cerita: rows('storyList'),
    rekening: rows('rekeningList'),
    galeriKeep: G.filter(x => !x.file).map(x => x.url)
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
const person = s => ({
  nama: g('nama'+s), gelar: g('gelar'+s), urutan: g('urutan'+s),
  instagram: g('instagram'+s), bapak: g('namaBapak'+s), ibu: g('namaIbu'+s),
  foto: F[s].file ? null : (F[s].url || null)
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
    body: JSON.stringify({...payload, adminPassword: window.ADMIN_PW || ''})
  });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); }catch{ throw {status:res.status, raw:text.slice(0,200)}; }
  if(!res.ok || json.success === false || json.result === 'error') throw {status:res.status, json};
  return json;
}

function handleErr(e, verb='menyimpan'){
  if(!navigator.onLine) return toast('Tidak ada koneksi internet.','error',6000);
  if(e.name === 'AbortError') return toast('Request timeout. Coba lagi.','error',6000);
  const j = e.json || {};
  let first = null;
  if(j.errors) Object.entries(j.errors).forEach(([k,m]) => {
    const el = $(k); if(el && rule(el)){ setErr(el,m); first = first || el; }
  });
  if(e.status === 409 && !first){ setErr($('slug'),'Slug sudah dipakai'); first = $('slug'); }
  if(first){
    markErrorsOnStepper();
    const stepIdx = first.closest('.step-content')?.dataset.stepContent;
    if(stepIdx != null) setStep(+stepIdx);
    setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'center'}),200);
  }
  toast(`Gagal ${verb}: ${j.message || 'Error '+(e.status||'?')}`,'error',6000);
}

function setBtn(loading, p){
  const b = $('btnSubmit'); if(!b) return;
  b.disabled = loading;
  const span = b.querySelector('span');
  if(!span) return;
  if(loading){
    span.textContent = p < 100 ? `Upload… ${p}%` : 'Proses…';
  } else {
    span.textContent = editing ? 'Perbarui' : 'Simpan';
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault(); if(busy) return;
  attempted = true;
  const bad = validateAll(true); markErrorsOnStepper();
  if(bad.length){
    const stepIdx = bad[0].el.closest('.step-content')?.dataset.stepContent;
    if(stepIdx != null) setStep(+stepIdx);
    setTimeout(()=>bad[0].el.scrollIntoView({behavior:'smooth',block:'center'}),200);
    return toast(`${bad.length} isian belum benar.`,'error',5000);
  }
  busy = true; setBtn(true, 0);
  try{
    const payload = await buildPayload();
    setBtn(true, 100);
    await sendJSON(payload);
    submitted = true;
    dirty = false;
    toast(editing ? 'Undangan diperbarui ✅' : 'Undangan disimpan ✅');
    clearDraft();
    resetForm(true);
    goDashboard();
    load();
  }catch(err){ handleErr(err); }
  finally{ busy = false; setBtn(false); }
});

/* =====================================================================
   DRAFT — FIX: hanya simpan kalau ada isi nyata, jangan prompt kalau kosong
   ===================================================================== */
let draftTimer;

function isEmptyDraft(obj){
  if(!obj || typeof obj !== 'object') return true;
  /* Cek apakah ada field non-_ yang punya nilai non-empty string */
  for(const [k, v] of Object.entries(obj)){
    if(k.startsWith('_')) continue;
    if(typeof v === 'string' && v.trim() !== '') return false;
    if(Array.isArray(v) && v.length > 0) return false;
  }
  return true;
}

function saveDraft(){
  if(editing) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try{
      const data = {};
      Object.keys(R).forEach(k => { if($(k)) data[k] = g(k); });
      data._step = currentStep;
      data._ts = Date.now();

      /* ✅ FIX: Kalau draft kosong (semua field blank), JANGAN simpan */
      if(isEmptyDraft(data)){
        try{ localStorage.removeItem(DRAFT_KEY); }catch{}
        const hint = $('autosaveHint');
        if(hint) hint.textContent = '💾 Draft otomatis tersimpan';
        return;
      }

      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      const hint = $('autosaveHint');
      if(hint) hint.textContent = '💾 Tersimpan ' + new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    }catch{}
  }, 1000);
}
function clearDraft(){ try{ localStorage.removeItem(DRAFT_KEY); }catch{} }

async function loadDraft(){
  try{
    const raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);

    /* ✅ FIX: Kalau draft kosong atau cuma metadata, hapus & jangan prompt */
    if(!d || typeof d !== 'object'){ localStorage.removeItem(DRAFT_KEY); return false; }
    if(Date.now() - (d._ts||0) > 7*24*3600*1000){ localStorage.removeItem(DRAFT_KEY); return false; }
    if(isEmptyDraft(d)){ localStorage.removeItem(DRAFT_KEY); return false; }

    /* ✅ FIX: Baru prompt kalau draft benar-benar berisi data */
    const ok = await askConfirm(
      'Ada draft yang belum disimpan. Lanjutkan mengisi draft?',
      { title: 'Lanjutkan Draft?', ok: 'Ya, Lanjutkan', cancel: 'Hapus Draft' }
    );
    if(!ok){ clearDraft(); return false; }

    Object.entries(d).forEach(([k,v]) => {
      if(k.startsWith('_')) return;
      const el = $(k); if(el && typeof v === 'string') el.value = v;
    });
    if(d._step != null) setStep(+d._step);
    toast('Draft dimuat');
    return true;
  }catch{ return false; }
}
form.addEventListener('input', saveDraft);
form.addEventListener('change', saveDraft);

/* =====================================================================
   RESET & EDIT
   ===================================================================== */
function resetForm(silent){
  form.reset(); $('editId').value = '';
  ['rangkaianList','storyList','rekeningList'].forEach(i => { const el = $(i); if(el) el.innerHTML = ''; });
  G.forEach(x => x.file && URL.revokeObjectURL(x.src)); G = [];
  ['Pria','Wanita'].forEach(s => {
    if(F[s].file) URL.revokeObjectURL(F[s].src);
    F[s] = {file:null,url:null,src:null}; renderFoto(s);
  });
  document.querySelectorAll('.msg').forEach(x => x.remove());
  document.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
  document.querySelectorAll('.input-affix.invalid').forEach(x => x.classList.remove('invalid'));
  const slug = $('slug'); if(slug) slug.dataset.auto = '';
  editing = attempted = dirty = false;
  editingPaket = null; editingTema = null;

  const wrap = $('paketTemaInfoWrap'); if(wrap) wrap.hidden = true;
  const pn = $('adminPaketName'); if(pn) pn.textContent = '—';
  const tn = $('adminTemaName'); if(tn) tn.textContent = '—';

  const title = $('editorTitle'); if(title) title.textContent = 'Buat Undangan Baru';
  const br = $('btnReset'); if(br) br.innerHTML = '<svg class="ic"><use href="#i-refresh"/></svg> <span>Reset</span>';
  setBtn(false);
  renderG(); markErrorsOnStepper(); setStep(0);
  clearDraft();
}

function edit(id){
  const d = ROWSDATA.find(x => String(x.id) === id); if(!d) return;
  resetForm(true); editing = true;
  const set = (k,v) => { const el = $(k); if(el) el.value = v ?? ''; };
  $('editId').value = d.id;
  set('slug', d.slug); set('musik', d.musik);

  editingPaket = d.paket || 'premium';
  editingTema = d.tema || null;

  const wrap = $('paketTemaInfoWrap');
  const pn = $('adminPaketName');
  const tn = $('adminTemaName');
  if(wrap && pn && tn){
    pn.textContent = labelPaket(editingPaket);
    tn.textContent = editingTema ? titleCaseSlug(editingTema) : '—';
    wrap.hidden = false;
  }

  ['Pria','Wanita'].forEach(s => {
    const p = d[s.toLowerCase()] || {};
    set('nama'+s, p.nama); set('gelar'+s, p.gelar); set('urutan'+s, p.urutan);
    set('instagram'+s, p.instagram); set('namaBapak'+s, p.bapak); set('namaIbu'+s, p.ibu);
    F[s] = {file:null,url:p.foto||null,src:p.foto||null}; renderFoto(s);
  });

  ['Akad','Resepsi'].forEach(A => {
    const a = d[A.toLowerCase()] || {};
    set('tanggal'+A, a.tanggal);
    set(`jam${A}Mulai`, jamToTimeInput(a.jamMulai));
    set(`jam${A}Selesai`, a.jamSelesai === 'Selesai' ? 'Selesai' : (jamToInput(a.jamSelesai) || ''));
    set('lokasi'+A, a.lokasi); set('alamat'+A, a.alamat); set('maps'+A, a.maps);
  });

  set('livePlatform', (d.live||{}).platform); set('liveLink', (d.live||{}).link);
  (d.rangkaian||[]).forEach(x => addRow('rangkaian', x));
  (d.cerita||[]).forEach(x => addRow('cerita', x));
  (d.rekening||[]).forEach(x => addRow('rekening', x));
  G = (d.galeri||[]).map(u => ({url:u, src:u})); renderG();

  const title = $('editorTitle'); if(title) title.textContent = `Edit Undangan #${d.id}`;
  const br = $('btnReset'); if(br) br.innerHTML = '<svg class="ic"><use href="#i-close"/></svg> <span>Batal</span>';
  setBtn(false);
  setStep(0);
  toast(`Mode edit: ${d.slug}`);
  goForm();
}

/* =====================================================================
   TABLE
   ===================================================================== */
const fmtDate = s => {
  if(!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return !isNaN(d) ? d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—';
};
function renderTable(){
  const tb = $('tableBody'); if(!tb) return;
  const q = ($('searchBox').value || '').toLowerCase().trim();
  const fPaket = ($('filterPaket').value || '').toLowerCase();

  const list = ROWSDATA.filter(d => {
    if(fPaket && String(d.paket || '').toLowerCase() !== fPaket) return false;
    if(!q) return true;
    return [d.slug, (d.pria||{}).nama, (d.wanita||{}).nama].join(' ').toLowerCase().includes(q);
  });

  const sub = $('tableSub');
  if(sub) sub.textContent = `${list.length} dari ${ROWSDATA.length} undangan`;

  if(!list.length){
    tb.innerHTML = `<tr><td colspan="8" class="empty-row">${ROWSDATA.length?'Tidak ada hasil.':'Belum ada undangan.'}</td></tr>`;
    return;
  }

  tb.innerHTML = list.map(d => {
    const p = d.pria||{}, w = d.wanita||{}, id = esc(d.id);
    const th = [p.foto,w.foto].filter(Boolean).map(u=>`<img class="thumb" src="${esc(u)}" alt="" loading="lazy">`).join('') || '—';
    const paketLabel = labelPaket(d.paket);
    const temaLabel = d.tema ? titleCaseSlug(d.tema) : '—';
    const paketClass = ['basic','premium','exclusive'].includes(String(d.paket||'').toLowerCase())
      ? `paket-badge paket-${String(d.paket).toLowerCase()}`
      : 'paket-badge';

    return `<tr>
      <td>#${id}</td>
      <td><code>${esc(d.slug)}</code></td>
      <td>${esc(p.nama||'—')} &amp; ${esc(w.nama||'—')}</td>
      <td><span class="${paketClass}">${esc(paketLabel)}</span></td>
      <td class="hide-sm">${esc(temaLabel)}</td>
      <td class="hide-sm">${fmtDate((d.akad||{}).tanggal)}</td>
      <td class="hide-sm">${th}</td>
      <td><div class="actions">
        <button class="act-btn" data-a="edit" data-id="${id}"><svg class="ic"><use href="#i-edit"/></svg> Edit</button>
        <button class="act-btn" data-a="copy" data-id="${id}"><svg class="ic"><use href="#i-copy"/></svg> Salin</button>
        <button class="act-btn danger" data-a="del" data-id="${id}"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}

async function load(){
  const tb = $('tableBody');
  if(tb) tb.innerHTML = `<tr><td colspan="8" class="empty-row skeleton">Memuat data...</td></tr>`;
  const t0 = performance.now();
  try{
    const j = await fetchJSON(API, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({action:'list', adminPassword: window.ADMIN_PW || ''})
    });
    let data = [];
    if(Array.isArray(j)) data = j;
    else if(j && Array.isArray(j.data)) data = j.data;
    else if(j && j.result === 'error') throw {json: j};
    ROWSDATA = data;
    renderTable();
    updateStats();
    const dt = Math.round(performance.now() - t0);
    const sub = $('tableSub');
    if(sub) sub.textContent = `${ROWSDATA.length} undangan · ${dt}ms`;
  }catch(e){
    let why = 'Gagal terhubung ke server';
    if(e.name === 'AbortError') why = 'Request timeout';
    else if(e.status) why = `Gagal memuat (HTTP ${e.status})`;
    else if(e.raw) why = 'Response bukan JSON: ' + e.raw;
    if(tb) tb.innerHTML = `<tr><td colspan="8" class="empty-row">⚠️ ${esc(why)}. <button class="act-btn" id="retry" type="button">Coba lagi</button></td></tr>`;
    const retry = $('retry'); if(retry) retry.onclick = load;
    toast(why,'error');
  }
}

function updateStats(){
  const total = ROWSDATA.length;
  const t = $('statTotal'); if(t) t.textContent = total;

  const now = new Date();
  const thisMonth = ROWSDATA.filter(d => {
    const tg = (d.akad||{}).tanggal || '';
    if(!tg) return false;
    const dt = new Date(tg);
    return !isNaN(dt) && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }).length;
  const b = $('statBulanIni'); if(b) b.textContent = thisMonth;
  const bt = $('statMonthTrend');
  if(bt) bt.textContent = thisMonth ? `${thisMonth} di bulan ${now.toLocaleDateString('id-ID',{month:'long'})}` : 'Belum ada bulan ini';

  const premium = ROWSDATA.filter(d => {
    const p = String(d.paket || '').toLowerCase();
    return p === 'premium' || p === 'exclusive';
  }).length;
  const pr = $('statPremium'); if(pr) pr.textContent = premium;
  const pt = $('statPremiumTrend');
  if(pt) pt.textContent = total ? `${Math.round(premium/total*100)}% dari total` : '—';
}

async function del(id, btn){
  const d = ROWSDATA.find(x => String(x.id) === id);
  if(!(await askConfirm(`Hapus undangan "${d?d.slug:id}"? Tidak bisa dibatalkan.`, {ok:'Hapus'}))) return;
  btn.disabled = true;
  try{
    await sendJSON({action:'delete', id});
    ROWSDATA = ROWSDATA.filter(x => String(x.id) !== id);
    renderTable(); updateStats(); toast('Undangan dihapus');
    if($('editId').value === id) resetForm(true);
  }catch(e){ btn.disabled = false; handleErr(e, 'menghapus'); }
}

{
  const tb = $('tableBody');
  if(tb) tb.addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if(!b) return;
    const id = b.dataset.id, a = b.dataset.a;
    if(a === 'edit'){
      if(!dirty || await askConfirm('Isian belum disimpan akan hilang. Lanjut edit?')) edit(id);
    }
    else if(a === 'del') del(id, b);
    else if(a === 'copy'){
      const d = ROWSDATA.find(x => String(x.id) === id); if(!d) return;
      const url = INVITE_URL(d.slug);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(() => toast('Link disalin: ' + url), () => toast('Gagal menyalin. Link: ' + url, 'error', 6000));
    }
  });
}

/* =====================================================================
   INIT
   ===================================================================== */
(function init(){
  Object.keys(R).forEach(id => {
    const el = $(id); if(!el) return;
    const r = R[id];
    Object.entries(r[3]||{}).forEach(([a,v]) => el.setAttribute(a,v));
    if(r[1] === 1 || (typeof r[1] === 'function')) el.required = false;
    const lb = el.closest('.form-group')?.querySelector('label');
    if(lb){
      const base = lb.textContent.replace(/\s*\*\s*$/,'').replace(/\s+/g,' ').trim();
      lb.innerHTML = esc(base) + (r[1] === 1 ? ' <span class="req">*</span>' : '');
    }
    setErr(el,'');
  });

  const prev = $('btnPrev'); if(prev) prev.onclick = prevStep;
  const next = $('btnNext'); if(next) next.onclick = nextStep;
  const back = $('btnBackToDash'); if(back) back.onclick = async () => {
    if(!dirty || await askConfirm('Isian yang belum disimpan akan hilang. Kembali ke dashboard?')){
      resetForm(true);
      goDashboard();
    }
  };
  const add = $('btnAddNew'); if(add) add.onclick = () => { resetForm(true); goForm(); };
  const refresh = $('btnRefresh'); if(refresh) refresh.onclick = load;
  const search = $('searchBox'); if(search) search.addEventListener('input', renderTable);
  const filter = $('filterPaket'); if(filter) filter.addEventListener('change', renderTable);
  const reset = $('btnReset'); if(reset) reset.onclick = async () => {
    if(editing){
      if(await askConfirm('Batalkan mode edit?')){ resetForm(true); goDashboard(); }
    } else {
      if(!dirty || await askConfirm('Isian belum disimpan akan dihapus. Lanjutkan?')) resetForm(true);
    }
  };

  document.querySelectorAll('.step-btn').forEach((b,i) => {
    b.addEventListener('click', () => {
      if(i <= currentStep || document.querySelector(`.step[data-step="${i}"]`).classList.contains('done')){
        setStep(i);
      } else {
        const bad = validateStep(currentStep);
        if(!bad.length) setStep(i);
        else { toast('Lengkapi dulu langkah ini','error'); markErrorsOnStepper(); }
      }
    });
  });

  renderFoto('Pria'); renderFoto('Wanita'); renderG();
  setStep(0);
  goDashboard();

  /* ✅ FIX: tunggu admin-ready dari document (gate). Bukan dari window */
  if(window.ADMIN_PW){
    load();
    setTimeout(checkDraft, 500);
  } else {
    document.addEventListener('admin-ready', () => {
      load();
      setTimeout(checkDraft, 500);
    }, { once: true });
  }

  function checkDraft(){
    const hasDraft = !!localStorage.getItem(DRAFT_KEY);
    if(!hasDraft) return;
    loadDraft().then(loaded => { if(loaded) goForm(); });
  }
})();

addEventListener('beforeunload', e => {
  if(submitted) return;
  if(dirty){ e.preventDefault(); e.returnValue=''; }
});