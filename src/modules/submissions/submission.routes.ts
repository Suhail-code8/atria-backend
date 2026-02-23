import { Router } from "express";
import * as controller from "./submission.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

   
                     
                                                                               
   

                                                                              
                                                                                  
router.get(
  "/:eventId/submissions/me",
  authMiddleware,
  controller.getMySubmissions
);

                                                                          
router.post(
  "/:eventId/submissions",
  authMiddleware,
  upload.single('file'),
  controller.createSubmission
);

                                                                               
router.get(
  "/:eventId/submissions/:submissionId",
  authMiddleware,
  controller.getSubmission
);

                                                                                      
router.put(
  "/:eventId/submissions/:submissionId",
  authMiddleware,
  upload.single('file'),
  controller.updateSubmission
);

                                                                                                        
router.post(
  "/:eventId/submissions/:submissionId/submit",
  authMiddleware,
  controller.submitSubmission
);

   
                         
   

                                                                                     
router.get(
  "/:eventId/submissions",
  authMiddleware,
  controller.listEventSubmissions
);

                                                                                                             
router.put(
  "/:eventId/submissions/:submissionId/review",
  authMiddleware,
  controller.reviewSubmission
);

                                                                                                                
router.patch(
  "/:eventId/submissions/:submissionId/status",
  authMiddleware,
  controller.updateSubmissionStatus
);

export default router;
