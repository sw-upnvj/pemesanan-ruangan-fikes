const API_URL = "https://script.google.com/macros/s/AKfycbz-Szf7PXSSJPSEAddGSfGksyjU49d_U0ASyepGZszXDtV9pQPmbb5-2yHh3197X-DmgA/exec"; 

let currentUser = null;
let liveBookings = []; 

const ROOMS = [
  { id: "rapat", name: "Ruang Rapat FIKES" },
  { id: "209", name: "209 (CBT FIKES)" },
  { id: "podcast", name: "Ruang Podcast" }
];

window.handleCredentialResponse = async function(response) {
  const idToken = response.credential;
  const loginError = document.getElementById("loginError");
  
  loginError.innerText = "Memverifikasi akun Google...";
  loginError.style.color = "#1e3a5f";
  loginError.style.display = "block";

  try {
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
      document.getElementById("userBadge").innerText = "Login: " + data.name + " (" + data.role + ")";
      
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

window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("userData");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainPage").style.display = "block";
    document.getElementById("userBadge").innerText = "Login: " + currentUser.name + " (" + currentUser.role + ")";
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
    card.className = "room-card " + (conflict ? "occupied" : "available");

    if (conflict) {
      card.innerHTML = `<div class="room-name">${room.name}</div>
                        <div class="room-status"><strong>Dipakai:</strong> ${conflict.activity}<br><small>(${conflict.email})</small><br><small>👁️ Klik untuk detail</small></div>`;
      // Tambahkan klik untuk lihat detail
      card.addEventListener("click", () => openDetailModal(conflict, room));
    } else {
      card.innerHTML = `<div class="room-name">${room.name}</div>
                        <div class="room-status">Tersedia — Klik untuk pesan</div>`;
      card.addEventListener("click", () => openModal(room));
    }
    grid.appendChild(card);
  });
}

// FUNGSI BARU: Buka Modal Detail Ruangan
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

  document.getElementById("detailModal").style.display = "flex";
}

function closeDetailModal() {
  document.getElementById("detailModal").style.display = "none";
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
  
  // Reset form
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
  
  // Validasi sederhana
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
      alert("Pemesanan Berhasil! Email konfirmasi akan dikirim.");
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