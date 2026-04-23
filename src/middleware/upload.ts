import fs from "node:fs";
import path from "node:path";
import { MediaType, MessageType } from "@prisma/client";
import multer from "multer";
import { HttpError } from "../utils/http-error";

const uploadDir = path.resolve("uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const cleanBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 40);
    cb(null, `${cleanBase}_${timestamp}${ext}`);
  }
});

const receiptMime = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/heic",
  "image/heif"
]);

const receiptExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif"
]);

const mediaMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "application/pdf"
]);

const mediaExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".pdf"
]);

const profileMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/gif",
  "image/heic",
  "image/heif"
]);

const profileExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif"
]);

const allowFile = (
  file: Express.Multer.File,
  mimeSet: Set<string>,
  extensionSet: Set<string>
) => {
  const mimeType = (file.mimetype || "").toLowerCase();
  const extension = path.extname(file.originalname || "").toLowerCase();
  return mimeSet.has(mimeType) || extensionSet.has(extension);
};

export const receiptUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowFile(file, receiptMime, receiptExtensions)) return cb(null, true);
    return cb(new HttpError(400, "Only PDF/JPG/PNG/WebP/HEIC receipt files are allowed"));
  }
});

export const postMediaUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (allowFile(file, mediaMime, mediaExtensions)) return cb(null, true);
    return cb(
      new HttpError(400, "Only image/video/audio/PDF files are allowed for post media")
    );
  }
});

export const chatMediaUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (allowFile(file, mediaMime, mediaExtensions)) return cb(null, true);
    return cb(
      new HttpError(400, "Only image/video/audio/PDF files are allowed for chat attachments")
    );
  }
});

export const profileMediaUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    if (allowFile(file, profileMime, profileExtensions)) return cb(null, true);
    return cb(
      new HttpError(
        400,
        "Only image files (JPG/PNG/WebP/GIF/HEIC) are allowed for profile media"
      )
    );
  }
});

export const inferPostMediaType = (file: Express.Multer.File): MediaType => {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (mime.startsWith("image/")) return ext === ".gif" ? MediaType.GIF : MediaType.IMAGE;
  if (mime.startsWith("video/")) return MediaType.VIDEO;
  if (mime.startsWith("audio/")) return MediaType.AUDIO;
  return MediaType.FILE;
};

export const inferMessageType = (file: Express.Multer.File): MessageType => {
  const mediaType = inferPostMediaType(file);
  return mediaType === MediaType.IMAGE || mediaType === MediaType.GIF
    ? MessageType.IMAGE
    : MessageType.FILE;
};
