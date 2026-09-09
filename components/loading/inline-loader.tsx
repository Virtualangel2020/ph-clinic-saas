"use client";

// The small, local loading state (spec §3D, §12): a section of a page, a
// card mid-refresh, a dropdown populating — anywhere the fullscreen
// MyCareDeskLoader would be overkill. A small brand-colored spinner plus
// optional text, sized to sit inline with normal content.
export function InlineLoader({
  label = "Loading...",
  size = 16,
  align = "center",
}: {
  label?: string;
  size?: number;
  align?: "left" | "center";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: 8,
        padding: "10px 0",
        color: "var(--brand-text-muted, #64748b)",
        fontSize: 12.5,
      }}
    >
      <span
        className="mcd-spin"
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2px solid var(--brand-border-tint, #cfe6e6)`,
          borderTopColor: "var(--brand-secondary, #049ca0)",
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}
