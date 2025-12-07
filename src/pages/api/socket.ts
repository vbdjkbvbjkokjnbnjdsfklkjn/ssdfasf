import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Socket } from "net";

type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
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

    res.socket.server.io = io;
  }

  res.end();
}
