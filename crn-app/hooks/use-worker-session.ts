import { useEffect, useState } from "react";
import {
  getWorkerUser,
  isWorkerSignedIn,
  onWorkerSessionChange,
  type WorkerSessionUser,
} from "../services/api";

interface WorkerSessionState {
  /** False until the first storage read completes. */
  ready: boolean;
  /** True when a worker session token is stored on this device. */
  isSignedIn: boolean;
  /** Display identity of the signed-in worker (null when none). */
  user: WorkerSessionUser | null;
}

const INITIAL_STATE: WorkerSessionState = {
  ready: false,
  isSignedIn: false,
  user: null,
};

/**
 * Reactive view of the on-device worker session. Re-renders on login,
 * logout, and token invalidation (see onWorkerSessionChange in services/api).
 *
 * With no worker token stored (today's production), this resolves to
 * { isSignedIn: false, user: null } and nothing new renders anywhere.
 */
export function useWorkerSession(): WorkerSessionState {
  const [state, setState] = useState<WorkerSessionState>(INITIAL_STATE);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [signedIn, user] = await Promise.all([
        isWorkerSignedIn(),
        getWorkerUser(),
      ]);
      if (mounted) {
        setState({ ready: true, isSignedIn: signedIn, user });
      }
    };

    void load();
    const unsubscribe = onWorkerSessionChange(() => void load());

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
