const HASHTAG_REGEX = /(^|\s)#([a-z0-9_]{2,40})/gi;

export const extractHashtags = (content: string): string[] => {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    const tag = match[2]?.toLowerCase();
    if (tag) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
};

