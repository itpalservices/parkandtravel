import { Router } from "express";
import { getDashboardStatsController, getCheckInsController, getCheckOutsController } from "../controllers/dashboard.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/stats", checkJwt, getDashboardStatsController);
router.get("/check-ins", checkJwt, getCheckInsController);
router.get("/check-outs", checkJwt, getCheckOutsController);

export default router;
