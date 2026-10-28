import { type ClientMessage, type ServerMessage, type WorldStateDto, WS_PATH } from "@openvtt/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "./components/ui/toast";
import { reconnectDelay } from "./lib/backoff";

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

  const { t } = useTranslation();
  const translate = useRef(t);
  translate.current = t;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;
    let lostConnection = false;

    const connect = () => {
      clearTimeout(timer);
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${scheme}://${location.host}${WS_PATH}?world=${encodeURIComponent(worldId)}`);
      socketRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
        if (lostConnection) {
          lostConnection = false;
          toast({ title: translate.current("table.reconnected"), tone: "success" });
        }
      };
      socket.onmessage = (event) => dispatch(JSON.parse(event.data) as ServerMessage);
      socket.onclose = () => {
        setConnected(false);
        lostConnection = true;
        if (!disposed) timer = setTimeout(connect, reconnectDelay(attempt++));
      };
    };
    connect();

    // Coming back online is a better signal than waiting out the timer.
    const retryNow = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;
      attempt = 0;
      connect();
    };
    window.addEventListener("online", retryNow);

    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("online", retryNow);
      socketRef.current?.close();
    };
  }, [worldId]);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(message));
  }, []);

  return { state, connected, send };
}
