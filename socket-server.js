// Minimal Socket.IO server for external hosting (Railway/Render/Fly/etc.)
// Usage: `node socket-server.js` (set PORT via env if needed)
import http from "http";
import { Server } from "socket.io";

const port = process.env.PORT || 3001;
const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket server running\n");
});

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: "*", // tighten this to your deployed frontend origin
  },
});

io.on("connection", (socket) => {
  const projectId = socket.handshake.query.projectId;
  if (typeof projectId === "string") {
    socket.join(projectId);
  }

  socket.on("collab-message", (message) => {
    if (typeof projectId === "string") {
      socket.to(projectId).emit("collab-message", message);
    } else {
      socket.broadcast.emit("collab-message", message);
    }
  });
});

server.listen(port, () => {
  console.log(`Socket server listening on ${port}`);
});
