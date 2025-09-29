// server.js
const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const net = require("net");
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;     // Express HTTP port
const TCP_PORT = 4000; // TCP socket port

app.use(bodyParser.json());

// ================== EXPRESS API ==================
app.get("/api/status", (req, res) => {
  res.json({ message: "API working fine ✅" });
});

app.post("/api/device", (req, res) => {
  const { imei, data } = req.body;
  console.log("Received via API:", { imei, data });

  res.json({ success: true, message: "Data saved (dummy)" });
});

// Create HTTP server (Express + Socket.io will share this)
const server = http.createServer(app);

// ================== SOCKET.IO (WebSocket) ==================
const io = new Server(server, {
  cors: {
    origin: "*", // allow frontend (React, Angular, etc.)
  },
});

io.on("connection", (socket) => {
  console.log("🔗 WebSocket client connected");

  socket.on("disconnect", () => {
    console.log("❌ WebSocket client disconnected");
  });
});

// ================== TCP SOCKET SERVER ==================
const handleSinoCastal = async (data, socket) => {
  const spacedHexString = data.toString("hex").match(/.{1,2}/g).join(" ");
  const hexArray = spacedHexString.split(" ");
  const packetHeader = hexArray.slice(25, 27).join("");
  const imei = hexArray.slice(5, 25).join("");
  console.log("spacedHexString", spacedHexString, packetHeader, imei);

  // 🔥 Broadcast to WebSocket clients
  io.emit("tcp-data", { imei, packetHeader, raw: spacedHexString });
};

const tcpServer = net.createServer((socket) => {
  console.log("📡 New TCP client connected:", socket.remoteAddress, socket.remotePort);

  socket.on("data", (data) => {
    handleSinoCastal(data, socket);

    // Example: Send ACK back
    socket.write("ACK: " + data.toString());
  });

  socket.on("end", () => {
    console.log("TCP client disconnected");
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

// ================== START SERVERS ==================
server.listen(PORT, () => {
  console.log(`🚀 Express + Socket.IO server running on port ${PORT}`);
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`🔌 TCP server running on port ${TCP_PORT}`);
});
