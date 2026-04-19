import type express from "express";

type EventClient = {
  id: string;
  userId: number;
  role: string;
  businessId: number | null;
  res: express.Response;
};

const clients = new Map<string, EventClient>();

export function registerEventClient(client: EventClient) {
  clients.set(client.id, client);
}

export function removeEventClient(id: string) {
  clients.delete(id);
}

export function broadcastEvent(event: { type: string; payload: unknown; userId?: number; businessId?: number | null }) {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
  clients.forEach((client) => {
    const targetsSpecificUser = event.userId != null;
    const targetsBusiness = event.businessId != null;
    const matchesUser = targetsSpecificUser && client.userId === event.userId;
    const matchesBusiness = targetsBusiness && (client.businessId === event.businessId || client.role === "admin");
    if (targetsSpecificUser && targetsBusiness && !matchesUser && !matchesBusiness) return;
    if (targetsSpecificUser && !targetsBusiness && !matchesUser) return;
    if (!targetsSpecificUser && targetsBusiness && !matchesBusiness) return;
    client.res.write(data);
  });
}
