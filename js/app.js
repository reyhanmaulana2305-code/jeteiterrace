/* ============================================================
   TERAS JTI - app.js
   Satu file untuk seluruh alur pelanggan:
   - Navbar mobile (hamburger) di semua halaman
   - menu.html   : tombol "+ Tambah" -> isi keranjang (localStorage)
   - pesanan.html: render keranjang, kontrol +/-, Kirim -> QR code
   Data disimpan di localStorage agar tetap saat pindah halaman.
   ============================================================ */

// ===== KUNCI PENYIMPANAN =====
const KEY = {
  keranjang: 'teras_keranjang',   // { [nama]: { nama, harga, qty } }
  antrian: 'teras_antrian',       // nomor antrian aktif
  urut: 'teras_antrian_urut',     // counter nomor antrian
  terkirim: 'teras_terkirim',     // data pesanan terakhir (untuk kasir)
};

// ===== HELPER =====
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const simpan = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const muat = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
const rupiah = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const angka = teks => Number(String(teks).replace(/[^0-9]/g, '')) || 0;

const getKeranjang = () => muat(KEY.keranjang, {});
const setKeranjang = k => simpan(KEY.keranjang, k);
const totalItem = () => Object.values(getKeranjang()).reduce((t, q) => t + q.qty, 0);
const totalHarga = () => Object.values(getKeranjang()).reduce((t, q) => t + q.harga * q.qty, 0);

/* Nomor antrian berikutnya: A-07, A-08, ... */
function antrianBerikutnya() {
  const urut = parseInt(String(muat(KEY.urut, 6)), 10) + 1;
  const no = 'A-' + String(urut).padStart(2, '0');
  simpan(KEY.urut, urut);
  simpan(KEY.antrian, no);
  return no;
}

/* ============================================================
   NAVBAR MOBILE (hamburger) — berlaku di halaman yang punya tombol
   ============================================================ */
function initNavbar() {
  const tombol = $('#tombol-menu');
  const nav = $('#menu-nav');
  if (!tombol || !nav) return;
  tombol.addEventListener('click', () => {
    const terbuka = tombol.getAttribute('aria-expanded') === 'true';
    tombol.setAttribute('aria-expanded', String(!terbuka));
    nav.classList.toggle('terbuka', !terbuka);
  });
}

/* ============================================================
   HALAMAN MENU: tombol "+ Tambah", filter kategori, dan pencarian
   ============================================================ */

/* Tebak kategori menu dari nama (makanan / minuman) */
function kategoriItem(nama) {
  const n = nama.toLowerCase();
  const makanan = ['nasi', 'mie', 'ayam', 'kentang', 'lalapan', 'soto',
    'goreng', 'katsu', 'telur', 'sambal', 'teriyaki', 'kriwil', 'kribo', 'ayam'];
  return makanan.some(k => n.includes(k)) ? 'makanan' : 'minuman';
}

function initMenu() {
  const daftar = $('.daftar');
  if (!daftar) return;

  const elJumlah = $('#jumlah-item');
  const elTotal = $('#total-keranjang');
  const inputCari = $('#cari');
  const filterNav = $('.filter');

  let kategori = 'semua';
  let q = '';

  const perbaruiKeranjang = () => {
    if (elJumlah) elJumlah.textContent = 'Keranjang: ' + totalItem() + ' item';
    if (elTotal) elTotal.textContent = rupiah(totalHarga());
  };

  /* Tampilkan item sesuai kategori + kata kunci */
  const terapkanFilter = () => {
    let tampil = 0;
    $$('.item', daftar).forEach(item => {
      const nama = item.querySelector('h2')?.textContent.trim() || '';
      const cocokKategori = kategori === 'semua' || kategoriItem(nama) === kategori;
      const cocokCari = !q || nama.toLowerCase().includes(q);
      const tampilkan = cocokKategori && cocokCari;
      item.hidden = !tampilkan;
      if (tampilkan) tampil += 1;
    });

    let pesan = $('#pesan-menu');
    if (!pesan) {
      pesan = document.createElement('p');
      pesan.id = 'pesan-menu';
      pesan.className = 'tidak-ada';
      daftar.after(pesan);
    }
    pesan.hidden = tampil > 0;
    pesan.textContent = 'Menu tidak ditemukan. Coba kata kunci lain.';
  };

  /* Tombol + Tambah */
  daftar.addEventListener('click', e => {
    const tombol = e.target.closest('.tombol');
    if (!tombol) return;
    const item = tombol.closest('.item');
    if (!item) return;

    const nama = item.querySelector('h2')?.textContent.trim() || 'Menu';
    const harga = angka(item.querySelector('.harga')?.textContent);
    const keranjang = getKeranjang();

    if (keranjang[nama]) keranjang[nama].qty += 1;
    else keranjang[nama] = { nama, harga, qty: 1 };
    setKeranjang(keranjang);
    perbaruiKeranjang();

    // umpan balik visual
    tombol.textContent = '✓ Ditambah';
    tombol.classList.add('sudah');
    setTimeout(() => {
      tombol.textContent = '+ Tambah';
      tombol.classList.remove('sudah');
    }, 900);
  });

  /* Filter kategori (pill) — cegah navigasi, filter di halaman */
  if (filterNav) {
    filterNav.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();
      kategori = link.dataset.cat
        || (link.textContent.trim().toLowerCase() === 'makanan' ? 'makanan'
          : link.textContent.trim().toLowerCase() === 'minuman' ? 'minuman' : 'semua');
      $$('a', filterNav).forEach(a => a.classList.toggle('aktif', a === link));
      terapkanFilter();
    });
  }

  /* Kotak pencarian */
  if (inputCari) {
    inputCari.addEventListener('input', e => {
      q = e.target.value.trim().toLowerCase();
      terapkanFilter();
    });
  }

  perbaruiKeranjang();
  terapkanFilter();
}

/* ============================================================
   HALAMAN PESANAN
   ============================================================ */
function initPesanan() {
  const tabel = $('.tabel') || $('table');
  const btnKirim = $('#kirimPesanan');
  if (!tabel || !btnKirim) return;

  const tbody = $('tbody', tabel);
  const elTotal = $('.total');
  const qrHasil = $('#qrHasil');
  const nama = $('#nama');
  const alertBox = $('.alert');

  /* Baca item langsung dari baris tabel (DOM) */
  function bacaItems() {
    return $$('tbody tr', tabel).map(tr => {
      const nilaiEl = $('.qta-nilai', tr);
      if (!nilaiEl) return null;
      const selNama = $('td:nth-child(2)', tr);
      return {
        nama: (selNama?.textContent || '').trim(),
        qty: Number(nilaiEl.textContent) || 0,
        harga: Number(tr.dataset.harga) || 0,
      };
    }).filter(Boolean);
  }

  /* Hitung ulang subtotal tiap baris + total + nomor urut */
  function perbaruiTotal() {
    let total = 0;
    let urut = 0;
    $$('tbody tr', tabel).forEach(tr => {
      const nilaiEl = $('.qta-nilai', tr);
      if (!nilaiEl) return;
      urut += 1;
      const noEl = $('td:first-child', tr);
      if (noEl) noEl.textContent = urut;

      const harga = Number(tr.dataset.harga) || 0;
      const qty = Number(nilaiEl.textContent) || 0;
      const subtotal = harga * qty;
      const sel = $('.angka', tr);
      if (sel) sel.textContent = rupiah(subtotal);
      total += subtotal;
    });
    if (elTotal) elTotal.textContent = 'Total: ' + rupiah(total);
    return total;
  }

  /* Jika keranjang berisi, bangun ulang tabel dari keranjang */
  function renderDariKeranjang() {
    const list = Object.values(getKeranjang()).filter(q => q.qty > 0);
    if (list.length === 0) return false;
    tbody.innerHTML = list.map((q, i) => `
      <tr data-harga="${q.harga}" data-nama="${q.nama}">
        <td>${i + 1}</td>
        <td>${q.nama}</td>
        <td class="tengah">
          <div class="kuantitas">
            <button type="button" class="qta kurang" aria-label="Kurangi jumlah ${q.nama}">−</button>
            <span class="qta-nilai">${q.qty}</span>
            <button type="button" class="qta tambah" aria-label="Tambah jumlah ${q.nama}">+</button>
          </div>
        </td>
        <td class="angka">${rupiah(q.harga * q.qty)}</td>
      </tr>
    `).join('');
    perbaruiTotal();
    return true;
  }

  /* Tampilkan keadaan kosong bila tak ada baris sama sekali */
  function cekKosong() {
    const adaBaris = $$('tbody tr', tabel).some(tr => $('.qta-nilai', tr));
    if (!adaBaris) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--abu);padding:22px">Keranjang kosong. <a href="menu.html" style="color:var(--utama);font-weight:700">Pilih menu</a> dulu.</td></tr>';
      if (elTotal) elTotal.textContent = 'Total: ' + rupiah(0);
      btnKirim.disabled = true;
      if (qrHasil) qrHasil.hidden = true;
    } else {
      btnKirim.disabled = false;
    }
  }

  /* ---- Kontrol + / − ---- */
  tabel.addEventListener('click', e => {
    const btn = e.target.closest('.qta');
    if (!btn) return;
    const tr = btn.closest('tr');
    const nilaiEl = $('.qta-nilai', tr);
    if (!nilaiEl) return;

    let qty = Number(nilaiEl.textContent) || 0;
    if (btn.classList.contains('tambah')) qty += 1;
    if (btn.classList.contains('kurang')) qty = Math.max(0, qty - 1);

    // sinkron ke keranjang bila baris berasal dari keranjang
    const namaItem = tr.dataset.nama;
    if (namaItem) {
      const keranjang = getKeranjang();
      if (keranjang[namaItem]) {
        if (qty <= 0) delete keranjang[namaItem];
        else keranjang[namaItem].qty = qty;
        setKeranjang(keranjang);
      }
    }

    // jumlah 0 -> hapus baris (nama item otomatis hilang)
    if (qty <= 0) {
      tr.remove();
      perbaruiTotal();
      cekKosong();
      return;
    }

    nilaiEl.textContent = qty;
    perbaruiTotal();
  });

  /* ---- Kirim Pesanan ---- */
  btnKirim.addEventListener('click', () => {
    const list = bacaItems().filter(i => i.qty > 0);
    if (list.length === 0) { cekKosong(); return; }

    if (!nama.value.trim()) {
      alertBox.hidden = false;
      nama.classList.add('invalid');
      nama.focus();
      if (qrHasil) qrHasil.hidden = true;
      return;
    }
    alertBox.hidden = true;
    nama.classList.remove('invalid');

    const total = list.reduce((t, i) => t + i.harga * i.qty, 0);
    const no = antrianBerikutnya();

    const data = {
      antrian: no,
      nama: nama.value.trim(),
      catatan: $('#catatan').value.trim(),
      items: list.map(i => ({ nama: i.nama, qty: i.qty, harga: i.harga })),
      total,
      waktu: new Date().toISOString(),
    };
    simpan(KEY.terkirim, data);

    $('#qrAntrian').textContent = no;
    $('#qrData').textContent =
      `${no} · ${data.nama} · ${list.map(i => i.nama + ' x' + i.qty).join(', ')} · ${rupiah(total)}`;

    const box = $('#qrcode');
    box.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(box, {
        text: JSON.stringify(data),
        width: 180, height: 180,
        colorDark: '#0e3b3a', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } else {
      box.textContent = 'QR tidak tersedia (periksa koneksi internet).';
    }

    if (qrHasil) {
      qrHasil.hidden = false;
      qrHasil.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    localStorage.removeItem(KEY.keranjang);
  });

  /* ---- Validasi input nama ---- */
  alertBox.hidden = true;
  nama.addEventListener('input', () => {
    if (nama.value.trim()) { alertBox.hidden = true; nama.classList.remove('invalid'); }
  });

  /* ---- Inisialisasi ---- */
  renderDariKeranjang(); // jika ada isi keranjang, tampilkan
  cekKosong();           // jika tetap kosong, tampilkan pesan
  perbaruiTotal();
}

/* ============================================================
   MULAI sesuai halaman
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  if ($('#kirimPesanan')) initPesanan();
  else initMenu();
});