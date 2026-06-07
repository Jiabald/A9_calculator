import { nanoid } from "nanoid";
import { tradeReviewDao } from "../dao/tradeReviewDao.js";
import { HttpError } from "../errors/HttpError.js";
import type { PaginatedTradeReviews, TradeReviewRecord } from "../types/tradeReview.js";
import { validateTradeReviewInput } from "./tradeReviewValidator.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

export const tradeReviewService = {
  async listReviews(page: unknown, pageSize: unknown): Promise<PaginatedTradeReviews> {
    const { page: safePage, pageSize: safePageSize } = normalizePagination(page, pageSize);
    const total = await tradeReviewDao.count();
    const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
    const effectivePage = totalPages === 0 ? 1 : Math.min(safePage, totalPages);
    const offset = (effectivePage - 1) * safePageSize;
    const items = await tradeReviewDao.findPaginated(offset, safePageSize);
    return {
      items,
      total,
      page: effectivePage,
      pageSize: safePageSize
    };
  },

  async getReview(id: string): Promise<TradeReviewRecord> {
    const record = await tradeReviewDao.findById(id);
    if (!record) {
      throw new HttpError(404, "复盘记录不存在");
    }
    return record;
  },

  async createReview(body: unknown): Promise<TradeReviewRecord> {
    const input = validateTradeReviewInput(body);
    const now = new Date().toISOString();
    const record: TradeReviewRecord = {
      id: nanoid(),
      ...input,
      createdAt: now,
      updatedAt: now
    };
    await tradeReviewDao.insert(record);
    return record;
  },

  async updateReview(id: string, body: unknown): Promise<TradeReviewRecord> {
    const existing = await tradeReviewDao.findById(id);
    if (!existing) {
      throw new HttpError(404, "复盘记录不存在");
    }

    const input = validateTradeReviewInput(body);
    const record: TradeReviewRecord = {
      id,
      ...input,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    const updated = await tradeReviewDao.update(record);
    if (!updated) {
      throw new HttpError(404, "复盘记录不存在");
    }
    return record;
  }
};
