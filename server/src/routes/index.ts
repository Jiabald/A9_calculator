import { Router } from "express";
import { healthController } from "../controller/healthController.js";
import { aiAnalyzeController } from "../controller/aiAnalyzeController.js";
import { positionController } from "../controller/positionController.js";
import { principalController } from "../controller/principalController.js";
import { tradeReviewController } from "../controller/tradeReviewController.js";

export const apiRouter = Router();

apiRouter.get("/health", healthController.check);
apiRouter.get("/principal", principalController.getCurrent);
apiRouter.post("/ai/analyze", aiAnalyzeController.analyze);
apiRouter.post("/ai/analyze/stream", aiAnalyzeController.analyzeStream);
apiRouter.get("/positions", positionController.list);
apiRouter.post("/positions", positionController.create);
apiRouter.put("/positions/:id", positionController.replace);
apiRouter.patch("/positions/:id", positionController.patch);
apiRouter.delete("/positions/:id", positionController.remove);
apiRouter.get("/trade-reviews", tradeReviewController.list);
apiRouter.get("/trade-reviews/:id", tradeReviewController.detail);
apiRouter.post("/trade-reviews", tradeReviewController.create);
