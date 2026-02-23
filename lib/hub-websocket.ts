type HubWebSocketPayload = {
  deviceId: string;
  commandId?: string;
  action?: string;
  command?: Record<string, unknown>;
  [key: string]: unknown;
};

type HubCommandResult = {
  status: "sent" | "failed";
  error?: string;
  commandId: string;
};

const DEFAULT_WS_PORT = "8765";
const DEFAULT_WS_PATH = "/ws";
const DEFAULT_TIMEOUT_MS = 4000;

function requiresSecureWebSocket() {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

function getPreferredWsScheme() {
  return requiresSecureWebSocket() ? "wss" : "ws";
}

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
  const scheme = getPreferredWsScheme();
  if (trimmedHost.includes("/")) {
    return `${scheme}://${trimmedHost}`;
  }
  if (trimmedHost.includes(":")) {
    return `${scheme}://${trimmedHost}${DEFAULT_WS_PATH}`;
  }
  return `${scheme}://${trimmedHost}:${DEFAULT_WS_PORT}${DEFAULT_WS_PATH}`;
}

function appendWebSocketToken(url: string) {
  const token = process.env.NEXT_PUBLIC_HUB_WS_TOKEN?.trim();
  if (!token) {
    return url;
  }
  const parsed = new URL(url);
  parsed.searchParams.set("token", token);
  return parsed.toString();
}

function assertSecureWebSocketUrl(url: string) {
  if (!requiresSecureWebSocket()) {
    return;
  }
  if (url.startsWith("ws://")) {
    throw new Error("Refusing insecure ws:// control channel in secure context");
  }
}

function createCommandId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseCommandResultMessage(data: unknown) {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (parsed.type !== "command_result") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveHubWebSocketUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_HUB_WS_URL?.trim();
  if (explicitUrl) {
    const signedUrl = appendWebSocketToken(explicitUrl);
    assertSecureWebSocketUrl(signedUrl);
    return signedUrl;
  }

  const explicitHost = process.env.NEXT_PUBLIC_HUB_WS_HOST?.trim();
  if (explicitHost) {
    const built = buildWsUrlFromHost(explicitHost);
    const signedUrl = appendWebSocketToken(built);
    assertSecureWebSocketUrl(signedUrl);
    return signedUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;
  const path = normalizePath(
    process.env.NEXT_PUBLIC_HUB_WS_PATH ?? DEFAULT_WS_PATH,
  );
  const built = `${protocol}//${hostname}:${DEFAULT_WS_PORT}${path}`;
  const signedUrl = appendWebSocketToken(built);
  assertSecureWebSocketUrl(signedUrl);
  return signedUrl;
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
    const commandId = payload.commandId?.trim() || createCommandId();
    const commandPayload: HubWebSocketPayload = {
      ...payload,
      commandId,
    };
    let settled = false;
    let opened = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        socket.close();
      } catch {
        // ignore
      }
      reject(
        new Error(
          `WebSocket command timed out (${wsUrl}). Check relay/gateway connectivity.`,
        ),
      );
    }, timeoutMs);

    socket.onopen = () => {
      opened = true;
      socket.send(JSON.stringify(commandPayload));
    };

    socket.onmessage = (event) => {
      const message = parseCommandResultMessage(event.data);
      if (!message || settled) {
        return;
      }

      const incomingCommandId =
        typeof message.commandId === "string" ? message.commandId : "";
      if (incomingCommandId && incomingCommandId !== commandId) {
        return;
      }

      settled = true;
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
      resolve({ status, error, commandId });
    };

    socket.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `WebSocket connection error (${wsUrl}). Ensure the WS relay is running and URL/token are correct.`,
        ),
      );
    };

    socket.onclose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!opened) {
        reject(
          new Error(
            `WebSocket connection closed before command was sent (${wsUrl})`,
          ),
        );
      } else {
        reject(
          new Error(
            `WebSocket closed before command result was received (${wsUrl})`,
          ),
        );
      }
    };
  });
}
