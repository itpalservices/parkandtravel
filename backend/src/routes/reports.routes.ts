import { Router } from "express";
import { washServiceReport, dailyInOutReport, zReport, pendingBookingsReport } from "../controllers/reports.controller";
import {
  employeeSessionReportEmployees,
  employeeSessionReportShifts,
  employeeSessionReportByShift,
  employeeSessionReportByDate,
} from "../controllers/employee-session-report.controller";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/z-report", zReport);
router.get("/pending-bookings", pendingBookingsReport);

router.get("/employee-session/employees", employeeSessionReportEmployees);
router.get("/employee-session/employees/:userId/shifts", employeeSessionReportShifts);
router.get("/employee-session/shifts/:shiftId/transactions", employeeSessionReportByShift);
router.get("/employee-session/by-date", employeeSessionReportByDate);

export default router;
