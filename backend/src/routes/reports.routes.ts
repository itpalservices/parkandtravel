import { Router } from "express";
import { washServiceReport, dailyInOutReport, zReport, pendingBookingsReport } from "../controllers/reports.controller";
import {
  employeeZReportEmployees,
  employeeZReportShifts,
  employeeZReportByShift,
  employeeZReportByDate,
} from "../controllers/employee-z-report.controller";

const router = Router();

router.get("/wash-service", washServiceReport);
router.get("/daily-in-out", dailyInOutReport);
router.get("/z-report", zReport);
router.get("/pending-bookings", pendingBookingsReport);

router.get("/employee-z/employees", employeeZReportEmployees);
router.get("/employee-z/employees/:userId/shifts", employeeZReportShifts);
router.get("/employee-z/shifts/:shiftId/transactions", employeeZReportByShift);
router.get("/employee-z/by-date", employeeZReportByDate);

export default router;
