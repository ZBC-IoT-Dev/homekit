type HubWebSocketPayload = {
  deviceId: string;
  action?: string;
  command?: Record<string, unknown>;
  [key: string]: unknown;
};

type HubCommandResult = {
  status: "sent" | "failed";
  error?: string;
};

const DEFAULT_WS_PORT = "8765";
const DEFAULT_WS_PATH = "/ws";
const DEFAULT_TIMEOUT_MS = 4000;

function normalizePath(path: string) {
  if (!path) return DEFAULT_WS_PATH;
  return path.startsWith("/") ? path : `/${path}`;
}

function buildWsUrlFromHost(host: string) {
  const trimmedHost = host.trim();
  if (!trimmedHost) return "";
  if (trimmedHost.startsWith("ws://") || trimmedHost.startsWith("wss://")) {
    return trimmedHost;
  }
  if (trimmedHost.includes("/")) {
    return `ws://${trimmedHost}`;
  }
  if (trimmedHost.includes(":")) {
    return `ws://${trimmedHost}${DEFAULT_WS_PATH}`;
  }
  return `ws://${trimmedHost}:${DEFAULT_WS_PORT}${DEFAULT_WS_PATH}`;
}

export function resolveHubWebSocketUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_HUB_WS_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const explicitHost = process.env.NEXT_PUBLIC_HUB_WS_HOST?.trim();
  if (explicitHost) {
    return buildWsUrlFromHost(explicitHost);
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;
  const path = normalizePath(
    process.env.NEXT_PUBLIC_HUB_WS_PATH ?? DEFAULT_WS_PATH,
  );
  return `${protocol}//${hostname}:${DEFAULT_WS_PORT}${path}`;
}

export async function sendHubWebSocketCommand(
  payload: HubWebSocketPayload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const wsUrl = resolveHubWebSocketUrl();
  if (!wsUrl) {
    throw new Error("Hub WebSocket URL not configured");
  }

  return await new Promise<HubCommandResult>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      try {
        socket.close();
      } catch {
        // ignore
      }
      reject(new Error("WebSocket command timed out"));
    }, timeoutMs);

    socket.onopen = () => {
      socket.send(JSON.stringify(payload));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.type !== "command_result") {
          return;
        }

        cleanup();
        try {
          socket.close();
        } catch {
          // ignore
        }

        const resultStatus = message.status;
        const status: HubCommandResult["status"] =
          resultStatus === "sent" ? "sent" : "failed";
        const error =
          typeof message.error === "string" && message.error.trim().length > 0
            ? message.error
            : undefined;
        resolve({ status, error });
      } catch {
        // Ignore non-JSON messages.
      }
    };

    socket.onerror = () => {
      cleanup();
      reject(new Error("WebSocket connection error"));
    };

    socket.onclose = () => {
      cleanup();
    };
  });
}
