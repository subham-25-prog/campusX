import bcrypt from "bcryptjs";
import { User } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { signAccessToken, signRefreshToken } from "../utils/tokens";

const refreshExpiryFromNow = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
};

const accessPayloadFromUser = (user: User) => ({
  sub: user.id,
  fullName: user.fullName,
  handle: user.handle,
  role: user.role,
  instituteId: user.instituteId
});

export const createSessionTokens = async (options: {
  user: User;
  userAgent?: string;
  ipAddress?: string;
}) => {
  const session = await prisma.session.create({
    data: {
      userId: options.user.id,
      refreshTokenHash: "pending",
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      expiresAt: refreshExpiryFromNow()
    }
  });

  const accessToken = signAccessToken(accessPayloadFromUser(options.user));
  const refreshToken = signRefreshToken({ sub: options.user.id, sid: session.id });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash }
  });

  return { accessToken, refreshToken, sessionId: session.id };
};

export const rotateSessionToken = async (sessionId: string, user: User) => {
  const accessToken = signAccessToken(accessPayloadFromUser(user));
  const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash,
      expiresAt: refreshExpiryFromNow(),
      revokedAt: null
    }
  });
  return { accessToken, refreshToken };
};
