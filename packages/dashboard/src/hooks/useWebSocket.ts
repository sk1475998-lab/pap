import { useEffect, useRef, useCallback, useState } from "react";
import { getWsTicket } from "../lib/api";

export interface LogEntry {
  type: "info" | "success" | "error" | "warn" | "progress";
  msg: string;
  ts: number;
  progress?: number;
}

export interface UseWebSocketReturn {
  connected: boolean;
  logs: LogEntry[];
  clearLogs: () => void;
  send: (data: object) => void;
}

/**
 * Connects to the SuperJobAgent WebSocket server with nonce-based auth (Gap 7.1).
 * Auto-reconnects on disconnect. Parses the SJA log event format.
 */
export function useWebSocket(enabled = true): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Get a single-use nonce ticket (Gap 7.1 secure WS auth)
      const { ticket } = await getWsTicket();
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const host = location.host;
      const ws = new WebSocket(`${protocol}//${host}?ticket=${ticket}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const entry: LogEntry = {
            type: data.type ?? "info",
            msg: data.msg ?? data.message ?? JSON.stringify(data),
            ts: data.ts ?? Date.now(),
            progress: data.progress,
          };
          setLogs((prev) => [...prev.slice(-499), entry]);
        } catch {
          setLogs((prev) => [
            ...prev.slice(-499),
            { type: "info", msg: e.data, ts: Date.now() },
          ]);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3s
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { connected, logs, clearLogs, send };
}
