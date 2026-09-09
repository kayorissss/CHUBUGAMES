import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameProvider, useGame } from "./core/store";
import { Aurora } from "./ui/Glass";
import Nav, { type Tab } from "./components/Nav";

/** Подстраницы поверх вкладок */
export type SubPage = "network" | "ai" | "casino" | "donate" | "boss";
import { Toasts, OfflineModal } from "./components/Overlays";
import UpdateBanner from "./ui/UpdateBanner";
import Icon from "./ui/Icon";
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
import AiPage from "./pages/AiPage";
import BurgerRain from "./games/BurgerRain";
import Clicker from "./games/Clicker";
import MergeHeads from "./games/MergeHeads";
import WhackFriend from "./games/WhackFriend";
import ArtyomBite from "./games/ArtyomBite";
import ShitovRun from "./games/ShitovRun";
import RadomirBeat from "./games/RadomirBeat";
import BurgerStack from "./games/BurgerStack";
import Canteen from "./games/Canteen";
import WhoWasIt from "./games/WhoWasIt";
import RadomirFlight from "./games/RadomirFlight";
import DormDefense from "./games/DormDefense";
import { unlockAudio } from "./core/fx";
import { pushBack } from "./core/nav";
import type { GameId } from "./core/types";

function Splash({ done }: { done: () => void }) {
  useEffect(() => {
    const t = setTimeout(done, 1750);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center"
      style={{ background: "var(--bg)" }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 0.45 }}
    >
      <Aurora />
      <motion.div
        initial={{ scale: 0.7, opacity: 0, filter: "blur(14px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="relative text-center"
      >
        <motion.div
          animate={{ y: [0, -9, 0], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
          style={{ color: "var(--acc)", display: "flex", justifyContent: "center" }}
        >
          <Icon name="burger" size={64} />
        </motion.div>
        <div
          className="t-display mt-3"
          style={{
            fontSize: 42,
            background: "linear-gradient(100deg, var(--text) 15%, var(--acc) 90%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ЧУБУГЕЙМ
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="t-label mt-2"
        >
          мини-игры про своих пацанов
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute"
        style={{ bottom: "calc(var(--sab) + 34px)", width: 120 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            style={{ height: "100%", background: "var(--acc)", boxShadow: "0 0 12px var(--acc-glow)" }}
          />
        </div>
      </motion.div>
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

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

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
    settings: <Settings onOpen={setSub} />,
  };

  return (
    <ModesProvider onSwitchGame={(g) => setGame(g)} currentGame={game}>
    <div className="h-full w-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
      {s.settings.fx && <Aurora />}

      <div className="relative h-full" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
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
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 26 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0"
            style={{ zIndex: 40, background: "var(--bg)" }}
          >
            {sub === "network" && <Network onBack={() => setSub(null)} />}
            {sub === "ai" && <AiPage onBack={() => setSub(null)} />}
            {sub === "casino" && <Casino onBack={() => setSub(null)} />}
            {sub === "donate" && <Donate onBack={() => setSub(null)} />}
            {sub === "boss" && <BossFight onBack={() => setSub(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      {!game && <Nav tab={tab} onTab={setTab} />}

      <AnimatePresence>
        {game && (
          <motion.div
            key={game}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
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
          </motion.div>
        )}
      </AnimatePresence>

      <Toasts />
      <OfflineModal />
      {!game && <UpdateBanner />}

      <AnimatePresence>{splash && <Splash done={() => setSplash(false)} />}</AnimatePresence>
    </div>
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
