"use client";

// The one branded MyCareDesk loader (spec §1-2): the real logo held
// stationary at the center, with a subtle animated ring orbiting around it
// in brand teal/blue — never the logo itself spinning. Pure CSS animation
// on a single small PNG already in the app (no GIF, no extra asset), so
// this is effectively free at runtime and safe to mount many times on one
// page (e.g. one per skeleton row is NOT what this is for — see
// InlineLoader/Skeleton for that — this is for LoadingOverlay and other
// genuinely blocking moments).
//
// Sizing is a single `size` prop rather than raw pixel props so every call
// site stays visually consistent instead of drifting to bespoke sizes.

const SIZES = {
  sm: { box: 40, ring: 3, logo: 20 },
  md: { box: 64, ring: 4, logo: 32 },
  lg: { box: 96, ring: 5, logo: 48 },
} as const;

export function MyCareDeskLoader({
  size = "md",
  label = "Loading...",
  sublabel = "Please wait.",
  showText = true,
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  sublabel?: string | null;
  showText?: boolean;
  className?: string;
}) {
  const { box, ring, logo } = SIZES[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
    >
      <div style={{ position: "relative", width: box, height: box, flexShrink: 0 }}>
        {/* Static faint track so the ring reads as a ring even mid-rotation */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${ring}px solid var(--brand-border-tint, #cfe6e6)`,
          }}
        />
        {/* The moving part — a partial arc that orbits, not the whole ring
            fading in/out, so it reads as gentle motion rather than a pulse */}
        <div
          className="mcd-spin"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `${ring}px solid transparent`,
            borderTopColor: "var(--brand-secondary, #049ca0)",
            borderRightColor: "var(--brand-primary, #0f5a8c)",
          }}
        />
        <img
          src="/logo-240.png"
          alt=""
          width={logo}
          height={logo}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: 8,
          }}
        />
      </div>
      {showText && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: size === "sm" ? 12.5 : 14, fontWeight: 600, color: "var(--brand-text, #10233d)" }}>
            {label}
          </div>
          {sublabel && (
            <div style={{ fontSize: size === "sm" ? 11 : 12.5, color: "var(--brand-text-muted, #64748b)", marginTop: 2 }}>
              {sublabel}
            </div>
          )}
        </div>
      )}
      {/* Screen-reader announcement even when showText is false (e.g. a
          button's own inline spinner already shows visible text) */}
      {!showText && <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{label}</span>}
    </div>
  );
}
