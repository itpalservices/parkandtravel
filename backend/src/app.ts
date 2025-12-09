import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import bookingsRoutes from "./routes/bookings.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/bookings", bookingsRoutes);

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
