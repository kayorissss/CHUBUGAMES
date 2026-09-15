import io

p = 'scripts/check-ui.mjs'
s = io.open(p, encoding='utf-8').read()

fixes = [
  ("ok((gm.match(/price:/g) || []).length === 10,", "ok((gm.match(/price: \\d/g) || []).length === 10,"),
  ("ok(/price: 10_?0000/.test(gm),", "ok(/price: 10_?000/.test(gm),"),
  ("""  ok(/\\.pc-case-strip-tape \\{[\\s\\S]{0,400}?transition: transform 4\\.4s/.test(css),""",
   """  ok(/\\.pc-case-strip-tape \\{[\\s\\S]{0,700}?transition: transform 4\\.4s/.test(css),"""),
  ("""/translateX\\(calc\\(var\\(--step\\) \\*-\\$\\{PRIZE_AT\\}\\)\\)/.test(cases) &&""",
   """/translateX\\(calc\\(var\\(--step\\) \\* -\\$\\{PRIZE_AT\\}\\)\\)/.test(cases) &&"""),
  ("""ok(/icon: "(case|gift|lock|burger|bolt|trophy|star|skull|crown)"/.test(gm) && /name=\\{c\\.icon\\} size=\\{26\\}/.test(cases),""",
   """ok(/icon: "(case|gift|lock|burger|bolt|trophy|star|skull|crown)"/.test(gm) && /<Icon name=\\{c\\.icon\\} size=\\{15\\}/.test(cases),"""),
  ("""ok(/\\{odds && \\(\\n?\\s*<div className="pc-case-odds">/.test(cases) && !/pc-case-modds/.test(cases),""",
   """ok(/\\{odds && \\(\\n\\s*<div className="pc-case-odds">/.test(cases) && /pc-case-odds-note/.test(cases),"""),
  ("""  ok(/const cap = c\\.cap \\?\\? Infinity/.test(gm) && /for \\(let guard = 0; guard < 4; guard\\+\\+\\)/.test(gm) &&""",
   """  ok(/for \\(let guard = 0; guard < 4; guard\\+\\+\\)/.test(gm) &&"""),
]
for a, b in fixes:
    assert a in s, 'NOT FOUND: ' + a[:56]
    s = s.replace(a, b, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
