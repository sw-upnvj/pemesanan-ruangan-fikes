const API_URL = "https://script.google.com/macros/s/AKfycbz-Szf7PXSSJPSEAddGSfGksyjU49d_U0ASyepGZszXDtV9pQPmbb5-2yHh3197X-DmgA/exec"; 

let currentUser = null;
let liveBookings = []; 

const ROOMS = [
  // Ruang Khusus (Existing)
  { id: "rapat", name: "Ruang Rapat FIKES" },
  { id: "209", name: "209 (CBT FIKES)" },
  { id: "podcast", name: "Ruang Podcast" },
  
  // Lantai 1 (100-an)
  { id: "102", name: "Ruang 102" },
  { id: "103", name: "Ruang 103" },
  { id: "104", name: "Ruang 104" },
  { id: "105", name: "Ruang 105" },
  { id: "106", name: "Ruang 106" },
  
  // Lantai 2 (200-an)
  { id: "201", name: "Ruang 201" },
  { id: "202", name: "Ruang 202" },
  { id: "203", name: "Ruang 203" },
  { id: "204", name: "Ruang 204" },
  { id: "205", name: "Ruang 205" },
  { id: "206", name: "Ruang 206" },
  { id: "207", name: "Ruang 207" },
  { id: "208", name: "Ruang 208" },
  
  // Lantai 4 (400-an)
  { id: "407", name: "Ruang 407" },
  { id: "408", name: "Ruang 408" },
  { id: "409", name: "Ruang 409" },
  { id: "410", name: "Ruang 410" }
];

const ALLOWED_DOMAIN = "upnvj.ac.id";

// Handle response dari Google Sign-In
window.handleCredentialResponse = async function(response) {
  const idToken = response.credential;
  const loginError = document.getElementById("loginError");
  
  loginError.innerText = "Memverifikasi akun Google...";
  loginError.style.color = "#1e3a5f";
  loginError.style.display = "block";

  try {
    // Decode token untuk dapat email
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const email = payload.email;
    
    // Validasi domain UPNVJ
    if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
      loginError.innerText = "Hanya email @upnvj.ac.id yang diizinkan.";
      loginError.style.color = "#c0392b";
      return;
    }

    // Cek apakah user sudah terdaftar
    const checkRes = await fetch(API_URL + "?action=checkUser&email=" + encodeURIComponent(email));
    const checkData = await checkRes.json();
    
    if (checkData.success && !checkData.registered) {
      showRegisterPage(email);
      return;
    }

    // User sudah terdaftar → lanjut login
    const formData = new URLSearchParams();
    formData.append("action", "login");
    formData.append("id_token", idToken);

    const res = await fetch(API_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.allowed) {
      currentUser = data;
      localStorage.setItem("userData", JSON.stringify(data)); 
      
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

// Tampilkan halaman registrasi
function showRegisterPage(email) {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("registerPage").style.display = "flex";
  document.getElementById("regEmail").value = email;
}

// Submit registrasi
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
        
        // Reset form
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

// Auto-login jika ada session tersimpan
window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("userData");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainPage").style.display = "block";
    // Tambahkan fallback jika prodi undefined
    document.getElementById("userBadge").innerText = 
      `${currentUser.name} (${currentUser.role} - ${currentUser.prodi || '-'})`;
    fetchBookings().then(() => initApp());
  }
});

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
          notes: b.notes || "-"
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
}

function renderRooms() {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const grid = document.getElementById("roomGrid");

  if (!date || !start || !end) return;
  grid.innerHTML = "";

  ROOMS.forEach(room => {
    const conflict = liveBookings.find(b => {
      const isSameRoom = b.roomId.toString().trim() === room.id.toString().trim();
      const isSameDate = b.date.toString().trim() === date.toString().trim();
      const isOverlap = (start < b.end && end > b.start);
      return isSameRoom && isSameDate && isOverlap;
    });

    const card = document.createElement("div");
    
    // Tentukan class CSS berdasarkan status
    let cardClass = "available";
    let statusLabel = "Tersedia — Klik untuk pesan";
    
    if (conflict) {
      if (conflict.status === 'unconfirmed') {
        cardClass = "unconfirmed"; // Warna Oranye/Kuning
        statusLabel = `⚠️ Belum Konfirmasi: ${conflict.activity}`;
      } else {
        cardClass = "occupied"; // Warna Abu-abu
        statusLabel = `Dipakai: ${conflict.activity}`;
      }
    }

    card.className = "room-card " + cardClass;

    if (conflict) {
      card.innerHTML = `<div class="room-name">${room.name}</div>
                        <div class="room-status"><strong>${statusLabel}</strong><br><small>(${conflict.email})</small><br><small>️ Klik untuk detail</small></div>`;
      card.addEventListener("click", () => openDetailModal(conflict, room));
    } else {
      card.innerHTML = `<div class="room-name">${room.name}</div>
                        <div class="room-status">${statusLabel}</div>`;
      card.addEventListener("click", () => openModal(room));
    }
    grid.appendChild(card);
  });
}

function openModal(room) {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;

  const dateObj = new Date(date + "T00:00:00");
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = dateObj.toLocaleDateString('id-ID', options);

  document.getElementById("modalRoomName").innerText = room.name;
  document.getElementById("modalDateTime").innerText = dateStr + " • " + start + " - " + end;
  
  document.getElementById("formRoomId").value = room.id;
  document.getElementById("formDate").value = date;
  document.getElementById("formStart").value = start;
  document.getElementById("formEnd").value = end;
  
  // OTOMATIS ISI NAMA DARI DATA USER
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
  if(!activity || !phone) {
    alert("Nama Kegiatan dan No. HP wajib diisi!");
    return;
  }

  btnSubmit.innerText = "Memproses...";
  btnSubmit.disabled = true;

  const payload = {
    action: "createBooking",
    email: currentUser.email,
    roomId: document.getElementById("formRoomId").value,
    date: document.getElementById("formDate").value,
    start: document.getElementById("formStart").value,
    end: document.getElementById("formEnd").value,
    activity: activity,
    courseName: document.getElementById("formCourse").value,
    lecturerName: document.getElementById("formLecturer").value,
    contactPerson: currentUser.name,
    contactPhone: phone,
    notes: document.getElementById("formNotes").value
  };

  try {
    const formData = new URLSearchParams();
    for (const key in payload) {
      formData.append(key, payload[key]);
    }

    const res = await fetch(API_URL, { method: "POST", body: formData });
    const result = await res.json();

    if (result.success) {
      alert("Pemesanan Berhasil!");
      closeModal();
      await fetchBookings(); 
    } else {
      alert("Gagal: " + result.message);
    }
  } catch (err) {
    alert("Gagal terhubung ke server.");
  } finally {
    btnSubmit.innerText = originalText;
    btnSubmit.disabled = false;
  }
}

function logout() {
  // Konfirmasi sebelum logout
  if (!confirm("Yakin ingin logout dari sistem?")) return;
  
  // 1. Hapus data user dari localStorage
  localStorage.removeItem("userData");
  
  // 2. Reset variabel currentUser
  currentUser = null;
  liveBookings = [];
  
  // 3. Sembunyikan halaman utama
  document.getElementById("mainPage").style.display = "none";
  
  // 4. Tampilkan halaman login
  document.getElementById("loginPage").style.display = "flex";
  
  // 5. Reset pesan error login
  const loginError = document.getElementById("loginError");
  loginError.style.display = "none";
  loginError.innerText = "";
  
  // 6. Reset Google Sign-In state (agar bisa login dengan akun berbeda)
  if (window.google && google.accounts && google.accounts.id) {
    try {
      google.accounts.id.disableAutoSelect();
    } catch (err) {
      console.log("Google sign-in reset:", err);
    }
  }
  
  console.log("✅ User berhasil logout");
}

function openDetailModal(booking, room) {
  const dateObj = new Date(booking.date + "T00:00:00");
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = dateObj.toLocaleDateString('id-ID', options);

  document.getElementById("detailRoomName").innerText = room.name;
  document.getElementById("detailDateTime").innerText = dateStr + " • " + booking.start + " - " + booking.end;
  document.getElementById("detailActivity").innerText = booking.activity;
  document.getElementById("detailCourse").innerText = booking.courseName;
  document.getElementById("detailLecturer").innerText = booking.lecturerName;
  document.getElementById("detailContact").innerText = booking.contactPerson + " (" + booking.contactPhone + ")";
  document.getElementById("detailEmail").innerText = booking.email;
  document.getElementById("detailNotes").innerText = booking.notes;

  // LOGIKA BARU: Tampilkan tombol batal hanya jika user yang login adalah pemesan
  const btnCancel = document.getElementById("btnCancelBooking");
  if (currentUser && booking.email.toLowerCase() === currentUser.email.toLowerCase()) {
    // Cek apakah status masih bisa dibatalkan
    if (booking.status === 'confirmed' || booking.status === 'unconfirmed') {
      btnCancel.style.display = "block";
      btnCancel.dataset.id = booking.id; // Simpan ID booking di tombol
    } else {
      btnCancel.style.display = "none";
    }
  } else {
    btnCancel.style.display = "none";
  }

  document.getElementById("detailModal").style.display = "flex";
}

async function confirmCancelBooking() {
  const btn = document.getElementById("btnCancelBooking");
  const bookingId = btn.dataset.id;
  
  if (!bookingId) return;

  // Konfirmasi bertingkat agar user tidak salah klik
  const confirm1 = confirm("Apakah Anda yakin ingin MEMBATALKAN pemesanan ini?\n\nRuangan akan otomatis tersedia untuk pengguna lain.");
  if (!confirm1) return;

  const confirm2 = confirm("KONFIRMASI TERAKHIR:\n\nTindakan ini tidak dapat dibatalkan. Lanjutkan pembatalan?");
  if (!confirm2) return;

  const originalText = btn.innerText;
  btn.innerText = "Memproses...";
  btn.disabled = true;

  const formData = new URLSearchParams();
  formData.append("action", "cancelBooking");
  formData.append("id", bookingId);
  formData.append("email", currentUser.email);

  try {
    const res = await fetch(API_URL, { method: "POST", body: formData });
    const result = await res.json();

    if (result.success) {
      alert("✅ " + result.message);
      closeDetailModal();
      await fetchBookings(); // Refresh data ruangan
    } else {
      alert("❌ Gagal: " + result.message);
    }
  } catch (err) {
    alert("Gagal terhubung ke server.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function closeDetailModal() {
  document.getElementById("detailModal").style.display = "none";
}