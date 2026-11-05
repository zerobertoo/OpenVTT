import { type ClientMessage, type ServerMessage, type WorldStateDto, WS_PATH } from "@openvtt/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "./components/ui/toast";
import { reconnectDelay } from "./lib/backoff";
import { useTableUi } from "./tableStore";

const MAX_CLIENT_MESSAGES = 300;
const DROP_NOTICE_INTERVAL_MS = 5000;

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
    case "vision.update":
      return { ...state, vision: msg.vision };
    case "scene.drawings":
      return {
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === msg.sceneId ? { ...s, floors: s.floors.map((f) => (f.id === msg.floorId ? { ...f, drawings: msg.drawings } : f)) } : s,
        ),
      };
    case "combat.update":
      return { ...state, combat: msg.combat };
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
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        // Pings are moments, not state: they go straight to the map instead of through the reducer.
        if (message.type === "map.ping") useTableUi.getState().showPing(message.ping);
        else if (message.type === "map.effect") useTableUi.getState().showEffect(message.effect);
        // The server refused an action (locked layer, observer, bad input); say so instead of letting the change silently snap back.
        else if (message.type === "error") {
          const t = translate.current;
          toast({ title: t(`errors.${message.code}`, { defaultValue: t("errors.internal_error") }), tone: "error" });
        } else dispatch(message);
      };
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

  const lastDropNotice = useRef(0);
  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return socketRef.current.send(JSON.stringify(message));
    // A change made while offline is lost, so say so (at most every few seconds, to not bury a drag in toasts).
    if (Date.now() - lastDropNotice.current > DROP_NOTICE_INTERVAL_MS) {
      lastDropNotice.current = Date.now();
      toast({ title: translate.current("table.notSent"), tone: "error" });
    }
  }, []);

  return { state, connected, send };
}
