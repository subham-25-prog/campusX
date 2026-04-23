import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import apiRoutes from "./routes";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    credentials: true
  })
);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  }),
  apiRoutes
);

app.use("/uploads", express.static(path.resolve("uploads")));
app.use(express.static(path.resolve("public")));

app.get("/", (_req, res) => {
  res.sendFile(path.resolve("public/campusx.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);
