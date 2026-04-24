import path from "node:path";
import { MessageType, NotificationType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { io } from "../socket";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { chatMediaUpload, inferMessageType } from "../middleware/upload";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";

const createConversationSchema = z.object({
  participantIds: z.array(z.string().min(5)).min(1),
  isGroup: z.boolean().optional(),
  title: z.string().max(80).optional()
});

const sendMessageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  type: z.nativeEnum(MessageType).optional(),
  mediaUrl: z.string().trim().min(1).max(255).optional()
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(8)
});

const conversationParamSchema = z.object({
  id: z.string().min(1)
});

const messageParamSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1)
});

const router = Router();

router.use(requireAuth);

const ensureMember = async (conversationId: string, userId: string) => {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    },
    select: { id: true }
  });
  if (!member) throw new HttpError(403, "You are not part of this conversation");
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: { userId: req.user!.id }
        }
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                handle: true,
                avatarUrl: true,
                verified: true,
                institute: {
                  select: { shortCode: true }
                }
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true
          }
        }
      },
      take: 50
    });

    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const me = conversation.members.find((m) => m.userId === req.user!.id);
        const others = conversation.members.filter((m) => m.userId !== req.user!.id);
        const unread = me
          ? await prisma.message.count({
              where: {
                conversationId: conversation.id,
                createdAt: { gt: me.lastReadAt },
                senderId: { not: req.user!.id },
                deletedAt: null
              }
            })
          : 0;

        return {
          id: conversation.id,
          isGroup: conversation.isGroup,
          title:
            conversation.title ??
            (others.length > 0 ? others.map((o) => o.user.fullName).join(", ") : "New Chat"),
          participants: conversation.members.map((m) => ({
            id: m.user.id,
            name: m.user.fullName,
            handle: `@${m.user.handle}`,
            avatarUrl: m.user.avatarUrl ?? "",
            institute: m.user.institute?.shortCode ?? "JIS",
            verified: m.user.verified
          })),
          lastMessage: conversation.messages[0] ?? null,
          unreadCount: unread
        };
      })
    );

    res.json({ conversations: summaries });
  })
);

router.post(
  "/uploads",
  chatMediaUpload.single("media"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "Media file is required");
    const url = `/uploads/${path.basename(file.path)}`;
    const type = inferMessageType(file);
    res.status(201).json({ url, type });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createConversationSchema.parse(req.body);
    const currentUserId = req.user!.id;
    const uniqueParticipants = Array.from(new Set(input.participantIds.filter(Boolean))).filter(
      (id) => id !== currentUserId
    );

    if (uniqueParticipants.length === 0) {
      throw new HttpError(400, "At least one participant is required");
    }

    const isGroup = input.isGroup ?? uniqueParticipants.length > 1;

    if (!isGroup && uniqueParticipants.length === 1) {
      const targetId = uniqueParticipants[0]!;
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          members: {
            some: { userId: currentUserId }
          },
          AND: [
            { members: { some: { userId: targetId } } },
            { members: { every: { userId: { in: [currentUserId, targetId] } } } }
          ]
        },
        include: {
          members: { select: { userId: true } }
        }
      });

      if (existing && existing.members.length === 2) {
        return res.status(200).json({ conversation: existing, existed: true });
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        isGroup,
        title: input.title?.trim() || null,
        members: {
          create: [{ userId: currentUserId }, ...uniqueParticipants.map((id) => ({ userId: id }))]
        }
      },
      include: {
        members: {
          select: {
            userId: true
          }
        }
      }
    });

    for (const member of conversation.members) {
      io?.to(`user:${member.userId}`).emit("chat:conversation-created", {
        conversationId: conversation.id
      });
    }

    res.status(201).json({ conversation, existed: false });
  })
);

router.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const { id: conversationId } = conversationParamSchema.parse(req.params);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 40), 1), 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

    await ensureMember(conversationId, req.user!.id);

    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        sender: {
          select: { id: true, fullName: true, handle: true, verified: true }
        },
        reactions: {
          include: {
            user: {
              select: { id: true, fullName: true, handle: true }
            }
          }
        }
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasNext = messages.length > limit;
    const visible = hasNext ? messages.slice(0, limit) : messages;
    const nextCursor = hasNext ? visible[visible.length - 1]?.id : null;

    res.json({
      messages: visible.reverse(),
      nextCursor
    });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const { id: conversationId } = conversationParamSchema.parse(req.params);
    const input = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;
    const content = input.content?.trim() ?? "";

    if (!content && !input.mediaUrl) {
      throw new HttpError(400, "Message cannot be empty");
    }

    const resolvedType =
      input.type ??
      (input.mediaUrl ? (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(input.mediaUrl) ? MessageType.IMAGE : MessageType.FILE) : MessageType.TEXT);

    await ensureMember(conversationId, senderId);

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content,
          type: resolvedType,
          mediaUrl: input.mediaUrl
        },
        include: {
          sender: {
            select: { id: true, fullName: true, handle: true, verified: true }
          }
        }
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
      });

      const recipients = await tx.conversationMember.findMany({
        where: {
          conversationId,
          userId: { not: senderId }
        },
        select: { userId: true }
      });

      for (const recipient of recipients) {
        await tx.notification.create({
          data: {
            recipientId: recipient.userId,
            actorId: senderId,
            type: NotificationType.MESSAGE,
            message: `${req.user!.fullName} sent you a message`,
            metadata: { conversationId, messageId: created.id }
          }
        });
      }

      return created;
    });

    io?.to(`chat:${conversationId}`).emit("chat:new-message", message);
    res.status(201).json({ message });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const { id: conversationId } = conversationParamSchema.parse(req.params);
    await ensureMember(conversationId, req.user!.id);

    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id
        }
      },
      data: { lastReadAt: new Date() }
    });

    io?.to(`chat:${conversationId}`).emit("chat:read", {
      conversationId,
      userId: req.user!.id
    });

    res.json({ ok: true });
  })
);

router.post(
  "/:chatId/messages/:messageId/reactions",
  asyncHandler(async (req, res) => {
    const { chatId, messageId } = messageParamSchema.parse(req.params);
    const input = reactionSchema.parse(req.body);
    await ensureMember(chatId, req.user!.id);

    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: req.user!.id,
          emoji: input.emoji
        }
      },
      update: {},
      create: {
        messageId,
        userId: req.user!.id,
        emoji: input.emoji
      }
    });

    res.status(201).json({ ok: true });
  })
);

router.delete(
  "/:chatId/messages/:messageId/reactions",
  asyncHandler(async (req, res) => {
    const { chatId, messageId } = messageParamSchema.parse(req.params);
    const input = reactionSchema.parse(req.body);
    await ensureMember(chatId, req.user!.id);

    await prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId: req.user!.id,
        emoji: input.emoji
      }
    });

    res.json({ ok: true });
  })
);

export default router;
