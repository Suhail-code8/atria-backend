import { Router } from "express";
import * as controller from "./entry.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", controller.getEntries);
router.post("/", authMiddleware, controller.createEntry);
router.put("/sync", authMiddleware, controller.syncEntries);
router.get("/event/:eventId", controller.getEntriesByEvent);
router.get("/item/:itemId", controller.getEntriesByItem);

export default router;
