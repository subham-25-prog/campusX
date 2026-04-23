const avatarPalette = [
  "linear-gradient(135deg,#1d9bf0,#7856ff)",
  "linear-gradient(135deg,#f4212e,#ff6b9d)",
  "linear-gradient(135deg,#00ba7c,#1d9bf0)",
  "linear-gradient(135deg,#7856ff,#f4212e)",
  "linear-gradient(135deg,#ff8a00,#ffd166)"
];

export const initialsFromName = (fullName: string) => {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const normalizeHandle = (input: string) => {
  return input
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
};

export const randomHandleFromName = (fullName: string) => {
  const base = normalizeHandle(fullName);
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${base || "jis_student"}${suffix}`;
};

export const avatarColorForId = (id: string) => {
  const code = id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return avatarPalette[code % avatarPalette.length] ?? avatarPalette[0];
};

