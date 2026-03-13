import { Router } from "express";
import { washServiceReport, dailyInOutReport, zReport } from "../controllers/reports.controller";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/z-report", zReport);

export default router;
