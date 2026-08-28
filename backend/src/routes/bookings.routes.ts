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
  generateCheckinReceiptHandler,
  generateCheckinReceiptZplHandler,
  generateCheckinPaymentZplHandler,
  generateCompletionPaymentZplHandler,
  generatePrepaidPaymentZplHandler,
  generateBookingTagZplHandler,
  emailCheckinReceiptHandler,
  emailCheckinPaymentHandler,
  emailCompletionPaymentHandler,
  emailPrepaidPaymentHandler,
  emailBookingTagHandler,
  getCheckinPaymentPdfHandler,
  getCompletionPaymentPdfHandler,
  getPrepaidPaymentPdfHandler,
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
router.post("/:id/checkin-receipt", checkJwt, generateCheckinReceiptHandler);
router.get("/:id/checkin-receipt/zpl", checkJwt, generateCheckinReceiptZplHandler);
router.get("/:id/checkin-payment/zpl", checkJwt, generateCheckinPaymentZplHandler);
router.get("/:id/completion-payment/zpl", checkJwt, generateCompletionPaymentZplHandler);
router.get("/:id/prepaid-payment/zpl", checkJwt, generatePrepaidPaymentZplHandler);
router.get("/:id/checkin-payment/pdf", checkJwt, getCheckinPaymentPdfHandler);
router.get("/:id/completion-payment/pdf", checkJwt, getCompletionPaymentPdfHandler);
router.get("/:id/prepaid-payment/pdf", checkJwt, getPrepaidPaymentPdfHandler);
router.get("/:id/booking-tag/zpl", checkJwt, generateBookingTagZplHandler);
router.post("/:id/checkin-receipt/email", checkJwt, emailCheckinReceiptHandler);
router.post("/:id/checkin-payment/email", checkJwt, emailCheckinPaymentHandler);
router.post("/:id/completion-payment/email", checkJwt, emailCompletionPaymentHandler);
router.post("/:id/prepaid-payment/email", checkJwt, emailPrepaidPaymentHandler);
router.post("/:id/booking-tag/email", checkJwt, emailBookingTagHandler);
router.post("/guest", createGuestBooking);

export default router;
