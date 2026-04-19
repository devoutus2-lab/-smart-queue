import type { ConversationCloseReason, ConversationVisitType, QueueStatus } from "./api";

export type GuestQueueAction = "pause" | "resume" | "skip" | "reschedule" | "cancel";
export type OwnerQueueTransition = "called" | "completed" | "no_show" | "in_service" | "delayed";

export function getQueueStatusPresentation(status: QueueStatus) {
  switch (status) {
    case "waiting":
      return {
        label: "Waiting in line",
        description: "Your place is active and the business can call you when the line reaches your service.",
      };
    case "called":
      return {
        label: "Called to the business",
        description: "The business is ready for you now. Head over and watch for counter or staff details.",
      };
    case "in_service":
      return {
        label: "In service",
        description: "Your visit is actively being handled now.",
      };
    case "paused":
      return {
        label: "Paused by guest",
        description: "The guest placed this visit on a short hold. It cannot be called again until the guest resumes.",
      };
    case "delayed":
      return {
        label: "Delayed visit",
        description: "This visit needs business follow-up. It is different from a guest pause and may need manual review or a rejoin.",
      };
    case "completed":
      return {
        label: "Completed",
        description: "This visit was completed and moved out of the active line.",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        description: "This visit was cancelled before service began.",
      };
    case "no_show":
      return {
        label: "No show",
        description: "The business marked this visit as missed.",
      };
    case "transferred":
      return {
        label: "Transferred",
        description: "This visit was transferred out of the current line.",
      };
    default:
      return {
        label: String(status).replace("_", " "),
        description: "Queue status updated.",
      };
  }
}

export function getGuestQueueActionCopy(action: GuestQueueAction, pauseLimitMinutes: number) {
  switch (action) {
    case "pause":
      return {
        timelineLabel: "Guest paused the visit for a short hold.",
        userMessage: `Your place is on hold for up to ${pauseLimitMinutes} minutes. Resume before the hold expires to keep this visit active.`,
        ownerMessage: "The guest paused the visit for a short hold.",
        realtimeMessage: `Your place is on hold for up to ${pauseLimitMinutes} minutes. Resume before the hold expires to keep this visit active.`,
      };
    case "resume":
      return {
        timelineLabel: "Guest resumed the visit and returned to the live line.",
        userMessage: "Your place in line is active again. The business can call you when your turn gets closer.",
        ownerMessage: "The guest resumed the visit and returned to the live line.",
        realtimeMessage: "Your place in line is active again. The business can call you when your turn gets closer.",
      };
    case "skip":
      return {
        timelineLabel: "Guest let the next waiting guests go first.",
        userMessage: "You stayed in this queue, but moved behind the next waiting guests in the same service lane.",
        ownerMessage: "The guest stayed active, but moved behind the next waiting guests.",
        realtimeMessage: "You stayed in this queue, but moved behind the next waiting guests in the same service lane.",
      };
    case "reschedule":
      return {
        timelineLabel: "Guest rejoined later with a fresh place in line.",
        userMessage: "You rejoined later and received a fresh place in line for this same visit.",
        ownerMessage: "The guest rejoined later and received a fresh place in line.",
        realtimeMessage: "You rejoined later and received a fresh place in line for this same visit.",
      };
    case "cancel":
      return {
        timelineLabel: "Guest cancelled the queue visit.",
        userMessage: "Your queue visit was cancelled. You can join again later if you still need this service.",
        ownerMessage: "The guest cancelled the queue visit.",
        realtimeMessage: "Your queue visit was cancelled. You can join again later if you still need this service.",
      };
  }
}

export function getOwnerQueueTransitionCopy(nextState: OwnerQueueTransition) {
  switch (nextState) {
    case "called":
      return {
        timelineLabel: "Business called the guest.",
        userMessage: "The business called your turn. Head over now and watch for counter details.",
        ownerMessage: "The guest was called and should be moving to service now.",
        realtimeMessage: "The business called your turn. Head over now and watch for counter details.",
      };
    case "in_service":
      return {
        timelineLabel: "Business started service.",
        userMessage: "The business started service for this visit.",
        ownerMessage: "Service is now in progress for this visit.",
        realtimeMessage: "The business started service for this visit.",
      };
    case "completed":
      return {
        timelineLabel: "Business completed the visit.",
        userMessage: "This visit was completed and moved to your history.",
        ownerMessage: "The visit was completed and removed from the active queue.",
        realtimeMessage: "This visit was completed and moved to your history.",
      };
    case "delayed":
      return {
        timelineLabel: "Business marked the visit as delayed for manual follow-up.",
        userMessage: "The business marked this visit as delayed. Check messages or rejoin later if they ask you to return.",
        ownerMessage: "This visit is delayed and now needs manual follow-up. It is not the same as a guest pause.",
        realtimeMessage: "The business marked this visit as delayed. Check messages or rejoin later if they ask you to return.",
      };
    case "no_show":
      return {
        timelineLabel: "Business marked the guest as no-show.",
        userMessage: "The business marked this visit as no-show.",
        ownerMessage: "The visit was closed as no-show and removed from the active queue.",
        realtimeMessage: "The business marked this visit as no-show.",
      };
  }
}

export function getPauseExpiredCopy() {
  return {
    timelineLabel: "Guest pause expired. The visit now needs business follow-up or a rejoin.",
    userMessage: "Your short hold expired. Rejoin later if you still need this visit.",
    ownerMessage: "The guest pause expired. This visit now needs follow-up and is not simply paused anymore.",
    realtimeMessage: "Your short hold expired. Rejoin later if you still need this visit.",
  };
}

export function getConversationContextLabel(
  visitType: ConversationVisitType,
  state: "active" | "delayed" | "closed",
  reason?: ConversationCloseReason | null,
) {
  if (state === "active") {
    if (visitType === "queue") return "Active queue";
    if (visitType === "appointment") return "Upcoming appointment";
    return "Pre-visit question";
  }

  if (state === "delayed") {
    return visitType === "queue" ? "Delayed visit" : "Visit needs follow-up";
  }

  if (visitType === "queue") {
    if (reason === "cancelled") return "Cancelled queue visit";
    if (reason === "completed") return "Completed queue visit";
    if (reason === "no_show") return "Missed queue visit";
    return "Closed queue visit";
  }

  if (visitType === "appointment") {
    if (reason === "cancelled") return "Cancelled appointment";
    if (reason === "completed") return "Completed appointment";
    if (reason === "expired") return "Expired appointment";
    return "Closed appointment";
  }

  return "Closed conversation";
}
