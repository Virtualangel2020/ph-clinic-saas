// Small numbered pill for unread-message counts (Customer Care, both the
// clinic's own Settings entry and the Superadmin nav tab). Renders nothing
// at 0 so it visually "goes away" once everything's been read.
export function UnreadBadge({ count, style }: { count: number; style?: React.CSSProperties }) {
  if (!count || count <= 0) return null;
  return (
    <span
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        minWidth: 20,
        height: 20,
        padding: "0 5px",
        borderRadius: 999,
        background: "#c0392b",
        color: "white",
        fontSize: 11,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        ...style,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
