const socket = io();
let roomId = localStorage.getItem("roomId");
let username = localStorage.getItem("username");
let myRole = null;

function createRoom() {
  username = document.getElementById("username").value;
  roomId = document.getElementById("roomId").value;

  localStorage.setItem("username", username);
  localStorage.setItem("roomId", roomId);

  socket.emit("createRoom", { roomId, username });
  window.location = "room.html";
}

function joinRoom() {
  username = document.getElementById("username").value;
  roomId = document.getElementById("roomId").value;

  localStorage.setItem("username", username);
  localStorage.setItem("roomId", roomId);

  socket.emit("joinRoom", { roomId, username });
  window.location = "room.html";
}

if (window.location.pathname.includes("room.html")) {

  socket.emit("joinRoom", { roomId, username });

  document.getElementById("startBtn").onclick = () => {
    socket.emit("startGame", roomId);
  };

  document.getElementById("phaseBtn").onclick = () => {
    socket.emit("changePhase", roomId);
  };

  socket.on("yourRole", role => {
    myRole = role;
    alert("บทบาทของคุณคือ: " + role);
  });

  socket.on("updateRoom", room => {
    document.getElementById("roomTitle").innerText = "ห้อง: " + roomId;
    document.getElementById("phaseText").innerText = "ตอนนี้: " + room.phase;

    const div = document.getElementById("players");
    div.innerHTML = "";

    room.players.forEach(p => {
      const btn = document.createElement("button");
      btn.innerText = p.username + (p.alive ? "" : " (ตาย)");
      btn.disabled = !p.alive;

      if (room.phase === "night" && myRole === "wolf" && p.alive && p.username !== username) {
        btn.onclick = () => {
          socket.emit("kill", { roomId, target: p.username });
          lockButtons();
        };
      }

      if (room.phase === "day" && p.alive) {
        btn.onclick = () => {
          socket.emit("vote", { roomId, target: p.username });
          lockButtons();
        };
      }

      div.appendChild(btn);
    });

    if (room.phase === "day") {
      const noBtn = document.createElement("button");
      noBtn.innerText = "No Vote";
      noBtn.onclick = () => {
        socket.emit("vote", { roomId, target: "novote" });
        lockButtons();
      };
      div.appendChild(noBtn);
    }
  });

  socket.on("alertMessage", msg => alert(msg));
  socket.on("playerKilled", msg => alert(msg + " ถูกฆ่า"));
  socket.on("playerExecuted", msg => alert(msg + " ถูกโหวตออก"));
}

function lockButtons() {
  document.querySelectorAll("button").forEach(b => b.disabled = true);
}
