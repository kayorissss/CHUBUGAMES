import io

p = 'src/pages/Casino.tsx'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, tag):
    global s
    assert old in s, 'NOT FOUND: ' + tag
    s = s.replace(old, new, 1)
    print('ok:', tag)


rep("""  const [armed, setArmed] = useState(false);""",
    """  const [armed, setArmed] = useState(false);
  /**
   * Шансы — по кнопке «?», а не постоянно в модалке (претензия 1.28:
   * «шансы занимают больше всего места»). Список содержимого остаётся,
   * проценты доезжают сверху.
   */
  const [odds, setOdds] = useState(false);""", 'odds state')

# правая колонка: содержимое по факту дропа (cap) + проценты только под «?»
rep("""                  <div className=\"t-label pc-case-rcap\">{tr(\"ЧТО МОЖЕТ ВЫПАСТЬ\")}</div>
                  {([\"legend\", \"epic\", \"rare\", \"common\"] as const).map((r) => {
                    const items = ITEMS.filter((i) => i.rarity === r);
                    return (
                      <div key={r} className=\"pc-case-row\" style={{ [\"--rc\" as never]: RARITY_COLOR[r] }}>
                        <span className=\"pc-case-row-pct t-num\">{(opening.odds[r] * 100).toFixed(opening.odds[r] < 0.1 ? 2 : 1)}%</span>
                        <span className=\"min-w-0\">
                          <span className=\"t-label pc-case-row-r\">{RARITY_LABEL[r]} · {items.length}</span>
                          <span className=\"pc-case-row-names\">
                            {items.slice(0, 4).map((i) => i.name).join(\" · \")}
                            {items.length > 4 ? ` · +${items.length - 4}` : \"\"}
                          </span>
                        </span>
                      </div>
                    );
                  })}""",
    """                  <div className=\"t-label pc-case-rcap\">
                    {tr(\"Что может выпасть\")}
                    <span className=\"pc-case-rcap-cap\">
                      {tr(\"до\")} <b className=\"t-num\">{fmt(opening.cap)}</b>
                    </span>
                  </div>
                  {([\"legend\", \"epic\", \"rare\", \"common\"] as const).map((r) => {
                    /* тот же фильтр, что у rollItem: список должен совпадать
                       с реальным дропом, иначе «что может выпасть» врёт */
                    const items = ITEMS.filter((i) => i.rarity === r && i.value <= opening.cap);
                    if (!items.length) return null;
                    const pct = opening.odds[r] * 100;
                    return (
                      <div key={r} className=\"pc-case-row\" style={{ [\"--rc\" as never]: RARITY_COLOR[r] }}>
                        {odds && (
                          <span className=\"pc-case-row-pct t-num\">
                            {pct.toFixed(pct < 10 ? 2 : 1)}%
                          </span>
                        )}
                        <span className=\"min-w-0\">
                          <span className=\"t-label pc-case-row-r\">
                            {RARITY_LABEL[r]} · {items.length}
                          </span>
                          <span className=\"pc-case-row-names\">
                            {items.slice(0, 4).map((i) => i.name).join(\" · \")}
                            {items.length > 4 ? ` · +${items.length - 4}` : \"\"}
                          </span>
                        </span>
                      </div>
                    );
                  })}""", 'right column')

rep("""                  <div className=\"pc-case-mid\">
                    <span className=\"t-caption\">
                      {tr(\"шанс редких растёт с удачей друга\")}""",
    """                  <div className=\"pc-case-mid\">
                    <span className=\"t-caption\">
                      {odds
                        ? tr(\"шанс редких растёт с удачей друга\")
                        : tr(\"шансы на выпадение — по «?» вверху\")}""", 'hint text')

io.open(p, 'w', encoding='utf-8').write(s)
print('WRITTEN')
