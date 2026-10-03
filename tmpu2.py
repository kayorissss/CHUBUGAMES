import io

p = 'src/index.css'
c = io.open(p, encoding='utf-8').read()
CSS = '''

/* ---------- АПГРЕЙД 1.28: мультивыбор в ставку ---------- */
.pc-up-pickhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 9px;
}
.pc-up-pickall {
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--btn-bg);
  border: 1px solid var(--btn-brd);
  color: var(--text-mute);
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.16s, border-color 0.16s;
}
.pc-up-pickall:hover { color: var(--acc); border-color: var(--acc); }
.pc-up-pickall:disabled { opacity: 0.4; cursor: default; }
.pc-up-tick {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--btn-brd);
  color: transparent;
}
.pc-up-tick.on { background: var(--acc); border-color: var(--acc); color: var(--acc-ink); }
.pc-up-more {
  color: var(--text-mute);
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--surface-2);
}
'''
c = c + CSS
io.open(p, 'w', encoding='utf-8').write(c)
print('upgrade css added')
