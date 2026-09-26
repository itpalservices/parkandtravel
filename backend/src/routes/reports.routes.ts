import { Router } from "express";
import { washServiceReport, dailyInOutReport, onlinePaymentsReport, pendingBookingsReport } from "../controllers/reports.controller";
import {
  employeeSessionReportEmployees,
  employeeSessionReportShifts,
  employeeSessionReportByShift,
  employeeSessionReportByDate,
} from "../controllers/employee-session-report.controller";
import {
  getXReport,
  createZReport,
  getZReportHistory,
  getZReportById,
  getZReportZpl,
} from "../controllers/x-z-report.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/online-payments", onlinePaymentsReport);
router.get("/pending-bookings", pendingBookingsReport);

router.get("/employee-session/employees", employeeSessionReportEmployees);
router.get("/employee-session/employees/:userId/shifts", employeeSessionReportShifts);
router.get("/employee-session/shifts/:shiftId/transactions", employeeSessionReportByShift);
router.get("/employee-session/by-date", employeeSessionReportByDate);

router.get("/x-report", checkJwt, getXReport);
router.post("/z-report-new", checkJwt, createZReport);
router.get("/z-report-new/history", checkJwt, getZReportHistory);
router.get("/z-report-new/:id", checkJwt, getZReportById);
router.get("/z-report-new/:id/zpl", checkJwt, getZReportZpl);

export default router;
