import { Router } from "express";
import { createPod } from "../kubernetes/pod.js";
import { createService } from "../kubernetes/service.js";
import { createSandboxKey } from "../config/redis.js";
import { v7 as uuid } from "uuid";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Project from "../models/project.model.js";
import { verifyToken } from "../../utils.js";

const router = Router();

function getAuthenticatedUser(req) {
  const token =
    req.cookies.token || req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

router.post("/project", authMiddleware, async (req, res) => {
  const { title } = req.body;

  const newProject = new Project({
    user: req.user.id,
    title,
  });

  await newProject.save();

  return res.status(201).json({
    message: "Project created successfully",
    project: newProject,
  });
});

router.post("/start", async (req, res) => {
  try {
    const sandboxId = uuid();
    const user = getAuthenticatedUser(req);
    const requestedProjectId = req.body.projectId;
    let effectiveProjectId = sandboxId;
    let project = null;

    if (requestedProjectId) {
      if (!user) {
        return res.status(401).json({
          message: "Authentication is required when starting a saved project",
        });
      }

      project = await Project.findOne({
        _id: requestedProjectId,
        user: user.id,
      });

      if (!project) {
        return res.status(404).json({
          message: "Project not found or access denied",
        });
      }

      effectiveProjectId = project._id.toString();
    } else if (user) {
      project = new Project({
        user: user.id,
        title: req.body.title || "Untitled Project",
      });

      await project.save();
      effectiveProjectId = project._id.toString();
    }

    await Promise.all([
      createPod(sandboxId, effectiveProjectId),
      createService(sandboxId),
      createSandboxKey(sandboxId),
    ]);

    return res.status(201).json({
      message: "Sandbox environment created successfully",
      sandboxId,
      projectId: effectiveProjectId,
      previewUrl: `http://${sandboxId}.preview.localhost`,
      isGuestSession: !user,
    });
  } catch (error) {
    console.error("Error creating sandbox environment:", error);
    return res.status(500).json({
      message: "Failed to create sandbox environment",
    });
  }
});

router.get("/project", authMiddleware, async (req, res) => {
  const projects = await Project.find({ user: req.user.id });

  return res.status(200).json({
    message: "Projects retrieved successfully",
    projects,
  });
});

export default router;
