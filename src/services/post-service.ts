import { avatarColorForId, initialsFromName } from "../utils/format";
import { toRelativeTime } from "../utils/time";

export const postCardInclude = (viewerId?: string) =>
  ({
    author: {
      select: {
        id: true,
        fullName: true,
        handle: true,
        avatarUrl: true,
        verified: true,
        institute: {
          select: { shortCode: true, name: true }
        }
      }
    },
    media: {
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        mediaType: true,
        url: true,
        altText: true
      }
    },
    _count: {
      select: {
        likes: true,
        reposts: true,
        replies: true
      }
    },
    likes: viewerId
      ? {
          where: { userId: viewerId },
          select: { id: true }
        }
      : false,
    reposts: viewerId
      ? {
          where: { userId: viewerId },
          select: { id: true }
        }
      : false,
    bookmarks: viewerId
      ? {
          where: { userId: viewerId },
          select: { id: true }
        }
      : false,
    quotePost: {
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            handle: true,
            avatarUrl: true,
            verified: true,
            institute: {
              select: { shortCode: true }
            }
          }
        },
        media: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            mediaType: true,
            url: true,
            altText: true
          }
        }
      }
    }
  }) as const;

const mapMedia = (mediaItems: Array<{ id: string; mediaType: string; url: string; altText: string | null }>) =>
  mediaItems.map((item) => ({
    id: item.id,
    type: item.mediaType,
    url: item.url,
    altText: item.altText
  }));

export const toPostCard = (post: any) => {
  const liked = Array.isArray(post.likes) && post.likes.length > 0;
  const reposted = Array.isArray(post.reposts) && post.reposts.length > 0;
  const bookmarked = Array.isArray(post.bookmarks) && post.bookmarks.length > 0;
  const media = Array.isArray(post.media) ? mapMedia(post.media) : [];
  const quotePost = post.quotePost
    ? {
        id: post.quotePost.id,
        name: post.quotePost.author.fullName,
        handle: `@${post.quotePost.author.handle}`,
        avatarUrl: post.quotePost.author.avatarUrl,
        verified: post.quotePost.author.verified,
        institute: post.quotePost.author.institute?.shortCode ?? "JIS",
        text: post.quotePost.content,
        media: Array.isArray(post.quotePost.media) ? mapMedia(post.quotePost.media) : []
      }
    : null;

  return {
    id: post.id,
    name: post.author.fullName,
    handle: `@${post.author.handle}`,
    institute: post.author.institute?.shortCode ?? "JIS",
    instituteName: post.author.institute?.name ?? "JIS Group",
    time: toRelativeTime(post.createdAt),
    verified: post.author.verified,
    text: post.content,
    likes: post._count.likes,
    reposts: post._count.reposts,
    replies: post._count.replies,
    liked,
    reposted,
    bookmarked,
    avatar: initialsFromName(post.author.fullName),
    avatarColor: avatarColorForId(post.author.id),
    avatarUrl: post.author.avatarUrl,
    authorId: post.authorId,
    createdAt: post.createdAt,
    parentId: post.parentId,
    quotePostId: post.quotePostId,
    media,
    quotePost
  };
};
