import { Router } from "express";
import { sendBookingConfirmation, testEmailService } from "../controllers/email.controller";

const router = Router();

router.post("/send-booking-confirmation", sendBookingConfirmation);
router.get("/test", testEmailService);

export default router;
