# -*- coding: utf-8 -*-
"""
Faz o PDF do plano a partir do plano-treino.json.

Gera um HTML preparado para impressao e manda o Chrome imprimi-lo em PDF.
Uma pagina por semana, os quatro dias em grelha, com uma coluna em branco para
apontar o que se fez.

    python para_pdf.py
"""
import json, os, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

DIA_PT = {'segunda': 'Segunda', 'terca': 'Terça',
          'quinta': 'Quinta', 'sexta': 'Sexta'}
MES_PT = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
          'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

NOME = {'MORTO': 'Peso morto', 'SUPINO': 'Supino',
        'AGACHAMENTO': 'Agachamento', 'OMBRO': 'Press de ombro'}
MODO = {'maximos': 'MÁXIMOS', 'volume_5': 'pesado',
        'volume_8': 'médio', 'leve': 'leve'}
CURTO = {
    'Cable Overhead Triceps Extension': 'Cable OH Triceps',
    'Standing Calf Raise Machine': 'Standing Calf',
    'Seated Calf Raise Machine': 'Seated Calf',
    'Barbell Calf Raise': 'Barbell Calf',
    'Leg Extension Machine': 'Leg Extension',
    'Seated Leg Curl Machine': 'Seated Leg Curl',
    'Leg Curl Machine': 'Leg Curl',
    'Incline Dumbbell Bench Press': 'Incline DB Bench',
    'Flat Dumbbell Bench Press': 'Flat DB Bench',
    'Rear Delt Dumbbell Raise': 'Rear Delt DB',
    'Rear Delt Machine Fly': 'Rear Delt Machine',
    'Lateral Dumbbell Raise': 'Lateral DB Raise',
    'Lateral Machine Raise': 'Lateral Machine',
    'Dumbbell Hammer Curl': 'Hammer Curl',
    'Dumbell Skullcrusher': 'Skullcrusher',
    'Incline Barbell Bench Press': 'Incline BB Bench',
    'Ab-Wheel Rollout': 'Ab-Wheel',
    'Barbell Front Squat': 'Front Squat',
    'Flat Dumbbell Fly': 'Flat DB Fly',
}


def kg(x):
    return ('%g' % x).replace('.', ',')


def data_pt(iso):
    a, m, d = iso.split('-')
    return '%d de %s' % (int(d), MES_PT[int(m)])


def series_txt(ex, lift):
    if ex['foco']:
        n = len(ex['series'])
        out = []
        for j, (p, r) in enumerate(ex['series']):
            t = '%s×%d' % (kg(p), r)
            if ex['modo'] == 'maximos' and j == n - 2:
                t = '<b>%s</b>' % t
            out.append(t)
        return ' · '.join(out)
    if ex['nome'] == 'Plank':
        return '%d-%d s' % (ex['series'][0][1], ex['series'][1][1])
    if not ex['series'][0][0]:
        r1, r2 = ex['series'][0][1], ex['series'][1][1]
        if ex['categoria'] == 'abs':
            return '%d-%d reps' % (r1, r2)
        return 'corporal · %d e %d' % (r1, r2)
    return ' · '.join('%s×%d' % (kg(p), r) for p, r in ex['series'])


CSS = """
@page { size: A4 portrait; margin: 12mm 10mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
       font-size: 8.5pt; color: #111; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 2mm; }
h2 { font-size: 11pt; margin: 0 0 3mm; padding-bottom: 1.5mm;
     border-bottom: 1.5pt solid #111; }
.semana { page-break-after: always; }
.semana:last-child { page-break-after: auto; }
.grelha { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.dia { border: 0.6pt solid #bbb; border-radius: 2mm; padding: 2.5mm;
       break-inside: avoid; }
.dia.max { border-color: #111; border-width: 1.2pt; }
.cab { display: flex; justify-content: space-between; align-items: baseline;
       margin-bottom: 1.5mm; }
.dia-nome { font-weight: 700; font-size: 9pt; }
.dia-data { color: #777; font-size: 7.5pt; }
.lift { font-size: 8pt; color: #444; margin-bottom: 2mm; }
.lift b { color: #111; }
.tag { display: inline-block; padding: 0.3mm 1.5mm; border-radius: 1mm;
       font-size: 6.5pt; font-weight: 700; letter-spacing: 0.3pt;
       background: #eee; color: #444; }
.tag.max { background: #111; color: #fff; }
table { width: 100%; border-collapse: collapse; }
td { padding: 1.1mm 0.8mm; border-bottom: 0.4pt solid #eee;
     vertical-align: top; }
tr:last-child td { border-bottom: none; }
td.ex { width: 42%; }
td.carga { width: 39%; font-variant-numeric: tabular-nums; color: #333; }
td.marca { width: 19%; white-space: nowrap; text-align: right; }
tr.foco td { font-weight: 700; border-bottom: 0.6pt solid #ccc; }
.cx { display: inline-block; width: 2.6mm; height: 2.6mm;
      border: 0.5pt solid #999; border-radius: 0.5mm; margin-left: 0.5mm; }
.rodape { margin-top: 3mm; font-size: 7pt; color: #777;
          display: flex; justify-content: space-between; }
.intro { font-size: 8pt; line-height: 1.45; }
.intro table { margin: 2mm 0 4mm; }
.intro td, .intro th { border-bottom: 0.4pt solid #ddd; padding: 1.2mm 2mm;
                       text-align: left; }
.intro th { font-size: 7.5pt; text-transform: uppercase;
            letter-spacing: 0.4pt; color: #666; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
"""


def html(P):
    D = P['config']['dias']
    L = ['<!doctype html><meta charset="utf-8"><title>Plano de treino</title>',
         '<style>%s</style>' % CSS]

    # --------- pagina de rosto
    L.append('<div class="semana"><h1>Plano de treino — Bruno</h1>')
    L.append('<p class="intro" style="margin-top:0">Full body, quatro dias por '
             'semana. Os quatro exercícios foco recuam um dia por semana, e '
             'cada um passa pelos quatro modos antes de voltar ao dia de '
             'máximos.</p>')
    L.append('<div class="duas"><div>')
    L.append('<h2>Os dias</h2><table class="intro">')
    L.append('<tr><th>Dia</th><th>Modo</th><th>O que é</th></tr>')
    for d, m, q in [('Segunda', 'MÁXIMOS', 'aproxima e vai ao limite'),
                    ('Terça', 'médio', '4×6-8'),
                    ('Quinta', 'pesado', '4×5'),
                    ('Sexta', 'leve', '4×8, recomeça a onda')]:
        L.append('<tr><td><b>%s</b></td><td>%s</td><td>%s</td></tr>' % (d, m, q))
    L.append('</table>')
    L.append('<h2>Séries e reps</h2><table class="intro">')
    L.append('<tr><td>Exercício foco</td><td><b>4 séries</b></td></tr>'
             '<tr><td>Tudo o resto</td><td><b>2 séries</b></td></tr>'
             '<tr><td>Reps, no geral</td><td>8 → 6</td></tr>'
             '<tr><td>Isolamentos pequenos</td><td>10 → 8</td></tr>'
             '<tr><td>Sextas</td><td>12 → 10</td></tr></table>')
    L.append('</div><div>')
    L.append('<h2>Máximos por ciclo</h2><table class="intro">')
    L.append('<tr><th>Lift</th><th>C1</th><th>C2</th><th>C3</th></tr>')
    for k in P['config']['ordem_circular']:
        lf = P['lifts_foco'][k]
        m, inc = lf['maximo_ciclo1'], lf['incremento_por_ciclo']
        L.append('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>'
                 % (NOME[k], kg(m), kg(m + inc), kg(m + 2 * inc)))
    L.append('</table>')
    L.append('<h2>Como progride</h2><p class="intro">'
             'Nos acessórios: acertas o topo da faixa nas duas séries → sobes '
             '+2,5 kg na barra e nos halteres, +5 kg na máquina.<br><br>'
             'No dia de máximos: se o top sair fácil, sobe 5 kg e usa esse no '
             'ciclo seguinte. Se falhares, fica no anterior.<br><br>'
             '<b>Descansos.</b> 4-5 min antes do top set · 3 min nas outras '
             'séries do foco · 90 s nos compostos · 60 s nos isolamentos.'
             '</p>')
    L.append('</div></div></div>')

    # --------- uma pagina por semana
    for sem in P['calendario']:
        L.append('<div class="semana">')
        L.append('<h2>Semana %d &nbsp;·&nbsp; máximos: %s &nbsp;·&nbsp; '
                 '<span style="font-weight:400;color:#777">%s</span></h2>'
                 % (sem['semana'], NOME[sem['maximos']].lower(),
                    data_pt(sem['inicio'])))
        L.append('<div class="grelha">')
        for d in D:
            dd = sem['dias'][d]
            eh_max = dd['modo'] == 'maximos'
            tot = sum(len(e['series']) for e in dd['exercicios'])
            L.append('<div class="dia%s">' % (' max' if eh_max else ''))
            L.append('<div class="cab"><span class="dia-nome">%s</span>'
                     '<span class="dia-data">%s</span></div>'
                     % (DIA_PT[d], dd['data'][8:10] + '/' + dd['data'][5:7]))
            L.append('<div class="lift"><b>%s</b> &nbsp;'
                     '<span class="tag%s">%s</span></div>'
                     % (NOME[dd['lift']], ' max' if eh_max else '',
                        MODO[dd['modo']]))
            L.append('<table>')
            for ex in dd['exercicios']:
                nm = (NOME[dd['lift']] if ex['foco']
                      else CURTO.get(ex['nome'], ex['nome']))
                cls = ' class="foco"' if ex['foco'] else ''
                cxs = ''.join('<span class="cx"></span>'
                              for _ in range(len(ex['series'])))
                L.append('<tr%s><td class="ex">%s</td>'
                         '<td class="carga">%s</td>'
                         '<td class="marca">%s</td></tr>'
                         % (cls, nm, series_txt(ex, dd['lift']), cxs))
            L.append('</table>')
            L.append('<div class="rodape"><span>%d séries</span>'
                     '<span>&nbsp;</span></div>' % tot)
            L.append('</div>')
        L.append('</div></div>')

    return '\n'.join(L)


def main():
    P = json.load(open(os.path.join(AQUI, 'plano-treino.json'), encoding='utf-8'))
    htm = os.path.join(AQUI, 'Plano-Treino.html')
    pdf = os.path.join(AQUI, 'Plano-Treino.pdf')
    with open(htm, 'w', encoding='utf-8') as f:
        f.write(html(P))

    if not os.path.exists(CHROME):
        raise SystemExit('Chrome nao encontrado em ' + CHROME)
    if os.path.exists(pdf):
        os.remove(pdf)
    subprocess.run([CHROME, '--headless', '--disable-gpu',
                    '--no-pdf-header-footer',
                    '--print-to-pdf=' + pdf, 'file:///' + htm.replace('\\', '/')],
                   check=True, capture_output=True, timeout=120)
    if not os.path.exists(pdf):
        raise SystemExit('o Chrome nao produziu o PDF')
    print('Plano-Treino.pdf  %.0f KB  (%d paginas: rosto + %d semanas)'
          % (os.path.getsize(pdf) / 1024, 1 + len(P['calendario']),
             len(P['calendario'])))


if __name__ == '__main__':
    main()
