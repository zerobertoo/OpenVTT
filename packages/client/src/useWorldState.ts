import { type ClientMessage, type ServerMessage, type WorldStateDto, WS_PATH } from "@openvtt/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 1500;
const MAX_CLIENT_MESSAGES = 300;

function reducer(state: WorldStateDto | null, msg: ServerMessage): WorldStateDto | null {
  if (msg.type === "world.state") return msg.state;
  if (!state) return state;
  switch (msg.type) {
    case "token.upsert":
      return {
        ...state,
        tokens: state.tokens.some((t) => t.id === msg.token.id)
          ? state.tokens.map((t) => (t.id === msg.token.id ? msg.token : t))
          : [...state.tokens, msg.token],
      };
    case "token.remove":
      return { ...state, tokens: state.tokens.filter((t) => t.id !== msg.tokenId) };
    case "chat.message":
      return { ...state, messages: [...state.messages, msg.message].slice(-MAX_CLIENT_MESSAGES) };
    default:
      return state;
  }
}

/**
 * Keeps a WebSocket open to the world and folds server events into one state object.
 * On every (re)connect the server sends a full snapshot, so reconnecting reconciles automatically.
 */
export function useWorldState(worldId: string) {
  const [state, dispatch] = useReducer(reducer, null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${scheme}://${location.host}${WS_PATH}?world=${encodeURIComponent(worldId)}`);
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => dispatch(JSON.parse(event.data) as ServerMessage);
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) timer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [worldId]);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
  }, []);

  return { state, connected, send };
}
