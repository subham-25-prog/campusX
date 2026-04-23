import { MessageType } from "@prisma/client";
import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { verifyAccessToken } from "../utils/tokens";

type IncomingChatPayload = {
  conversationId: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
};

type SocketWithUser = Socket & { data: { userId: string } };

export let io: Server;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const rawToken =
        (socket.handshake.auth?.token as string | undefined) ??
        ((socket.handshake.query.token as string | undefined) ?? "").trim();
      const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
      if (!token) {
        return next(new Error("Unauthorized socket"));
      }
      const decoded = verifyAccessToken(token);
      (socket as SocketWithUser).data.userId = decoded.sub;
      return next();
    } catch {
      return next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const authedSocket = socket as SocketWithUser;
    const userId = authedSocket.data.userId;

    socket.join(`user:${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() }
    });

    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true }
    });

    for (const member of memberships) {
      socket.join(`chat:${member.conversationId}`);
    }

    socket.on("chat:join", async (conversationId: string) => {
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
        select: { id: true }
      });
      if (!member) return;
      socket.join(`chat:${conversationId}`);
    });

    socket.on("chat:typing", (payload: { conversationId: string; isTyping: boolean }) => {
      socket.to(`chat:${payload.conversationId}`).emit("chat:typing", {
        conversationId: payload.conversationId,
        userId,
        isTyping: payload.isTyping
      });
    });

    socket.on("chat:send", async (payload: IncomingChatPayload, callback?: (result: unknown) => void) => {
      try {
        const member = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: payload.conversationId,
              userId
            }
          }
        });

        if (!member) {
          callback?.({ ok: false, error: "You are not part of this conversation" });
          return;
        }

        const content = payload.content?.trim();
        if (!content) {
          callback?.({ ok: false, error: "Message cannot be empty" });
          return;
        }

        const [message] = await prisma.$transaction([
          prisma.message.create({
            data: {
              conversationId: payload.conversationId,
              senderId: userId,
              content,
              type: payload.type ?? MessageType.TEXT,
              mediaUrl: payload.mediaUrl
            },
            include: {
              sender: {
                select: { id: true, fullName: true, handle: true, verified: true }
              }
            }
          }),
          prisma.conversation.update({
            where: { id: payload.conversationId },
            data: { lastMessageAt: new Date() }
          })
        ]);

        io.to(`chat:${payload.conversationId}`).emit("chat:new-message", message);
        callback?.({ ok: true, message });
      } catch (error) {
        callback?.({ ok: false, error: "Failed to send message", details: String(error) });
      }
    });

    socket.on("chat:read", async (payload: { conversationId: string }) => {
      await prisma.conversationMember.updateMany({
        where: { conversationId: payload.conversationId, userId },
        data: { lastReadAt: new Date() }
      });

      io.to(`chat:${payload.conversationId}`).emit("chat:read", {
        conversationId: payload.conversationId,
        userId
      });
    });

    socket.on("disconnect", async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() }
      });
    });
  });

  return io;
};

