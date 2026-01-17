import { Router } from "express";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/stats", checkJwt, getDashboardStatsController);

export default router;
