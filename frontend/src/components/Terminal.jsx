import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io } from "socket.io-client";

export default function Terminal({ sandboxId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectFailedHandlerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const initTerminal = useCallback(() => {
    if (!containerRef.current || termRef.current) return null;

    const term = new XTerm({
      theme: {
        background: "#070b14",
        foreground: "#e2e8f0",
        cursor: "#22d3ee",
        cursorAccent: "#070b14",
        selectionBackground: "rgba(34,211,238,0.2)",
        black: "#1e2d45",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#a78bfa",
        cyan: "#22d3ee",
        white: "#e2e8f0",
        brightBlack: "#334155",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#c4b5fd",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("======================================");
    term.writeln("Sandbox Terminal");
    term.writeln("======================================");
    term.writeln("");
    term.writeln("Connecting to sandbox...");

    return term;
  }, []);

  const connectSocket = useCallback(
    (term) => {
      if (!sandboxId || !term) return;

      const agentHost = `${window.location.protocol}//${sandboxId}.agent.localhost`;

      try {
        const socket = io(agentHost, {
          transports: ["polling", "websocket"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 15000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          setConnected(true);
          setError(null);
          term.writeln("[ok] Connected to sandbox shell");
          term.writeln("");
        });

        socket.on("disconnect", () => {
          setConnected(false);
          term.writeln("\r\n[warn] Disconnected. Reconnecting...");
        });

        socket.on("connect_error", (err) => {
          setConnected(false);

          // Socket.IO can recover by falling back from websocket to polling.
          if (!socket.active) {
            setError("Connection failed");
            term.writeln(`\r\n[error] Connection error: ${err.message}`);
          }
        });

        socket.on("terminal-output", (data) => {
          term.write(data);
        });

        term.onData((data) => {
          socket.emit("terminal-input", data);
        });

        reconnectFailedHandlerRef.current = () => {
          setConnected(false);
          setError("Failed to reconnect");
          term.writeln("\r\n[error] Failed to reconnect to sandbox shell");
        };

        socket.io.on("reconnect_failed", reconnectFailedHandlerRef.current);
      } catch (err) {
        setError(err.message);
      }
    },
    [sandboxId],
  );

  useEffect(() => {
    const term = initTerminal();
    if (term) connectSocket(term);

    return () => {
      if (socketRef.current) {
        if (reconnectFailedHandlerRef.current) {
          socketRef.current.io.off(
            "reconnect_failed",
            reconnectFailedHandlerRef.current,
          );
          reconnectFailedHandlerRef.current = null;
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [initTerminal, connectSocket]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (_) {}
      }
    });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: "#070b14" }}>
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{
          height: "32px",
          background: "#0d1424",
          borderBottom: "1px solid #1e2d45",
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="text-xs font-medium" style={{ color: "#475569" }}>
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs" style={{ color: "#ef4444" }}>
              {error}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? "#10b981" : "#ef4444",
                boxShadow: `0 0 6px ${connected ? "#10b981" : "#ef4444"}`,
              }}
            />
            <span className="text-xs" style={{ color: "#475569" }}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
