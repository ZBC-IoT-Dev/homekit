// @ts-expect-error Bun runtime module is available when running `bun run`.
import { serve } from "bun";

const DEFAULT_PORT = 8765;
const WS_PATH = "/ws";
const WELCOME_MESSAGE = JSON.stringify({ type: "welcome", path: WS_PATH });
const port = process.env.WS_PORT
  ? parseInt(process.env.WS_PORT, 10)
  : DEFAULT_PORT;

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid WS_PORT value: ${process.env.WS_PORT}`);
}

console.log(`Starting WebSocket relay server on port ${port}...`);

type RelayWebSocket = {
  send: (message: string | Buffer | Uint8Array | ArrayBuffer) => void;
};
const connectedClients = new Set<RelayWebSocket>();

function isAuthorized(url: URL) {
  const expectedToken = process.env.HUB_WS_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }
  const providedToken = url.searchParams.get("token");
  return providedToken === expectedToken;
}

function relayToPeers(
  sender: RelayWebSocket,
  message: string | Buffer | Uint8Array | ArrayBuffer,
) {
  for (const client of connectedClients) {
    if (client === sender) {
      continue;
    }
    client.send(message);
  }
}

serve({
  port,
  fetch(req: Request, server: { upgrade: (request: Request) => boolean }) {
    const url = new URL(req.url);
    if (url.pathname !== WS_PATH) {
      return new Response("Not Found", { status: 404 });
    }

    if (!isAuthorized(url)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const success = server.upgrade(req);
    if (success) {
      return undefined;
    }

    return new Response("WebSocket upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: RelayWebSocket) {
      console.log(`[WS] Client connected`);
      connectedClients.add(ws);
      ws.send(WELCOME_MESSAGE);
    },
    message(ws: RelayWebSocket, message: string | Buffer | Uint8Array | ArrayBuffer) {
      relayToPeers(ws, message);
    },
    close(ws: RelayWebSocket, code: number, message: string) {
      console.log(`[WS] Client disconnected: ${code}`);
      connectedClients.delete(ws);
    },
    error(ws: RelayWebSocket, error: unknown) {
      console.error(`[WS] Client error:`, error);
      connectedClients.delete(ws);
    },
  },
});
