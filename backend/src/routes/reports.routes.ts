import { Router } from "express";
import { washServiceReport, dailyInOutReport, zReport, pendingBookingsReport } from "../controllers/reports.controller";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/z-report", zReport);
router.get("/pending-bookings", pendingBookingsReport);

export default router;
