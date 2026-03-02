import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/** Maps SSE event types to tRPC query keys to invalidate */
const EVENT_INVALIDATION_MAP: Record<string, string[]> = {
  "agent.heartbeat": ["agents.liveStatuses", "federation.health"],
  "agent.status": ["agents.list", "agents.liveStatuses", "federation.stats"],
  "task.updated": ["tasks.list", "federation.stats"],
  "economy.transfer": ["economy.treasuryStats", "federation.stats"],
  "federation.stats": ["federation.stats"],
};

/**
 * Connects to the federation SSE stream and auto-invalidates
 * relevant tRPC queries when events arrive, replacing polling.
 */
export function useFederationSSE() {
  const utils = trpc.useUtils();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events/federation");
    esRef.current = es;

    const handleEvent = (type: string) => {
      const keys = EVENT_INVALIDATION_MAP[type];
      if (!keys) return;
      for (const key of keys) {
        const [router, method] = key.split(".");
        try {
          (utils as any)[router]?.[method]?.invalidate();
        } catch {}
      }
    };

    // Register handlers for each event type
    for (const eventType of Object.keys(EVENT_INVALIDATION_MAP)) {
      es.addEventListener(eventType, () => handleEvent(eventType));
    }

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [utils]);
}
