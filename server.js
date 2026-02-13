const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

function assignRoles(players) {
  let roles = [];
  const wolfCount = Math.floor(players.length / 4) || 1;

  for (let i = 0; i < wolfCount; i++) roles.push("wolf");
  while (roles.length < players.length) roles.push("villager");

  roles.sort(() => Math.random() - 0.5);

  players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
  });
}

function resetRoom(room) {
  room.phase = "waiting";
  room.killTarget = null;
  room.votes = {};

  room.players.forEach(p => {
    p.role = null;
    p.alive = true;
  });
}

function checkWin(room, roomId) {
  const alive = room.players.filter(p => p.alive);
  const wolves = alive.filter(p => p.role === "wolf");
  const villagers = alive.filter(p => p.role === "villager");

  if (wolves.length === 0 && room.phase !== "waiting") {
    io.to(roomId).emit("gameOver", "ชาวบ้านชนะ!");
    resetRoom(room);
    io.to(roomId).emit("phaseChange", "waiting");
    io.to(roomId).emit("updatePlayers", room.players);
  }
  else if (wolves.length >= villagers.length && room.phase !== "waiting") {
    io.to(roomId).emit("gameOver", "หมาป่าชนะ!");
    resetRoom(room);
    io.to(roomId).emit("phaseChange", "waiting");
    io.to(roomId).emit("updatePlayers", room.players);
  }
}

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId, username }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        phase: "waiting",
        killTarget: null,
        votes: {},
        hostId: socket.id
      };
    }

    rooms[roomId].players.push({
      id: socket.id,
      username,
      role: null,
      alive: true
    });

    io.to(roomId).emit("updatePlayers", rooms[roomId].players);
    io.to(roomId).emit("hostUpdate", rooms[roomId].hostId);
  });

  socket.on("wolfKill", ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== "night") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.role !== "wolf" || !player.alive) return;

    if (room.killTarget) return; // 🔒 ฆ่าได้ครั้งเดียว

    room.killTarget = targetId;
    io.to(socket.id).emit("killLocked"); // ล็อคปุ่ม
  });

  socket.on("vote", ({ roomId, targetId }) => {
  const room = rooms[roomId];
  if (!room || room.phase !== "day") return;

  const voter = room.players.find(p => p.id === socket.id);
  if (!voter || !voter.alive) return;

  if (room.votes[socket.id]) return; // 🔒 โหวตได้ครั้งเดียว

  room.votes[socket.id] = targetId;
  io.to(socket.id).emit("voteLocked");
});


  socket.on("nextPhase", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    if (socket.id !== room.hostId) return;

    if (room.phase === "waiting") {
      assignRoles(room.players);
      room.phase = "night";

      room.players.forEach(p => {
        io.to(p.id).emit("yourRole", p.role);
      });

      io.to(roomId).emit("phaseChange", "night");
      return;
    }

    // 🔥 night → day ต้องมีการฆ่าก่อน
    if (room.phase === "night") {

      if (!room.killTarget) {
        io.to(socket.id).emit("alertMessage", "หมาป่ายังไม่ได้เลือกฆ่า!");
        return;
      }

      room.phase = "day";

      const victim = room.players.find(p => p.id === room.killTarget);
      if (victim) victim.alive = false;

      io.to(roomId).emit("playerDied", victim?.username);
      room.killTarget = null;
    }

  else if (room.phase === "day") {

  if (Object.keys(room.votes).length === 0) {
    io.to(socket.id).emit("alertMessage", "ยังไม่มีใครโหวต!");
    return;
  }

  room.phase = "night";

  const count = {};
  Object.values(room.votes).forEach(id => {
    count[id] = (count[id] || 0) + 1;
  });

  let maxVotes = 0;
  let executedId = null;

  for (let id in count) {
    if (count[id] > maxVotes) {
      maxVotes = count[id];
      executedId = id;
    }
  }

  if (executedId && executedId !== "noVote") {
    const victim = room.players.find(p => p.id === executedId);
    if (victim) victim.alive = false;
    io.to(roomId).emit("playerExecuted", victim?.username);
  } else {
    io.to(roomId).emit("alertMessage", "ไม่มีใครถูกประหาร");
  }

  room.votes = {};
}

    checkWin(room, roomId);

    io.to(roomId).emit("phaseChange", room.phase);
    io.to(roomId).emit("updatePlayers", room.players);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running");
});

