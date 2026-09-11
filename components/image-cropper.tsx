"use client";

import { useEffect, useRef, useState } from "react";

// Minimal, dependency-free drag-to-reposition + zoom-slider cropper — Angel:
// "allow us to crop a photo." Renders a circular viewport (matching every
// avatar this app shows a photo in), always crops to a square so
// object-fit:cover + border-radius:50% downstream looks right no matter
// what shape the original photo was. Output is a single square JPEG blob
// drawn from the natural-resolution image, not the on-screen preview, so
// quality doesn't depend on viewport size.
export function ImageCropper({
  imageUrl,
  onCancel,
  onCropped,
  size = 220,
  outputSize = 512,
}: {
  imageUrl: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  size?: number;
  outputSize?: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const baseScale = natural ? Math.max(size / natural.w, size / natural.h) : 1;
  const scale = baseScale * zoom;
  const displayedW = natural ? natural.w * scale : size;
  const displayedH = natural ? natural.h * scale : size;

  function clamp(o: { x: number; y: number }, dW: number, dH: number) {
    const minX = size - dW;
    const minY = size - dH;
    return { x: Math.min(0, Math.max(minX, o.x)), y: Math.min(0, Math.max(minY, o.y)) };
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }

  // Center the image the first time we know its size.
  useEffect(() => {
    if (!natural) return;
    const dW = natural.w * baseScale;
    const dH = natural.h * baseScale;
    setOffset(clamp({ x: (size - dW) / 2, y: (size - dH) / 2 }, dW, dH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  // Re-clamp whenever zoom changes so the image never reveals empty space.
  useEffect(() => {
    setOffset((o) => clamp(o, displayedW, displayedH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(clientX: number, clientY: number) {
      if (!dragStartRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      setOffset(clamp({ x: dragStartRef.current.offX + dx, y: dragStartRef.current.offY + dy }, displayedW, displayedH));
    }
    function onMouseMove(e: MouseEvent) {
      onMove(e.clientX, e.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (t) {
        e.preventDefault();
        onMove(t.clientX, t.clientY);
      }
    }
    function endDrag() {
      setDragging(false);
      dragStartRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", endDrag);
    };
  }, [dragging, displayedW, displayedH]);

  function startDrag(clientX: number, clientY: number) {
    dragStartRef.current = { x: clientX, y: clientY, offX: offset.x, offY: offset.y };
    setDragging(true);
  }

  function handleSave() {
    if (!natural || !imgRef.current) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }
    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    const srcSize = size / scale;
    ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onCropped(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          position: "relative",
          background: "#eee",
          border: "2px solid var(--brand-primary)",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) startDrag(t.clientX, t.clientY);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          onLoad={handleImgLoad}
          draggable={false}
          style={{
            position: "absolute",
            left: offset.x,
            top: offset.y,
            width: displayedW || size,
            height: displayedH || size,
            maxWidth: "none",
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: size }}>
        <span style={{ fontSize: 11, color: "#888" }}>Zoom</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
      </div>
      <p style={{ fontSize: 11, color: "#999", margin: 0, maxWidth: size }}>Drag to reposition, use the slider to zoom in.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !natural}
          style={{ fontSize: 12.5, fontWeight: 700, color: "white", background: "var(--brand-primary)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save Photo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{ fontSize: 12.5, fontWeight: 600, color: "#666", background: "none", border: "none", padding: "8px 4px", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
