import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PositionRecord } from "./types.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(currentDir, "../data/positions.json");

async function ensureDataFile() {
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

export async function readPositions(): Promise<PositionRecord[]> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw) as PositionRecord[];
}

export async function writePositions(records: PositionRecord[]) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}
