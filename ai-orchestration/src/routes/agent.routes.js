import { Router } from "express";
import agent from "../agents/code.agent.js";

const agentRouter = Router();

agentRouter.post("/invoke", async (req, res) => {
  try {
    const { message, projectId } = req.body;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    const writer = (text) => {
      const payload = String(text).replace(/\r?\n/g, "\ndata: ");
      res.write(`data: ${payload}\n\n`);
    };

    const stream = await agent.stream(
      {
        messages: [{ role: "user", content: message }],
      },
      {
        context: { projectId, writer },
        streamMode: "values",
        timeout: 300000,
      }
    );

    let lastState = null;

    for await (const state of stream) {
      lastState = state;
    }

    if (lastState?.messages?.length) {
      const msgs = lastState.messages;

      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const role = m.role ?? m._getType?.();

        if (
          (role === "ai" || role === "assistant") &&
          !m.tool_calls?.length
        ) {
          const content =
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content);

          writer(content);
          break;
        }
      }
    }

    res.write("event: done\ndata: complete\n\n");
    res.end();
  } catch (error) {
    console.error("Error invoking agent:", error);

    if (res.headersSent) {
      const message =
        error?.name === "TimeoutError"
          ? "The AI request timed out. Please try a smaller prompt or retry."
          : "Failed to invoke agent";
      res.write(`event: error\ndata: ${message}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        error:
          error?.name === "TimeoutError"
            ? "The AI request timed out. Please try again."
            : "Failed to invoke agent",
      });
    }
  }
});

export default agentRouter;
