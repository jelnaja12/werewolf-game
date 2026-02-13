const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {

  socket.on("createRoom", ({ roomId, username }) => {
    rooms[roomId] = {
      host: socket.id,
      phase: "waiting",
      players: [],
      votes: {},
      wolfKilled: false
    };

    socket.join(roomId);
    rooms[roomId].players.push({
      id: socket.id,
      username,
      role: null,
      alive: true
    });

    socket.emit("roomCreated", roomId);
    io.to(roomId).emit("updateRoom", rooms[roomId]);
  });

  socket.on("joinRoom", ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) return;

    socket.join(roomId);
    room.players.push({
      id: socket.id,
      username,
      role: null,
      alive: true
    });

    io.to(roomId).emit("updateRoom", room);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const players = room.players;
    const wolfIndex = Math.floor(Math.random() * players.length);
    players.forEach((p, i) => {
      p.role = i === wolfIndex ? "wolf" : "villager";
    });

    room.phase = "night";
    room.wolfKilled = false;

    players.forEach(p => {
      io.to(p.id).emit("yourRole", p.role);
    });

    io.to(roomId).emit("updateRoom", room);
  });

  socket.on("changePhase", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    if (room.phase === "night" && !room.wolfKilled) {
      io.to(roomId).emit("alertMessage", "หมาป่ายังไม่ได้ฆ่า");
      return;
    }

    if (room.phase === "day") {
      calculateVotes(roomId);
    }

    room.phase =
      room.phase === "night"
        ? "day"
        : room.phase === "day"
        ? "night"
        : "night";

    room.votes = {};
    room.wolfKilled = false;

    io.to(roomId).emit("updateRoom", room);
  });

  socket.on("kill", ({ roomId, target }) => {
    const room = rooms[roomId];
    if (!room) return;

    const killer = room.players.find(p => p.id === socket.id);
    if (!killer || killer.role !== "wolf" || room.phase !== "night") return;

    const victim = room.players.find(p => p.username === target);
    if (!victim || !victim.alive) return;

    victim.alive = false;
    room.wolfKilled = true;

    io.to(roomId).emit("playerKilled", victim.username);
    checkWin(roomId);
  });

  socket.on("vote", ({ roomId, target }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.votes[socket.id] = target;
  });

});

function calculateVotes(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const voteCount = {};

  Object.values(room.votes).forEach(v => {
    if (!voteCount[v]) voteCount[v] = 0;
    voteCount[v]++;
  });

  let max = 0;
  let top = [];

  for (let key in voteCount) {
    if (voteCount[key] > max) {
      max = voteCount[key];
      top = [key];
    } else if (voteCount[key] === max) {
      top.push(key);
    }
  }

  if (max === 0) {
    io.to(roomId).emit("alertMessage", "ไม่มีการโหวต");
    return;
  }

  if (top.length > 1) {
    io.to(roomId).emit("alertMessage", "คะแนนเสมอ ไม่มีใครตาย");
    return;
  }

  if (top[0] === "novote") {
    io.to(roomId).emit("alertMessage", "No Vote มากสุด ไม่มีใครตาย");
    return;
  }

  const victim = room.players.find(p => p.username === top[0]);
  if (victim) {
    victim.alive = false;
    io.to(roomId).emit("playerExecuted", victim.username);
  }

  checkWin(roomId);
}

function checkWin(roomId) {
  const room = rooms[roomId];
  const wolves = room.players.filter(p => p.role === "wolf" && p.alive);
  const villagers = room.players.filter(p => p.role === "villager" && p.alive);

  if (wolves.length === 0) {
    io.to(roomId).emit("alertMessage", "ชาวบ้านชนะ!");
    resetGame(roomId);
  }

  if (wolves.length >= villagers.length) {
    io.to(roomId).emit("alertMessage", "หมาป่าชนะ!");
    resetGame(roomId);
  }
}

function resetGame(roomId) {
  const room = rooms[roomId];
  room.phase = "waiting";
  room.players.forEach(p => {
    p.role = null;
    p.alive = true;
  });
  room.votes = {};
  room.wolfKilled = false;
  io.to(roomId).emit("updateRoom", room);
}

server.listen(3000);
