import "./loadEnv.js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 server/.env 中配置（可参考 .env.example）`);
  }
  return value;
}

export const dbConfig = {
  host: requiredEnv("DB_HOST"),
  port: Number(requiredEnv("DB_PORT")),
  user: requiredEnv("DB_USER"),
  password: requiredEnv("DB_PASSWORD"),
  database: requiredEnv("DB_NAME")
};
