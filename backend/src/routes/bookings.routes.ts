import { Router } from "express";
import {
  listBookings,
  getBooking,
  deleteBooking,
  createGuestBooking,
} from "../controllers/bookings.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", checkJwt, listBookings);
router.get("/:id", checkJwt, getBooking);
router.put("/:id/delete", checkJwt, deleteBooking);
router.post("/guest", createGuestBooking);

export default router;
