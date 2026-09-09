import { useEffect, useRef } from "react";
import type { Friend } from "../core/types";
import { drawHead } from "../core/head";

export default function HeadView({
  friend, size = 72, className = "", style, mouth = 0.1, round = true,
}: {
  friend: Friend; size?: number; className?: string;
  style?: React.CSSProperties; mouth?: number; round?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (friend.photo) return;
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawHead(ctx, friend.look, size / 2, size * 0.54, size * 0.35, { mouth, blink: 0 });
  }, [friend, size, mouth]);

  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: round ? "50%" : "var(--r-md)",
    objectFit: "cover", display: "block", ...style,
  };

  if (friend.photo) {
    return <img src={friend.photo} alt={friend.name} className={className} style={common} draggable={false} />;
  }
  return <canvas ref={ref} className={className} style={common} />;
}
