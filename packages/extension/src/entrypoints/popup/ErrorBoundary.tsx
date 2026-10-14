import React, { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("[SJA Popup ErrorBoundary caught an exception]", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetState = async (): Promise<void> => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.remove(["sja_last_tab", "sja_active_panel"]);
      }
    } catch {}
    window.location.reload();
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    const text = [
      "SuperJobAgent Extension Diagnostic Error Log",
      "Timestamp: " + new Date().toISOString(),
      "Message: " + (this.state.error?.message || "Unknown error"),
      "Stack: " + (this.state.error?.stack || ""),
      "ComponentStack: " + (this.state.errorInfo?.componentStack || ""),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {}
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            width: "380px",
            minHeight: "360px",
            padding: "20px",
            background: "#0f172a",
            color: "#f8fafc",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🛡️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                SuperJobAgent Protected
              </h2>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                A tab encountered a render issue.
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.28)",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "12px",
              color: "#fca5a5",
              lineHeight: 1.45,
            }}
          >
            <strong>Error:</strong> {this.state.error?.message || "An unexpected error occurred"}
          </div>

          {this.state.error?.stack && (
            <details style={{ fontSize: "11px", color: "#64748b" }}>
              <summary style={{ cursor: "pointer", marginBottom: "4px" }}>Technical stack trace</summary>
              <pre
                style={{
                  background: "#020617",
                  padding: "8px",
                  borderRadius: "6px",
                  overflowX: "auto",
                  maxHeight: "100px",
                  color: "#cbd5e1",
                  margin: 0,
                  fontSize: "10px",
                }}
              >
                {this.state.error.stack.slice(0, 1000)}
              </pre>
            </details>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                color: "#fff",
                fontWeight: 600,
                fontSize: "12.5px",
                cursor: "pointer",
              }}
            >
              🔄 Reload Popup
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  padding: "8px",
                  color: "#cbd5e1",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {this.state.copied ? "✓ Copied" : "📋 Copy Diagnostics"}
              </button>
              <button
                type="button"
                onClick={this.handleResetState}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  padding: "8px",
                  color: "#cbd5e1",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                ⚡ Reset State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
