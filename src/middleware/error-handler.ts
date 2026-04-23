import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../utils/http-error";

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({ error: "Route not found" });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Unique field conflict",
        details: error.meta
      });
    }
  }

  if (error instanceof Error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(500).json({ error: "Unexpected server error" });
};

