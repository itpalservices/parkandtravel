import { Router, Request, Response } from "express";
import multer from "multer";
import { checkJwt } from "../middleware/auth.middleware";
import { uploadMultipleImages, listImagesForBooking } from "../services/upload.service";
import { isValidUUID, getBookingById } from "../services/bookings.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WEBP files are allowed"));
    }
  },
});

const router = Router();

router.post(
  "/:bookingId/images",
  checkJwt,
  upload.array("images", 10),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { bookingId } = req.params;

      if (!isValidUUID(bookingId)) {
        res.status(400).json({ error: "Invalid booking ID format" });
        return;
      }

      const authUser = req.authUser;
      if (authUser?.role === "user") {
        res.status(403).json({ error: "Regular users cannot upload vehicle images" });
        return;
      }

      const booking = await getBookingById(bookingId);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No images provided" });
        return;
      }

      const result = await uploadMultipleImages(
        bookingId,
        files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
      );

      if (result.urls.length === 0 && result.errors.length > 0) {
        res.status(500).json({
          error: "All image uploads failed",
          details: result.errors,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          urls: result.urls,
          errors: result.errors,
        },
      });
    } catch (error: any) {
      console.error("Error uploading images:", error);
      if (error.message?.includes("Only JPG")) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to upload images" });
    }
  },
);

router.get(
  "/:bookingId/images",
  checkJwt,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { bookingId } = req.params;

      if (!isValidUUID(bookingId)) {
        res.status(400).json({ error: "Invalid booking ID format" });
        return;
      }

      const booking = await getBookingById(bookingId);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const images = await listImagesForBooking(bookingId);

      res.json({
        success: true,
        data: { images },
      });
    } catch (error: any) {
      console.error("Error listing images:", error);
      res.status(500).json({ error: "Failed to list images" });
    }
  },
);

export default router;
