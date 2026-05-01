import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import bookingsRoutes from "./routes/bookings.routes";
import userRoutes from "./routes/user.routes";
import carsRoutes from "./routes/cars.routes";
import settingsRoutes from "./routes/settings.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportsRoutes from "./routes/reports.routes";
import emailRoutes from "./routes/email.routes";
import availabilityRoutes from "./routes/availability.routes";
import uploadRoutes from "./routes/upload.routes";
import paymentRoutes from "./routes/payment.routes";
import shiftsRoutes from "./routes/shifts.routes";
import receiptsRoutes from "./routes/receipts.routes";
import { getParkingTypes, getPhoneCodes } from "./services/bookings.service";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/parking-types", async (req, res) => {
  try {
    const types = await getParkingTypes();
    res.json(types);
  } catch (error) {
    console.error("Error getting parking types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/phone-codes", async (req, res) => {
  try {
    const codes = await getPhoneCodes();
    res.json(codes);
  } catch (error) {
    console.error("Error getting phone codes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use("/api/bookings", bookingsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cars", carsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/receipts", receiptsRoutes);

if (process.env.NODE_ENV !== "production") {
  const frontendProxy = createProxyMiddleware({
    target: "http://localhost:4200",
    changeOrigin: true,
    ws: true,
    pathFilter: (path) => !path.startsWith('/api'),
  });
  app.use(frontendProxy);
}

export default app;
