import { NotificationType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { profileMediaUpload } from "../middleware/upload";
import { postCardInclude, toPostCard } from "../services/post-service";
import { asyncHandler } from "../utils/async-handler";
import { HttpError } from "../utils/http-error";

const searchSchema = z.object({
  q: z.string().min(1)
});

const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(280).optional()
  })
  .refine((data) => data.fullName !== undefined || data.bio !== undefined, {
    message: "At least one field is required"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

const userProfileSelect = {
  id: true,
  fullName: true,
  handle: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  verified: true,
  createdAt: true,
  institute: {
    select: { id: true, name: true, shortCode: true }
  },
  _count: {
    select: {
      posts: true,
      followers: true,
      following: true
    }
  }
} as const;

const toProfileResponse = (
  user: {
    id: string;
    fullName: string;
    handle: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    verified: boolean;
    createdAt: Date;
    institute: { id: string; name: string; shortCode: string } | null;
    _count: { posts: number; followers: number; following: number };
  },
  opts: { isSelf: boolean; isFollowing: boolean }
) => ({
  id: user.id,
  name: user.fullName,
  handle: `@${user.handle}`,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
  bannerUrl: user.bannerUrl,
  verified: user.verified,
  institute: user.institute,
  joinedAt: user.createdAt,
  posts: user._count.posts,
  followers: user._count.followers,
  following: user._count.following,
  isFollowing: opts.isFollowing,
  isSelf: opts.isSelf
});

const router = Router();

router.use(requireAuth);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userProfileSelect
    });

    if (!me) throw new HttpError(404, "User not found");

    res.json({
      profile: toProfileResponse(me, { isFollowing: false, isSelf: true })
    });
  })
);

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const input = updateMeSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        fullName: input.fullName ?? undefined,
        bio: input.bio ?? undefined
      },
      select: userProfileSelect
    });

    res.json({
      profile: toProfileResponse(updated, { isFollowing: false, isSelf: true })
    });
  })
);

router.patch(
  "/me/profile-media",
  profileMediaUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const files = (req.files || {}) as {
      avatar?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    };

    const avatarFile = files.avatar?.[0];
    const bannerFile = files.banner?.[0];

    if (!avatarFile && !bannerFile) {
      throw new HttpError(400, "Upload avatar or banner image");
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        avatarUrl: avatarFile ? `/uploads/${avatarFile.filename}` : undefined,
        bannerUrl: bannerFile ? `/uploads/${bannerFile.filename}` : undefined
      },
      select: userProfileSelect
    });

    res.json({
      profile: toProfileResponse(updated, { isFollowing: false, isSelf: true })
    });
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = searchSchema.parse({ q: String(req.query.q ?? "") }).q.toLowerCase();
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { handle: { contains: query, mode: "insensitive" } },
          { institute: { name: { contains: query, mode: "insensitive" } } }
        ]
      },
      take: 20,
      select: {
        id: true,
        fullName: true,
        handle: true,
        verified: true,
        institute: {
          select: { shortCode: true, name: true }
        }
      }
    });

    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.fullName,
        handle: `@${user.handle}`,
        verified: user.verified,
        institute: user.institute?.shortCode ?? "JIS",
        instituteName: user.institute?.name ?? "JIS Group"
      }))
    });
  })
);

router.get(
  "/me/bookmarks",
  asyncHandler(async (req, res) => {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          include: postCardInclude(req.user!.id)
        }
      }
    });

    res.json({
      posts: bookmarks.map((bookmark) => toPostCard(bookmark.post))
    });
  })
);

router.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 5), 1), 20);
    const users = await prisma.user.findMany({
      where: { id: { not: req.user!.id } },
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        fullName: true,
        handle: true,
        verified: true,
        institute: {
          select: { shortCode: true, name: true }
        },
        followers: {
          where: { followerId: req.user!.id },
          select: { id: true },
          take: 1
        }
      }
    });

    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.fullName,
        handle: `@${user.handle}`,
        verified: user.verified,
        institute: user.institute?.shortCode ?? "JIS",
        instituteName: user.institute?.name ?? "JIS Group",
        isFollowing: user.followers.length > 0
      }))
    });
  })
);

router.get(
  "/:id/posts",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const posts = await prisma.post.findMany({
      where: {
        authorId: id,
        parentId: null,
        deletedAt: null
      },
      include: postCardInclude(req.user!.id),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({ posts: posts.map(toPostCard) });
  })
);

router.get(
  "/:id/replies",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const posts = await prisma.post.findMany({
      where: {
        authorId: id,
        parentId: { not: null },
        deletedAt: null
      },
      include: postCardInclude(req.user!.id),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({ posts: posts.map(toPostCard) });
  })
);

router.get(
  "/:id/likes",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        likes: {
          some: { userId: id }
        }
      },
      include: postCardInclude(req.user!.id),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({ posts: posts.map(toPostCard) });
  })
);

router.get(
  "/:id/media",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const posts = await prisma.post.findMany({
      where: {
        authorId: id,
        deletedAt: null,
        media: {
          some: {}
        }
      },
      include: postCardInclude(req.user!.id),
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({ posts: posts.map(toPostCard) });
  })
);

router.get(
  "/:id/profile",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: userProfileSelect
    });

    if (!user) throw new HttpError(404, "User not found");

    const relation = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.user!.id,
          followingId: user.id
        }
      },
      select: { id: true }
    });

    res.json({
      profile: toProfileResponse(user, {
        isFollowing: Boolean(relation),
        isSelf: user.id === req.user!.id
      })
    });
  })
);

router.post(
  "/:id/follow",
  asyncHandler(async (req, res) => {
    const { id: followingId } = idParamSchema.parse(req.params);
    const followerId = req.user!.id;

    if (followerId === followingId) {
      throw new HttpError(400, "You cannot follow yourself");
    }

    const target = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true }
    });
    if (!target) throw new HttpError(404, "User not found");

    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      },
      update: {},
      create: { followerId, followingId }
    });

    await prisma.notification.create({
      data: {
        recipientId: followingId,
        actorId: followerId,
        type: NotificationType.FOLLOW,
        message: `${req.user!.fullName} started following you`
      }
    });

    const followers = await prisma.follow.count({ where: { followingId } });
    res.json({ following: true, followers });
  })
);

router.delete(
  "/:id/follow",
  asyncHandler(async (req, res) => {
    const { id: followingId } = idParamSchema.parse(req.params);
    const followerId = req.user!.id;
    await prisma.follow.deleteMany({
      where: { followerId, followingId }
    });
    const followers = await prisma.follow.count({ where: { followingId } });
    res.json({ following: false, followers });
  })
);

export default router;
