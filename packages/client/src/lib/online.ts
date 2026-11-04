import { createContext, useContext } from "react";

/** Whether the table socket is open. Portaled forms (popovers, dialogs) sit outside the panel fieldset, so they read it here. */
export const OnlineContext = createContext(true);

export const useOnline = () => useContext(OnlineContext);
