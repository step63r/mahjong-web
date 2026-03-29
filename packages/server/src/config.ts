import "dotenv/config";

const config = {
  port: Number(process.env["PORT"] ?? 3001),
  host: process.env["HOST"] ?? "0.0.0.0",
  cors: {
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  },
  firebase: {
    projectId: process.env["FIREBASE_PROJECT_ID"] ?? "",
  },
} as const;

export { config };
