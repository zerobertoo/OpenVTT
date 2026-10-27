import { useEffect, useState } from "react";
import { WS_PATH, type ServerMessage, type WorldStateDto } from "@openvtt/shared";

const RECONNECT_DELAY_MS = 1500;

/** Keeps a WebSocket open to the world, reconnecting on loss; the server resends full state on connect. */
export function useWorldState(worldId: string) {
  const [state, setState] = useState<WorldStateDto | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${scheme}://${location.host}${WS_PATH}?world=${encodeURIComponent(worldId)}`);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "world.state") setState(msg.state);
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) timer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [worldId]);

  return { state, connected };
}
