import { Router } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const institutes = await prisma.institute.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortCode: true,
        domain: true
      }
    });

    res.json({ institutes });
  })
);

export default router;

