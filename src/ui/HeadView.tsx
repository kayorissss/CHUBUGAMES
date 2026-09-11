import { useEffect, useRef } from "react";
import type { Friend } from "../core/types";
import { drawHead } from "../core/head";
import { readGamble, type SkinKind } from "../core/gamble";

/**
 * Рисует надетые в казино украшения поверх головы.
 *
 * Долг из прошлого пакета: купленные предметы «надевались» в казино
 * (g.equipped), но на герое НИКОГДА не появлялись — надеть можно было,
 * а увидеть нельзя. Теперь шапки, очки, цепи, ауры и питомцы рисуются
 * прямо на голове, тем же канвасом, что и сама голова.
 */
function drawEquipped(
  ctx: CanvasRenderingContext2D,
  eq: Partial<Record<SkinKind, string>>,
  cx: number,
  cy: number,
  r: number,
) {
  const top = cy - r * 1.02;

  // АУРА — рисуем первой, она за головой
  if (eq.aura) {
    const colors: Record<string, [string, string]> = {
      aura_smoke: ["rgba(150,150,170,0.42)", "rgba(150,150,170,0)"],
      aura_fire: ["rgba(255,140,40,0.55)", "rgba(255,60,0,0)"],
      aura_ice: ["rgba(120,210,255,0.55)", "rgba(60,140,255,0)"],
      aura_rgb: ["rgba(255,80,200,0.55)", "rgba(80,200,255,0)"],
    };
    const [c0, c1] = colors[eq.aura] || colors.aura_smoke;
    const gr = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.7);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ЦЕПЬ — под подбородком
  if (eq.chain) {
    const gold = eq.chain === "chain_gold";
    ctx.strokeStyle = gold ? "#f0c04a" : "#c8ccd6";
    ctx.lineWidth = gold ? r * 0.13 : r * 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.72, r * 0.66, 0.32, Math.PI - 0.32);
    ctx.stroke();
    if (gold) {
      ctx.fillStyle = "#f0c04a";
      ctx.beginPath();
      ctx.arc(cx, cy + r * 1.34, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ОЧКИ — на линии глаз
  if (eq.glasses) {
    const ey = cy - r * 0.1;
    const rr = r * 0.3;
    const dx = r * 0.38;
    if (eq.glasses === "glass_vr") {
      ctx.fillStyle = "#22252e";
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.82, ey - r * 0.3, r * 1.64, r * 0.62, r * 0.16);
      ctx.fill();
      ctx.fillStyle = "#4aa3ff";
      ctx.fillRect(cx - r * 0.66, ey - r * 0.14, r * 1.32, r * 0.1);
    } else if (eq.glasses === "glass_deal") {
      ctx.fillStyle = "#0d0d12";
      ctx.fillRect(cx - r * 0.86, ey - r * 0.22, r * 1.72, r * 0.42);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - r * 0.7, ey - r * 0.1, r * 0.2, r * 0.14);
    } else {
      ctx.strokeStyle = "#1d1d24";
      ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.arc(cx - dx, ey, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + dx, ey, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - dx + rr, ey); ctx.lineTo(cx + dx - rr, ey);
      ctx.stroke();
    }
  }

  // ШАПКИ И КОРОНЫ — на макушке
  if (eq.hat) {
    const hw = r * 1.12;
    switch (eq.hat) {
      case "cap_black":
      case "cap_red": {
        const col = eq.hat === "cap_red" ? "#d8362f" : "#22242c";
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, top + r * 0.16, hw * 0.82, Math.PI, 0);
        ctx.fill();
        // козырёк назад
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(cx - hw * 1.12, top + r * 0.05, hw * 0.42, r * 0.2, r * 0.08);
        ctx.fill();
        break;
      }
      case "beanie":
        ctx.fillStyle = "#3e6bd8";
        ctx.beginPath();
        ctx.arc(cx, top + r * 0.2, hw * 0.84, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#2c4fa8";
        ctx.fillRect(cx - hw * 0.84, top + r * 0.14, hw * 1.68, r * 0.2);
        ctx.beginPath();
        ctx.arc(cx, top - r * 0.5, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "bucket":
        ctx.fillStyle = "#7a8b5a";
        ctx.beginPath();
        ctx.arc(cx, top + r * 0.24, hw * 0.7, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, top + r * 0.26, hw * 1.05, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "helmet":
        ctx.fillStyle = "#f2b224";
        ctx.beginPath();
        ctx.arc(cx, top + r * 0.22, hw * 0.8, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#d99a15";
        ctx.beginPath();
        ctx.ellipse(cx, top + r * 0.24, hw * 1.0, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "crown_plast":
      case "crown_gold": {
        const gold = eq.hat === "crown_gold";
        ctx.fillStyle = gold ? "#ffd34a" : "#c9ccd4";
        ctx.beginPath();
        const bw = hw * 0.86, by = top + r * 0.16;
        ctx.moveTo(cx - bw, by);
        ctx.lineTo(cx - bw, by - r * 0.34);
        ctx.lineTo(cx - bw * 0.5, by - r * 0.08);
        ctx.lineTo(cx, by - r * 0.46);
        ctx.lineTo(cx + bw * 0.5, by - r * 0.08);
        ctx.lineTo(cx + bw, by - r * 0.34);
        ctx.lineTo(cx + bw, by);
        ctx.closePath();
        ctx.fill();
        if (gold) {
          ctx.fillStyle = "#ff5f7a";
          ctx.beginPath();
          ctx.arc(cx, by - r * 0.1, r * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  // ПИТОМЕЦ — сидит сбоку у щеки
  if (eq.pet) {
    const px = cx + r * 1.15, py = cy + r * 0.55;
    if (eq.pet === "pet_burger") {
      ctx.fillStyle = "#e8a33d";
      ctx.beginPath();
      ctx.arc(px, py - r * 0.1, r * 0.26, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#7a4a28";
      ctx.fillRect(px - r * 0.26, py - r * 0.1, r * 0.52, r * 0.12);
      ctx.fillStyle = "#e8a33d";
      ctx.beginPath();
      ctx.roundRect(px - r * 0.26, py + r * 0.02, r * 0.52, r * 0.16, r * 0.07);
      ctx.fill();
    } else {
      // мини-Чубуков
      ctx.fillStyle = "#f2c9a0";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1d1d24";
      ctx.beginPath(); ctx.arc(px - r * 0.09, py - r * 0.03, r * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + r * 0.09, py - r * 0.03, r * 0.045, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export default function HeadView({
  friend, size = 72, className = "", style, mouth = 0.1, round = true, gear = false,
}: {
  friend: Friend; size?: number; className?: string;
  style?: React.CSSProperties; mouth?: number; round?: boolean;
  /** Показывать надетые в казино украшения (только для героя) */
  gear?: boolean;
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
    // с украшениями голову рисуем чуть меньше, чтобы шапка влезла в кадр
    const r = size * (gear ? 0.3 : 0.35);
    const cy = size * (gear ? 0.58 : 0.54);
    if (gear) {
      const eq = readGamble().equipped;
      // аура рисуется под головой
      if (eq.aura) drawEquipped(ctx, { aura: eq.aura }, size / 2, cy, r);
      drawHead(ctx, friend.look, size / 2, cy, r, { mouth, blink: 0 });
      drawEquipped(ctx, { ...eq, aura: undefined }, size / 2, cy, r);
    } else {
      drawHead(ctx, friend.look, size / 2, cy, r, { mouth, blink: 0 });
    }
  }, [friend, size, mouth, gear]);

  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: round ? "50%" : "var(--r-md)",
    objectFit: "cover", display: "block", ...style,
  };

  if (friend.photo) {
    return <img src={friend.photo} alt={friend.name} className={className} style={common} draggable={false} />;
  }
  return <canvas ref={ref} className={className} style={common} />;
}
