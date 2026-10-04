import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "reconcile app stats",
  { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
  internal.maintenance.reconcileAppStatsCron,
);

crons.daily(
  "purge stale chat sessions",
  { hourUTC: 5, minuteUTC: 0 },
  internal.maintenance.purgeStaleChatSessions,
);

crons.weekly(
  "purge old link events",
  { dayOfWeek: "monday", hourUTC: 5, minuteUTC: 30 },
  internal.maintenance.purgeOldLinkEvents,
);

export default crons;
