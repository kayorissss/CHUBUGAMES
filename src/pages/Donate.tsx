import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon from "../ui/Icon";
import { sfx, haptic } from "../core/fx";

/** Ссылка на приём донатов */
export const DONATE_URL = "https://pay.cloudtips.ru/p/cab48a6e";
export const AUTHOR_URL = "https://t.me/kayorisan";

const PERKS = [
  { icon: "bolt",    title: tr("Новые игры"),      desc: tr("Каждое обновление — ещё режимы и механики") },
  { icon: "users",   title: tr("Больше друзей"),   desc: tr("Новые персонажи и боссы в общаге") },
  { icon: "sparkle", title: tr("Оформление"),      desc: tr("Анимации, скины, украшения") },
  { icon: "shield",  title: tr("Без рекламы"),     desc: tr("Ролики только по желанию, за награду") },
] as const;

export default function Donate({ onBack }: { onBack: () => void }) {
  const open = (url: string) => {
    sfx.click();
    haptic("light");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Screen
      title={tr("ПОДДЕРЖКА")}
      sub={tr("Проект делается для своих")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      {/* Главная плашка */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Panel
          r="xl"
          strong
          style={{
            padding: 22,
            marginBottom: 14,
            textAlign: "center",
            border: "1.5px solid rgba(255,176,32,0.45)",
            background:
              "radial-gradient(120% 90% at 50% 0%, rgba(255,176,32,0.14), transparent 70%)",
          }}
        >
          <motion.span
            className="inline-flex items-center justify-center"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 74, height: 74, borderRadius: "var(--r-lg)",
              background: "rgba(255,176,32,0.14)",
              border: "1.5px solid rgba(255,176,32,0.5)",
              color: "#FFB020",
              marginBottom: 16,
            }}
          >
            <Icon name="heart" size={34} />
          </motion.span>

          <div className="t-display" style={{ fontSize: 26, marginBottom: 8 }}>{tr("СПАСИБО")}</div>
          <div
            className="t-body"
            style={{ color: "var(--text-mute)", lineHeight: 1.6, marginBottom: 20 }}
          >
            ЧУБУГЕЙМ бесплатный и без обязательной рекламы.
            Если игра зашла — можно закинуть на развитие.
            Любая сумма помогает и мотивирует пилить дальше.
          </div>

          <Tap
            onClick={() => open(DONATE_URL)}
            accent
            r="md"
            center
            className="w-full py-4 t-title"
            style={{ fontSize: 15 }}
            sound="coin"
          >
            <span className="inline-flex items-center" style={{ gap: 9 }}>
              <Icon name="gift" size={17} />{tr("ПОДДЕРЖАТЬ ПРОЕКТ")}</span>
          </Tap>

          <div className="t-caption" style={{ marginTop: 11 }}>{tr("Откроется CloudTips — карта, СБП")}</div>
        </Panel>
      </motion.div>

      {/* На что идёт */}
      <div className="t-label" style={{ marginBottom: 9 }}>{tr("Куда пойдут деньги")}</div>
      {PERKS.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06 * i, duration: 0.25 }}
        >
          <Panel r="lg" style={{ padding: 13, marginBottom: 8 }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <span
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 38, height: 38, borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
                }}
              >
                <Icon name={p.icon as never} size={18} accent />
              </span>
              <span className="flex-1 min-w-0">
                <span className="t-title-sm block">{p.title}</span>
                <span className="t-caption block" style={{ marginTop: 2 }}>{p.desc}</span>
              </span>
            </div>
          </Panel>
        </motion.div>
      ))}

      {/* Автор */}
      <Panel r="lg" style={{ padding: 13, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => open(AUTHOR_URL)}
          className="flex items-center w-full"
          style={{ gap: 12 }}
        >
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 38, height: 38, borderRadius: "var(--r-sm)",
              background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
            }}
          >
            <Icon name="user" size={18} />
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="t-title-sm block">{tr("Написать автору")}</span>
            <span className="t-caption block" style={{ marginTop: 2 }}>{tr("идеи, баги, предложения")}</span>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      </Panel>

      <div
        className="t-caption"
        style={{ marginTop: 16, textAlign: "center", lineHeight: 1.6 }}
      >
        Поддержка добровольная и ни на что не влияет в игре —
        никаких платных преимуществ здесь нет.
      </div>
    </Screen>
  );
}
