import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AccessTokenPayload, RefreshTokenPayload } from "../types/auth";

export const signAccessToken = (payload: AccessTokenPayload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as jwt.Secret, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]
  });
};

export const signRefreshToken = (payload: RefreshTokenPayload) => {
  const expiresIn = `${env.REFRESH_TOKEN_TTL_DAYS}d`;
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as jwt.Secret, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"]
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};
