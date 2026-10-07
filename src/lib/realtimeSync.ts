import { useEffect } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

export type SyncPayload = {
  table?: string;
  action?: string;
  id?: string;
  timestamp: number;
};

type SyncCallback = (payload: SyncPayload) => void;

class RealtimeSyncManager {
  private listeners = new Set<SyncCallback>();
  private channel: any = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private lastTriggerTime = 0;
  private debounceTimer: any = null;
  private heartbeatTimer: any = null;
  private isInitialized = false;
  private isSubscribed = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Cross-tab BroadcastChannel (instant in same browser)
    try {
      if ("BroadcastChannel" in window) {
        this.localBroadcastChannel = new BroadcastChannel("hajj_realtime_sync");
        this.localBroadcastChannel.onmessage = (event) => {
          this.handleIncomingSync(event.data || { timestamp: Date.now() });
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    // 2. Storage event for cross-tab fallback
    window.addEventListener("storage", (e) => {
      if (e.key === "hajj_last_data_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.handleIncomingSync(parsed);
        } catch {
          this.handleIncomingSync({ timestamp: Date.now() });
        }
      }
    });

    // 3. Tab focus and visibility
    window.addEventListener("focus", () => {
      this.trigger({ action: "focus", timestamp: Date.now() });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.trigger({ action: "visibilitychange", timestamp: Date.now() });
      }
    });

    // 4. Supabase Realtime WebSocket Channel
    this.connectSupabase();

    // 5. Smart background heartbeat polling (every 5 seconds when tab is active)
    this.startHeartbeat();
  }

  public connectSupabase() {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    if (!client) return;

    if (this.channel) {
      try {
        client.removeChannel(this.channel);
      } catch {}
      this.channel = null;
      this.isSubscribed = false;
    }

    try {
      const channel = client.channel("realtime:hajj_global_sync", {
        config: {
          broadcast: { self: false },
        },
      });

      // A) Listen for broadcast mutations from other users across all browsers/devices
      channel.on("broadcast", { event: "data_mutated" }, (payload: any) => {
        const data = payload?.payload || payload || {};
        this.handleIncomingSync({
          table: data.table,
          action: data.action,
          id: data.id,
          timestamp: data.timestamp || Date.now(),
        });
      });

      // B) Listen for Postgres CDC changes on tables
      const tables = [
        "group_requests",
        "hosting_infos",
        "travelers",
        "documents",
        "status_histories",
        "app_users",
      ];
      tables.forEach((tableName) => {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: tableName },
          (payload: any) => {
            this.handleIncomingSync({
              table: tableName,
              action: payload?.eventType || "postgres_change",
              id: payload?.new?.id || payload?.old?.id,
              timestamp: Date.now(),
            });
          }
        );
      });

      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          this.isSubscribed = true;
          console.log("[RealtimeSync] Connected to Supabase real-time channel");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.isSubscribed = false;
        }
      });

      this.channel = channel;
    } catch (err) {
      console.warn("[RealtimeSync] Could not initialize Supabase channel:", err);
    }
  }

  private handleIncomingSync(payload: SyncPayload) {
    const now = Date.now();
    // Throttle duplicate events within 200ms
    if (now - this.lastTriggerTime < 200) {
      return;
    }
    this.trigger(payload);
  }

  private trigger(payload: SyncPayload) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.lastTriggerTime = Date.now();
      this.listeners.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error("[RealtimeSync] Listener error:", err);
        }
      });
    }, 120);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    // Poll every 5 seconds when visible
    this.heartbeatTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        this.trigger({ action: "heartbeat", timestamp: Date.now() });
      }
    }, 5000);
  }

  /**
   * Broadcast a mutation across all clients, tabs, and devices immediately
   */
  public notifyMutation(data?: { table?: string; action?: string; id?: string }) {
    const payload: SyncPayload = {
      table: data?.table,
      action: data?.action,
      id: data?.id,
      timestamp: Date.now(),
    };

    // 1. Post to local BroadcastChannel
    try {
      this.localBroadcastChannel?.postMessage(payload);
    } catch {}

    // 2. Set localStorage to trigger cross-tab storage event
    try {
      localStorage.setItem("hajj_last_data_sync", JSON.stringify(payload));
    } catch {}

    // 3. Send Supabase broadcast event to all other clients worldwide
    if (this.channel) {
      try {
        this.channel.send({
          type: "broadcast",
          event: "data_mutated",
          payload,
        });
      } catch (err) {
        console.warn("[RealtimeSync] Error sending broadcast:", err);
      }
    }

    // 4. Trigger local listeners
    this.trigger(payload);
  }

  /**
   * Subscribe a component or hook to real-time events
   */
  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public isRealtimeActive(): boolean {
    return this.isSubscribed;
  }
}

export const realtimeSync = new RealtimeSyncManager();

/**
 * Custom React hook for auto-subscribing a component to real-time data changes
 */
export function useRealtimeSync(onSync: (payload: SyncPayload) => void) {
  useEffect(() => {
    return realtimeSync.subscribe(onSync);
  }, [onSync]);
}
