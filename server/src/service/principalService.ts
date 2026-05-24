import { positionDao } from "../dao/positionDao.js";
import { getCurrentPrincipalFromRecord } from "../utils/tradeResult.js";

export const principalService = {
  async getCurrentPrincipal(): Promise<number | null> {
    const latest = await positionDao.findLatest();
    if (!latest) {
      return null;
    }
    return getCurrentPrincipalFromRecord(latest);
  }
};
