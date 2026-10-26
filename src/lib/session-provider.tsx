import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSession, type PublicUser } from "./auth";
import { SessionContext } from "./session-context";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSession()
      .then(({ user: sessionUser, providers }) => {
        if (active) {
          setUser(sessionUser);
          setGoogleEnabled(providers?.google === true);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, googleEnabled, loading, setUser }),
    [googleEnabled, loading, user],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
