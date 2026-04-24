import { NotificationType, VerificationStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAdmin } from "../middleware/admin-only";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(300).optional()
});

const router = Router();

router.use(requireAuth, requireAdmin);

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.user!.role === "SUPER_ADMIN";
    const scopedPendingWhere = isSuperAdmin
      ? { status: VerificationStatus.PENDING }
      : {
          status: VerificationStatus.PENDING,
          instituteId: req.user!.instituteId
        };
    const [users, posts, pendingVerifications, conversations] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { deletedAt: null, parentId: null } }),
      prisma.verificationRequest.count({ where: scopedPendingWhere }),
      prisma.conversation.count()
    ]);

    res.json({
      metrics: {
        users,
        posts,
        pendingVerifications,
        conversations
      }
    });
  })
);

router.get(
  "/verifications",
  asyncHandler(async (req, res) => {
    const isSuperAdmin = req.user!.role === "SUPER_ADMIN";
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const statusWhere =
      status && Object.values(VerificationStatus).includes(status as VerificationStatus)
        ? ({ status: status as VerificationStatus } as const)
        : {};
    const where = isSuperAdmin
      ? statusWhere
      : {
          ...statusWhere,
          instituteId: req.user!.instituteId
        };

    const requests = await prisma.verificationRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            handle: true,
            email: true,
            rollNumber: true,
            institute: { select: { name: true, shortCode: true } }
          }
        },
        institute: {
          select: { id: true, name: true, shortCode: true }
        }
      },
      take: 200
    });

    res.json({ requests });
  })
);

router.patch(
  "/verifications/:id",
  asyncHandler(async (req, res) => {
    const input = reviewSchema.parse(req.body);
    const adminId = req.user!.id;

    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id },
      include: {
        requester: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (!request) throw new HttpError(404, "Verification request not found");
    if (req.user!.role !== "SUPER_ADMIN" && request.instituteId !== req.user!.instituteId) {
      throw new HttpError(403, "You can only review requests from your own institute");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: input.status,
          notes: input.notes?.trim() || null,
          reviewerId: adminId,
          reviewedAt: new Date()
        }
      });

      await tx.user.update({
        where: { id: request.userId },
        data: {
          verified: input.status === "APPROVED",
          verificationStatus: input.status
        }
      });

      await tx.notification.create({
        data: {
          recipientId: request.userId,
          actorId: adminId,
          type: NotificationType.VERIFY,
          message:
            input.status === "APPROVED"
              ? "Your account verification has been approved."
              : "Your account verification was rejected. Please upload a valid receipt.",
          metadata: {
            requestId: request.id,
            notes: input.notes ?? null
          }
        }
      });

      return updatedRequest;
    });

    res.json({ request: updated });
  })
);

export default router;
