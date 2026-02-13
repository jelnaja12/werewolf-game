const socket = io();

const username = localStorage.getItem("username");
const roomId = localStorage.getItem("room");

let myRole = null;
let players = [];
let phase = "waiting";
let hostId = null;

document.getElementById("roomName").innerText = roomId;

socket.emit("joinRoom", { roomId, username });

socket.on("updatePlayers", (data) => {
  players = data;
  render();
});

socket.on("hostUpdate", (id) => {
  hostId = id;
  render();
});

function render() {
  const list = document.getElementById("players");
  list.innerHTML = "";

  players.forEach(p => {
    const li = document.createElement("li");
    let text = p.username;
    if (p.id === hostId) text += " 👑";
    if (!p.alive) text += " (ตาย)";
    li.innerText = text;
    list.appendChild(li);
  });

  renderActions();
  renderHostButton();
}

function renderHostButton() {
  const btn = document.getElementById("phaseBtn");
  if (!btn) return;

  if (socket.id === hostId) {
    btn.style.display = "inline-block";
  } else {
    btn.style.display = "none";
  }
}

function renderActions() {
  const div = document.getElementById("actionSection");
  div.innerHTML = "";

  const me = players.find(p => p.username === username);
  if (!me || !me.alive) return;

  if (phase === "night" && myRole === "wolf") {
    players.forEach(p => {
      if (p.alive && p.username !== username) {
        const btn = document.createElement("button");
        btn.innerText = "ฆ่า " + p.username;
        btn.onclick = () => {
          socket.emit("wolfKill", { roomId, targetId: p.id });
        };
        div.appendChild(btn);
      }
    });
  }

  if (phase === "day") {

  let voted = false;

  players.forEach(p => {
    if (p.alive && p.username !== username) {
      const btn = document.createElement("button");
      btn.innerText = "โหวต " + p.username;
      btn.onclick = () => {
        if (voted) return;
        voted = true;
        socket.emit("vote", { roomId, targetId: p.id });
      };
      div.appendChild(btn);
    }
  });

  // 🔥 ปุ่มไม่โหวต
  const noBtn = document.createElement("button");
  noBtn.innerText = "ไม่โหวต";
  noBtn.onclick = () => {
    if (voted) return;
    voted = true;
    socket.emit("vote", { roomId, targetId: "noVote" });
  };
  div.appendChild(noBtn);
}

}

socket.on("yourRole", (role) => {
  myRole = role;
  alert("บทบาทของคุณคือ: " + role);
});

socket.on("phaseChange", (p) => {
  phase = p;
  document.getElementById("phaseText").innerText = "ตอนนี้คือ: " + p;
  renderActions();
});

socket.on("playerDied", (name) => {
  alert(name + " ถูกหมาป่าฆ่า!");
});

socket.on("playerExecuted", (name) => {
  alert(name + " ถูกโหวตประหาร!");
});

socket.on("killLocked", () => {
  const div = document.getElementById("actionSection");
  div.innerHTML = "<p>คุณเลือกเหยื่อแล้ว</p>";
});

socket.on("alertMessage", (msg) => {
  alert(msg);
});

socket.on("gameOver", (msg) => {
  alert(msg); // 🔥 เหลือแค่แจ้งเตือน
  myRole = null;
  phase = "waiting";
  document.getElementById("resultText").innerText = "";
});

socket.on("voteLocked", () => {
  const div = document.getElementById("actionSection");
  div.innerHTML = "<p>คุณโหวตแล้ว</p>";
});




function nextPhase() {
  socket.emit("nextPhase", roomId);
}
