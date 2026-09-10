import { useState } from "react";
import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import Icon from "./Icon";
import { CHANGELOG, type ChangeItem } from "../core/changelog";
import { APP_VERSION } from "../core/version";
import { listItem, listStagger } from "../core/motion";

/**
 * История изменений прямо в приложении.
 *
 * Раньше, чтобы узнать что нового, надо было идти на GitHub. Список версий
 * лежит в самой сборке (src/core/changelog.ts), поэтому экран работает и
 * без интернета — а именно этого пользователь и просил.
 */

/** Сортировка версий по числам: «1.9.0» должна идти ПОСЛЕ «1.10.0» */
function cmpVer(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}

export const changelogVersions = (): string[] =>
  Object.keys(CHANGELOG).sort(cmpVer);

function Row({ it }: { it: ChangeItem }) {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 11,
        padding: "11px 12px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--surface-brd)",
      }}
    >
      <span
        className={`ico-box ${it.fix ? "" : "ico-box-acc"}`}
        style={{
          width: 30,
          height: 30,
          ...(it.fix
            ? { background: "var(--ok-soft)", borderColor: "var(--ok-brd)", color: "var(--ok)" }
            : null),
        }}
      >
        <Icon name={it.icon} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-title-sm block" style={{ fontSize: 13 }}>{it.title}</span>
        <span className="t-caption block" style={{ marginTop: 3, lineHeight: 1.5 }}>
          {it.text}
        </span>
      </span>
      {it.fix && (
        <span className="tag tag-ok shrink-0" style={{ fontSize: 8.5, padding: "3px 7px" }}>
          {tr("ПОЧИНКА")}
        </span>
      )}
    </div>
  );
}

/** Полный список версий с раскрытием */
export default function ChangelogView() {
  const versions = changelogVersions();
  const [open, setOpen] = useState<string>(versions[0] ?? APP_VERSION);

  return (
    <motion.div variants={listStagger()} initial="initial" animate="animate">
      {versions.map((v) => {
        const items = CHANGELOG[v] || [];
        const isOpen = open === v;
        const current = v === APP_VERSION;
        return (
          <motion.div
            key={v}
            variants={listItem}
            style={{
              marginBottom: 10,
              borderRadius: "var(--r-lg)",
              background: "var(--surface)",
              border: `1px solid ${current ? "var(--acc-line)" : "var(--surface-brd)"}`,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? "" : v)}
              className="w-full flex items-center text-left"
              style={{ gap: 11, padding: "13px 14px" }}
            >
              <span className="t-display-sm" style={{ fontSize: 15 }}>{v}</span>
              {current && (
                <span className="tag tag-acc" style={{ fontSize: 8.5, padding: "3px 7px" }}>
                  {tr("СЕЙЧАС")}
                </span>
              )}
              <span className="flex-1" />
              <span className="t-caption shrink-0">
                {items.length} {tr("изм.")}
              </span>
              <motion.span
                className="shrink-0"
                style={{ lineHeight: 0, color: "var(--text-mute)" }}
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.18 }}
              >
                <Icon name="chevron" size={15} />
              </motion.span>
            </button>

            {isOpen && (
              <div
                className="flex flex-col"
                style={{
                  gap: 8,
                  padding: "0 12px 12px",
                }}
              >
                {items.map((it, i) => (
                  <Row key={i} it={it} />
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
