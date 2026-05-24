import { nanoid } from "nanoid";
import { positionDao } from "../dao/positionDao.js";
import { HttpError } from "../errors/HttpError.js";
import type { PositionInput, PositionRecord } from "../types.js";
import { validatePartialPositionInput, validatePositionInput } from "./positionValidator.js";

export const positionService = {
  async listPositions(): Promise<PositionRecord[]> {
    return positionDao.findAll();
  },

  async createPosition(body: unknown): Promise<PositionRecord> {
    const input = validatePositionInput(body);
    const now = new Date().toISOString();
    const record: PositionRecord = {
      id: nanoid(),
      ...input,
      createdAt: now,
      updatedAt: now
    };
    await positionDao.insert(record);
    return record;
  },

  async replacePosition(id: string, body: unknown): Promise<PositionRecord> {
    const input = validatePositionInput(body);
    const existing = await positionDao.findById(id);
    if (!existing) {
      throw new HttpError(404, "仓位记录不存在");
    }

    const updated: PositionRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString()
    };
    await positionDao.update(updated);
    return updated;
  },

  async patchPosition(id: string, body: unknown): Promise<PositionRecord> {
    const input = validatePartialPositionInput(body);
    const existing = await positionDao.findById(id);
    if (!existing) {
      throw new HttpError(404, "仓位记录不存在");
    }

    const updated: PositionRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString()
    };
    await positionDao.update(updated);
    return updated;
  },

  async deletePosition(id: string): Promise<void> {
    const deleted = await positionDao.deleteById(id);
    if (!deleted) {
      throw new HttpError(404, "仓位记录不存在");
    }
  }
};
