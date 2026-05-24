import { Router } from "express";
import { healthController } from "../controller/healthController.js";
import { positionController } from "../controller/positionController.js";
import { principalController } from "../controller/principalController.js";

export const apiRouter = Router();

apiRouter.get("/health", healthController.check);
apiRouter.get("/principal", principalController.getCurrent);
apiRouter.get("/positions", positionController.list);
apiRouter.post("/positions", positionController.create);
apiRouter.put("/positions/:id", positionController.replace);
apiRouter.patch("/positions/:id", positionController.patch);
apiRouter.delete("/positions/:id", positionController.remove);
