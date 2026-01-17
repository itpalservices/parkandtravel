import { Router } from "express";
import { washServiceReport, dailyInOutReport } from "../controllers/reports.controller";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);

export default router;
