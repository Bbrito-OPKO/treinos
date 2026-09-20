# -*- coding: utf-8 -*-
"""
Valida plano-treino.json contra as regras do plano.
Nao le o gerador -- le o ficheiro final, para apanhar erros de transcricao.
Sai com codigo 1 se alguma prova falhar.
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(AQUI, 'plano-treino.json'), encoding='utf-8'))

DIAS = P['config']['dias']
ALVO = P['volume_alvo_semanal']
OBRIG = P['config']['categorias_obrigatorias_por_dia']
GRUPO_ACC = {'MORTO': 'costas', 'SUPINO': 'peito',
             'AGACHAMENTO': 'perna', 'OMBRO': 'ombro'}
CICLO = [s for s in P['calendario'] if s['tipo'] == 'progressao']
TODAS = P['calendario']

falhas = []


def n_series(ex):
    return len(ex['series'])


OFFSET_DIA = {'segunda': 0, 'terca': 1, 'quinta': 3, 'sexta': 4}


def seguidos(d1, d2):
    """terca -> quinta NAO conta: ha a quarta de descanso pelo meio."""
    return OFFSET_DIA[d2] - OFFSET_DIA[d1] == 1


def cab(t):
    print()
    print('=' * 76)
    print(t)
    print('=' * 76)


# --------------------------------------------------------------------------
cab('PROVA 1 - volume semanal por grupo bate com o alvo')
for sem in CICLO:
    v = {}
    for d in DIAS:
        for ex in sem['dias'][d]['exercicios']:
            v[ex['grupo']] = v.get(ex['grupo'], 0) + n_series(ex)
    linha = []
    for g in sorted(ALVO):
        got, want = v.get(g, 0), ALVO[g]
        if g == 'perna':
            ok = got == want
        else:
            ok = got == want
        if not ok:
            falhas.append('S%d %s: %d (alvo %d)' % (sem['semana'], g, got, want))
        linha.append('%s %d/%d%s' % (g, got, want, '' if ok else ' ERRO'))
    print('Semana %d (max %s)  %s' % (sem['semana'], sem['maximos'], '  '.join(linha)))
    print('            total %d series' % sum(v.values()))

# --------------------------------------------------------------------------
cab('PROVA 2 - CORPO INTEIRO: todos os dias tem %s' % ', '.join(OBRIG))
for sem in TODAS:
    linha, mau = [], []
    for d in DIAS:
        cats = set(ex['categoria'] for ex in sem['dias'][d]['exercicios'])
        falta = [c for c in OBRIG if c not in cats]
        if falta:
            mau.append('%s sem %s' % (d, '+'.join(falta)))
        linha.append('%s %s' % (d[:3], 'ok' if not falta else 'FALTA ' + '+'.join(falta)))
    if mau:
        falhas.append('S%d %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], '   '.join(linha)))

# --------------------------------------------------------------------------
cab('PROVA 3 - ROTACAO: cada lift 4x por ciclo, um modo de cada, a recuar um dia')
OFFSET = {'segunda': 0, 'terca': 1, 'quinta': 3, 'sexta': 4}
ESPERADO = ['segunda', 'sexta', 'quinta', 'terca']   # o percurso pedido pelo Bruno
for L in P['config']['ordem_circular']:
    ap = []
    for sem in CICLO:
        for d in DIAS:
            if sem['dias'][d]['lift'] == L:
                ap.append(((sem['semana'] - 1) * 7 + OFFSET[d] + 1, d,
                           sem['dias'][d]['modo'], sem['semana']))
    ap.sort()
    modos = [x[2] for x in ap]
    dias = [x[0] for x in ap]
    gaps = [dias[i + 1] - dias[i] for i in range(len(dias) - 1)] + \
           [dias[0] + 28 - dias[-1]]
    # o percurso tem de ser segunda->sexta->quinta->terca, a partir de onde comeca
    seq = [x[1] for x in ap]
    i0 = ESPERADO.index(seq[0])
    esperado_rot = [ESPERADO[(i0 + k) % 4] for k in range(4)]
    ok = (len(ap) == 4
          and sorted(modos) == ['leve', 'maximos', 'volume_5', 'volume_8']
          and seq == esperado_rot)
    if not ok:
        falhas.append('%s rotacao: %dx, dias %s (esperado %s), modos %s'
                      % (L, len(ap), seq, esperado_rot, modos))
    print('%-12s %s   %s' % (L, ' -> '.join('S%d %s' % (x[3], x[1]) for x in ap),
                             'OK' if ok else 'FALHA'))
    print('             intervalos %s' % gaps)

# --------------------------------------------------------------------------
cab('PROVA 4 - os 11 dias de descanso vem LOGO A SEGUIR aos maximos')
for L in P['config']['ordem_circular']:
    ap = []
    for sem in CICLO:
        for d in DIAS:
            if sem['dias'][d]['lift'] == L:
                ap.append(((sem['semana'] - 1) * 7 + OFFSET[d] + 1,
                           sem['dias'][d]['modo']))
    ap.sort()
    dias = [x[0] for x in ap]
    modos = [x[1] for x in ap]
    gaps = [dias[i + 1] - dias[i] for i in range(len(dias) - 1)] + \
           [dias[0] + 28 - dias[-1]]
    i = modos.index('maximos')
    depois = gaps[i]
    ok = depois == 11
    if not ok:
        falhas.append('%s: %d dias depois dos maximos, esperado 11' % (L, depois))
    print('%-12s maximos no dia %d -> proxima vez %d dias depois   %s'
          % (L, dias[i], depois, 'OK' if ok else 'FALHA'))

# --------------------------------------------------------------------------
cab('PROVA 5 - o lift da SEXTA nunca e o dos MAXIMOS da segunda seguinte')
for i, sem in enumerate(CICLO):
    prox = CICLO[(i + 1) % 4]
    sexta = sem['dias']['sexta']['lift']
    seg = prox['dias']['segunda']['lift']
    ok = sexta != seg
    if not ok:
        falhas.append('S%d sexta=%s e S%d segunda=%s' % (sem['semana'], sexta,
                                                         prox['semana'], seg))
    print('Semana %d  sexta %-12s -> Semana %d segunda %-12s   %s'
          % (sem['semana'], sexta, prox['semana'], seg, 'OK' if ok else 'FALHA'))

# --------------------------------------------------------------------------
cab('PROVA 6 - APROXIMACAO: quinta e sexta so com trabalho LEVE do grupo dos maximos')
for i, sem in enumerate(CICLO):
    ap = sem['grupo_em_aproximacao']
    prox = CICLO[(i + 1) % 4]
    # o grupo em aproximacao tem de ser mesmo o do lift dos maximos seguintes
    esperado = GRUPO_ACC[prox['dias']['segunda']['lift']]
    coerente = ap == esperado
    mau, leves = [], []
    for d in ['quinta', 'sexta']:
        for ex in sem['dias'][d]['exercicios']:
            if ex['grupo'] == ap:
                (mau if ex['intensidade'] == 'pesado' else leves).append(
                    '%s: %s' % (d[:3], ex['nome']))
    ok = coerente and not mau
    if not ok:
        falhas.append('S%d aproximacao %s (esperado %s) pesados=%s'
                      % (sem['semana'], ap, esperado, mau))
    print('Semana %d  %s a caminho dos maximos de %s   %s'
          % (sem['semana'], ap, prox['dias']['segunda']['lift'],
             'OK' if ok else 'FALHA ' + str(mau)))
    print('            leve nesses dias: %s' % (leves or 'nenhum'))

# --------------------------------------------------------------------------
cab('PROVA 7 - bracos todos os dias; biceps e triceps 2 dias cada; gemeos 2 dias')
for sem in CICLO:
    def nd(g):
        return sum(1 for d in DIAS
                   if any(e['grupo'] == g for e in sem['dias'][d]['exercicios']))
    nb, nt, ng = nd('biceps'), nd('triceps'), nd('gemeos')
    nbr = sum(1 for d in DIAS
              if any(e['categoria'] == 'braco' for e in sem['dias'][d]['exercicios']))
    ok = nb == 2 and nt == 2 and ng == 2 and nbr == 4
    if not ok:
        falhas.append('S%d bi=%d tri=%d gem=%d braco=%d' % (sem['semana'], nb, nt, ng, nbr))
    print('Semana %d  biceps %dd   triceps %dd   gemeos %dd   dias com braco %d/4   %s'
          % (sem['semana'], nb, nt, ng, nbr, 'ok' if ok else 'ERRO'))

# --------------------------------------------------------------------------
cab('PROVA 8 - tetos: segunda <= %d, outros <= %d, grupo <= %d por dia'
    % (P['regras']['teto_series_dia_maximos'],
       P['regras']['teto_series_outros_dias'],
       P['regras']['max_series_por_grupo_por_dia']))
for sem in CICLO:
    linha = []
    for d in DIAS:
        tot, porg = 0, {}
        for ex in sem['dias'][d]['exercicios']:
            n = n_series(ex)
            tot += n
            porg[ex['grupo']] = porg.get(ex['grupo'], 0) + n
        teto = (P['regras']['teto_series_dia_maximos'] if d == 'segunda'
                else P['regras']['teto_series_outros_dias'])
        pior = max(porg.values())
        ok = tot <= teto and pior <= P['regras']['max_series_por_grupo_por_dia']
        if not ok:
            falhas.append('S%d %s: %d series (teto %d), maior grupo %d'
                          % (sem['semana'], d, tot, teto, pior))
        linha.append('%s %d/%d g%d%s' % (d[:3], tot, teto, pior, '' if ok else ' ERRO'))
    print('Semana %d  %s' % (sem['semana'], '   '.join(linha)))

# --------------------------------------------------------------------------
cab('PROVA 9 - sem exercicio repetido no mesmo dia nem em dias seguidos')
for sem in TODAS:
    mau = []
    for i, d in enumerate(DIAS):
        nomes = [ex['nome'] for ex in sem['dias'][d]['exercicios'] if not ex['foco']]
        if len(nomes) != len(set(nomes)):
            mau.append('%s: repetido no proprio dia' % d)
        if i > 0 and seguidos(DIAS[i - 1], d):
            ant = {ex['nome'] for ex in sem['dias'][DIAS[i - 1]]['exercicios']
                   if not ex['foco']}
            colados = set(nomes) & ant
            if colados:
                mau.append('%s: %s tambem ontem' % (d, ', '.join(sorted(colados))))
    if mau:
        falhas.append('S%d %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], 'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
cab('PROVA 10 - ordem: lift primeiro, e o fim e sempre braco -> gemeos -> abs')
ESCALAO = {'perna': 1, 'empurrar': 1, 'puxar': 1, 'braco': 2, 'gemeos': 3, 'abs': 4}
for sem in TODAS:
    mau, linha = [], []
    for d in DIAS:
        exs = sem['dias'][d]['exercicios']
        esc = [0 if e['foco'] else ESCALAO[e['categoria']] for e in exs]
        if esc != sorted(esc):
            ordem = ' '.join(e['categoria'][:3] for e in exs)
            mau.append('%s: %s' % (d, ordem))
        linha.append('%s %s' % (d[:3], 'ok' if esc == sorted(esc) else 'ERRO'))
    if mau:
        falhas.append('S%d ordem: %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], '   '.join(linha)))

# --------------------------------------------------------------------------
cab('PROVA 11 - PERNA por lift (o alvo vem do ficheiro)')
ESPERA_PERNA = P['regras']['perna_por_lift']
for sem in TODAS:
    linha, mau = [], []
    for d in DIAS:
        L = sem['dias'][d]['lift']
        n = sum(n_series(e) for e in sem['dias'][d]['exercicios']
                if e['grupo'] == 'perna' and not e['foco'])
        want = ESPERA_PERNA[L]
        if n != want:
            mau.append('%s (%s): %d, esperado %d' % (d, L, n, want))
        linha.append('%s %d' % (d[:3], n))
    if mau:
        falhas.append('S%d perna: %s' % (sem['semana'], mau))
    print('Semana %d  %s   %s' % (sem['semana'], '  '.join(linha),
                                  'OK' if not mau else 'FALHA ' + str(mau)))

cab('PROVA 12 - ABS so nas segundas e quintas')
for sem in TODAS:
    dias_abs = [d for d in DIAS
                if any(e['categoria'] == 'abs' for e in sem['dias'][d]['exercicios'])]
    esperado = P['regras']['abs_dias']
    ok = dias_abs == esperado
    if not ok:
        falhas.append('S%d abs em %s, esperado %s' % (sem['semana'], dias_abs, esperado))
    print('Semana %d  abs em %s   %s' % (sem['semana'], dias_abs, 'OK' if ok else 'FALHA'))

# --------------------------------------------------------------------------
cab('PROVA 13 - FAMILIAS: nunca dois do mesmo movimento no mesmo dia')
FAM = P['regras']['familia_por_exercicio']   # lido do ficheiro, sem copia
for sem in TODAS:
    mau = []
    for d in DIAS:
        vistas = {}
        for e in sem['dias'][d]['exercicios']:
            f = FAM.get(e['nome'])
            if not f:
                continue
            if f in vistas:
                mau.append('%s: %s + %s (ambos %s)' % (d, vistas[f], e['nome'], f))
            vistas[f] = e['nome']
    if mau:
        falhas.append('S%d familias: %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], 'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
cab('PROVA 14 - BRACO segue o lift: triceps quando empurra, biceps quando puxa')
ESPERA = {'SUPINO': 'triceps', 'OMBRO': 'triceps',
          'MORTO': 'biceps', 'AGACHAMENTO': 'biceps'}
for sem in TODAS:
    linha, mau = [], []
    for d in DIAS:
        L = sem['dias'][d]['lift']
        gs = {e['grupo'] for e in sem['dias'][d]['exercicios']
              if e['categoria'] == 'braco'}
        want = ESPERA[L]
        if gs != {want}:
            mau.append('%s (%s): %s, esperado %s' % (d, L, gs or 'nenhum', want))
        linha.append('%s %s' % (d[:3], want[:3]))
    if mau:
        falhas.append('S%d braco: %s' % (sem['semana'], mau))
    print('Semana %d  %s   %s' % (sem['semana'], '  '.join(linha),
                                  'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
cab('PROVA 15 - INTERFERENCIA entre dias SEGUIDOS (terca->quinta nao conta)')
SUB = P['regras']['subgrupos']
INT = P['regras']['interferencia']
for sem in TODAS:
    mau, notas = [], []
    for i, d in enumerate(DIAS):
        fora = set()
        reg = INT.get(sem['dias'][d]['lift'])
        if reg:
            fora |= set(reg['dia'])
        if i + 1 < len(DIAS) and seguidos(d, DIAS[i + 1]):
            reg = INT.get(sem['dias'][DIAS[i + 1]]['lift'])
            if reg:
                fora |= set(reg['vespera'])
        if not fora:
            continue
        for e in sem['dias'][d]['exercicios']:
            if e['foco']:
                continue
            if SUB.get(e['nome']) in fora:
                mau.append('%s: %s (%s)' % (d, e['nome'], SUB[e['nome']]))
        notas.append('%s sem %s' % (d[:3], '+'.join(sorted(fora))))
    if mau:
        falhas.append('S%d interferencia: %s' % (sem['semana'], mau))
    print('Semana %d  %s   %s' % (sem['semana'], ' | '.join(notas),
                                  'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
cab('PROVA 16 - sem series orfas: nenhum acessorio com 1 so serie (excepto abs)')
for sem in TODAS:
    mau = []
    for d in DIAS:
        for e in sem['dias'][d]['exercicios']:
            if not e['foco'] and e['series'] == 1 and e['categoria'] != 'abs':
                mau.append('%s: %s' % (d, e['nome']))
    if mau:
        falhas.append('S%d orfas: %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], 'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
cab('PROVA 17 - reps: 8 no geral, 10 nos isolamentos pequenos, 12 as sextas')
# os isolamentos de musculo pequeno podem ir a 10
LIMITE_REPS = {n: 10 for n in P['acessorios']
               if P['acessorios'][n]['series'][0][1] == 10}
for sem in TODAS:
    mau = []
    for d in DIAS:
        for e in sem['dias'][d]['exercicios']:
            if e['categoria'] == 'abs':
                continue
            n = len(e['series'])
            for j, (peso, r) in enumerate(e['series']):
                backoff = (e['foco'] and e.get('modo') == 'maximos' and j == n - 1)
                teto = 12 if d == 'sexta' else LIMITE_REPS.get(e['nome'], 8)
                if r > teto and not backoff:
                    mau.append('%s: %s serie %d com %d reps' % (d, e['nome'],
                                                                j + 1, r))
    if mau:
        falhas.append('S%d reps: %s' % (sem['semana'], mau))
    print('Semana %d  %s' % (sem['semana'], 'OK' if not mau else 'FALHA ' + str(mau)))

# --------------------------------------------------------------------------
print()
print('=' * 76)
if falhas:
    print('VEREDICTO: %d FALHA(S)' % len(falhas))
    for f in falhas:
        print('  - %s' % f)
    sys.exit(1)
print('VEREDICTO: as 17 provas passam.')
