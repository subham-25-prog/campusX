import { NextFunction, Request, Response } from "express";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (!role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
};

