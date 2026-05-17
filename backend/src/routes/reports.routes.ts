import { Router } from "express";
import { washServiceReport, dailyInOutReport, zReport, pendingBookingsReport } from "../controllers/reports.controller";
import {
  employeeSessionReportEmployees,
  employeeSessionReportShifts,
  employeeSessionReportByShift,
  employeeSessionReportByDate,
} from "../controllers/employee-session-report.controller";
import {
  getXReport,
  getZReportEmployees,
  createZReport,
  getZReportHistory,
  getZReportById,
} from "../controllers/x-z-report.controller";
import { getReceiptsReport } from "../controllers/receipts-report.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/z-report", zReport);
router.get("/pending-bookings", pendingBookingsReport);

router.get("/employee-session/employees", employeeSessionReportEmployees);
router.get("/employee-session/employees/:userId/shifts", employeeSessionReportShifts);
router.get("/employee-session/shifts/:shiftId/transactions", employeeSessionReportByShift);
router.get("/employee-session/by-date", employeeSessionReportByDate);

router.get("/x-report", checkJwt, getXReport);
router.get("/receipts", checkJwt, getReceiptsReport);
router.get("/z-report-new/employees", checkJwt, getZReportEmployees);
router.post("/z-report-new", checkJwt, createZReport);
router.get("/z-report-new/history", checkJwt, getZReportHistory);
router.get("/z-report-new/:id", checkJwt, getZReportById);

export default router;
