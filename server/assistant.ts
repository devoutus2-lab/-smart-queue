import { assistantResponseSchema, type AssistantResponse, type AuthUser } from "../shared/api";

export const SMART_QUEUE_KNOWLEDGE_PACK = `
Smart Queue is a queueing and appointment application.

Core product rules:
- Smart Queue helps guests avoid physical lines by joining remotely or booking appointments.
- Guests can browse businesses, check services, business hours, notices, estimated waits, and exact location details.
- Queue actions include pause, resume, let the next guest go first, rejoin later, and cancel.
- Queue holds are limited and business rules still apply.
- Appointments can be pending, approved, rejected, converted, expired, cancelled, or completed.
- Business messages are visit-based and move into archive when the visit ends.
- External places can show location and contact details, but only Smart Queue businesses support full queueing and appointments.
- The assistant must stay within Smart Queue topics and refuse unrelated requests.
- The assistant must never claim that an action happened unless the backend execution really succeeded.
- The assistant should use live app data first and product rules second.

Guest routes and screens:
- /account is the guest home with summaries, recommendations, notifications, conversations, and a home assistant.
- /account/queues shows active queue entries and queue-focused actions.
- /account/search helps guests browse businesses and compare wait times, services, favorites, and saved places.
- /account/map shows nearby businesses and location-aware discovery.
- /account/appointments shows upcoming appointments and booking status.
- /account/receipts shows digital receipts from completed visits when the business supports receipts.
- /account/messages is the dedicated business messaging hub and visit archive.
- /account/notifications shows account notifications.
- /account/profile lets the guest update personal details.
- /account/settings lets the guest manage preferences, including the AI assistant setting.
- /schedule-queue helps a guest choose between queueing now and booking later.
- /queue-preview/:entryId shows one live queue card with status, ETA, and next actions.
- /business/:id shows a Smart Queue business profile with services, notices, hours, and queue/appointment options.
- /places/external/:provider/:placeId shows an external place profile that may not support Smart Queue actions yet.

Owner routes and screens:
- /business-dashboard is the owner workspace.
- /business-dashboard/queue is for live queue operations and guest progress.
- /business-dashboard/appointments is for pending and approved appointment handling.
- /business-dashboard/services manages services, counters, and staffing-related setup.
- /business-dashboard/messages is the owner inbox for guest conversations.
- /business-dashboard/receipts manages receipt issuance when receipts are enabled.
- /business-dashboard/analytics shows performance summaries and busiest windows.
- /business-dashboard/feedback shows customer reviews and owner replies.
- /business-dashboard/notifications shows owner notifications.
- /business-dashboard/settings manages business profile, hours, queue open state, and receipt settings.

Admin routes and screens:
- /admin-panel is the platform administration workspace.
- /admin-panel/overview shows high-level platform counts.
- /admin-panel/businesses manages business records.
- /admin-panel/owners manages owner accounts.
- /admin-panel/accounts manages platform account visibility.
- Admin workflows also include subscriptions and claim/import review where available in the current UI data.

Important workflow knowledge:
- Queue actions for guests can include pause, resume, let the next guest go first, rejoin later, and cancel, subject to business limits.
- Appointments can move through pending, approved, rejected, converted, expired, cancelled, or completed states.
- Business messages are tied to a visit context and move into archive after the visit ends.
- Favorites and saved places are guest-specific, not shared across accounts.
- Receipts are only available for businesses that enable receipt support.
- Demo routes exist for figure-based demos and may preload preset data.
- If the user asks how to do something in the app, prefer step-by-step instructions using the real route or screen name.
- If the user reports a technical problem, account issue, bug, broken screen, missing data, crash, or subscription/access problem, direct them to Smart Queue support or technical support instead of pretending to debug it fully.
`.trim();

export function extractJsonObject(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lowerIncludes(input: string, patterns: string[]) {
  const normalized = input.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function buildGuestQueueGuidance(context: Record<string, unknown>) {
  const selectedQueueEntry = asRecord(context.selectedQueueEntry);
  const activeQueueEntries = asArray(context.activeQueueEntries).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const target = selectedQueueEntry ?? activeQueueEntries[0] ?? null;
  if (!target) {
    return {
      resolutionState: "unresolved" as const,
      message: "You do not have an active live queue right now. The fastest next step is to open Search, Map, or a business page and compare wait times before joining.",
      nextSteps: [
        "Open Account Search or Account Map to compare businesses.",
        "Open a business page and choose between Join Queue now or booking later.",
      ],
    };
  }

  const businessName = asString(target.businessName) ?? "this business";
  const serviceName = asString(target.serviceName) ?? "the selected service";
  const status = asString(target.status) ?? "waiting";
  const wait = asNumber(target.estimatedWaitMinutes);
  const position = asNumber(target.position);
  const timing = wait != null ? `The estimated wait is about ${wait} minute${wait === 1 ? "" : "s"}.` : "The current wait estimate is not available.";
  const place = position != null ? `Your current line position is ${position}.` : "Your exact line position is not available in this snapshot.";

  return {
    resolutionState: "resolved" as const,
    message: `Your live queue with ${businessName} for ${serviceName} is currently ${status.split("_").join(" ")}. ${timing} ${place}`.trim(),
    nextSteps: [
      "Open Account Queues or the live queue card to review the latest status.",
      "If timing changes, use pause, let the next guest go first, rejoin later, or cancel only if those options fit the current queue rules.",
    ],
  };
}

function buildGuestAppointmentGuidance(context: Record<string, unknown>) {
  const selectedAppointment = asRecord(context.selectedAppointment);
  const upcomingAppointments = asArray(context.upcomingAppointments).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const target = selectedAppointment ?? upcomingAppointments[0] ?? null;
  if (!target) {
    return {
      resolutionState: "unresolved" as const,
      message: "You do not have a pending or approved appointment in view right now. If you want a planned visit instead of a live queue, open Appointments or a business page and book from there.",
      nextSteps: [
        "Open Account Appointments to review scheduled visits.",
        "Open a business page and choose Book Appointment if that service supports appointments.",
      ],
    };
  }

  const businessName = asString(target.businessName) ?? "this business";
  const serviceName = asString(target.serviceName) ?? "the selected service";
  const scheduledFor = asString(target.scheduledFor);
  const status = asString(target.status) ?? "pending";

  return {
    resolutionState: "resolved" as const,
    message: `Your appointment with ${businessName} for ${serviceName} is ${status}. ${scheduledFor ? `It is scheduled for ${scheduledFor}.` : ""}`.trim(),
    nextSteps: [
      "Open Account Appointments to confirm the schedule and status details.",
      "If you need to change plans, compare this appointment with the live queue option before cancelling.",
    ],
  };
}

function buildGuestBusinessGuidance(context: Record<string, unknown>) {
  const selectedBusiness = asRecord(context.selectedBusiness);
  const services = asArray(context.selectedBusinessServices).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  if (!selectedBusiness) {
    return {
      resolutionState: "unresolved" as const,
      message: "I can help you compare businesses, queue options, and appointments, but I need a business page or a business name in context first.",
      nextSteps: [
        "Open a business page from Search or Map.",
        "Ask again once you are on the business page you want to compare.",
      ],
    };
  }

  const businessName = asString(selectedBusiness.name) ?? "this business";
  const serviceNames = services.slice(0, 3).map((service) => asString(service.name)).filter(Boolean) as string[];
  const serviceSummary = serviceNames.length ? `Available services in view include ${serviceNames.join(", ")}.` : "The current service list is limited in this snapshot.";

  return {
    resolutionState: "resolved" as const,
    message: `${businessName} is ready for a queue-or-appointment decision. ${serviceSummary}`,
    nextSteps: [
      "Use the business page to compare Join Queue now versus Book Appointment later.",
      "Check the service list, notices, and hours before confirming your visit.",
    ],
  };
}

function buildGuestDefaultGuidance(context: Record<string, unknown>) {
  const pageContext = asRecord(context.pageContext);
  const label = asString(pageContext?.label) ?? "your current Smart Queue screen";
  return {
    resolutionState: "unresolved" as const,
    message: `I can help you use ${label} more efficiently. Tell me whether you want queue guidance, appointment planning, business comparison, messages, settings help, or the best next route to open.`,
    nextSteps: [
      "Ask what to do next on this screen.",
      "Mention whether you want queue help, appointment help, or business comparison.",
    ],
  };
}

function buildOwnerGuidance(context: Record<string, unknown>, prompt: string) {
  const business = asRecord(context.business);
  const queueSummary = asRecord(context.queueSummary);
  const businessName = asString(business?.name) ?? "your business";
  const activeCount = asNumber(queueSummary?.activeCount) ?? 0;
  const pendingAppointments = asNumber(queueSummary?.pendingAppointments) ?? 0;
  const pendingConversationCount = asNumber(queueSummary?.pendingConversationCount) ?? 0;
  const services = asArray(queueSummary?.services).map(asRecord).filter(Boolean) as Record<string, unknown>[];

  if (lowerIncludes(prompt, ["queue", "line", "wait", "guest"])) {
    return {
      resolutionState: "resolved" as const,
      message: `${businessName} currently shows ${activeCount} active queue entr${activeCount === 1 ? "y" : "ies"} and ${pendingAppointments} pending appointment${pendingAppointments === 1 ? "" : "s"}.`,
      nextSteps: [
        "Open the live queue area if you need to move guests forward.",
        "Open appointments next if you need to approve or reschedule upcoming visits.",
      ],
    };
  }

  if (lowerIncludes(prompt, ["message", "chat", "inbox", "support"])) {
    return {
      resolutionState: "resolved" as const,
      message: `${businessName} currently has ${pendingConversationCount} conversation${pendingConversationCount === 1 ? "" : "s"} in the owner workspace snapshot.`,
      nextSteps: [
        "Open Business Dashboard Messages to answer guest questions.",
        "If the issue is technical or billing-related, contact Smart Queue support instead of replying as if it were a normal visit message.",
      ],
    };
  }

  const topServices = services.slice(0, 3).map((service) => asString(service.name)).filter(Boolean) as string[];
  return {
    resolutionState: "resolved" as const,
    message: `${businessName} is in a healthy owner-guidance mode. You currently have ${activeCount} active queue entries, ${pendingAppointments} pending appointments, and ${pendingConversationCount} active guest conversations.${topServices.length ? ` Services in view include ${topServices.join(", ")}.` : ""}`,
    nextSteps: [
      "Use Queue for live guest flow, Appointments for approvals, and Messages for visit questions.",
      "Open Settings when you need queue open state, hours, receipts, or profile changes.",
    ],
  };
}

function buildAdminGuidance(context: Record<string, unknown>, prompt: string) {
  const overview = asRecord(context.overview);
  const businesses = asNumber(overview?.businesses) ?? 0;
  const owners = asNumber(overview?.owners) ?? 0;
  const users = asNumber(overview?.users) ?? 0;
  const pendingClaims = asNumber(overview?.pendingClaims) ?? 0;
  const activeSubscriptions = asNumber(overview?.activeSubscriptions) ?? 0;

  if (lowerIncludes(prompt, ["claim", "import", "business"])) {
    return {
      resolutionState: "resolved" as const,
      message: `The admin snapshot currently shows ${businesses} businesses and ${pendingClaims} pending claim request${pendingClaims === 1 ? "" : "s"}.`,
      nextSteps: [
        "Open Admin Businesses for record changes and ownership checks.",
        "Open claim review workflows next if you need to resolve pending claims.",
      ],
    };
  }

  if (lowerIncludes(prompt, ["subscription", "billing", "plan"])) {
    return {
      resolutionState: "resolved" as const,
      message: `The platform snapshot currently shows ${activeSubscriptions} active subscription${activeSubscriptions === 1 ? "" : "s"}.`,
      nextSteps: [
        "Open subscription management in the admin workspace.",
        "If there is a billing problem or access issue, route it to Smart Queue support.",
      ],
    };
  }

  return {
    resolutionState: "resolved" as const,
    message: `The current admin snapshot includes ${businesses} businesses, ${owners} owners, ${users} guest accounts, ${pendingClaims} pending claims, and ${activeSubscriptions} active subscriptions.`,
    nextSteps: [
      "Use Overview for platform health, Businesses for record management, and Accounts for moderation or access checks.",
      "Escalate technical or billing issues to Smart Queue support instead of guessing.",
    ],
  };
}

export function buildOfflineAssistantResponse(
  role: AuthUser["role"],
  prompt: string,
  context: Record<string, unknown>,
): AssistantResponse {
  const normalizedPrompt = prompt.toLowerCase();
  const guidance =
    role === "owner"
      ? buildOwnerGuidance(context, normalizedPrompt)
      : role === "admin"
        ? buildAdminGuidance(context, normalizedPrompt)
        : lowerIncludes(normalizedPrompt, ["queue", "line", "turn", "eta", "wait", "pause", "resume", "skip", "rejoin", "cancel"])
          ? buildGuestQueueGuidance(context)
          : lowerIncludes(normalizedPrompt, ["appointment", "book", "schedule", "reschedule", "calendar"])
            ? buildGuestAppointmentGuidance(context)
            : lowerIncludes(normalizedPrompt, ["business", "service", "join", "hours", "open", "place", "map", "search"])
              ? buildGuestBusinessGuidance(context)
              : buildGuestDefaultGuidance(context);

  return {
    status: "answered",
    resolutionState: guidance.resolutionState,
    canRate: guidance.resolutionState === "resolved" && role !== "admin",
    message: guidance.message,
    nextSteps: guidance.nextSteps,
    suggestedReply: "Tell me what screen you are on and what you want to do next.",
    recommendedBusinessAction: null,
    refusalReason: null,
    actionProposal: null,
    actionResult: null,
  };
}

export function isGroqAssistantConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function callGroqAssistant(systemPrompt: string, userPrompt: string): Promise<AssistantResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const baseUrl = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with status ${response.status}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim() || "";

    const parsed = JSON.parse(extractJsonObject(content)) as unknown;
    const validated = assistantResponseSchema.safeParse(parsed);

    if (validated.success) {
      return {
        status: validated.data.status ?? "answered",
        resolutionState: validated.data.resolutionState ?? "unresolved",
        canRate: validated.data.canRate ?? false,
        message: validated.data.message ?? "I could not generate a helpful answer just now.",
        nextSteps: validated.data.nextSteps ?? [],
        suggestedReply: validated.data.suggestedReply ?? null,
        recommendedBusinessAction: validated.data.recommendedBusinessAction ?? null,
        refusalReason: validated.data.refusalReason ?? null,
        actionProposal: validated.data.actionProposal ?? null,
        actionResult: validated.data.actionResult ?? null,
      };
    }

    const fallbackMessage =
      typeof parsed === "object" && parsed !== null && "message" in parsed && typeof parsed.message === "string"
        ? parsed.message
        : content;

    return {
      status: "answered",
      resolutionState: "unresolved",
      canRate: false,
      message: fallbackMessage || "I couldn't generate a reliable Smart Queue answer just now.",
      nextSteps: [],
      suggestedReply: null,
      recommendedBusinessAction: null,
      refusalReason: null,
      actionProposal: null,
      actionResult: null,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error("Groq request failed");
  }
}
