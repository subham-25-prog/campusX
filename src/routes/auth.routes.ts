import bcrypt from "bcryptjs";
import { VerificationStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { createSessionTokens, rotateSessionToken } from "../services/auth-service";
import { asyncHandler } from "../utils/async-handler";
import { randomHandleFromName, normalizeHandle } from "../utils/format";
import { HttpError } from "../utils/http-error";
import { comparePassword, hashPassword } from "../utils/password";
import { verifyRefreshToken } from "../utils/tokens";

const registerSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  rollNumber: z.string().min(3).max(40),
  instituteId: z.string().min(6),
  handle: z.string().optional()
});

const loginSchema = z.object({
  emailOrHandle: z.string().min(3),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const sanitizeUser = (user: {
  id: string;
  fullName: string;
  email: string;
  handle: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: string;
  verified: boolean;
  verificationStatus: string;
  rollNumber: string;
  institute: { id: string; name: string; shortCode: string } | null;
}) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  handle: `@${user.handle}`,
  avatarUrl: user.avatarUrl,
  bannerUrl: user.bannerUrl,
  role: user.role,
  verified: user.verified,
  verificationStatus: user.verificationStatus,
  rollNumber: user.rollNumber,
  institute: user.institute
});

const createUniqueHandle = async (rawHandle: string) => {
  const base = normalizeHandle(rawHandle) || "jis_student";
  let handle = base;
  let step = 0;
  while (true) {
    const exists = await prisma.user.findUnique({
      where: { handle },
      select: { id: true }
    });
    if (!exists) return handle;
    step += 1;
    handle = `${base}${100 + step}`;
  }
};

const router = Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);

    const institute = await prisma.institute.findUnique({
      where: { id: input.instituteId, isActive: true },
      select: { id: true }
    });

    if (!institute) {
      throw new HttpError(400, "Invalid institute");
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email.toLowerCase() }, { rollNumber: input.rollNumber }]
      },
      select: { id: true, email: true, rollNumber: true }
    });

    if (existingUser) {
      throw new HttpError(409, "Email or roll number already registered");
    }

    const handle = await createUniqueHandle(input.handle ?? randomHandleFromName(input.fullName));
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: input.email.toLowerCase(),
        passwordHash,
        rollNumber: input.rollNumber.trim(),
        instituteId: input.instituteId,
        handle
      }
    });

    const tokens = await createSessionTokens({
      user,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        handle: true,
        avatarUrl: true,
        bannerUrl: true,
        role: true,
        verified: true,
        verificationStatus: true,
        rollNumber: true,
        institute: {
          select: { id: true, name: true, shortCode: true }
        }
      }
    });

    res.status(201).json({
      user: profile ? sanitizeUser(profile) : null,
      ...tokens
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const key = input.emailOrHandle.trim().toLowerCase();
    const handle = key.replace(/^@/, "");

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: key }, { handle }]
      }
    });

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const validPassword = await comparePassword(input.password, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, "Invalid credentials");
    }

    if (user.verificationStatus === VerificationStatus.REJECTED) {
      throw new HttpError(
        403,
        "Your account is blocked by admin. Upload valid identity proof for re-verification."
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    });

    const tokens = await createSessionTokens({
      user,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        handle: true,
        avatarUrl: true,
        bannerUrl: true,
        role: true,
        verified: true,
        verificationStatus: true,
        rollNumber: true,
        institute: {
          select: { id: true, name: true, shortCode: true }
        }
      }
    });

    res.json({
      user: profile ? sanitizeUser(profile) : null,
      ...tokens
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const input = refreshSchema.parse(req.body);

    let decoded: { sub: string; sid: string };
    try {
      decoded = verifyRefreshToken(input.refreshToken);
    } catch {
      throw new HttpError(401, "Invalid refresh token");
    }

    const session = await prisma.session.findUnique({
      where: { id: decoded.sid },
      include: { user: true }
    });

    if (!session || session.userId !== decoded.sub) {
      throw new HttpError(401, "Session not found");
    }

    if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new HttpError(401, "Session expired");
    }

    const matches = await bcrypt.compare(input.refreshToken, session.refreshTokenHash);
    if (!matches) {
      throw new HttpError(401, "Refresh token mismatch");
    }

    if (session.user.verificationStatus === VerificationStatus.REJECTED) {
      throw new HttpError(
        403,
        "Your account is blocked by admin. Upload valid identity proof for re-verification."
      );
    }

    const tokens = await rotateSessionToken(session.id, session.user);
    res.json(tokens);
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const input = refreshSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(204).send();
    }

    try {
      const decoded = verifyRefreshToken(input.data.refreshToken);
      await prisma.session.updateMany({
        where: {
          id: decoded.sid,
          userId: decoded.sub
        },
        data: { revokedAt: new Date() }
      });
    } catch {
      // Ignore invalid token during logout.
    }

    return res.status(204).send();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        handle: true,
        avatarUrl: true,
        bannerUrl: true,
        role: true,
        verified: true,
        verificationStatus: true,
        rollNumber: true,
        institute: {
          select: { id: true, name: true, shortCode: true }
        }
      }
    });

    if (!me) {
      throw new HttpError(404, "User not found");
    }

    res.json({ user: sanitizeUser(me) });
  })
);

export default router;
