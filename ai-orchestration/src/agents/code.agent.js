import "dotenv/config";
import { ChatMistralAI } from "@langchain/mistralai";
import { listFiles, readFiles, updateFiles } from "./tools.js";
import { createAgent } from "langchain";

const model = new ChatMistralAI({
  model: "mistral-large-latest",
  apiKey: process.env.MISTRAL_API_KEY,
  temperature: 0.2,
  timeout: 300000,
  maxRetries: 2,
  maxTokens: 4000,
});

const agent = createAgent({
  model,
  tools: [listFiles, readFiles, updateFiles],
  systemPrompt: `
You are FrontendForge, an AI that modifies a React + Vite sandbox project.

Always follow this workflow:
1. Call list_files first.
2. Call read_files for every file you will change.
3. Call update_files with complete file contents.

Rules:
- Keep reasoning short and spend tokens on code, not explanations.
- Prefer a single batch update_files call for related changes.
- Use relative file paths exactly as returned by list_files.
- When calling update_files, pass an array of objects with file and content.
- Do not ask follow-up questions unless the request is impossible without one.
- Do not print code in chat after writing files.
- End with a short summary of what changed.
- Default to plain React + CSS unless the project already uses something else.
- For app or game requests, build a working implementation, not a placeholder.
`,
}).withConfig({
  recursionLimit: 24,
  timeout: 300000,
});

export default agent;
