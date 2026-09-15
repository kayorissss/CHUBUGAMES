import io

# 1) sfx.lock -> sfx.tap
p = 'src/pages/Casino.tsx'
s = io.open(p, encoding='utf-8').read()
a = '''    sfx.lock ? sfx.lock() : sfx.click();'''
assert a in s, 'sfx lock'
s = s.replace(a, '''    sfx.tap();''', 1)

# 2) hide-sm на второстепенных столбцах
pairs = [
  ('<span className="pc-stuff-th">{tr("КУДА")}</span>', '<span className="pc-stuff-th hide-sm">{tr("КУДА")}</span>'),
  ('<span className="pc-stuff-th">{tr("ЦЕННОСТЬ")}</span>', '<span className="pc-stuff-th hide-sm">{tr("ЦЕННОСТЬ")}</span>'),
  ('<span className="pc-stuff-th">{tr("ПРОДАТЬ ЗА")}</span>', '<span className="pc-stuff-th hide-sm">{tr("ПРОДАТЬ ЗА")}</span>'),
  ('<span className="pc-stuff-td pc-stuff-td-kind">{ITEM_KIND_LABEL[it.kind]}</span>',
   '<span className="pc-stuff-td pc-stuff-td-kind hide-sm">{ITEM_KIND_LABEL[it.kind]}</span>'),
  ('<span className="pc-stuff-td pc-stuff-td-num t-num">{fmt(it.value)}</span>',
   '<span className="pc-stuff-td pc-stuff-td-num t-num hide-sm">{fmt(it.value)}</span>'),
]
for old, new in pairs:
    assert old in s, 'pair: ' + old[:40]
    s = s.replace(old, new, 1)

# заголовок «РЕДКОСТЬ» тоже прячем на мобильном: он в .map по массиву, поэтому
# класс добавим прямо в данных
s = s.replace('''              ["rarity", tr("РЕДКОСТЬ")],''', '''              ["rarity", tr("РЕДКОСТЬ")],''', 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('ok jsx')

# 3) CSS таблицы вещей
p2 = 'src/index.css'
c = io.open(p2, encoding='utf-8').read()
CSS = '''

/* ---------- ВЕЩИ 1.28: таблица, страницы, замки, продажа пачкой ----------
   Просьба: «вещи — список на весь экран, продавай по одной». Теперь таблица
   с сортировкой, постранично, с мультивыбором, «продажа за …» отдельным
   столбцом и подтверждением; замок запрещает продажу. */
.pc-stuff-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.pc-stuff-bulk { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.pc-stuff-bulk b { margin-left: 3px; }
.pc-stuff-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--btn-bg);
  border: 1px solid var(--btn-brd);
  color: var(--text-dim);
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.16s, border-color 0.16s;
}
.pc-stuff-sort:hover { color: var(--acc); border-color: var(--acc); }
.pc-stuff-pager { display: inline-flex; align-items: center; gap: 5px; color: var(--text-mute); font-size: 10px; }
.pc-stuff-pager-btn {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--surface-brd);
  color: var(--text-dim);
  cursor: pointer;
}
.pc-stuff-pager-btn:disabled { opacity: 0.4; cursor: default; }
.pc-stuff-table { display: flex; flex-direction: column; }
.pc-stuff-tr {
  display: grid;
  grid-template-columns: 26px minmax(0, 1.7fr) minmax(0, 0.9fr) minmax(0, 0.9fr) 44px 60px 60px minmax(0, 1fr);
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--surface-brd);
  transition: background 0.14s;
}
.pc-stuff-tr:last-child { border-bottom: 0; }
.pc-stuff-tr:hover { background: color-mix(in srgb, var(--n-000) 26%, transparent); }
.pc-stuff-tr.sel { background: color-mix(in srgb, var(--acc) 10%, transparent); }
.pc-stuff-tr.worn { box-shadow: inset 2px 0 0 var(--rc); }
.pc-stuff-thead { background: var(--surface-2); }
.pc-stuff-thead:hover { background: var(--surface-2); }
.pc-stuff-th {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.53rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--text-mute);
  text-align: left;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.pc-stuff-th.on { color: var(--acc); }
.pc-stuff-td { min-width: 0; font-size: 0.7rem; color: var(--text-dim); }
.pc-stuff-td-chk { display: flex; justify-content: center; }
.pc-stuff-check {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--surface-brd);
  color: transparent;
  cursor: pointer;
}
.pc-stuff-check.on { background: var(--acc); border-color: var(--acc); color: var(--acc-ink); }
.pc-stuff-check:disabled { opacity: 0.35; cursor: default; }
.pc-stuff-td-name { display: flex; }
.pc-stuff-ico {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: var(--r-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--rc);
}
.pc-stuff-worn {
  flex: 0 0 auto;
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--acc-ink);
  background: var(--acc);
  border-radius: 999px;
  padding: 1px 5px;
}
.pc-stuff-td-rar { font-weight: 700; }
.pc-stuff-td-num { text-align: right; }
.pc-stuff-sellnum { color: var(--text); font-weight: 700; }
.pc-stuff-td-act { display: flex; align-items: center; gap: 0.3rem; justify-content: flex-end; flex-wrap: wrap; }
.pc-stuff-lock {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--surface-brd);
  color: var(--text-mute);
  cursor: pointer;
}
.pc-stuff-lock.on {
  color: var(--gold);
  border-color: var(--gold-brd);
  background: color-mix(in srgb, var(--gold) 14%, transparent);
}
.pc-stuff-abtn {
  padding: 5px 8px;
  border-radius: var(--r-sm);
  background: var(--btn-bg);
  border: 1px solid var(--btn-brd);
  color: var(--text-dim);
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 0.16s, border-color 0.16s;
}
.pc-stuff-abtn:hover { color: var(--acc); border-color: var(--acc); }
.pc-stuff-abtn.sell:hover { color: var(--danger); border-color: var(--danger); }
.pc-stuff-abtn:disabled { opacity: 0.4; cursor: default; }
.pc-stuff-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.45rem 0.7rem;
  background: var(--surface-2);
  border-top: 1px solid var(--surface-brd);
  color: var(--text-mute);
  line-height: 1.4;
}
.pc-stuff-confirm {
  width: min(30rem, 92vw);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--surface-brd);
  box-shadow: var(--sh-lg);
}
.pc-stuff-confirm-sum { font-size: 1.55rem; line-height: 1.1; }
.pc-stuff-confirm-list {
  display: grid;
  gap: 2px;
  max-height: min(30vh, 15rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}
.pc-stuff-confirm-list span {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  font-size: 0.66rem;
  color: var(--text-dim);
  padding: 3px 5px;
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--n-000) 26%, transparent);
  box-shadow: inset 2px 0 0 var(--rc);
}
.pc-stuff-confirm-list b { color: var(--text); }
.pc-stuff-confirm-list i { font-style: normal; color: var(--acc); font-weight: 700; }
/* на телефоне таблица сжимается до «вещь + actions»: второстепенные столбцы
   всё равно не прочитать в восемь колонок на 360 px */
@media (max-width: 56rem) {
  .pc-stuff-tr { grid-template-columns: 24px minmax(0, 1fr) minmax(0, 1fr); }
  .pc-stuff-td.hide-sm, .pc-stuff-th.hide-sm { display: none; }
  .pc-stuff-td-act { flex-wrap: nowrap; }
}
'''
c = c + CSS
io.open(p2, 'w', encoding='utf-8').write(c)
print('ok css')
