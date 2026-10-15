/* ================================================================
   IVOLERA CHATBOT — SMART ENGINE v3
   + CTA buttons
   + Paket awareness (baca localStorage 'ivolera-paket')
   + Workflow integration (link ke order.html & WA)
   ================================================================ */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const cm = $('cm'), cf = $('cf'), ci = $('ci');
  if(!cm || !cf) return;

  let busy = false, open = false, lastTopic = null;

  /* ============ KONFIG WORKFLOW ============ */
  const ORDER_URL = 'order.html';
  const ADMIN_WA  = '6289609289911';
  const PAKET_MAP = {
    basic:     { name:'Basic',     price:'Rp49.000'  },
    premium:   { name:'Premium',   price:'Rp99.000'  },
    exclusive: { name:'Exclusive', price:'Rp199.000' }
  };

  function getCurrentPaket(){
    try{
      const d = JSON.parse(localStorage.getItem('ivolera-paket') || 'null');
      if(d && PAKET_MAP[d.key]) return d.key;
    }catch(e){}
    return null;
  }

  function orderUrl(paket){
    return ORDER_URL + '?paket=' + encodeURIComponent(paket || 'premium');
  }
  function waUrl(msg){
    return 'https://wa.me/' + ADMIN_WA + '?text=' + encodeURIComponent(msg);
  }

  /* ============ NORMALISASI ============ */
  const SYNONYMS = {
    'brp':'berapa','hrg':'harga','byr':'bayar','gmn':'bagaimana','gimana':'bagaimana',
    'bs':'bisa','gk':'tidak','ga':'tidak','gak':'tidak','tdk':'tidak','engga':'tidak',
    'utk':'untuk','dgn':'dengan','yg':'yang','aja':'saja','sy':'saya','aq':'saya',
    'wa':'whatsapp','ig':'instagram','trims':'terima kasih','thx':'terima kasih',
    'tq':'terima kasih','makasih':'terima kasih','mksh':'terima kasih',
    'price':'harga','cost':'harga','fee':'harga','payment':'pembayaran',
    'feature':'fitur','features':'fitur','theme':'tema','themes':'tema',
    'how':'bagaimana','what':'apa','why':'kenapa','when':'kapan','where':'dimana',
    'help':'bantuan','support':'bantuan','contact':'kontak','order':'pesan'
  };
  function normalize(text){
    let t = String(text||'').toLowerCase().trim();
    t = t.replace(/[^\w\s\u00C0-\u024F]/g,' ').replace(/\s+/g,' ');
    return t.split(' ').map(w => SYNONYMS[w] || w).join(' ');
  }

  /* ============ KNOWLEDGE BASE ============ */
  /* Setiap topic punya: keys, answer (HTML), next (quick replies), cta (tombol opsional) */
  const KB = [
    {
      id:'greeting', weight:1,
      keys:['halo','hai','hi','hey','hello','selamat pagi','selamat siang','selamat sore','selamat malam','assalam','pagi','siang','sore','malam'],
      answer:`Halo! 👋 Senang bertemu Anda.<br>Saya siap bantu soal <b>undangan digital Ivolera</b>.<br><br>Populer hari ini:<br>• <b>"Harga paket premium?"</b><br>• <b>"Cara buat undangan?"</b><br>• <b>"Rekomendasi untuk 500 tamu"</b>`,
      next:['Berapa harga paketnya?','Apa saja fiturnya?','Bagaimana cara buat undangan?']
    },
    {
      id:'price', weight:1.2,
      keys:['harga','biaya','tarif','paket','promo','murah','diskon','berapa','rp','bayar berapa','budget','price','cost'],
      answer:`Berikut paket Ivolera (semua <b>sekali bayar</b>, aktif selamanya):<br><br>
        • <b>Basic — Rp49.000</b> <s>Rp99.000</s><br>&nbsp;&nbsp;1 tema, RSVP, countdown & lokasi<br>
        • <b>Premium — Rp99.000</b> <s>Rp199.000</s> <b>(paling populer ⭐)</b><br>&nbsp;&nbsp;Semua tema (50+), amplop digital, galeri 20 foto, musik, custom nama tamu<br>
        • <b>Exclusive — Rp199.000</b> <s>Rp399.000</s><br>&nbsp;&nbsp;Semua fitur Premium + domain kustom, video sinematik, desain custom, support 24/7<br><br>
        Mau saya rekomendasikan paket sesuai kebutuhan Anda?`,
      next:['Rekomendasi paket untuk 500 tamu','Apa beda Premium dan Exclusive?','Metode pembayarannya apa?'],
      cta:[
        { label:'Mulai Isi Data →', href: orderUrl('premium') },
        { label:'Chat Admin', href: waUrl('Halo, saya mau tanya soal paket Ivolera'), cls:'wa' }
      ]
    },
    {
      id:'price_premium',
      keys:['premium','paket premium','99','99rb','99ribu','paling populer'],
      answer:`Paket <b>Premium — Rp99.000</b> <s>Rp199.000</s> (hemat 50%) adalah favorit pasangan:<br><br>
        ✅ Semua tema (50+)<br>
        ✅ RSVP + Ucapan & Doa<br>
        ✅ Amplop digital<br>
        ✅ Galeri 20 foto<br>
        ✅ Musik latar<br>
        ✅ Custom nama tamu<br><br>
        Cocok untuk pernikahan 100–1000 tamu.`,
      next:['Lihat tema yang tersedia','Bagaimana cara buat undangan?','Metode pembayarannya apa?'],
      cta:[{ label:'Pilih Premium — Rp99rb', href: orderUrl('premium') }]
    },
    {
      id:'price_basic',
      keys:['basic','paket basic','49','49rb','49ribu','termurah','paling murah'],
      answer:`Paket <b>Basic — Rp49.000</b> <s>Rp99.000</s>:<br><br>
        ✅ 1 tema pilihan<br>
        ✅ RSVP online<br>
        ✅ Countdown & lokasi<br>
        ✅ Aktif selamanya<br><br>
        Cocok untuk undangan simpel namun elegan. Bisa upgrade ke Premium kapan saja!`,
      next:['Apa beda Basic dan Premium?','Bagaimana cara buat undangan?'],
      cta:[{ label:'Pilih Basic — Rp49rb', href: orderUrl('basic') }]
    },
    {
      id:'price_exclusive',
      keys:['exclusive','paket exclusive','199','199rb','199ribu','termewah','domain kustom','custom desain'],
      answer:`Paket <b>Exclusive — Rp199.000</b> <s>Rp399.000</s>:<br><br>
        ✅ Semua fitur Premium<br>
        ✅ <b>Domain kustom</b> (namaanda.com)<br>
        ✅ Video sinematik<br>
        ✅ Desain custom oleh tim kami<br>
        ✅ Prioritas support 24/7<br><br>
        Untuk yang ingin pengalaman paling personal & mewah. 💎`,
      next:['Bagaimana cara order Exclusive?','Metode pembayarannya apa?'],
      cta:[{ label:'Pilih Exclusive — Rp199rb', href: orderUrl('exclusive') }]
    },
    {
      id:'features',
      keys:['fitur','dapat apa','fasilitas','lengkap','bisa apa','include','isinya','feature'],
      answer:`Fitur Ivolera:<br><br>
        🎨 <b>Desain</b>: 50+ tema elegan<br>
        💌 <b>RSVP online</b>: tamu konfirmasi kehadiran<br>
        💬 <b>Ucapan & Doa</b>: tamu kirim pesan<br>
        🎁 <b>Amplop digital</b>: rekening & e-wallet<br>
        📸 <b>Galeri foto</b>: hingga 20 foto<br>
        🎵 <b>Musik latar</b>: pilih lagu favorit<br>
        ⏳ <b>Countdown</b> & <b>Google Maps</b><br>
        👤 <b>Custom nama tamu</b><br>
        ♾️ <b>Aktif selamanya</b>, tanpa biaya bulanan`,
      next:['Berapa harga paketnya?','Bagaimana cara buat undangan?','Lihat tema yang tersedia'],
      cta:[{ label:'Mulai Sekarang →', href: orderUrl() }]
    },
    {
      id:'howto',
      keys:['cara buat','buat undangan','membuat','langkah','proses','gimana buat','tutorial','cara pesan','cara order','how to'],
      answer:`Cara buat undangan cuma <b>5–15 menit</b>:<br><br>
        <b>1.</b> Pilih paket<br>
        <b>2.</b> Isi data mempelai, tanggal, lokasi<br>
        <b>3.</b> Pilih tema favorit<br>
        <b>4.</b> Tambah foto & musik<br>
        <b>5.</b> Kirim → admin konfirmasi → bayar → aktif ✨<br><br>
        Tidak perlu keahlian desain sama sekali!`,
      next:['Metode pembayarannya apa?','Lihat tema yang tersedia','Bisa edit setelah jadi?'],
      cta:[{ label:'Isi Data Sekarang →', href: orderUrl() }]
    },
    {
      id:'themes',
      keys:['tema','desain','theme','pilihan tema','gaya','style','floral','minimalis','klasik','modern','rustic'],
      answer:`Tema Ivolera ada <b>50+ pilihan</b>:<br><br>
        🌿 <b>Sage Elegance</b> — klasik natural<br>
        💎 <b>Deep Teal</b> — mewah & klasik<br>
        🌲 <b>Forest Royale</b> — elegan bold<br>
        🌅 <b>Golden Cream</b> — modern hangat<br>
        ...dan masih banyak lagi.<br><br>
        <b>Basic</b>: 1 tema · <b>Premium & Exclusive</b>: semua tema.`,
      next:['Berapa harga paket Premium?','Bagaimana cara buat undangan?'],
      cta:[{ label:'Pilih Tema Sekarang →', href: orderUrl() }]
    },
    {
      id:'payment',
      keys:['pembayaran','transfer','rekening','qris','bayar','gopay','ovo','dana','shopeepay','bca','mandiri','bni','bri','payment'],
      answer:`Metode pembayaran:<br><br>
        🏦 <b>Transfer bank</b>: BCA, Mandiri, BNI, BRI<br>
        📱 <b>E-wallet</b>: GoPay, OVO, Dana, ShopeePay<br>
        🔳 <b>QRIS</b> (semua aplikasi)<br><br>
        Semua <b>sekali bayar</b>, tidak ada biaya bulanan.`,
      next:['Berapa harga paketnya?','Bagaimana cara buat undangan?'],
      cta:[{ label:'Chat Admin & Bayar', href: waUrl('Halo, saya mau konfirmasi pembayaran Ivolera'), cls:'wa' }]
    },
    {
      id:'edit',
      keys:['edit','ubah','revisi','ganti','update','salah data','koreksi','perbaiki'],
      answer:`Tentu bisa! ✏️<br><br>
        Setelah undangan jadi, Anda bisa <b>edit kapan saja</b> lewat dashboard:<br>
        ✅ Ganti nama, tanggal, lokasi<br>
        ✅ Tukar foto atau musik<br>
        ✅ Ubah tema (Premium/Exclusive)<br>
        ✅ Tambah/ubah nama tamu<br><br>
        <b>Gratis</b>, tanpa biaya tambahan.`,
      next:['Bagaimana cara buat undangan?','Apa saja fiturnya?'],
      cta:[{ label:'Chat Admin', href: waUrl('Halo, saya mau revisi undangan'), cls:'wa' }]
    },
    {
      id:'share',
      keys:['bagikan','share','kirim','link','sebar','whatsapp','instagram','undang tamu','sebarkan'],
      answer:`Cara bagikan undangan:<br><br>
        🔗 Dapat <b>link unik</b> (contoh: ivolera.com/raka-sinta)<br>
        📱 Share via <b>WhatsApp</b>, Instagram, Facebook, atau SMS<br>
        👤 Bisa <b>custom nama tamu</b> (misal: "Untuk Bapak Andi")<br>
        📊 Pantau siapa yang sudah buka & RSVP<br><br>
        <b>Tanpa batasan jumlah tamu!</b>`,
      next:['Apa itu custom nama tamu?','Berapa harga paketnya?']
    },
    {
      id:'rsvp',
      keys:['rsvp','konfirmasi','hadir','kehadiran','ucapan','doa','pesan tamu'],
      answer:`Fitur <b>RSVP & Ucapan</b>:<br><br>
        ✅ Tamu konfirmasi hadir / tidak hadir<br>
        ✅ Kirim ucapan & doa langsung dari undangan<br>
        ✅ Anda lihat daftar tamu di dashboard<br>
        ✅ Export data ke Excel<br><br>
        Sangat membantu estimasi konsumsi & kursi! 🎉`,
      next:['Apa saja fiturnya?','Berapa harga paketnya?']
    },
    {
      id:'gift',
      keys:['amplop','hadiah','gift','uang','kado','amplop digital','transfer hadiah'],
      answer:`Fitur <b>Amplop Digital</b> 🎁:<br><br>
        ✅ Tampilkan nomor rekening<br>
        ✅ E-wallet: GoPay, OVO, Dana, ShopeePay<br>
        ✅ QRIS untuk scan langsung<br>
        ✅ Tamu konfirmasi setelah kirim<br><br>
        Tersedia di paket <b>Premium</b> & <b>Exclusive</b>.`,
      next:['Berapa harga paket Premium?','Apa saja fiturnya?']
    },
    {
      id:'duration',
      keys:['lama','berapa lama','durasi','cepat','kapan jadi','proses berapa lama','butuh waktu'],
      answer:`⏱️ <b>5–15 menit</b> saja!<br><br>
        Setelah pembayaran:<br>
        <b>1.</b> Isi data (5 menit)<br>
        <b>2.</b> Pilih tema (2 menit)<br>
        <b>3.</b> Upload foto & musik (3 menit)<br>
        <b>4.</b> Undangan langsung aktif!<br><br>
        Untuk paket <b>Exclusive</b>, 1–3 hari kerja.`,
      next:['Bagaimana cara buat undangan?','Berapa harga paketnya?']
    },
    {
      id:'active',
      keys:['aktif','masa aktif','expired','kadaluarsa','berlaku','perpanjang','bulanan','langganan'],
      answer:`Undangan Ivolera <b>aktif selamanya</b> ♾️<br><br>
        ✅ <b>Sekali bayar</b>, tanpa biaya bulanan<br>
        ✅ Tidak ada tanggal kadaluarsa<br>
        ✅ Bisa diakses kapan saja<br>
        ✅ Tetap online setelah pernikahan (kenangan digital)`,
      next:['Berapa harga paketnya?','Apa saja fiturnya?']
    },
    {
      id:'guest_limit',
      keys:['batas tamu','jumlah tamu','limit','berapa tamu','maksimal tamu','tamu maksimal'],
      answer:`Tidak ada batasan jumlah tamu! 🎉<br><br>
        ✅ Sebanyak apa pun tamu, <b>tanpa biaya tambahan</b><br>
        ✅ Cocok untuk 50 sampai 5000+ tamu<br>
        ✅ Fitur <b>custom nama tamu</b> memudahkan personalisasi`,
      next:['Bagaimana cara bagikan undangan?','Berapa harga paketnya?']
    },
    {
      id:'recommend',
      keys:['rekomendasi','saran','cocok','bagus mana','pilih mana','untuk 100','untuk 500','untuk 1000','sebaiknya','rekomen'],
      answer:`Biar saya bantu rekomendasikan 🎯:<br><br>
        • <b>≤ 100 tamu, simpel</b> → <b>Basic Rp49rb</b><br>
        • <b>100–1000 tamu, lengkap</b> → <b>Premium Rp99rb</b> ⭐<br>
        • <b>Mewah + domain sendiri</b> → <b>Exclusive Rp199rb</b><br><br>
        Kalau masih ragu, <b>Premium</b> paling worth it — 90% pasangan pilih ini.`,
      next:['Apa beda Premium dan Exclusive?','Bagaimana cara buat undangan?'],
      cta:[{ label:'Pilih Premium Sekarang →', href: orderUrl('premium') }]
    },
    {
      id:'contact',
      keys:['kontak','cs','customer service','hubungi','bantuan','kendala','masalah','error','admin','whatsapp','email','help','support','contact'],
      answer:`Butuh bantuan langsung? 📞<br><br>
        📧 <b>hello@ivolera.com</b><br>
        📱 <b>0812-3456-7890</b> (WhatsApp)<br>
        🕐 Senin–Sabtu, 08.00–20.00 WIB<br><br>
        Untuk paket <b>Exclusive</b>, support tersedia <b>24/7</b>.`,
      next:['Berapa harga paketnya?','Bagaimana cara buat undangan?'],
      cta:[{ label:'Chat Admin via WA', href: waUrl('Halo Admin Ivolera, saya butuh bantuan'), cls:'wa' }]
    },
    {
      id:'my_paket',
      keys:['paket saya','paket yang saya pilih','paket saya apa','sudah pilih paket','lihat paket saya'],
      answer:`Sebentar, saya cek paket yang Anda pilih...`,
      dynamic: true, // diisi runtime
      next:['Bagaimana cara buat undangan?','Metode pembayarannya apa?']
    },
    {
      id:'thanks',
      keys:['terima kasih','makasih','thanks','thank you','tq','thx','syukron','mksh'],
      answer:`Sama-sama! 😊<br>Selamat mempersiapkan pernikahan — semoga lancar & bahagia! 💕<br><br>Kalau ada pertanyaan lain, tanya saja ya.`,
      next:['Berapa harga paketnya?','Lihat tema yang tersedia']
    },
    {
      id:'bye',
      keys:['bye','dadah','sampai jumpa','selamat tinggal','goodbye','see you'],
      answer:`Sampai jumpa! 👋<br>Semoga harinya menyenangkan. Kapan saja butuh bantuan, saya di sini. 💐`,
      next:[]
    }
  ];

  /* ============ MATCHING ============ */
  function score(topic, text){
    let s = 0;
    const w = topic.weight || 1;
    for(const k of topic.keys){
      if(text.includes(k)){
        s += (k.length >= 6 ? 3 : k.length >= 4 ? 2 : 1) * w;
      }
    }
    return s;
  }
  function findBest(text){
    let best = null, bestScore = 0;
    for(const t of KB){
      const s = score(t, text);
      if(s > bestScore){ bestScore = s; best = t; }
    }
    return {best, bestScore};
  }

  /* Bangun HTML jawaban (termasuk kartu paket & tombol CTA) */
  function buildAnswer(topic){
    let html = topic.answer;

    // Topic dinamis: my_paket
    if(topic.dynamic && topic.id === 'my_paket'){
      const key = getCurrentPaket();
      if(key && PAKET_MAP[key]){
        html = `Paket yang Anda pilih: <div class="chat-paket">
          <span class="cp-name">${PAKET_MAP[key].name}</span>
          <span class="cp-price">${PAKET_MAP[key].price}</span>
        </div><br>Kalau mau lanjut isi data, klik tombol di bawah ya.`;
      } else {
        html = `Anda belum pilih paket. Yuk pilih dulu di halaman utama, atau saya bantu rekomendasikan.`;
      }
    }

    // Tambah CTA buttons
    let ctaHtml = '';
    if(topic.cta && topic.cta.length){
      topic.cta.forEach(b => {
        const cls = 'cta-btn' + (b.cls ? ' ' + b.cls : '');
        const target = /^https?:/.test(b.href) ? ' target="_blank" rel="noopener"' : '';
        ctaHtml += `<br><a href="${b.href}" class="${cls}"${target}>${b.label}</a>`;
      });
    }

    // Kalau topik = howto, tambahkan tombol order
    if(topic.id === 'howto' && !topic.cta){
      ctaHtml += `<br><a href="${orderUrl()}" class="cta-btn">Mulai Isi Data →</a>`;
    }

    return html + ctaHtml;
  }

  function reply(raw){
    const text = normalize(raw);

    if(text.length < 2){
      return {
        text:`Bisa ulangi pertanyaannya? 🙏<br>Coba tanya soal <b>harga</b>, <b>fitur</b>, atau <b>cara buat</b>.`,
        next:['Berapa harga paketnya?','Apa saja fiturnya?','Bagaimana cara buat undangan?'],
        cta:[]
      };
    }

    // Deteksi khusus: "paket saya"
    if(/(paket\s*(saya|ku|aku|gue|gw)|sudah pilih|sudah pesan)/i.test(raw)){
      const t = KB.find(k => k.id === 'my_paket');
      lastTopic = 'my_paket';
      return { text: buildAnswer(t), next: t.next || [], cta: [] };
    }

    const {best, bestScore} = findBest(text);

    if(!best || bestScore < 2){
      return {
        text:`Maaf, saya belum paham maksudnya. 🙏<br><br>Coba tanya:<br>• <b>harga</b> paket<br>• <b>fitur</b> yang didapat<br>• <b>cara buat</b> undangan<br>• <b>tema</b> yang tersedia<br>• <b>pembayaran</b>`,
        next:['Berapa harga paketnya?','Apa saja fiturnya?','Bagaimana cara buat undangan?'],
        cta:[{ label:'Chat Admin', href: waUrl('Halo Admin, saya butuh bantuan'), cls:'wa' }]
      };
    }

    lastTopic = best.id;
    return {
      text: buildAnswer(best),
      next: best.next || [],
      cta: best.cta || []
    };
  }

  /* ============ UI ============ */
  function el(tag, cls, html){
    const d = document.createElement(tag);
    if(cls) d.className = cls;
    if(html != null) d.innerHTML = html;
    return d;
  }
  function scrollBottom(){ cm.scrollTop = cm.scrollHeight; }

  function bubble(html, who){
    const d = el('div','b ' + who, html);
    cm.appendChild(d);
    scrollBottom();
    return d;
  }
  function typingBubble(){
    const d = el('div','b bot','<span class="typing"><span></span><span></span><span></span></span>');
    cm.appendChild(d);
    scrollBottom();
    return d;
  }
  function renderQuickReplies(list){
    const old = $('qk-wrap');
    if(old) old.remove();
    if(!list || !list.length) return;
    const wrap = el('div','','');
    wrap.id = 'qk-wrap';
    list.forEach(q => {
      const b = el('button','qk', q);
      b.type = 'button';
      b.onclick = () => send(q);
      wrap.appendChild(b);
    });
    cm.appendChild(wrap);
    scrollBottom();
  }

  function send(raw){
    const text = String(raw||'').trim();
    if(!text || busy) return;

    const safe = text.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
    bubble(safe, 'user');
    ci.value = '';

    const old = $('qk-wrap'); if(old) old.remove();

    busy = true;
    const ty = typingBubble();
    const delay = 650 + Math.min(text.length * 22, 900);

    setTimeout(() => {
      ty.remove();
      const { text: answer, next } = reply(text);
      bubble(answer, 'bot');
      renderQuickReplies(next);
      busy = false;
    }, delay);
  }

  function toggleChat(force){
    open = typeof force === 'boolean' ? force : !open;
    const cp = $('cp'), ct = $('ct'), cb = $('cb');
    cp.classList.toggle('open', open);
    ct.setAttribute('aria-expanded', String(open));
    if(open){
      if(cb) cb.style.display = 'none';
      setTimeout(() => ci && ci.focus(), 320);
      scrollBottom();
    }
  }

  /* ============ INIT ============ */
  function init(){
    // Sapaan kontekstual
    const paketKey = getCurrentPaket();
    let greet = `Halo! 👋 Saya <b>Ivolera Assistant</b>.<br>
      Saya bisa bantu soal <b>harga</b>, <b>fitur</b>, <b>cara buat</b>, <b>tema</b>, <b>pembayaran</b>, dan <b>bantuan teknis</b>.<br><br>`;
    if(paketKey && PAKET_MAP[paketKey]){
      greet += `Sepertinya Anda memilih paket <b>${PAKET_MAP[paketKey].name}</b> (${PAKET_MAP[paketKey].price}). Mau lanjut isi data atau tanya dulu?`;
    } else {
      greet += `Mau mulai dari mana?`;
    }
    bubble(greet, 'bot');

    const initialQK = paketKey
      ? ['Lanjut isi data sekarang','Paket saya apa?','Berapa harga paketnya?']
      : ['💰 Berapa harga paketnya?','✨ Apa saja fiturnya?','🛠️ Bagaimana cara buat undangan?','🎯 Rekomendasi paket untuk 500 tamu'];
    renderQuickReplies(initialQK);

    $('ct').addEventListener('click', () => toggleChat());
    $('cc').addEventListener('click', () => toggleChat(false));

    cf.addEventListener('submit', e => {
      e.preventDefault();
      send(ci.value);
    });

    document.addEventListener('click', e => {
      const qk = e.target.closest('.qk');
      if(qk && qk.dataset.q) send(qk.dataset.q);
    });

    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && open) toggleChat(false);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();