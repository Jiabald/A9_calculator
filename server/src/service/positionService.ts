import { nanoid } from "nanoid";
import { positionDao } from "../dao/positionDao.js";
import { HttpError } from "../errors/HttpError.js";
import { DEFAULT_PRINCIPAL, type PositionRecord } from "../types.js";
import { principalChainForIds } from "../utils/principalChain.js";
import { getCurrentPrincipalFromRecord } from "../utils/tradeResult.js";
import { validatePartialPositionInput, validatePositionInput } from "./positionValidator.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type PaginatedPositions = {
  items: PositionRecord[];
  total: number;
  page: number;
  pageSize: number;
  principalChain: Record<string, { startPrincipal: number; endPrincipal: number | null }>;
};

function normalizePagination(page: unknown, pageSize: unknown): { page: number; pageSize: number } {
  const parsedPage = Number(page);
  const parsedPageSize = Number(pageSize);
  const safePage = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const safePageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(parsedPageSize))
      : DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safePageSize };
}

async function resolveOpeningPrincipal(): Promise<number> {
  const latest = await positionDao.findLatest();
  if (!latest) {
    return DEFAULT_PRINCIPAL;
  }
  return getCurrentPrincipalFromRecord(latest);
}

export const positionService = {
  async listPositions(page: unknown, pageSize: unknown): Promise<PaginatedPositions> {
    const { page: safePage, pageSize: safePageSize } = normalizePagination(page, pageSize);
    const total = await positionDao.count();
    const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
    const effectivePage = totalPages === 0 ? 1 : Math.min(safePage, totalPages);
    const offset = (effectivePage - 1) * safePageSize;
    const items = await positionDao.findPaginated(offset, safePageSize);
    const allPositions = await positionDao.findAll();
    const principalChain = principalChainForIds(
      allPositions,
      items.map((item) => item.id)
    );
    return {
      items,
      total,
      page: effectivePage,
      pageSize: safePageSize,
      principalChain
    };
  },

  async createPosition(body: unknown): Promise<PositionRecord> {
    const input = validatePositionInput(body);
    const openingPrincipal = await resolveOpeningPrincipal();
    const now = new Date().toISOString();
    const record: PositionRecord = {
      id: nanoid(),
      ...input,
      principal: openingPrincipal,
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
