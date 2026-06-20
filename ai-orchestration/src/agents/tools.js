import axios from "axios";
// import { write } from "fs";
import { tool } from "langchain";
import * as z from "zod";

function normalizePathList(input) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item)).filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeUpdates(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const file =
        item.file ?? item.path ?? item.filename ?? item.name ?? item.target;
      const content =
        item.content ?? item.contents ?? item.text ?? item.value ?? item.code;

      if (!file || typeof content !== "string") {
        return null;
      }

      return {
        file: String(file),
        content,
      };
    })
    .filter(Boolean);
}

export const listFiles = tool(
  async ({}, config) => {
    const writer = config.context?.writer ?? (() => {});

    writer("Listing files in project directory...\n");

    const response = await axios.get(
      `http://sandbox-service-${config.context.projectId}:3000/list-files`
    );

    writer(
      "Files listed successfully. " +
        "Files: " +
        response.data.files.join(",") +
        "\n"
    );

    return JSON.stringify(response.data.files);
  },
  {
    name: "list_files",
    description:
      "List all the files in the project directory. This is useful for understanding what files are available to work with.",
    schema: z.object({}),
  }
);

export const readFiles = tool(
  async ({ files = [], paths, file }, config) => {
    const writer = config.context?.writer ?? (() => {});
    const normalizedFiles = normalizePathList(files ?? paths ?? file);

    if (!normalizedFiles.length) {
      throw new Error("read_files requires at least one file path");
    }

    writer("Reading files..." + normalizedFiles.join(",") + "\n");

    const response = await axios.get(
      `http://sandbox-service-${config.context.projectId}:3000/read-files?files=` +
        normalizedFiles.join(",")
    );

    writer("Files read successfully.\n");

    return JSON.stringify(response.data);
  },
  {
    name: "read_files",
    description:
      "Read the contents of specified files. This is useful for understanding the content of files that are relevant to the task at hand.",
    schema: z.object({
      files: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .describe(
          "The list of files or comma-separated file paths to read. These should be files that were listed using the list_files tool or created later."
        ),
      paths: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .describe("Alias for files."),
      file: z.string().optional().describe("Single file path to read."),
    }),
  }
);

export const updateFiles = tool(
  async ({ files, updates }, config) => {
    const writer = config.context?.writer ?? (() => {});
    const normalizedUpdates = normalizeUpdates(files ?? updates);

    if (!normalizedUpdates.length) {
      throw new Error(
        "update_files requires an array of file updates with file and content"
      );
    }

    writer(
      "Updating files..." +
        normalizedUpdates.map((f) => f.file).join(",") +
        "\n"
    );

    const response = await axios.patch(
      `http://sandbox-service-${config.context.projectId}:3000/update-files`,
      {
        updates: normalizedUpdates,
      }
    );

    writer("Files updated successfully.\n");

    return JSON.stringify(response.data.results);
  },
  {
    name: "update_files",
    description:
      "Update the contents of specified files. This is useful for making changes to files based on the requirements of the task at hand. this tool can also use to create new files by providing a new file name in the file field and the content to be added in the content field.",
    schema: z.object({
      files: z
        .array(z.record(z.string(), z.any()))
        .optional()
        .describe("The list of files to update and their new contents."),
      updates: z
        .array(z.record(z.string(), z.any()))
        .optional()
        .describe("Alias for files."),
    }),
  }
);
