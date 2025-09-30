// server.js
const express = require("express");
const http = require("http");
const net = require("net");
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;     // Express HTTP port
const TCP_PORT = 4000; // TCP socket port

app.use(express.json());

// ================== EXPRESS API ==================
app.get("/api/status", (req, res) => {
  res.json({ message: "API working fine ✅" });
});

app.post("/api/device", (req, res) => {
  const { imei, data } = req.body;
  console.log("Received via API:", { imei, data });
  res.json({ success: true, message: "Data saved (dummy)" });
});

// ================== SERVE UI ==================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TCP Logs UI</title>
      <style>
        body { font-family: Arial; margin: 20px; }
        #status { font-weight: bold; margin-bottom: 10px; }
        #logs { border: 1px solid #ccc; padding: 10px; height: 800px; overflow-y: scroll; background: #f9f9f9; }
        .error { color: red; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <h2>TCP Server Logs</h2>
      <div id="status">Connecting...</div>
      <div id="logs"></div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();

        const statusEl = document.getElementById("status");
        const logsEl = document.getElementById("logs");

        socket.on("connect", () => {
          statusEl.textContent = "✅ Connected to server";
        });

        socket.on("disconnect", () => {
          statusEl.textContent = "❌ Disconnected from server";
        });

        socket.on("socket-status", (msg, type) => {
          statusEl.textContent = msg;
          statusEl.className = type || "";
        });

        socket.on("tcp-log", (msg, type) => {
          const div = document.createElement("div");
          div.textContent = msg;
          if(type) div.className = type;
          logsEl.appendChild(div);
          logsEl.scrollTop = logsEl.scrollHeight; // auto scroll
        });
      </script>
    </body>
    </html>
  `);
});

// ================== CREATE SERVER ==================
const server = http.createServer(app);

// ================== SOCKET.IO ==================
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🔗 WebSocket client connected");
  socket.emit("socket-status", "Connected to server", "success");

  socket.on("disconnect", () => {
    console.log("❌ WebSocket client disconnected");
  });

  socket.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    socket.emit("socket-status", "Socket error: " + err.message, "error");
  });
});

// ================== TCP SERVER ==================
const handleSinoCastal = async (data, socket) => {
  const spacedHexString = data.toString("hex").match(/.{1,2}/g).join(" ");
  const hexArray = spacedHexString.split(" ");
  const packetHeader = hexArray.slice(25, 27).join("");
  const imei = hexArray.slice(5, 25).join("");
  const logMessage = `TCP: IMEI=${imei}, Header=${packetHeader}, Raw=${spacedHexString}`;
  if(packetHeader=='1001'){
     let response=`40402900043231384C314542323032333030303536310000009001FFFFFFFF0000F185DA689F2B0D0A`
    const bufferToSend = Buffer.from(response, 'hex');
    console.log('sockets', bufferToSend);
    socket.write(bufferToSend);
  }
  console.log(logMessage);

  // Broadcast to UI via WebSocket
  io.emit("tcp-log", logMessage, "success");
};

const tcpServer = net.createServer((socket) => {
  console.log("📡 New TCP client connected:", socket.remoteAddress, socket.remotePort);
  io.emit("tcp-log", `TCP client connected: ${socket.remoteAddress}:${socket.remotePort}`, "info");

  socket.on("data", (data) => {
    try {
      handleSinoCastal(data, socket);
    //   socket.write("ACK: " + data.toString());
    } catch (err) {
      console.error("TCP handling error:", err.message);
      io.emit("tcp-log", `TCP handling error: ${err.message}`, "error");
    }
  });

  socket.on("end", () => {
    console.log("TCP client disconnected");
    io.emit("tcp-log", `TCP client disconnected: ${socket.remoteAddress}:${socket.remotePort}`, "error");
  });

  socket.on("error", (err) => {
    console.error("TCP socket error:", err.message);
    io.emit("tcp-log", `TCP socket error: ${err.message}`, "error");
  });
});

// ================== START SERVERS ==================
server.listen(PORT, () => console.log(`🚀 Express + Socket.IO running on port ${PORT}`));
tcpServer.listen(TCP_PORT, "0.0.0.0", () => console.log(`🔌 TCP server running on port ${TCP_PORT}`));
