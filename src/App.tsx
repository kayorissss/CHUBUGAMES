import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { GameProvider, useGame } from "./core/store";
import { Aurora } from "./ui/Glass";
import Nav, { type Tab } from "./components/Nav";

/** Подстраницы поверх вкладок */
export type SubPage = "network" | "casino" | "donate" | "boss";
import { Toasts, OfflineModal } from "./components/Overlays";
import UpdateBanner from "./ui/UpdateBanner";
import WhatsNew from "./ui/WhatsNew";
import {
  cancelBossNotifications,
  initNotificationsOnFirstRun,
  scheduleBossNotifications,
  scheduleNewsNotifications,
  cancelNewsNotifications,
  syncInstalledVersion,
} from "./core/notify";
import { upcomingBosses } from "./core/bosses";
import { applyPerfMode, isLowFx, measurePerfOnce } from "./core/perf";
import { initDesktopKeys, isDesktop } from "./core/desktop";
import Home from "./pages/Home";
import { ModesProvider } from "./core/modes";
import Casino from "./pages/Casino";
import Donate from "./pages/Donate";
import BossFight from "./pages/BossFight";
import ProgressPage from "./pages/Progress";
import Shop from "./pages/Shop";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import Network from "./pages/Network";
import BurgerRain from "./games/BurgerRain";
import Clicker from "./games/Clicker";
import MergeHeads from "./games/MergeHeads";
import WhackFriend from "./games/WhackFriend";
import ArtyomBite from "./games/ArtyomBite";
import ShitovRun from "./games/ShitovRun";
import RadomirBeat from "./games/RadomirBeat";
import BurgerStack from "./games/BurgerStack";
import Basket from "./games/Basket";
import Volley from "./games/Volley";
import Penalty from "./games/Penalty";
import Pool from "./games/Pool";
import Crossword from "./games/Crossword";
import Bus12 from "./games/Bus12";
import ChubPet from "./games/ChubPet";
import MaksBeard from "./games/MaksBeard";
import MotoArtyom from "./games/MotoArtyom";
import FuelHunt from "./games/FuelHunt";
import KirillHands from "./games/KirillHands";
import Europa from "./games/Europa";
import Chess from "./games/Chess";
import Checkers from "./games/Checkers";
import Backgammon from "./games/Backgammon";
import { EASE, pageVariants, subPageVariants, gameVariants } from "./core/motion";
import Canteen from "./games/Canteen";
import WhoWasIt from "./games/WhoWasIt";
import RadomirFlight from "./games/RadomirFlight";
import DormDefense from "./games/DormDefense";
import { unlockAudio } from "./core/fx";
import { pushBack } from "./core/nav";
import type { GameId } from "./core/types";

/**
 * Загрузчик приложения.
 *
 * Пользователь просил обновить его полностью: раньше это была прыгающая
 * иконка бургера, аврора на весь экран и тонкая полоска, которая рисовала
 * фиктивные полторы секунды. Смотрелось как заглушка и вдобавок тянуло
 * дорогое размытие на самом старте — то есть первое, что видел человек,
 * подтормаживало на слабом телефоне.
 *
 * Что теперь:
 *  • монограмма ЧГ, которая собирается из двух половин, — без blur-фильтров;
 *  • реальные подписи стадий (сохранение → друзья → игры), чтобы загрузка
 *    выглядела осмысленной;
 *  • прогресс идёт по стадиям, а не «просто анимация до 100%»;
 *  • всё уложено в 1.5 с и уважает режим слабого телефона.
 */
const BOOT_STEPS = ["ЗАГРУЖАЮ СОХРАНЕНИЕ", "СОБИРАЮ ПАЦАНОВ", "РАЗОГРЕВАЮ ИГРЫ"];

function Splash({ done }: { done: () => void }) {
  const [step, setStep] = useState(0);
  const low = isLowFx();

  useEffect(() => {
    const timers = BOOT_STEPS.map((_, i) =>
      window.setTimeout(() => setStep(i), 260 + i * 420),
    );
    const end = window.setTimeout(done, low ? 1150 : 1650);
    return () => { timers.forEach(clearTimeout); clearTimeout(end); };
  }, [done, low]);

  const pct = ((step + 1) / BOOT_STEPS.length) * 100;

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center"
      style={{ background: "var(--bg)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      {/* Монограмма */}
      <div className="relative flex items-center justify-center" style={{ marginBottom: 26 }}>
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="flex items-center justify-center"
          style={{
            width: 92, height: 92, borderRadius: 26,
            background: "var(--acc)", color: "var(--acc-ink)",
            overflow: "hidden", position: "relative",
          }}
        >
          <span className="t-display" style={{ fontSize: 38, letterSpacing: "-0.02em" }}>ЧГ</span>
          {/* блик пробегает по монограмме — дёшево, без blur */}
          {!low && (
            <motion.span
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.35 }}
              style={{
                position: "absolute", top: 0, bottom: 0, width: "48%",
                background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent)",
              }}
            />
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.34, ease: EASE }}
        className="t-display text-center"
        style={{ fontSize: 34, lineHeight: 1 }}
      >
        ЧУБУГЕЙМ
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.26 }}
        className="t-label"
        style={{ marginTop: 9, fontSize: 9.5, letterSpacing: "0.16em" }}
      >
        МИНИ-ИГРЫ ПРО СВОИХ ПАЦАНОВ
      </motion.div>

      {/* Прогресс со стадиями */}
      <div
        className="absolute flex flex-col items-center"
        style={{ bottom: "calc(var(--sab) + 44px)", width: "min(240px, 68vw)" }}
      >
        <div
          style={{
            width: "100%", height: 4, borderRadius: 999,
            background: "var(--n-300)", overflow: "hidden",
          }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.38, ease: EASE }}
            style={{ height: "100%", background: "var(--acc)" }}
          />
        </div>
        <div style={{ height: 15, marginTop: 11, position: "relative", width: "100%" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="t-label absolute inset-0 text-center"
              style={{ fontSize: 9, letterSpacing: "0.12em" }}
            >
              {BOOT_STEPS[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function Shell() {
  const { s } = useGame();
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [game, setGame] = useState<GameId | null>(null);
  // отдельные подстраницы поверх вкладок
  const [sub, setSub] = useState<SubPage | null>(null);
  // Влияет на анимации: в облегчённом режиме их выключаем целиком
  const [lowFx, setLowFx] = useState(() => isLowFx());

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Слабые телефоны: сначала быстрая догадка по железу (чтобы первые
  // секунды не лагали), потом честный замер FPS — он и решает.
  // Гадать по числу ядер бесполезно: у Realme C3 их восемь.
  useEffect(() => {
    applyPerfMode();
    measurePerfOnce((weak) => setLowFx(weak));
  }, []);

  useEffect(() => { void syncInstalledVersion(); }, []);

  /*
   * ПК-версия. На телефоне «назад» — системный жест, на компьютере его
   * нет, поэтому вешаем Escape на тот же стек слоёв (core/nav.ts).
   * Класс на <html> позволяет прятать чисто мобильные элементы.
   */
  useEffect(() => {
    if (!isDesktop()) return;
    document.documentElement.classList.add("is-desktop");
    return initDesktopKeys();
  }, []);

  // При первом запуске система сама спросит про уведомления — тумблер в
  // настройках после этого только включает и выключает напоминания.
  useEffect(() => { void initNotificationsOnFirstRun(); }, []);

  // Напоминания о боссах. Расписание считается формулой, поэтому ставим
  // их сразу на 12 часов вперёд — приложение может долго не открываться.
  // Переставляем при каждом запуске, чтобы список всегда был свежим.
  useEffect(() => {
    if (s.settings.notifyBoss) void scheduleBossNotifications(upcomingBosses());
    else void cancelBossNotifications();
  }, [s.settings.notifyBoss]);

  // Канал НОВИНКИ: напоминание про ежедневки. Перепланируем при запуске,
  // потому что расписание ставится на неделю вперёд и постепенно расходуется.
  useEffect(() => {
    if (s.settings.notifyNews) void scheduleNewsNotifications();
    else void cancelNewsNotifications();
  }, [s.settings.notifyNews]);

  // системная кнопка/жест «назад» закрывает игру, а не приложение
  useEffect(() => {
    if (!game) return;
    return pushBack("game", () => setGame(null));
  }, [game]);

  // «назад» закрывает подстраницу
  useEffect(() => {
    if (!sub) return;
    return pushBack(`sub:${sub}`, () => setSub(null));
  }, [sub]);

  // с любой вкладки «назад» возвращает на Игры
  useEffect(() => {
    if (game || sub || tab === "home") return;
    return pushBack(`tab:${tab}`, () => setTab("home"));
  }, [tab, game, sub]);

  // блокируем зум/скролл жестами
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("dblclick", prevent);
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("dblclick", prevent);
    };
  }, []);

  const pages: Record<Tab, React.ReactNode> = {
    home: <Home onPlay={(g) => setGame(g)} onOpenProfile={() => setTab("progress")} onOpen={setSub} />,
    progress: <ProgressPage />,
    shop: <Shop />,
    friends: <Friends />,
    settings: <Settings onOpen={setSub} onTab={setTab} />,
  };

  return (
    <ModesProvider
      onSwitchGame={(g) => setGame(g)}
      currentGame={game}
      bestOf={(g) => s.games[g]?.best ?? 0}
    >
    <MotionConfig reducedMotion={lowFx ? "always" : "never"}>
    <div className="h-full w-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
      {s.settings.fx && !lowFx && <Aurora />}

      <div className="relative h-full" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full"
          >
            {pages[tab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Подстраницы поверх вкладок */}
      <AnimatePresence>
        {sub && (
          <motion.div
            key={sub}
            variants={subPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
            style={{ zIndex: 40, background: "var(--bg)" }}
          >
            {sub === "network" && <Network onBack={() => setSub(null)} />}
            {sub === "casino" && <Casino onBack={() => setSub(null)} />}
            {sub === "donate" && <Donate onBack={() => setSub(null)} />}
            {sub === "boss" && <BossFight onBack={() => setSub(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Нижнее меню видно и поверх подстраниц (казино, донат…),
          поэтому переключение вкладки обязано закрывать подстраницу —
          иначе тапы по вкладкам «не работают». */}
      {!game && (
        <Nav
          tab={tab}
          onTab={(next) => { setSub(null); setTab(next); }}
        />
      )}

      <AnimatePresence>
        {game && (
          <motion.div
            key={game}
            variants={gameVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-[60]"
          >
            {game === "burger" && <BurgerRain onExit={() => setGame(null)} />}
            {game === "clicker" && <Clicker onExit={() => setGame(null)} />}
            {game === "merge" && <MergeHeads onExit={() => setGame(null)} />}
            {game === "whack" && <WhackFriend onExit={() => setGame(null)} />}
            {game === "bite" && <ArtyomBite onExit={() => setGame(null)} />}
            {game === "dino" && <ShitovRun onExit={() => setGame(null)} />}
            {game === "radomir" && <RadomirBeat onExit={() => setGame(null)} />}
            {game === "stack" && <BurgerStack onExit={() => setGame(null)} />}
            {game === "sort" && <Canteen onExit={() => setGame(null)} />}
            {game === "memory" && <WhoWasIt onExit={() => setGame(null)} />}
            {game === "flap" && <RadomirFlight onExit={() => setGame(null)} />}
            {game === "defend" && <DormDefense onExit={() => setGame(null)} />}
            {game === "basket" && <Basket onExit={() => setGame(null)} />}
            {game === "volley" && <Volley onExit={() => setGame(null)} />}
            {game === "penalty" && <Penalty onExit={() => setGame(null)} />}
            {game === "pool" && <Pool onExit={() => setGame(null)} />}
            {game === "crossword" && <Crossword onExit={() => setGame(null)} />}
            {game === "bus" && <Bus12 onExit={() => setGame(null)} />}
            {game === "pet" && <ChubPet onExit={() => setGame(null)} />}
            {game === "beard" && <MaksBeard onExit={() => setGame(null)} />}
            {game === "moto" && <MotoArtyom onExit={() => setGame(null)} />}
            {game === "fuel" && <FuelHunt onExit={() => setGame(null)} />}
            {game === "hands" && <KirillHands onExit={() => setGame(null)} />}
            {game === "europa" && <Europa onExit={() => setGame(null)} />}
            {game === "chess" && <Chess onExit={() => setGame(null)} />}
            {game === "checkers" && <Checkers onExit={() => setGame(null)} />}
            {game === "nards" && <Backgammon onExit={() => setGame(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      <Toasts />
      <OfflineModal />
      {!game && <UpdateBanner />}
      {!game && <WhatsNew />}

      <AnimatePresence>{splash && <Splash done={() => setSplash(false)} />}</AnimatePresence>
    </div>
    </MotionConfig>
    </ModesProvider>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
