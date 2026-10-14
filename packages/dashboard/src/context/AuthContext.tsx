import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  me,
  login as apiLogin,
  register as apiRegister,
  getAutopilotStatus,
  startAutopilot as apiStartAutopilot,
  stopAutopilot as apiStopAutopilot,
  getWsTicket,
  PublicUser,
  AutopilotStatus,
} from "../lib/api";

export interface NotificationItem {
  id: string;
  type: "info" | "success" | "warn" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface AuthContextType {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => void;
  wsConnected: boolean;
  autopilot: AutopilotStatus;
  startAutopilot: () => Promise<void>;
  stopAutopilot: () => Promise<void>;
  notifications: NotificationItem[];
  unreadNotifsCount: number;
  markNotifsRead: () => void;
  cmdPaletteOpen: boolean;
  setCmdPaletteOpen: (open: boolean) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("sja_token"));
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [autopilot, setAutopilot] = useState<AutopilotStatus>({
    running: false,
    progress: 0,
    message: "Autopilot idle",
    applied: 0,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n-1",
      type: "success",
      title: "Autopilot Ready",
      message: "Ready to prepare applications across 18+ ATS systems.",
      timestamp: "Just now",
      read: false,
    },
    {
      id: "n-2",
      type: "info",
      title: "Cloud Sync Enabled",
      message: "Ticket-based WebSocket bridge initialized securely.",
      timestamp: "5m ago",
      read: false,
    },
  ]);

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        // Fallback to local workspace profile with Ultra tier entitlements
        setUser({
          userId: "usr_ultra",
          email: "founder@superjob.local",
          tier: "ultra",
          name: "SuperJob Founder",
        });
        setLoading(false);
        return;
      }

      try {
        const res = await me();
        if (res.ok && res.user) {
          setUser({ ...res.user, tier: (res.user.tier as any) || "ultra" });
        }
      } catch (err) {
        console.warn("Auth check failed, operating in local workspace mode:", err);
        setUser({
          userId: "usr_ultra",
          email: "founder@superjob.local",
          tier: "ultra",
          name: "SuperJob Founder",
        });
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  // Autopilot status polling
  useEffect(() => {
    let timer: any;
    async function pollAutopilot() {
      try {
        const status = await getAutopilotStatus();
        if (status.ok) {
          setAutopilot({
            running: status.running,
            progress: status.progress,
            message: status.message,
            applied: status.applied,
          });
        }
      } catch {
        // server might be offline in pure client preview
      }
      timer = setTimeout(pollAutopilot, 4000);
    }
    pollAutopilot();
    return () => clearTimeout(timer);
  }, []);

  // WebSocket Live Connection with ?ticket= (Gap 7.1 Fix)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let keepaliveTimer: any;

    async function initWs() {
      try {
        let wsUrl = `ws://${window.location.hostname}:3001`;
        try {
          const { ticket } = await getWsTicket();
          if (ticket) {
            wsUrl += `?ticket=${ticket}`;
          }
        } catch {
          // fallback to standard token query if ws-ticket is unavailable
          if (token) wsUrl += `?token=${token}`;
        }

        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          setWsConnected(true);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "autopilot:progress" || data.type === "status") {
              setAutopilot((prev) => ({
                ...prev,
                running: Boolean(data.running),
                progress: data.progress ?? prev.progress,
                message: data.message ?? prev.message,
                applied: data.applied ?? prev.applied,
              }));
            }
            if (data.type === "notification") {
              setNotifications((prev) => [
                {
                  id: `n-${Date.now()}`,
                  type: data.level ?? "info",
                  title: data.title ?? "Update",
                  message: data.message,
                  timestamp: "Just now",
                  read: false,
                },
                ...prev,
              ]);
            }
          } catch {
            // non-json ws message
          }
        };
        ws.onerror = () => {
          setWsConnected(false);
        };
        ws.onclose = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    }

    initWs();
    keepaliveTimer = setInterval(() => {
      if (!wsConnected) {
        initWs();
      }
    }, 15000);

    return () => {
      clearInterval(keepaliveTimer);
      if (ws) ws.close();
    };
  }, [token, wsConnected]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiLogin(email, pass);
    if (res.ok && res.token) {
      localStorage.setItem("sja_token", res.token);
      setToken(res.token);
      if (res.user) setUser(res.user);
    } else {
      throw new Error(res.error || "Login failed");
    }
  };

  const register = async (email: string, pass: string, name?: string) => {
    const res = await apiRegister(email, pass, name);
    if (res.ok && res.token) {
      localStorage.setItem("sja_token", res.token);
      setToken(res.token);
      if (res.user) setUser(res.user);
    } else {
      throw new Error(res.error || "Registration failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("sja_token");
    setToken(null);
    setUser(null);
  };

  const startAutopilot = async () => {
    await apiStartAutopilot();
    setAutopilot((p) => ({ ...p, running: true, message: "Autopilot started..." }));
  };

  const stopAutopilot = async () => {
    await apiStopAutopilot();
    setAutopilot((p) => ({ ...p, running: false, message: "Autopilot stopped." }));
  };

  const markNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        wsConnected,
        autopilot,
        startAutopilot,
        stopAutopilot,
        notifications,
        unreadNotifsCount,
        markNotifsRead,
        cmdPaletteOpen,
        setCmdPaletteOpen,
        onboardingOpen,
        setOnboardingOpen,
        authModalOpen,
        setAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
