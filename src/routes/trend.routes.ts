import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const trends = await prisma.hashtag.findMany({
      orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
      take: 10,
      select: {
        tag: true,
        usageCount: true
      }
    });

    res.json({
      trends: trends.map((trend) => ({
        hashtag: `#${trend.tag}`,
        posts: trend.usageCount
      }))
    });
  })
);

export default router;

