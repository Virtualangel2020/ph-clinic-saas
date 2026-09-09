"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared state machine behind the MyCareDesk loading system
// (components/loading/*). One hook, reused by LoadingButton, UploadProgress,
// and any page that runs a genuinely blocking async action (checkout,
// report generation, etc.) instead of each spot hand-rolling its own
// pending/error/timeout bookkeeping.
//
// States: idle -> loading -> (slow) -> success | error
//   - "slow" fires after `slowAfterMs` if the action is still running, so a
//     page can swap in "This is taking a little longer than usual." (spec
//     §9) without a separate timer of its own.
//   - `minLoadingMs` guards against flicker (spec §13): if the action
//     resolves faster than this, the loading state is still held for the
//     remainder so a spinner never flashes for a single frame.
//   - `successHoldMs` auto-reverts a success flash back to idle so a
//     "Saved ✓" doesn't stay on screen forever (spec §7).
//   - A request id guards against a stale run's timers/setState firing
//     after a newer run started, or after the component unmounted.

export type AsyncStatus = "idle" | "loading" | "slow" | "success" | "error";

export interface UseAsyncStatusOptions {
  slowAfterMs?: number;
  minLoadingMs?: number;
  successHoldMs?: number;
}

export function useAsyncStatus<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  { slowAfterMs = 8000, minLoadingMs = 300, successHoldMs = 1500 }: UseAsyncStatusOptions = {}
) {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const reset = useCallback(() => {
    requestId.current += 1;
    setStatus("idle");
    setError(null);
  }, []);

  const run = useCallback(
    async (...args: Args) => {
      const id = ++requestId.current;
      const startedAt = Date.now();
      setError(null);
      setStatus("loading");

      const slowTimer = setTimeout(() => {
        if (mounted.current && requestId.current === id) setStatus("slow");
      }, slowAfterMs);

      try {
        const result = await fnRef.current(...args);
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minLoadingMs - elapsed);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        clearTimeout(slowTimer);
        if (!mounted.current || requestId.current !== id) return result;
        setStatus("success");
        setTimeout(() => {
          if (mounted.current && requestId.current === id) setStatus("idle");
        }, successHoldMs);
        return result;
      } catch (err) {
        clearTimeout(slowTimer);
        if (!mounted.current || requestId.current !== id) throw err;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        throw err;
      }
    },
    [slowAfterMs, minLoadingMs, successHoldMs]
  );

  return { status, error, run, reset, isLoading: status === "loading" || status === "slow" };
}
