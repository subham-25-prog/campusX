import path from "node:path";
import { NotificationType, VerificationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { receiptUpload } from "../middleware/upload";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";

const submitSchema = z.object({
  instituteId: z.string().min(5),
  academicYear: z.string().min(4).max(20),
  receiptNumber: z.string().min(2).max(80),
  transactionId: z.string().max(80).optional(),
  paymentAmount: z.string().optional(),
  studentName: z.string().max(80).optional(),
  rollNumber: z.string().max(40).optional()
});

const router = Router();

router.use(requireAuth);

router.post(
  "/submit",
  receiptUpload.single("receipt"),
  asyncHandler(async (req, res) => {
    const input = submitSchema.parse(req.body);
    const file = req.file;
    if (!file) throw new HttpError(400, "Receipt file is required");

    const institute = await prisma.institute.findFirst({
      where: { id: input.instituteId, isActive: true },
      select: { id: true }
    });
    if (!institute) throw new HttpError(400, "Invalid institute");

    const updatedProfileData: { fullName?: string; rollNumber?: string } = {};
    if (input.studentName?.trim()) updatedProfileData.fullName = input.studentName.trim();
    if (input.rollNumber?.trim()) updatedProfileData.rollNumber = input.rollNumber.trim();

    if (Object.keys(updatedProfileData).length > 0) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: updatedProfileData
      });
    }

    const request = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user!.id },
        data: {
          verificationStatus: VerificationStatus.PENDING,
          verified: false
        }
      });

      const created = await tx.verificationRequest.create({
        data: {
          userId: req.user!.id,
          instituteId: input.instituteId,
          academicYear: input.academicYear.trim(),
          receiptNumber: input.receiptNumber.trim(),
          transactionId: input.transactionId?.trim() || null,
          paymentAmount: input.paymentAmount?.trim() ? input.paymentAmount.trim() : null,
          receiptFileUrl: `/uploads/${path.basename(file.path)}`
        }
      });

      const instituteAdmins = await tx.user.findMany({
        where: {
          instituteId: input.instituteId,
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }
        },
        select: { id: true }
      });

      if (instituteAdmins.length > 0) {
        await tx.notification.createMany({
          data: instituteAdmins.map((admin) => ({
            recipientId: admin.id,
            actorId: req.user!.id,
            type: NotificationType.SYSTEM,
            message: `${req.user!.fullName} submitted a new verification request.`,
            metadata: {
              requestId: created.id,
              requesterId: req.user!.id
            }
          }))
        });
      }

      return created;
    });

    res.status(201).json({
      message: "Receipt submitted successfully. Verification typically takes up to 24 hours.",
      request
    });
  })
);

router.get(
  "/my",
  asyncHandler(async (req, res) => {
    const requests = await prisma.verificationRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        institute: {
          select: { id: true, name: true, shortCode: true }
        },
        reviewer: {
          select: { id: true, fullName: true, handle: true }
        }
      }
    });
    res.json({ requests });
  })
);

export default router;
