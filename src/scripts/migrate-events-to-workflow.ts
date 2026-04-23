/**
 * Migration Script: migrate-events-to-workflow.ts
 *
 * Finds all events that do not yet have a workflow (or have an empty workflow)
 * and generates a sensible default linear workflow graph based on the event's
 * existing `capabilities`, `isPaid`, and `isCompetition` flags.
 *
 * Node ordering:
 *   REGISTRATION  (if capabilities.registration)
 *   PAYMENT       (if isPaid)
 *   TEAM_FORMATION (if capabilities.teams)
 *   SUBMISSION    (if capabilities.submissions)
 *   JUDGING_ROUND (if capabilities.scoring && isCompetition)
 *   LEADERBOARD   (if capabilities.scoring && isCompetition)
 *
 * Nodes are connected in the order above with unconditional edges.
 *
 * Run automatically on server start when RUN_MIGRATION=true env var is set.
 */

import { Event, WorkflowNodeType, IWorkflowNode, IWorkflowEdge, EventCapabilities } from "../modules/events/event.model";

export const runMigration = async (): Promise<void> => {
  console.log("[Migration] Checking for events without a workflow...");

  // Find events where workflow is missing or nodes array is empty
  const events = await Event.find({
    $or: [
      { workflow: { $exists: false } },
      { "workflow.nodes": { $size: 0 } },
      { "workflow.nodes": { $exists: false } }
    ]
  });

  if (events.length === 0) {
    console.log("[Migration] All events already have a workflow. Nothing to do.");
    return;
  }

  console.log(`[Migration] Found ${events.length} event(s) without a workflow. Generating defaults...`);

  let updatedCount = 0;

  for (const event of events) {
    try {
      const nodes: IWorkflowNode[] = [];
      const edges: IWorkflowEdge[] = [];

      const cap: EventCapabilities = event.capabilities ?? {
        registration: false,
        submissions: false,
        review: false,
        teams: false,
        scoring: false,
        sessions: false,
        realtime: false
      };
      let xPos = 0;
      const Y = 200;
      const X_STEP = 250;

      const addNode = (type: WorkflowNodeType, config: Record<string, any> = {}) => {
        const id = `${type.toLowerCase()}_${xPos / X_STEP + 1}`;
        nodes.push({
          id,
          type,
          config,
          position: { x: xPos, y: Y }
        });
        xPos += X_STEP;
        return id;
      };

      // Build node sequence
      const nodeIds: string[] = [];

      if (cap.registration) {
        nodeIds.push(addNode(WorkflowNodeType.REGISTRATION, {
          formFields: (event.registrationForm ?? []).map((f) => f.id)
        }));
      }

      if (event.isPaid) {
        nodeIds.push(addNode(WorkflowNodeType.PAYMENT, {
          amount: event.price ?? 0,
          currency: "INR"
        }));
      }

      if (cap.teams) {
        nodeIds.push(addNode(WorkflowNodeType.TEAM_FORMATION));
      }

      if (cap.submissions) {
        nodeIds.push(addNode(WorkflowNodeType.SUBMISSION));
      }

      if (cap.scoring && event.isCompetition) {
        nodeIds.push(addNode(WorkflowNodeType.JUDGING_ROUND));
        nodeIds.push(addNode(WorkflowNodeType.LEADERBOARD));
      }

      // Connect nodes in sequence (no conditions = auto-advance)
      for (let i = 0; i < nodeIds.length - 1; i++) {
        edges.push({
          source: nodeIds[i],
          target: nodeIds[i + 1]
        });
      }

      // Even if no capabilities are set, set an empty but valid workflow
      event.workflow = { nodes, edges };
      await event.save();
      updatedCount++;

      console.log(
        `[Migration]   ✓ Event "${event.title}" (${event._id}) — generated ${nodes.length} node(s)`
      );
    } catch (err) {
      console.error(`[Migration]   ✗ Failed for event "${event.title}" (${event._id}):`, err);
    }
  }

  console.log(`[Migration] Done. Updated ${updatedCount}/${events.length} event(s).`);
};
