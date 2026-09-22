import express, { Request, Response } from "express";
import https      from "https";
import fs         from "fs";
import path       from "path";
import cors       from "cors";
import dotenv     from "dotenv";
import ticketRoutes from "./routes/tickets";
import { login }  from "./auth";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET not set in .env");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const frontendPath = path.join(__dirname, "../app");
if (fs.existsSync(frontendPath)) app.use(express.static(frontendPath));

app.post("/api/auth/login", login);
app.use("/api/tickets", ticketRoutes);

app.get("*", (_req: Request, res: Response) => {
  const index = path.join(frontendPath, "index.html");
  fs.existsSync(index)
    ? res.sendFile(index)
    : res.status(404).send("Frontend not built. Run: cd ../keli-frontend && npm run build");
});

const keyPath  = path.join(__dirname, "../server.key");
const certPath = path.join(__dirname, "../server.cert");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.warn("⚠ [WARNING] server.key or server.cert not found in project root!");
  console.warn("  Starting HTTP fallback on port 3000. Mobile browsers may block camera!");
  console.warn("  Run 'node gen-cert.js' or OpenSSL to generate certs.");
  app.listen(3000, "0.0.0.0", () => {
    console.log("KELI Scanner HTTP server running at http://0.0.0.0:3000");
  });
} else {
  const httpsOptions = {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  https.createServer(httpsOptions, app).listen(3000, "0.0.0.0", () => {
    console.log("KELI Scanner HTTPS server running at https://0.0.0.0:3000");
    console.log("Connect scanner devices to the same WiFi hotspot.");
  });
}
