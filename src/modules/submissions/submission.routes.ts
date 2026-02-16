import { Router } from "express";
import * as controller from "./submission.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

/**
 * Participant routes
 * Note: These routes are mounted at /api/events, so paths are relative to that
 */

// GET /api/events/:eventId/submissions/me - Get my submissions for this event
// IMPORTANT: This must come BEFORE /:eventId/submissions to avoid route conflicts
router.get(
  "/:eventId/submissions/me",
  authMiddleware,
  controller.getMySubmissions
);

// POST /api/events/:eventId/submissions - Create a new submission (DRAFT)
router.post(
  "/:eventId/submissions",
  authMiddleware,
  upload.single('file'),
  controller.createSubmission
);

// GET /api/events/:eventId/submissions/:submissionId - Get a single submission
router.get(
  "/:eventId/submissions/:submissionId",
  authMiddleware,
  controller.getSubmission
);

// PUT /api/events/:eventId/submissions/:submissionId - Update submission (DRAFT only)
router.put(
  "/:eventId/submissions/:submissionId",
  authMiddleware,
  upload.single('file'),
  controller.updateSubmission
);

// POST /api/events/:eventId/submissions/:submissionId/submit - Finalize submission (DRAFT -> SUBMITTED)
router.post(
  "/:eventId/submissions/:submissionId/submit",
  authMiddleware,
  controller.submitSubmission
);

/**
 * Organizer/Judge routes
 */

// GET /api/events/:eventId/submissions - List all submissions (Organizer/Judge only)
router.get(
  "/:eventId/submissions",
  authMiddleware,
  controller.listEventSubmissions
);

// PUT /api/events/:eventId/submissions/:submissionId/review - Review/Grade submission (Organizer/Judge only)
router.put(
  "/:eventId/submissions/:submissionId/review",
  authMiddleware,
  controller.reviewSubmission
);

// PATCH /api/events/:eventId/submissions/:submissionId/status - Update submission status (Organizer/Judge only)
router.patch(
  "/:eventId/submissions/:submissionId/status",
  authMiddleware,
  controller.updateSubmissionStatus
);

export default router;
