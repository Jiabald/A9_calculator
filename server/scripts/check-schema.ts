import "../src/config/loadEnv.js";
import { getPool, closePool } from "../src/db/pool.js";

async function main() {
  const pool = getPool();
  const [rows] = await pool.query("DESCRIBE positions");
  console.log(rows);
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
