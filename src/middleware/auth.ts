import { NextFunction, Request, Response } from "express";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { verifyAccessToken } from "../utils/tokens";

const extractBearerToken = (req: Request) => {
  const value = req.headers.authorization;
  if (!value || !value.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim();
};

const allowRejectedPath = (url: string) => {
  return (
    url.startsWith("/api/verification") ||
    url.startsWith("/api/notifications") ||
    url.startsWith("/api/auth/me")
  );
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        fullName: true,
        handle: true,
        role: true,
        instituteId: true,
        verified: true,
        verificationStatus: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (
      user.verificationStatus === VerificationStatus.REJECTED &&
      !allowRejectedPath(req.originalUrl || req.url || "")
    ) {
      return res.status(403).json({
        error:
          "Your account is blocked by admin. Please upload a valid identity proof for re-verification."
      });
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      handle: user.handle,
      role: user.role,
      instituteId: user.instituteId,
      verified: user.verified,
      verificationStatus: user.verificationStatus
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const attachAuthIfPresent = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        fullName: true,
        handle: true,
        role: true,
        instituteId: true,
        verified: true,
        verificationStatus: true
      }
    });

    if (!user) return next();

    req.user = {
      id: user.id,
      fullName: user.fullName,
      handle: user.handle,
      role: user.role,
      instituteId: user.instituteId,
      verified: user.verified,
      verificationStatus: user.verificationStatus
    };
  } catch {
    // Best-effort parser; ignore invalid token for public routes.
  }
  return next();
};
