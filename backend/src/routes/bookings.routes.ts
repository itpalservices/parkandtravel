import { Router } from "express";
import {
  listBookings,
  getBooking,
  deleteBooking,
  createGuestBooking,
  createBooking,
  updateBooking,
  updateBookingStatus,
  updateParkedBooking,
  checkParkPlaceAvailability,
  stageBookingUpdate,
  getExtraFeeEstimate,
  completeBookingHandler,
  getCheckinPaymentInfoHandler,
  recordCheckinPaymentHandler,
} from "../controllers/bookings.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", checkJwt, listBookings);
router.post("/", checkJwt, createBooking);
router.get("/check-park-place", checkJwt, checkParkPlaceAvailability);
router.get("/:id", checkJwt, getBooking);
router.put("/:id", checkJwt, updateBooking);
router.patch("/:id/status", checkJwt, updateBookingStatus);
router.patch("/:id/parked", checkJwt, updateParkedBooking);
router.put("/:id/delete", checkJwt, deleteBooking);
router.post("/:id/stage-update", checkJwt, stageBookingUpdate);
router.get("/:id/extra-fee-estimate", checkJwt, getExtraFeeEstimate);
router.post("/:id/complete", checkJwt, completeBookingHandler);
router.get("/:id/checkin-payment-info", checkJwt, getCheckinPaymentInfoHandler);
router.post("/:id/checkin-payment", checkJwt, recordCheckinPaymentHandler);
router.post("/guest", createGuestBooking);

export default router;
