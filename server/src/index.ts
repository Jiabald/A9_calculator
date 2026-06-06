import "./config/loadEnv.js";
import cors from "cors";
import express from "express";
import { initDatabase } from "./db/init.js";
import { closePool } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

const app = express();
const port = Number(process.env.PORT ?? "");
if (!Number.isFinite(port)) {
  throw new Error("缺少环境变量 PORT，请在 server/.env 中配置（可参考 .env.example）");
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/api", apiRouter);
app.use(errorHandler);

async function start() {
  await initDatabase();
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("服务启动失败:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});
