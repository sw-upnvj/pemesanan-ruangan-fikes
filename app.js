const API_URL = "https://script.google.com/macros/s/AKfycbz-Szf7PXSSJPSEAddGSfGksyjU49d_U0ASyepGZszXDtV9pQPmbb5-2yHh3197X-DmgA/exec"; 





// ==========================================
// HELPER: Validasi waktu "HH:MM"
// ==========================================
function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// Cek overlap waktu berbasis menit (bukan string)
function timesOverlap(startA, endA, startB, endB) {
  const sA = parseTimeToMinutes(startA);
  const eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = parseTimeToMinutes(endB);
  if (sA === null || eA === null || sB === null || eB === null) return false;
  return sA < eB && eA > sB;
}


// ==========================================
// HELPER: Toast notification (pengganti alert)
// ==========================================
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function getIdToken() {
  if (window.__lastIdToken) return window.__lastIdToken;
  throw new Error("Sesi token tidak tersedia. Silakan login ulang.");
}

let currentUser = null;
let liveBookings = []; 

const ROOMS = [
  // Ruang Khusus
  { id: "rapat", name: "Ruang Rapat FIKES", capacity: null },
  { id: "209", name: "209 (CBT FIKES)", capacity: null },
  { id: "podcast", name: "Ruang Podcast", capacity: null },
  
  // Lantai 1 (100-an)
  { id: "102", name: "Ruang 102", capacity: 45 },
  { id: "103", name: "Ruang 103", capacity: 46 },
  { id: "104", name: "Ruang 104", capacity: 45 },
  { id: "105", name: "Ruang 105", capacity: 45 },
  { id: "106", name: "Ruang 106", capacity: 25 },
  
  // Lantai 2 (200-an)
  { id: "201", name: "Ruang 201", capacity: 30 },
  { id: "202", name: "Ruang 202", capacity: 55 },
  { id: "203", name: "Ruang 203", capacity: 54 },
  { id: "204", name: "Ruang 204", capacity: 55 },
  { id: "205", name: "Ruang 205", capacity: 55 },
  { id: "206", name: "Ruang 206", capacity: 55 },
  { id: "207", name: "Ruang 207", capacity: 55 },
  { id: "208", name: "Ruang 208", capacity: 55 },

  // Lantai 3 (300-an)
  { id: "301", name: "Ruang 301", capacity: 20 },
  { id: "302", name: "Ruang 302", capacity: 20 },
  { id: "303", name: "Ruang 303", capacity: 20 },
  { id: "304", name: "Ruang 304", capacity: 20 },
  { id: "305", name: "Ruang 305", capacity: 20 },
  { id: "306", name: "Ruang 306", capacity: 20 },
  { id: "307", name: "Ruang 307", capacity: 20 },   // asumsi sama dgn 301-306
  { id: "308", name: "Ruang 308", capacity: 20 },   // asumsi sama
  { id: "309", name: "Ruang 309", capacity: 20 },   // asumsi sama
  { id: "310", name: "Ruang 310", capacity: 20 },   // asumsi sama
  
  // Lantai 4 (400-an)
  { id: "407", name: "Ruang 407", capacity: 50 },
  { id: "408", name: "Ruang 408", capacity: 52 },
  { id: "409", name: "Ruang 409", capacity: 50 },
  { id: "410", name: "Ruang 410", capacity: 44 }
];

const ALLOWED_DOMAINS = ["upnvj.ac.id", "mahasiswa.upnvj.ac.id"];

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 jam
const STORAGE_KEY = "userData";

// ==========================================
// HELPER: Session storage (expiry + validasi)
// ==========================================
function saveSession(userData) {
  const payload = {
    data: userData,
    savedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Kompatibilitas data lama (tanpa savedAt)
    if (!parsed.data) {
      return { user: parsed, expired: false };
    }
    const age = Date.now() - (parsed.savedAt || 0);
    if (age > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return { user: parsed.data, expired: true };
    }
    return { user: parsed.data, expired: false };
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// ==========================================
// 1. FUNGSI LOGIN GOOGLE
// ==========================================
window.handleCredentialResponse = async function(response) {
  const idToken = response.credential;
  const loginError = document.getElementById("loginError");
  
  loginError.innerText = "Memverifikasi akun Google...";
  loginError.style.color = "#1e3a5f";
  loginError.style.display = "block";

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const email = payload.email;
    
    // --- PERUBAHAN DI SINI ---
    const allowedDomains = ["upnvj.ac.id", "mahasiswa.upnvj.ac.id"];
    const isAllowed = allowedDomains.some(domain => email.endsWith("@" + domain));
    
    if (!isAllowed) {
      loginError.innerText = "Hanya email @upnvj.ac.id atau @mahasiswa.upnvj.ac.id yang diizinkan.";
      loginError.style.color = "#c0392b";
      return;
    }
    // -------------------------

    const checkRes = await fetch(API_URL + "?action=checkUser&id_token=" + encodeURIComponent(idToken));
    const checkData = await checkRes.json();
    
    if (checkData.success && !checkData.registered) {
      showRegisterPage(email);
      return;
    }

    const formData = new URLSearchParams();
    formData.append("action", "login");
    formData.append("id_token", idToken);

    const res = await fetch(API_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.allowed) {
      currentUser = data;
      saveSession(data); // ✅ simpan dengan timestamp
      window.__lastIdToken = idToken; // ✅ TAMBAHKAN INI — simpan token untuk request selanjutnya
      
      document.getElementById("loginPage").style.display = "none";
      document.getElementById("mainPage").style.display = "block";
      document.getElementById("userBadge").innerText = `${data.name} (${data.role} - ${data.prodi || '-'})`;
      
      await fetchBookings(); 
      initApp(); 
    } else {
      loginError.innerText = data.message;
      loginError.style.color = "#c0392b";
    }
  } catch (err) {
    loginError.innerText = "Gagal terhubung ke server.";
    console.error(err);
  }
};

// Cek Memori saat halaman di-refresh
window.addEventListener("DOMContentLoaded", () => {
  const session = loadSession();
  if (!session || !session.user) return;

  if (session.expired) {
    showToast("Sesi Anda telah berakhir. Silakan login ulang.", "warning", 5000);
    clearSession();
    return;
  }

  // ✅ JIKA TOKEN HILANG KARENA REFRESH: Paksa ke halaman login
  if (!window.__lastIdToken) {
    showToast("Halaman dimuat ulang. Silakan klik login untuk memesan ruangan.", "info", 5000);
    clearSession(); // Hapus sesi agar bersih
    
    // Tampilkan halaman login
    document.getElementById("mainPage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
    return; // Hentikan eksekusi di sini
  }

  // Jika token masih ada (jarang terjadi, tapi untuk berjaga-jaga)
  currentUser = session.user;
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("mainPage").style.display = "block";
  document.getElementById("userBadge").innerText = `${currentUser.name} (${currentUser.role} - ${currentUser.prodi || '-'})`;
  fetchBookings().then(() => initApp());
});

// ==========================================
// 2. FUNGSI REGISTRASI
// ==========================================
function showRegisterPage(email) {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("registerPage").style.display = "flex";
  document.getElementById("regEmail").value = email;
}

async function submitRegister() {
  const email = document.getElementById("regEmail").value;
  const nama = document.getElementById("regNama").value.trim();
  const role = document.getElementById("regRole").value;
  const prodi = document.getElementById("regProdi").value;
  
  const errorEl = document.getElementById("registerError");
  const successEl = document.getElementById("registerSuccess");
  
  errorEl.style.display = "none";
  successEl.style.display = "none";
  
  if (!nama || !role || !prodi) {
    errorEl.innerText = "Semua field harus diisi.";
    errorEl.style.display = "block";
    return;
  }
  
  const formData = new URLSearchParams();
  formData.append("action", "register");
  formData.append("email", email);
  formData.append("nama", nama);
  formData.append("role", role);
  formData.append("prodi", prodi);
  
  try {
    const res = await fetch(API_URL, { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.success) {
      successEl.innerText = data.message + " Mengalihkan ke halaman login...";
      successEl.style.display = "block";
      
      setTimeout(() => {
        document.getElementById("registerPage").style.display = "none";
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("loginError").style.display = "none";
        document.getElementById("regNama").value = "";
        document.getElementById("regRole").value = "";
        document.getElementById("regProdi").value = "";
      }, 2000);
    } else {
      errorEl.innerText = data.message;
      errorEl.style.display = "block";
    }
  } catch (err) {
    errorEl.innerText = "Gagal terhubung ke server.";
    errorEl.style.display = "block";
  }
}

// ==========================================
// 3. FUNGSI BOOKING & TAMPILAN
// ==========================================
async function fetchBookings() {
  try {
    const res = await fetch(API_URL + "?action=getBookings");
    const result = await res.json();
    if (result.success) {
      liveBookings = result.data.map(b => {
        let dStr = b.date ? b.date.toString().trim() : "";
        let sStr = b.start ? b.start.toString().trim() : "";
        if (sStr.length === 4) sStr = "0" + sStr;
        let eStr = b.end ? b.end.toString().trim() : "";
        if (eStr.length === 4) eStr = "0" + eStr;

        return {
          id: b.id,
          roomId: b.roomId ? b.roomId.toString().trim() : "",
          date: dStr,
          start: sStr,
          end: eStr,
          email: b.email ? b.email.toString().trim() : "",
          activity: b.activity ? b.activity.toString().trim() : "",
          status: b.status,
          courseName: b.courseName || "-",
          lecturerName: b.lecturerName || "-",
          contactPerson: b.contactPerson || "-",
          contactPhone: b.contactPhone || "-",
          notes: b.notes || "-",
          participantCount: b.participantCount || "-" // Data Baru
        };
      });
      renderRooms();
    }
  } catch (err) { 
    console.error("Gagal ambil data:", err); 
  }
}

function initApp() {
  const datePicker = document.getElementById("datePicker");
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  datePicker.value = `${yyyy}-${mm}-${dd}`;
  
  document.querySelectorAll(".btn-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = new Date();
      d.setDate(d.getDate() + Number(btn.dataset.offset));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      datePicker.value = `${y}-${m}-${day}`;
      document.querySelectorAll(".btn-quick").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderRooms();
    });
  });

  datePicker.addEventListener("change", renderRooms);
  document.getElementById("startTime").addEventListener("change", renderRooms);
  document.getElementById("endTime").addEventListener("change", renderRooms);
  document.querySelector(".btn-quick[data-offset='0']").click();

    // AUTO REFRESH SETIAP 15 DETIK
  setInterval(async () => {
    const isLoggedIn = document.getElementById("mainPage").style.display === "block";
    if (isLoggedIn) {
      await fetchBookings(); 
      // Cek tab mana yang sedang aktif, lalu update datanya
      if (document.getElementById('tabDaftar').style.display === 'block') {
        renderListBookings();
      }
      if (document.getElementById('tabRekap').style.display === 'block') {
        renderMonthlyView();
      }
    }
  }, 15000);
}

function renderRooms() {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const grid = document.getElementById("roomGrid");

  if (!date || !start || !end) return;

  const sMin = parseTimeToMinutes(start);
  const eMin = parseTimeToMinutes(end);
  if (sMin === null || eMin === null || sMin >= eMin) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align:center; color:#c0392b; font-weight:600;">⚠️ Jam mulai harus lebih awal dari jam selesai.</div>`;
    return;
  }

  grid.innerHTML = "";

  ROOMS.forEach(room => {
    const conflict = liveBookings.find(b => {
      const isSameRoom = b.roomId === room.id.toString();
      const isSameDate = b.date === date;
      if (!isSameRoom || !isSameDate) return false;
      return timesOverlap(start, end, b.start, b.end);
    });

    const card = document.createElement("div");

    let cardClass = "available";
    
    if (conflict) {
      if (conflict.status === 'unconfirmed') {
        cardClass = "unconfirmed";
      } else {
        cardClass = "occupied";
      }
    }

    card.className = "room-card " + cardClass;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    const capacityLine = room.capacity
      ? `<div class="room-capacity">🪑 ${room.capacity} kursi</div>`
      : "";

    if (conflict) {
      // TAMPILAN JIKA TERPAKAI / BELUM KONFIRMASI
      card.innerHTML = `
        <div class="card-top">
          <div class="room-name">${room.name}</div>
          ${capacityLine}
        </div>
        <div class="card-bottom">
          <strong>Dipakai: ${conflict.activity}</strong><br>
          <small>(${conflict.email})</small><br>
          <small>👁️ Klik untuk detail</small>
        </div>`;
      
      // ✅ Listener klik dimasukkan kembali ke dalam
      card.addEventListener("click", () => openDetailModal(conflict, room));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetailModal(conflict, room); }
      });
    } else {
      // TAMPILAN JIKA TERSEDIA (SESUAI FOTO)
      card.innerHTML = `
        <div class="card-top">
          <div class="room-name">${room.name}</div>
          ${capacityLine}
        </div>
        <div class="card-bottom">
          <span>Tersedia — Klik untuk pesan</span>
        </div>`;
      
      // ✅ Listener klik dimasukkan kembali ke dalam
      card.addEventListener("click", () => openModal(room));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(room); }
      });
    }
    
    grid.appendChild(card);
  });
}

function openModal(room) {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;

  // ✅ VALIDASI BARU: cek jam mulai < jam selesai dan dalam rentang 07:00-21:00
  const sMin = parseTimeToMinutes(start);
  const eMin = parseTimeToMinutes(end);
    if (sMin === null || eMin === null || sMin >= eMin) {
    showToast("Jam mulai harus lebih awal dari jam selesai.", "error");
    return;
  }
  if (sMin < 7 * 60 || eMin > 21 * 60) {
    showToast("Pemesanan hanya diizinkan antara 07:00 - 21:00.", "error");
    return;
  }

  const dateObj = new Date(date + "T00:00:00");
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = dateObj.toLocaleDateString('id-ID', options);

  document.getElementById("bookingType").value = "single";
  document.getElementById("multipleDateContainer").style.display = "none";
  selectedExtraDates = [];

  document.getElementById("modalRoomName").innerText = room.name;
  document.getElementById("modalDateTime").innerText = dateStr + " • " + start + " - " + end;

  document.getElementById("formRoomId").value = room.id;
  document.getElementById("formDate").value = date;
  document.getElementById("formStart").value = start;
  document.getElementById("formEnd").value = end;

  document.getElementById("formContactPerson").value = currentUser.name + " (" + currentUser.role + ")";

  document.getElementById("formActivity").value = "";
  document.getElementById("formCourse").value = "";
  document.getElementById("formLecturer").value = "";
  document.getElementById("formPhone").value = "";
  document.getElementById("formCount").value = "";
  document.getElementById("formNotes").value = "";

  document.getElementById("bookingModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("bookingModal").style.display = "none";
}

async function submitBooking() {
  const btnSubmit = document.querySelector('.btn-submit');
  const originalText = btnSubmit.innerText;

  const activity = document.getElementById("formActivity").value.trim();
  const phone = document.getElementById("formPhone").value.trim();
  if (!activity || !phone) {
    showToast("Nama Kegiatan dan No. HP wajib diisi!", "error");
    return;
  }

  // ✅ Validasi jam (start < end, dan dalam 07:00-21:00)
  const start = document.getElementById("formStart").value;
  const end = document.getElementById("formEnd").value;
  const sMin = parseTimeToMinutes(start);
  const eMin = parseTimeToMinutes(end);
  if (sMin === null || eMin === null || sMin >= eMin) {
    showToast("Jam mulai harus lebih awal dari jam selesai.", "error");
    return;
  }
  if (sMin < 7 * 60 || eMin > 21 * 60) {
    showToast("Pemesanan hanya diizinkan antara 07:00 - 21:00.", "error");
    return;
  }

  const bookingType = document.getElementById("bookingType").value;
  const baseDate = document.getElementById("formDate").value;
  const roomId = document.getElementById("formRoomId").value;
      // ✅ Validasi jumlah peserta vs kapasitas ruangan
  const roomObj = ROOMS.find(r => r.id === roomId);
  const countInput = document.getElementById("formCount").value;
  if (roomObj && roomObj.capacity && countInput) {
    const count = parseInt(countInput, 10);
    if (!isNaN(count) && count > roomObj.capacity) {
      showToast(`Jumlah peserta (${count}) melebihi kapasitas ruangan (${roomObj.capacity} kursi).`, "error", 5000);
      return;
    }
  }

  let datesToBook = [];
  if (bookingType === "single") {
    datesToBook.push(baseDate);
  } else {
    if (selectedExtraDates.length === 0) {
      showToast("Pilih minimal 1 tanggal di kalender!", "error");
      return;
    }
    datesToBook = [...selectedExtraDates];
  }

  // ✅ PRE-CHECK: refresh data terbaru + cek bentrok
  btnSubmit.innerText = "Memeriksa ketersediaan...";
  btnSubmit.disabled = true;

  try {
    await fetchBookings();

    // Cari tanggal yang bentrok
    const conflicts = [];
    for (const date of datesToBook) {
      const conflict = liveBookings.find((b) => {
        if (b.roomId !== roomId) return false;
        if (b.date !== date) return false;
        if (b.status === "cancelled") return false;
        return timesOverlap(start, end, b.start, b.end);
      });
      if (conflict) conflicts.push(date);
    }

    if (conflicts.length > 0) {
      const fmt = conflicts
        .map((d) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }))
        .join(", ");
      showToast(`Slot sudah terisi pada: ${fmt}. Silakan pilih waktu/tanggal lain.`, "error", 6000);
      return;
    }

    // ✅ SUBMIT
    btnSubmit.innerText = "Memproses...";
    let successCount = 0;
    const failedDates = [];

    for (const date of datesToBook) {
      const payload = {
        action: "createBooking",
        id_token: getIdToken(),
        roomId: roomId,
        date: date,
        start: start,
        end: end,
        activity: activity,
        courseName: document.getElementById("formCourse").value,
        lecturerName: document.getElementById("formLecturer").value,
        contactPerson: currentUser.name,
        contactPhone: phone,
        participantCount: document.getElementById("formCount").value,
        notes: document.getElementById("formNotes").value,
      };

      const formData = new URLSearchParams();
      for (const key in payload) formData.append(key, payload[key]);

      try {
        const res = await fetch(API_URL, { method: "POST", body: formData });
        const result = await res.json();
        if (result.success) {
          successCount++;
        } else {
          failedDates.push(date);
        }
      } catch (err) {
        failedDates.push(date);
      }
    }

    // ✅ Laporan hasil yang jelas
    if (successCount === datesToBook.length) {
      showToast(`✅ ${successCount} pemesanan berhasil!`, "success");
    } else if (successCount > 0) {
      const fmtFail = failedDates
        .map((d) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }))
        .join(", ");
      showToast(`⚠️ ${successCount} berhasil. Gagal di: ${fmtFail}.`, "warning", 6000);
    } else {
      showToast("❌ Semua pemesanan gagal. Silakan coba lagi.", "error");
    }

    closeModal();
    await fetchBookings();

    if (document.getElementById("tabDaftar").style.display === "block") renderListBookings();
    if (document.getElementById("tabRekap").style.display === "block") renderMonthlyView();
  } catch (err) {
    console.error(err);
    showToast("Gagal terhubung ke server.", "error");
  } finally {
    btnSubmit.innerText = originalText;
    btnSubmit.disabled = false;
  }
}

function logout() {
  if (!confirm("Yakin ingin logout dari sistem?")) return;
  clearSession();
  currentUser = null;
  liveBookings = [];
  document.getElementById("mainPage").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("loginError").innerText = "";
  if (window.google && google.accounts && google.accounts.id) {
    try { google.accounts.id.disableAutoSelect(); } catch (err) {}
  }
}

function openDetailModal(booking, room) {
  try {
    const dateObj = new Date(booking.date + "T00:00:00");
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = dateObj.toLocaleDateString('id-ID', options);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.innerText = value || "-";
    };

    setText("detailRoomName", room.name);
    setText("detailDateTime", dateStr + " • " + booking.start + " - " + booking.end);
    setText("detailCapacity", room.capacity ? room.capacity + " kursi" : "-");
    setText("detailActivity", booking.activity);
    setText("detailCourse", booking.courseName);
    setText("detailLecturer", booking.lecturerName);
    setText("detailContact", booking.contactPerson + " (" + booking.contactPhone + ")");
    setText("detailEmail", booking.email);
    setText("detailNotes", booking.notes);
    setText("detailCount", booking.participantCount === "-" ? "-" : booking.participantCount + " orang");

    const btnCancel = document.getElementById("btnCancelBooking");
    if (btnCancel && currentUser && booking.email.toLowerCase() === currentUser.email.toLowerCase()) {
      if (booking.status === 'confirmed' || booking.status === 'unconfirmed') {
        btnCancel.style.display = "block";
        btnCancel.dataset.id = booking.id;
      } else {
        btnCancel.style.display = "none";
      }
    } else if (btnCancel) {
      btnCancel.style.display = "none";
    }

    document.getElementById("detailModal").style.display = "flex";
  } catch (err) {
    console.error("Error di openDetailModal:", err);
    showToast("Gagal menampilkan detail. Silakan refresh halaman.", "error");
  }
}

async function confirmCancelBooking() {
  const btn = document.getElementById("btnCancelBooking");
  const bookingId = btn.dataset.id;
  if (!bookingId) return;

  // ✅ Cukup 1 confirm (tidak dobel)
  if (!confirm("Yakin ingin membatalkan pemesanan ini? Tindakan tidak dapat dibatalkan.")) return;

  const originalText = btn.innerText;
  btn.innerText = "Memproses...";
  btn.disabled = true;

  const formData = new URLSearchParams();
  formData.append("action", "cancelBooking");
formData.append("id", bookingId);
formData.append("id_token", getIdToken()); // ✅ KIRIM TOKEN

  try {
    const res = await fetch(API_URL, { method: "POST", body: formData });
    const result = await res.json();

    if (result.success) {
      showToast("✅ " + result.message, "success");
      closeDetailModal();
      await fetchBookings();

      if (document.getElementById('tabDaftar').style.display === 'block') renderListBookings();
      if (document.getElementById('tabRekap').style.display === 'block') renderMonthlyView();
    } else {
      showToast("❌ Gagal: " + (result.message || "Tidak diketahui"), "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server.", "error");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function closeDetailModal() {
  document.getElementById("detailModal").style.display = "none";
}

// ==========================================
// 5. FUNGSI DAFTAR PEMESANAN (LIST VIEW)
// ==========================================


function renderListBookings() {
  const tbody = document.getElementById("listBookingBody");
  tbody.innerHTML = "";

  // Urutkan berdasarkan tanggal dan jam terdekat
  const sortedBookings = [...liveBookings].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start.localeCompare(b.start);
  });

  if (sortedBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">Belum ada jadwal pemesanan.</td></tr>`;
    return;
  }

  sortedBookings.forEach(b => {
    // Cari nama ruangan berdasarkan roomId
    const roomObj = ROOMS.find(r => r.id === b.roomId);
    const roomName = roomObj ? roomObj.name : b.roomId;

    // Format tanggal
    const dateObj = new Date(b.date + "T00:00:00");
    const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    
    // Warna status
    let statusColor = b.status === 'unconfirmed' ? '#f39c12' : '#2ecc71';
    let statusText = b.status === 'unconfirmed' ? '(Belum Konfirmasi)' : '';

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    tr.innerHTML = `
      <td style="padding: 10px;">${dateStr}</td>
      <td style="padding: 10px;">${b.start} - ${b.end}</td>
      <td style="padding: 10px; font-weight: bold; color: #1e3a5f;">${roomName}</td>
      <td style="padding: 10px;">${b.activity} <br><small style="color:${statusColor};">${statusText}</small></td>
      <td style="padding: 10px;">${b.contactPerson || b.email}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 6. FUNGSI REKAP 1 BULAN
// ==========================================


function renderMonthlyView() {
  const monthValue = document.getElementById("monthPicker").value; // Format: YYYY-MM
  const table = document.getElementById("matrixTable");
  table.innerHTML = "";

  if (!monthValue) return;

  const [year, month] = monthValue.split("-");
  const daysInMonth = new Date(year, month, 0).getDate(); 

  // 1. Buat Header (Tanggal)
  let thead = "<thead><tr style='background: #f4f6f8;'>";
  thead += "<th style='padding: 10px; text-align: left; min-width: 140px; border: 1px solid #ddd; font-weight: bold; color: var(--hijau-gelap); position: sticky; left: 0; background: #f4f6f8; z-index: 1;'>Ruangan \\ Tanggal</th>";
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const bgColor = isWeekend ? "#f8d7da" : "#f4f6f8";
    
    // Format angka jadi 2 digit (01, 02)
    const dayStr = String(d).padStart(2, '0');
    
    thead += `<th style="padding: 8px 4px; border: 1px solid #ddd; font-weight: 600; color: var(--hijau-gelap); background: ${bgColor}; min-width: 35px;">${dayStr}</th>`;
  }
  thead += "</tr></thead>";
  table.innerHTML += thead;

  // 2. Buat Body (Baris per Ruangan)
  let tbody = "<tbody>";
  
  ROOMS.forEach(room => {
    tbody += "<tr>";
    // Kolom Nama Ruangan (Sticky agar tetap terlihat saat scroll ke kanan)
    tbody += `<td style="padding: 10px; text-align: left; font-weight: 600; font-size: 0.85rem; border: 1px solid #ddd; color: var(--hijau-gelap); position: sticky; left: 0; background: #fff; z-index: 1;">${room.name}</td>`;
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
      
      // Cari semua booking di tanggal & ruangan ini (bisa lebih dari 1 jam)
      const bookings = liveBookings.filter(b => 
        b.roomId === room.id && 
        b.date === dateStr && 
        b.status !== 'cancelled'
      );

      let cellContent = "";
      let cellBg = "#fff"; // Default kosong
      
      if (bookings.length > 0) {
        // Jika ada booking, warnai kotaknya
        const isUnconfirmed = bookings.some(b => b.status === 'unconfirmed');
        cellBg = isUnconfirmed ? "var(--emas)" : "var(--hijau-tosca)";
        
        // Buat text kecil (misal: "08:00") agar terlihat rapi
        const times = bookings.map(b => b.start).join(", ");
        cellContent = `<span style="color: white; font-size: 0.7rem; font-weight: bold;">${times}</span>`;
      }

      // Simpan data booking ke atribut onclick agar bisa dibuka detailnya
      const bookingsJson = encodeURIComponent(JSON.stringify(bookings));
      
      tbody += `<td style="padding: 6px 4px; border: 1px solid #ddd; background: ${cellBg}; cursor: ${bookings.length > 0 ? 'pointer' : 'default'}; border-radius: 4px;" 
                   ${bookings.length > 0 ? `onclick="openDetailFromMatrix('${bookingsJson}', '${room.name}')"` : ''}>
                   ${cellContent}
                </td>`;
    }
    tbody += "</tr>";
  });
  
  tbody += "</tbody>";
  table.innerHTML += tbody;
}

// Fungsi pembantu untuk membuka detail dari Matriks
function openDetailFromMatrix(bookingsJson, roomName) {
  const bookings = JSON.parse(decodeURIComponent(bookingsJson));
  if (!bookings || bookings.length === 0) return;

  // ✅ Jika hanya 1 booking → langsung buka detail seperti biasa
  if (bookings.length === 1) {
    const roomObj = ROOMS.find(r => r.name === roomName) || { name: roomName, id: bookings[0].roomId };
    openDetailModal(bookings[0], roomObj);
    return;
  }

  // ✅ Jika >1 booking → tampilkan modal pilihan
  const safeRoomName = roomName.replace(/'/g, "\\'");
  const list = bookings.map((b) => {
    const encoded = encodeURIComponent(JSON.stringify(b));
    return `<div class="matrix-booking-item" onclick="openDetailFromMatrixSingle('${encoded}', '${safeRoomName}')">
      <strong>${b.start} - ${b.end}</strong> — ${b.activity}
      <br><small>${b.contactPerson || b.email}</small>
    </div>`;
  }).join("");

  let modal = document.getElementById("matrixListModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "matrixListModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 class="modal-title" id="matrixListTitle">Pemesanan</h2>
        <p class="modal-subtitle">Pilih salah satu untuk melihat detail</p>
        <div id="matrixListBody" style="display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto;"></div>
        <div class="modal-actions">
          <button onclick="document.getElementById('matrixListModal').style.display='none'" class="btn-cancel">Tutup</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById("matrixListTitle").innerText = "Pemesanan di " + roomName;
  document.getElementById("matrixListBody").innerHTML = list;
  modal.style.display = "flex";
}

// ✅ Helper baru: buka detail satu booking dari modal pilihan
function openDetailFromMatrixSingle(encoded, roomName) {
  const booking = JSON.parse(decodeURIComponent(encoded));
  const roomObj = ROOMS.find(r => r.name === roomName) || { name: roomName, id: booking.roomId };
  document.getElementById("matrixListModal").style.display = "none";
  openDetailModal(booking, roomObj);
}

function switchTab(tabId) {
  // Sembunyikan semua konten tab
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  
  // Hapus class active dari semua tombol
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  // Tampilkan konten yang dipilih
  document.getElementById(tabId).style.display = 'block';
  
  // Tambahkan class active ke tombol yang diklik
  if (tabId === 'tabPesan') document.getElementById('btnTabPesan').classList.add('active');
  if (tabId === 'tabDaftar') document.getElementById('btnTabDaftar').classList.add('active');
  if (tabId === 'tabRekap') document.getElementById('btnTabRekap').classList.add('active');

  // Render ulang data sesuai tab
  if (tabId === 'tabDaftar') renderListBookings();
  if (tabId === 'tabRekap') {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById("monthPicker").value = currentMonth;
    renderMonthlyView();
  }
}

function toggleBookingType() {
  const type = document.getElementById("bookingType").value;
  const multipleContainer = document.getElementById("multipleDateContainer");
  
  if (type === "multiple") {
    multipleContainer.style.display = "block";
    renderMiniCalendar();
  } else {
    multipleContainer.style.display = "none";
  }
}

let selectedExtraDates = []; // Menyimpan tanggal yang di-klik user

function renderMiniCalendar() {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";
  selectedExtraDates = []; // Reset pilihan setiap kali kalender dibuka

  const baseDateStr = document.getElementById("formDate").value; // Tanggal awal yang dipilih di luar
  const baseDate = new Date(baseDateStr + "T00:00:00");
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  // Buat Header Hari (Sen, Sel, Rab, dst)
  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  days.forEach(day => {
    grid.innerHTML += `<div style="font-size: 0.7rem; font-weight: bold; color: var(--hijau-gelap); padding-bottom: 4px;">${day}</div>`;
  });

  // Dapatkan hari pertama di bulan tersebut (0=Minggu, 1=Senin, dst)
  let firstDay = new Date(year, month, 1).getDay();
  // Konversi agar Senin = 0, Minggu = 6
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  // Kosongkan kotak sebelum tanggal 1
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += `<div></div>`;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const roomId = document.getElementById("formRoomId").value;

  const start = document.getElementById("formStart").value;
  const end = document.getElementById("formEnd").value;

  // Generate tanggal 1 sampai akhir bulan
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // ✅ Cek apakah tanggal ini sudah terisi (pakai timesOverlap)
    const isOverlap = liveBookings.find(b =>
      b.roomId === roomId &&
      b.date === dateStr &&
      timesOverlap(start, end, b.start, b.end)
    );

    let cellStyle = "padding: 6px 0; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;";
    
    if (isOverlap) {
      // Jika sudah terisi
      cellStyle += "background: #e0e0e0; color: #999; cursor: not-allowed;";
      grid.innerHTML += `<div style="${cellStyle}">${d}</div>`;
    } else {
      // Jika kosong, bisa diklik
      cellStyle += "background: #fff; border: 1px solid var(--abu-kotak); color: var(--hijau-gelap); font-weight: bold;";
      
      // Beri ID unik untuk cell ini
      const cellId = `cal-${dateStr}`;
      grid.innerHTML += `<div id="${cellId}" style="${cellStyle}" onclick="toggleDateSelection('${dateStr}', '${cellId}')">${d}</div>`;
      
      // Jika tanggal ini adalah tanggal awal (baseDate), otomatis pilih
      if (dateStr === baseDateStr) {
        toggleDateSelection(dateStr, cellId);
      }
    }
  }
}

// Fungsi untuk memilih/batal memilih tanggal
function toggleDateSelection(dateStr, cellId) {
  const cell = document.getElementById(cellId);
  const index = selectedExtraDates.indexOf(dateStr);

  if (index > -1) {
    // Jika sudah dipilih, batalkan pilihan
    selectedExtraDates.splice(index, 1);
    cell.style.background = "#fff";
    cell.style.color = "var(--hijau-gelap)";
  } else {
    // Jika belum dipilih, tambahkan
    selectedExtraDates.push(dateStr);
    cell.style.background = "var(--hijau-tosca)";
    cell.style.color = "#fff";
  }
}

// Reset pilihan ke "Sekali Pesan" setiap kali modal dibuka
function resetBookingType() {
  document.getElementById("bookingType").value = "single";
  toggleBookingType();
}

// ==========================================
// AKSESIBILITAS: Tutup modal dengan Esc
// ==========================================
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  // Tutup modal detail jika terbuka
  const detailModal = document.getElementById("detailModal");
  if (detailModal && detailModal.style.display === "flex") {
    closeDetailModal();
    return;
  }

  // Tutup modal form booking jika terbuka
  const bookingModal = document.getElementById("bookingModal");
  if (bookingModal && bookingModal.style.display === "flex") {
    closeModal();
    return;
  }

  // Tutup modal pilihan matriks jika terbuka
  const matrixModal = document.getElementById("matrixListModal");
  if (matrixModal && matrixModal.style.display === "flex") {
    matrixModal.style.display = "none";
  }
});


