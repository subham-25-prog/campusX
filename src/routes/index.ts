import { Router } from "express";
import adminRoutes from "./admin.routes";
import authRoutes from "./auth.routes";
import chatRoutes from "./chat.routes";
import instituteRoutes from "./institute.routes";
import notificationRoutes from "./notification.routes";
import postRoutes from "./post.routes";
import trendRoutes from "./trend.routes";
import userRoutes from "./user.routes";
import verificationRoutes from "./verification.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "JISphere API",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRoutes);
router.use("/institutes", instituteRoutes);
router.use("/posts", postRoutes);
router.use("/users", userRoutes);
router.use("/notifications", notificationRoutes);
router.use("/chats", chatRoutes);
router.use("/verification", verificationRoutes);
router.use("/admin", adminRoutes);
router.use("/trends", trendRoutes);

export default router;

