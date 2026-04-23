import path from "node:path";
import { NotificationType, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { inferPostMediaType, postMediaUpload } from "../middleware/upload";
import { postCardInclude, toPostCard } from "../services/post-service";
import { asyncHandler } from "../utils/async-handler";
import { extractHashtags } from "../utils/hashtags";
import { HttpError } from "../utils/http-error";

const createPostSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  parentId: z.string().optional(),
  quotePostId: z.string().optional()
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

const router = Router();

router.use(requireAuth);

router.get(
  "/feed",
  asyncHandler(async (req, res) => {
    const tab = String(req.query.tab ?? "for-you");
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const user = req.user!;

    let where: Record<string, unknown> = {
      deletedAt: null,
      parentId: null
    };

    if (tab === "campus") {
      where = {
        ...where,
        instituteId: user.instituteId
      };
    } else if (tab === "following") {
      const following = await prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true }
      });
      const ids = [user.id, ...following.map((item) => item.followingId)];
      where = {
        ...where,
        authorId: { in: ids }
      };
    }

    const posts = await prisma.post.findMany({
      where,
      include: postCardInclude(user.id),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    const hasNext = posts.length > limit;
    const visible = hasNext ? posts.slice(0, limit) : posts;
    const nextCursor = hasNext ? visible[visible.length - 1]?.id : null;

    res.json({
      tab,
      posts: visible.map(toPostCard),
      nextCursor
    });
  })
);

router.post(
  "/",
  postMediaUpload.array("media", 4),
  asyncHandler(async (req, res) => {
    const input = createPostSchema.parse(req.body);
    const user = req.user!;
    const mediaFiles = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const content = input.content?.trim() ?? "";

    if (!content && mediaFiles.length === 0 && !input.quotePostId) {
      throw new HttpError(400, "Post must contain text, media, or a quote");
    }

    const parent = input.parentId
      ? await prisma.post.findFirst({
          where: { id: input.parentId, deletedAt: null },
          select: { id: true, authorId: true, content: true }
        })
      : null;

    if (input.parentId && !parent) {
      throw new HttpError(404, "Reply target post not found");
    }

    if (input.quotePostId) {
      const quoteExists = await prisma.post.findFirst({
        where: { id: input.quotePostId, deletedAt: null },
        select: { id: true }
      });
      if (!quoteExists) {
        throw new HttpError(404, "Quoted post not found");
      }
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId: user.id,
          instituteId: user.instituteId,
          content,
          parentId: input.parentId,
          quotePostId: input.quotePostId
        },
        include: postCardInclude(user.id)
      });

      if (mediaFiles.length > 0) {
        await tx.postMedia.createMany({
          data: mediaFiles.map((file) => ({
            postId: created.id,
            mediaType: inferPostMediaType(file),
            url: `/uploads/${path.basename(file.path)}`
          }))
        });
      }

      const hydrated = await tx.post.findUnique({
        where: { id: created.id },
        include: postCardInclude(user.id)
      });
      if (!hydrated) {
        throw new HttpError(500, "Failed to load created post");
      }

      const hashtags = extractHashtags(content);
      for (const tag of hashtags) {
        const hashtag = await tx.hashtag.upsert({
          where: { tag },
          update: { usageCount: { increment: 1 } },
          create: { tag, usageCount: 1 }
        });
        await tx.postHashtag.create({
          data: {
            postId: created.id,
            hashtagId: hashtag.id
          }
        });
      }

      if (parent && parent.authorId !== user.id) {
        await tx.notification.create({
          data: {
            recipientId: parent.authorId,
            actorId: user.id,
            postId: parent.id,
            type: NotificationType.REPLY,
            message: `${user.fullName} replied to your post`
          }
        });
      }

      return hydrated;
    });

    res.status(201).json({ post: toPostCard(post) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const user = req.user!;
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: postCardInclude(user.id)
    });
    if (!post) {
      throw new HttpError(404, "Post not found");
    }
    res.json({ post: toPostCard(post) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const target = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, deletedAt: true }
    });

    if (!target || target.deletedAt) {
      throw new HttpError(404, "Post not found");
    }

    const canDelete =
      req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
    if (!canDelete) {
      throw new HttpError(403, "Only admins can delete posts");
    }

    await prisma.post.update({
      where: { id: target.id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  })
);

router.post(
  "/:id/like",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const user = req.user!;
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true }
    });

    if (!post) throw new HttpError(404, "Post not found");

    const existing = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: user.id
        }
      }
    });

    if (!existing) {
      await prisma.postLike.create({
        data: { postId: post.id, userId: user.id }
      });

      if (post.authorId !== user.id) {
        await prisma.notification.create({
          data: {
            recipientId: post.authorId,
            actorId: user.id,
            postId: post.id,
            type: NotificationType.LIKE,
            message: `${user.fullName} liked your post`
          }
        });
      }
    }

    const likes = await prisma.postLike.count({ where: { postId: post.id } });
    res.json({ liked: true, likes });
  })
);

router.delete(
  "/:id/like",
  asyncHandler(async (req, res) => {
    const { id: postId } = idParamSchema.parse(req.params);
    await prisma.postLike.deleteMany({
      where: { postId, userId: req.user!.id }
    });
    const likes = await prisma.postLike.count({ where: { postId } });
    res.json({ liked: false, likes });
  })
);

router.post(
  "/:id/repost",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const user = req.user!;
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true }
    });
    if (!post) throw new HttpError(404, "Post not found");

    const existing = await prisma.postRepost.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: user.id
        }
      }
    });

    if (!existing) {
      await prisma.postRepost.create({
        data: { postId: post.id, userId: user.id }
      });
      if (post.authorId !== user.id) {
        await prisma.notification.create({
          data: {
            recipientId: post.authorId,
            actorId: user.id,
            postId: post.id,
            type: NotificationType.REPOST,
            message: `${user.fullName} reposted your post`
          }
        });
      }
    }

    const reposts = await prisma.postRepost.count({ where: { postId: post.id } });
    res.json({ reposted: true, reposts });
  })
);

router.delete(
  "/:id/repost",
  asyncHandler(async (req, res) => {
    const { id: postId } = idParamSchema.parse(req.params);
    await prisma.postRepost.deleteMany({
      where: { postId, userId: req.user!.id }
    });
    const reposts = await prisma.postRepost.count({ where: { postId } });
    res.json({ reposted: false, reposts });
  })
);

router.post(
  "/:id/bookmark",
  asyncHandler(async (req, res) => {
    const { id: postId } = idParamSchema.parse(req.params);
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true }
    });
    if (!post) throw new HttpError(404, "Post not found");

    await prisma.bookmark.upsert({
      where: {
        postId_userId: {
          postId,
          userId: req.user!.id
        }
      },
      update: {},
      create: { postId, userId: req.user!.id }
    });

    res.json({ bookmarked: true });
  })
);

router.delete(
  "/:id/bookmark",
  asyncHandler(async (req, res) => {
    const { id: postId } = idParamSchema.parse(req.params);
    await prisma.bookmark.deleteMany({
      where: { postId, userId: req.user!.id }
    });
    res.json({ bookmarked: false });
  })
);

router.get(
  "/:id/replies",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const user = req.user!;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 50);
    const replies = await prisma.post.findMany({
      where: { parentId: id, deletedAt: null },
      include: postCardInclude(user.id),
      orderBy: { createdAt: "asc" },
      take: limit
    });
    res.json({ replies: replies.map(toPostCard) });
  })
);

export default router;
