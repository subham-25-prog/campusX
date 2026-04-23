import { UserRole, VerificationStatus } from "@prisma/client";

export type AuthUser = {
  id: string;
  fullName: string;
  handle: string;
  role: UserRole;
  instituteId: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
};

export type AccessTokenPayload = {
  sub: string;
  fullName: string;
  handle: string;
  role: UserRole;
  instituteId: string;
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
};
