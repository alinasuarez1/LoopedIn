import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

const startServer = async (retries = 3) => {
  const PORT = 5000;

  try {
    const server = registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    server.listen(PORT, "0.0.0.0", () => {
      log(`serving on port ${PORT}`);
    });

    return server;
  } catch (error: any) {
    if (error.code === 'EADDRINUSE' && retries > 0) {
      log(`Port ${PORT} is in use, attempting to free it...`);
      try {
        // Find and kill the process using port 5000
        await execAsync(`fuser -k ${PORT}/tcp`);
        log(`Successfully freed port ${PORT}`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return startServer(retries - 1);
      } catch (killError) {
        log(`Failed to free port ${PORT}: ${killError}`);
      }
    }
    throw error;
  }
};

(async () => {
  try {
    await startServer();
  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();