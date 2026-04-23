import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 100);
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            handle: true,
            verified: true
          }
        },
        post: {
          select: {
            id: true,
            content: true
          }
        }
      }
    });

    const unreadCount = await prisma.notification.count({
      where: { recipientId: req.user!.id, isRead: false }
    });

    res.json({ notifications, unreadCount });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { recipientId: req.user!.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ ok: true });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        recipientId: req.user!.id
      },
      data: { isRead: true }
    });
    res.json({ ok: true });
  })
);

export default router;

