import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { PublicUser } from "./auth";

export type SessionContextValue = {
  user: PublicUser | null;
  loading: boolean;
  setUser: Dispatch<SetStateAction<PublicUser | null>>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }
  return context;
}
