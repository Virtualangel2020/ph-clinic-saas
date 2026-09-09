"use client";

import { useEffect, useRef, useState } from "react";

// The button loading state (spec §3B, §5, §7, §12-13): swap label for a
// small spinner + contextual text the instant a click is handled, disable
// the button so a second click can't fire the action twice, and — when the
// caller passes `success` — flash a brief confirmation before reverting.
//
// This app has no shared <Button> component (every page hand-rolls its own
// `<button style={{...}}>`), and its async actions already track pending
// state themselves via React's useTransition (see e.g.
// app/dashboard/calendar/appointment-form.tsx). So rather than forcing a
// rewrite, LoadingButton is a thin CONTROLLED wrapper: pass the `loading`
// boolean a page already has, and its existing inline `style` straight
// through — swapping `<button>` for `<LoadingButton>` at a call site is a
// one-line change, not a rework.
//
// `success` is edge-triggered: passing `success` from false->true shows
// successText/✓ for `successHoldMs` and then reverts on its own, so the
// caller doesn't need its own revert timer — just flip a boolean once.
export function LoadingButton({
  loading = false,
  success = false,
  disabled = false,
  loadingText = "Please wait...",
  successText,
  successHoldMs = 1500,
  children,
  style,
  className,
  onClick,
  type = "button",
  ...rest
}: {
  loading?: boolean;
  success?: boolean;
  disabled?: boolean;
  loadingText?: string;
  successText?: string;
  successHoldMs?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "style" | "className" | "onClick" | "type" | "disabled">) {
  const [showSuccess, setShowSuccess] = useState(false);
  const wasSuccess = useRef(false);

  useEffect(() => {
    if (success && !wasSuccess.current) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), successHoldMs);
      wasSuccess.current = true;
      return () => clearTimeout(t);
    }
    if (!success) wasSuccess.current = false;
  }, [success, successHoldMs]);

  const isBusy = loading;

  return (
    <button
      {...rest}
      type={type}
      onClick={onClick}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      className={className}
      style={{
        cursor: disabled || isBusy ? "default" : "pointer",
        opacity: disabled && !isBusy ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "opacity 0.15s ease",
        ...style,
      }}
    >
      {isBusy && (
        <span
          className="mcd-spin"
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 13,
            height: 13,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.45)",
            borderTopColor: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {isBusy ? loadingText : showSuccess && successText ? successText : children}
    </button>
  );
}
