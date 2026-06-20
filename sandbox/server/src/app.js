import express from "express";
import morgan from "morgan";

import cookieParser from "cookie-parser";
import sandboxRouter from './routes/sandbox.routes.js';

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

async function proxyAgentRequest(res, sandboxId, path, init = {}) {
  const response = await fetch(`http://sandbox-service-${sandboxId}:3000${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  res.status(response.status);
  res.setHeader("Content-Type", contentType);
  res.send(text);
}

app.use('/api/sandbox', sandboxRouter);

app.get("/api/sandbox/health", (req, res) => {
  res.status(200).json({
    message: "Sandbox API is healthy",
    status: "ok",
  });
});

app.get("/api/sandbox/:sandboxId/files", async (req, res) => {
  try {
    await proxyAgentRequest(res, req.params.sandboxId, "/list-files");
  } catch (error) {
    res.status(502).json({
      message: `Error listing files: ${error.message}`,
      status: "error",
    });
  }
});

app.get("/api/sandbox/:sandboxId/files/content", async (req, res) => {
  const file = req.query.file;

  if (!file) {
    return res.status(400).json({
      message: "Missing required query parameter: file",
      status: "error",
    });
  }

  try {
    const fileQuery = encodeURIComponent(String(file));
    await proxyAgentRequest(
      res,
      req.params.sandboxId,
      `/read-files?files=${fileQuery}`
    );
  } catch (error) {
    res.status(502).json({
      message: `Error reading file: ${error.message}`,
      status: "error",
    });
  }
});

export default app;
