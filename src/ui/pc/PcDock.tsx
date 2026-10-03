import PcBoost from "./PcBoost";
import type { Tab } from "../../components/Nav";
import type { SubPage } from "../../App";

/**
 * ПРАВЫЙ НИЖНИЙ УГОЛ (ПК).
 *
 * Кнопки «Поддержать» и «Настройки» перенесены в верхнюю панель (PcTopBar)
 * и сделаны квадратно-скруглёнными. В правом нижнем углу живёт только
 * компактный виджет спонсорского дропа (PcBoost).
 */
export default function PcDock(_props: {
  tab?: Tab;
  sub?: SubPage | null;
  onTab?: (t: Tab) => void;
  onOpen?: (s: SubPage | null) => void;
  goTab?: (t: Tab) => void;
  openSub?: (s: SubPage | null) => void;
}) {
  return (
    <aside className="pc-dock" aria-label="Спонсорский дроп">
      <PcBoost />
    </aside>
  );
}
