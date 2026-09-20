# -*- coding: utf-8 -*-
"""
Gerador do plano de treino do Bruno.
Full body 4x/semana, rotacao para a frente, segunda = maximos.
TODOS os dias sao corpo inteiro: perna + empurrar + puxar + braco.
As regras estao codificadas -- nada e escolhido a mao.
Escreve plano-treino.json e Plano-Treino.md na mesma pasta.
"""
import json, os, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))

# Segunda-feira em que arranca a semana 1. Mudar aqui desloca o plano todo.
DATA_INICIO = datetime.date(2026, 8, 31)
OFFSET_DIA = {'segunda': 0, 'terca': 1, 'quinta': 3, 'sexta': 4}
NOME_DIA = {'segunda': 'Segunda', 'terca': 'Terca',
            'quinta': 'Quinta', 'sexta': 'Sexta'}

# ---------------------------------------------------------------- DEFINICOES
LIFTS = ['MORTO', 'SUPINO', 'AGACHAMENTO', 'OMBRO']
NOME_LIFT = {
    'MORTO':       'Peso morto convencional',
    'SUPINO':      'Supino plano com barra',
    'AGACHAMENTO': 'Agachamento com barra livre',
    'OMBRO':       'Press de ombro com barra',
}
# grupo a que pertencem os ACESSORIOS de cada lift
GRUPO_ACC = {'MORTO': 'costas', 'SUPINO': 'peito',
             'AGACHAMENTO': 'perna', 'OMBRO': 'ombro'}

# categoria funcional -- usada para garantir que cada dia e corpo inteiro
CATEGORIA = {'perna': 'perna', 'peito': 'empurrar', 'ombro': 'empurrar',
             'costas': 'puxar', 'biceps': 'braco', 'triceps': 'braco',
             'gemeos': 'gemeos', 'abs': 'abs', 'morto': 'puxar'}
# o peso morto cobre "puxar" mas NAO cobre "perna" -- decisao do Bruno:
# o dia do morto leva sempre quadricipite a parte.
OBRIGATORIAS = ['perna', 'empurrar', 'puxar', 'braco']

# Ordem dos exercicios dentro da sessao. O lift foco abre; os grandes grupos vem a
# seguir; e o fim e SEMPRE braco -> gemeos -> abs, por esta ordem.
ORDEM_SESSAO = {'perna': 1, 'empurrar': 1, 'puxar': 1,
                'braco': 2, 'gemeos': 3, 'abs': 4}

# Dentro do mesmo grupo, o multiarticular vem antes do isolamento.
ISOLAMENTO = {
    'Leg Extension Machine', 'Seated Leg Curl Machine', 'Leg Curl Machine',
    'Flat Machine Fly', 'Flat Dumbbell Fly',
    'Lateral Dumbbell Raise', 'Lateral Machine Raise',
    'Rear Delt Machine Fly', 'Rear Delt Dumbbell Raise',
}

# Todos os acessorios levam 2 series. Os alvos sao por isso multiplos de 2:
# e o numero de exercicios do grupo na semana, vezes 2.
SERIES_ACESSORIO = 2
ALVO = {'perna': 14, 'costas': 8, 'peito': 10, 'ombro': 10,
        'biceps': 4, 'triceps': 4, 'gemeos': 4, 'abs': 4, 'morto': 4}
GEMEOS_DIAS = 2      # gemeos continuam em 2 dias
LIM_SEGUNDA = 16     # teto de series no dia de maximos
TETO_DIA = 18        # teto nos outros dias
MAX_GRUPO_DIA = 6    # nenhum grupo passa disto num so dia (lift incluido)

# PERNA -- quanta perna acessoria leva cada dia, conforme o lift:
#   agachamento -> zero, fica so o lift;
#   peso morto  -> 3, e so quadriceps (o morto ja fez a cadeia posterior);
#   supino e press ombro -> 5, sao os dias livres para trabalhar perna.
PERNA_POR_LIFT = {'AGACHAMENTO': 0, 'MORTO': 2, 'SUPINO': 4, 'OMBRO': 4}

# Nenhum dia deve ficar muito mais curto que os outros. Se ficar, puxam-se series
# dos dias cheios -- o volume da semana nao muda, so a distribuicao.
MIN_DIA = 14

# ABS -- so nas segundas e quintas
ABS_DIAS = ['segunda', 'quinta']

# BRACO -- segue o padrao do dia: triceps nos dias de empurrar, biceps nos de
# puxar. Da 2 dias de cada, que e o que mantem os 6 + 6.
BRACO_DO_LIFT = {'SUPINO': 'triceps', 'OMBRO': 'triceps',
                 'MORTO': 'biceps', 'AGACHAMENTO': 'biceps'}

# FAMILIAS de movimento. Dois exercicios da mesma familia nao entram no mesmo dia
# -- sao o mesmo movimento com outro aparelho e nao somam nada.
# O lift foco tambem conta: e por isto que o romanian deadlift nunca cai no dia
# do peso morto.
FAMILIA = {
 'Peso morto convencional': 'hinge',   'Romanian Deadlift': 'hinge',
 'Agachamento com barra livre': 'agachamento',
 'Barbell Front Squat': 'agachamento', 'Smith Squat': 'agachamento',
 'Goblet Squat': 'agachamento',
 'Bulgarian': 'unilateral',            'Lungees': 'unilateral',
 'Seated Leg Curl Machine': 'leg curl', 'Leg Curl Machine': 'leg curl',
 'Supino plano com barra': 'supino',   'Flat Dumbbell Bench Press': 'supino',
 'Flat Machine Fly': 'fly',            'Flat Dumbbell Fly': 'fly',
 'Barbell Row': 'remada barra',        'Pendlay Row': 'remada barra',
 'Chin Up': 'chin up',                 'Chin Up Machine': 'chin up',
 'Lat Pulldown': 'puxada',
 'Press de ombro com barra': 'press ombro',
 'Lateral Dumbbell Raise': 'lateral',  'Lateral Machine Raise': 'lateral',
 'Rear Delt Machine Fly': 'rear delt', 'Rear Delt Dumbbell Raise': 'rear delt',
}


# DUAS camadas, que sao coisas diferentes:
#   FAMILIA        -> mesmo movimento. Nunca dois no MESMO dia. O goblet e o
#                     smith contam como agachamento aqui.
#   EXERCICIOS_DUROS -> carga axial a serio. Nunca em dias SEGUIDOS. O goblet e o
#                     smith nao entram, senao nao ha quadriceps que chegue.
FAMILIA_DURA = {
    'Peso morto convencional': 'hinge',
    'Romanian Deadlift': 'hinge',
    'Agachamento com barra livre': 'agachamento pesado',
    'Barbell Front Squat': 'agachamento pesado',
    'Bulgarian': 'unilateral',
    'Lungees': 'unilateral',
}


def familia_dura(nome):
    return FAMILIA_DURA.get(nome)


def seguidos(d1, d2):
    """d2 e mesmo o dia a seguir a d1 no calendario?
    segunda->terca sim, quinta->sexta sim. terca->quinta NAO: ha a quarta pelo
    meio, e um dia de descanso. So os pares consecutivos e que interferem."""
    return OFFSET_DIA[d2] - OFFSET_DIA[d1] == 1


def dia_seguinte(d):
    i = DIAS.index(d)
    if i + 1 < len(DIAS) and seguidos(d, DIAS[i + 1]):
        return DIAS[i + 1]
    return None


def dia_anterior(d):
    i = DIAS.index(d)
    if i > 0 and seguidos(DIAS[i - 1], d):
        return DIAS[i - 1]
    return None

# SUBGRUPO -- mais fino do que o grupo. E o que permite dizer "quadriceps sim,
# isquiotibiais nao" ou "peito plano sim, inclinado nao".
SUBGRUPO = {
 'Agachamento com barra livre': 'quadriceps', 'Leg Press': 'quadriceps',
 'Leg Extension Machine': 'quadriceps',      'Goblet Squat': 'quadriceps',
 'Smith Squat': 'quadriceps',                'Barbell Front Squat': 'quadriceps',
 'Peso morto convencional': 'posterior',     'Romanian Deadlift': 'posterior',
 'Seated Leg Curl Machine': 'posterior',     'Leg Curl Machine': 'posterior',
 'Bulgarian': 'unilateral',                  'Lungees': 'unilateral',
 'Incline Barbell Bench Press': 'peito inclinado',
 'Incline Dumbbell Bench Press': 'peito inclinado',
 'Supino plano com barra': 'peito plano',
 'Flat Dumbbell Bench Press': 'peito plano', 'Chest Dips': 'peito plano',
 'Flat Machine Fly': 'peito isolamento',     'Flat Dumbbell Fly': 'peito isolamento',
 'Lateral Dumbbell Raise': 'ombro acessorio',
 'Lateral Machine Raise': 'ombro acessorio',
 'Rear Delt Machine Fly': 'ombro acessorio',
 'Rear Delt Dumbbell Raise': 'ombro acessorio',
}

# INTERFERENCIA -- o que cada lift proibe. 'dia' e no proprio dia do lift,
# 'vespera' e no dia anterior.
#   peso morto: ja e cadeia posterior a serio. Nada de isquios, glutea ou
#               unilateral nem no proprio dia nem na vespera -- so quadriceps.
#   press ombro: o supino inclinado puxa muito deltoide anterior, por isso nao
#               entra na vespera.
INTERFERE = {
 'MORTO': {'dia': {'posterior', 'unilateral'},
           'vespera': {'posterior', 'unilateral'}},
 'OMBRO': {'dia': set(),
           'vespera': {'peito inclinado', 'ombro acessorio'}},
 # mesma logica para o agachamento: na vespera, nada que canse isquios ou
 # gluteo. Quadriceps de maquina pode ficar -- e o que mantem o corpo inteiro.
 'AGACHAMENTO': {'dia': set(), 'vespera': {'posterior', 'unilateral'}},
}


def subgrupo(nome):
    return SUBGRUPO.get(nome)


def grupo_cabe_no_dia(g, d, dias_lift):
    """O grupo tem algum exercicio que nao esteja bloqueado neste dia?
    Se nao tiver, nem se alocam series -- senao o filtro tinha de ceder."""
    fora = bloqueados(d, dias_lift)
    return any(SUBGRUPO.get(x) not in fora for x in PREF[g])


def bloqueados(d, dias_lift):
    """Subgrupos que nao podem entrar neste dia -- por causa do lift de hoje
    e do lift de amanha."""
    fora = set()
    reg = INTERFERE.get(dias_lift[d])
    if reg:
        fora |= reg['dia']
    seg = dia_seguinte(d)
    if seg:
        reg = INTERFERE.get(dias_lift[seg])
        if reg:
            fora |= reg['vespera']
    return fora


def familia(nome):
    return FAMILIA.get(nome, nome)


# Isolamentos de musculo pequeno: carga alta rende pouco e o ombro ressente-se.
# Estes vao a 10 -> 8 reps; todo o resto vai a 8 -> 6.
REPS_ALTAS = {
    'Lateral Dumbbell Raise', 'Lateral Machine Raise',
    'Rear Delt Machine Fly', 'Rear Delt Dumbbell Raise',
    'Barbell Calf Raise', 'Seated Calf Raise Machine',
    'Standing Calf Raise Machine',
}


def series_acessorio(nome, dia=None):
    """As 2 series de um acessorio, em piramide: a primeira mais leve com mais
    reps, a segunda mais pesada com menos. O peso do catalogo e a media das duas.

    Na SEXTA -- o dia leve do lift -- os acessorios acompanham: sobem para 12 -> 10
    reps e o peso desce. Abs ficam sempre de fora."""
    g, peso, rmin, rmax, _ = ACC[nome]
    if g == 'abs':
        return [[peso, rmin], [peso, rmax]]   # a faixa, nao o mesmo numero 2x
    altas, baixas = (10, 8) if nome in REPS_ALTAS else (8, 6)
    fator = 1.0
    if dia == 'sexta':
        altas, baixas = 12, 10
        fator = 0.88                   # 11 reps carrega menos do que 7
    if not peso:
        return [[0, altas], [0, baixas]]   # peso corporal: so mudam as reps
    peso = peso * fator
    passo = 2.5 if peso < 60 else 5
    s1 = round(peso * 0.95 / passo) * passo
    s2 = round(peso * 1.05 / passo) * passo
    if s2 <= s1:
        s2 = s1 + passo
    return [[s1, altas], [s2, baixas]]

# AJUSTES a mao -- pedidos que nao vem de nenhuma regra. Ficam aqui escritos
# para sobreviverem a uma regeracao; sem isto perdiam-se ao correr o gerador.
#   (semana, dia): {'fora': [...nao quero], 'dentro': [...quero estes]}
AJUSTES = {
    (1, 'quinta'): {'fora': ['Flat Dumbbell Bench Press'], 'dentro': ['Chest Dips']},
    (1, 'sexta'): {'fora': ['Lungees']},
    (2, 'sexta'): {'fora': ['Goblet Squat']},
}

DIAS = ['segunda', 'terca', 'quinta', 'sexta']
# Modo de cada dia da semana. Como cada lift recua um dia por semana, o percurso
# dele entre dois dias de maximos e:
#   segunda MAXIMOS -> sexta leve -> quinta PESADO -> terca medio -> MAXIMOS
# O medio da terca funciona como descarga parcial antes do dia de limite.
MODO = {'segunda': 'maximos', 'terca': 'volume_8',
        'quinta': 'volume_5', 'sexta': 'leve'}

LIFT = {
 'MORTO': {'max_c1': 180, 'inc': 7.5,
   'maximos':   [(130, 3), (155, 2), (180, 1), (140, 8)],
   'volume_5':  [(125, 5), (135, 5), (145, 5), (152.5, 5)],
   'volume_8':  [(115, 8), (125, 8), (135, 7), (145, 6)],
   'leve':      [(110, 8), (120, 8), (127.5, 8), (135, 8)]},
 'SUPINO': {'max_c1': 120, 'inc': 2.5,
   'maximos':   [(85, 3), (102.5, 2), (120, 1), (90, 10)],
   'volume_5':  [(82.5, 5), (90, 5), (97.5, 5), (102.5, 5)],
   'volume_8':  [(77.5, 8), (85, 8), (90, 7), (97.5, 6)],
   'leve':      [(70, 8), (77.5, 8), (82.5, 8), (87.5, 8)]},
 'AGACHAMENTO': {'max_c1': 145, 'inc': 5,
   'maximos':   [(105, 3), (125, 2), (145, 1), (110, 8)],
   'volume_5':  [(100, 5), (107.5, 5), (115, 5), (122.5, 5)],
   'volume_8':  [(92.5, 8), (100, 8), (107.5, 7), (115, 6)],
   'leve':      [(87.5, 8), (95, 8), (102.5, 8), (110, 8)]},
 'OMBRO': {'max_c1': 65, 'inc': 2.5,
   'maximos':   [(47.5, 3), (55, 2), (65, 1), (45, 10)],
   'volume_5':  [(45, 5), (47.5, 5), (52.5, 5), (55, 5)],
   'volume_8':  [(42.5, 8), (45, 8), (47.5, 7), (52.5, 6)],
   'leve':      [(35, 8), (40, 8), (42.5, 8), (47.5, 8)]},
}

# catalogo: nome -> (grupo, peso kg, reps min, reps max, intensidade)
# pesos vindos do ultimo registo real de cada exercicio no FitNotes (agosto 2026)
#
# 'pesado' = composto com barra livre ou carga axial. So DEPOIS do lift do grupo,
#            e nunca na quinta/sexta antes dos maximos desse lift.
# 'leve'   = maquina, cabo, halteres ou isolamento. Vai a qualquer dia.
#            E o que permite que todos os dias sejam corpo inteiro.
# Marcados com (*) os que ele nao faz desde 2025 -- o peso e o do ultimo registo
# real e pode precisar de ajuste na primeira vez.
ACC = {
 'Romanian Deadlift':                ('perna',   132.5,  6,  8, 'pesado'),
 'Bulgarian':                        ('perna',    65,    6,  8, 'pesado'),
 'Lungees':                          ('perna',    27.5,  6,  8, 'pesado'),   # (*)
 'Leg Press':                        ('perna',   110,    6,  8, 'leve'),
 'Leg Extension Machine':            ('perna',   125,    6,  8, 'leve'),
 'Seated Leg Curl Machine':          ('perna',    22.5,  6,  8, 'leve'),     # (*)
 'Leg Curl Machine':                 ('perna',    27.5,  6,  8, 'leve'),     # (*)
 'Goblet Squat':                     ('perna',    32.5,  6,  8, 'leve'),     # (*)
 'Smith Squat':                      ('perna',    62.5,  6,  8, 'leve'),     # (*)
 'Barbell Front Squat':              ('perna',    42.5,  6,  8, 'pesado'),   # (*)
 'Incline Barbell Bench Press':      ('peito',    72.5,  6,  8, 'pesado'),
 'Chest Dips':                       ('peito',     0,    6,  8, 'leve'),     # (*)
 'Incline Dumbbell Bench Press':     ('peito',    65,    6,  8, 'leve'),
 'Flat Dumbbell Bench Press':        ('peito',    90,    6,  8, 'leve'),
 'Flat Machine Fly':                 ('peito',   125,    6,  8, 'leve'),
 'Flat Dumbbell Fly':                ('peito',    47.5,  6,  8, 'leve'),     # (*)
 'Barbell Row':                      ('costas',  100,    6,  8, 'pesado'),
 'Pendlay Row':                      ('costas',   55,    6,  8, 'pesado'),   # (*)
 'Chin Up':                          ('costas',   20,    6,  8, 'pesado'),
 'Lat Pulldown':                     ('costas',  115,    6,  8, 'leve'),
 'Chin Up Machine':                  ('costas',  127.5,  6,  8, 'leve'),
 'Seated Cable Row':                 ('costas',  110,    6,  8, 'leve'),     # (*)
 'Dumbbell Row':                     ('costas',   35,    6,  8, 'leve'),     # (*)
 'Lateral Dumbbell Raise':           ('ombro',    37.5, 10,  8, 'leve'),
 'Lateral Machine Raise':            ('ombro',    22.5, 10,  8, 'leve'),
 'Rear Delt Machine Fly':            ('ombro',    90,   10,  8, 'leve'),
 'Rear Delt Dumbbell Raise':         ('ombro',    27.5, 10,  8, 'leve'),     # (*)
 'Barbell Curl':                     ('biceps',   40,    6,  8, 'leve'),
 'Dumbbell Hammer Curl':             ('biceps',   42.5,  6,  8, 'leve'),
 'Cable Curl':                       ('biceps',   77.5,  6,  8, 'leve'),
 'Dumbell Skullcrusher':             ('triceps',  47.5,  6,  8, 'leve'),
 'Cable Overhead Triceps Extension': ('triceps',  67.5,  6,  8, 'leve'),
 'Bar Push Down':                    ('triceps',  50,    6,  8, 'leve'),
 'Barbell Calf Raise':               ('gemeos',   90,   10,  8, 'leve'),
 'Seated Calf Raise Machine':        ('gemeos',   80,   10,  8, 'leve'),
 'Standing Calf Raise Machine':      ('gemeos',   45,   10,  8, 'leve'),     # (*)
 'Crunch':                           ('abs',       0,   30, 40, 'leve'),
 'Hanging Leg Raise':                ('abs',       0,   20, 30, 'leve'),
 'Ab-Wheel Rollout':                 ('abs',       0,   15, 20, 'leve'),
 'Plank':                            ('abs',       0,   60, 90, 'leve'),
}
PREF = {}
for _n in ACC:
    PREF.setdefault(ACC[_n][0], []).append(_n)


# ------------------------------------------------------------------- REGRAS
def calendario(w):
    """w = 0..3. Rotacao PARA A FRENTE: cada lift recua um dia por semana
    (segunda -> sexta -> quinta -> terca -> segunda).
    Os 4 lifts sao feitos TODAS as semanas -- nenhum fica de fora."""
    ordem = [LIFTS[(w + i) % 4] for i in range(4)]
    return {DIAS[i]: ordem[i] for i in range(4)}


def lift_em_aproximacao(dias_lift):
    """O lift de TERCA e sempre o que vai a maximos na segunda seguinte."""
    return dias_lift['terca']


def n_series_lift(lift, dia):
    return len(LIFT[lift][MODO[dia]])


def pesados_ok(g, dia, dias_lift):
    """Pode fazer-se um composto PESADO deste grupo neste dia?

    UMA so regra, e so na semana que antecede os maximos: quando o lift do grupo
    esta a TERCA, vai a maximos na segunda seguinte -- e ai a quinta e a sexta nao
    levam nada pesado desse grupo, para chegar recuperado ao dia de limite.
    Nas outras semanas os compostos vao a qualquer dia."""
    if (GRUPO_ACC[lift_em_aproximacao(dias_lift)] == g
            and dia in ('quinta', 'sexta')):
        return False
    return True


def necessidades(dias_lift):
    """Series de ACESSORIO por grupo. O volume nao e cortado na aproximacao --
    o que muda nessa semana e a INTENSIDADE, nao a quantidade."""
    need = {}
    for g in ALVO:
        if g == 'morto':
            continue                       # a categoria morto e so o proprio lift
        if g == 'perna':
            need[g] = sum(PERNA_POR_LIFT.values())
            continue
        feitas = 0
        for d in dias_lift:
            L = dias_lift[d]
            # o peso morto esta a parte -- nao desconta das costas
            if GRUPO_ACC[L] == g and L != 'MORTO':
                feitas = n_series_lift(L, d)
        need[g] = max(0, ALVO[g] - feitas)
    return need


def alocar(dias_lift):
    """Distribui as series pelos dias garantindo corpo inteiro todos os dias."""
    need = necessidades(dias_lift)
    carga, no_dia = {}, {d: {} for d in DIAS}
    for d in DIAS:
        L = dias_lift[d]
        n = n_series_lift(L, d)
        carga[d] = n
        no_dia[d]['morto' if L == 'MORTO' else GRUPO_ACC[L]] = n
    plano = {d: {} for d in DIAS}

    def por(d, g, n):
        plano[d][g] = plano[d].get(g, 0) + n
        no_dia[d][g] = no_dia[d].get(g, 0) + n
        carga[d] += n

    def cabe(d, g, n):
        teto = LIM_SEGUNDA if d == 'segunda' else TETO_DIA
        return (carga[d] + n <= teto
                and no_dia[d].get(g, 0) + n <= MAX_GRUPO_DIA
                and need.get(g, 0) >= n
                and grupo_cabe_no_dia(g, d, dias_lift))

    def cobertas(d):
        """Categorias funcionais ja presentes neste dia."""
        c = set()
        L = dias_lift[d]
        c.add(CATEGORIA['morto' if L == 'MORTO' else GRUPO_ACC[L]])
        for g in plano[d]:
            c.add(CATEGORIA[g])
        return c

    # ---- 0. PERNA: conforme o lift de cada dia
    for d in DIAS:
        n = PERNA_POR_LIFT[dias_lift[d]]
        if n:
            por(d, 'perna', n)
    need['perna'] = 0

    # ---- 1. abs: so nas segundas e quintas, 2 series cada
    for d in ABS_DIAS:
        por(d, 'abs', SERIES_ACESSORIO)
    need['abs'] = 0

    # ---- 2. bracos: o braco segue o lift do dia -- triceps quando e empurrar,
    #        biceps quando e puxar. Sai 2 dias de cada, 3 series.
    for d in DIAS:
        g = BRACO_DO_LIFT[dias_lift[d]]
        por(d, g, SERIES_ACESSORIO)
        need[g] -= SERIES_ACESSORIO

    # ---- 3. gemeos: 2 dias, 3+3, nos dias mais leves
    perm = sorted([d for d in DIAS if cabe(d, 'gemeos', SERIES_ACESSORIO)],
                  key=lambda d: carga[d])
    for d in perm[:GEMEOS_DIAS]:
        por(d, 'gemeos', SERIES_ACESSORIO)
        need['gemeos'] -= SERIES_ACESSORIO

    # ---- 4. cobertura: cada dia precisa de perna, empurrar e puxar
    for d in DIAS:
        for cat in OBRIGATORIAS:
            if cat in cobertas(d):
                continue
            cands = [g for g in need
                     if CATEGORIA.get(g) == cat and need[g] >= SERIES_ACESSORIO
                     and cabe(d, g, SERIES_ACESSORIO)]
            if not cands:
                raise SystemExit('sem forma de cobrir %s na %s' % (cat, d))
            g = max(cands, key=lambda x: need[x])   # o grupo com mais volume a colocar
            por(d, g, SERIES_ACESSORIO)
            need[g] -= SERIES_ACESSORIO

    # ---- 5. o resto: blocos de ate 3, espalhados pelos dias mais leves
    while any(need[g] > 0 for g in need):
        g = max(need, key=lambda x: need[x])
        if need[g] <= 0:
            break
        n = SERIES_ACESSORIO                        # todos os acessorios: 2 series
        cands = [d for d in DIAS if cabe(d, g, n)]
        if not cands:
            raise SystemExit('sem espaco para %s (faltam %d)' % (g, need[g]))
        d = min(cands, key=lambda x: (no_dia[x].get(g, 0), carga[x]))
        por(d, g, n)
        need[g] -= n

    # ---- 6. equilibrio: puxa series dos dias cheios para os curtos.
    #        A perna e os abs ficam de fora -- tem regra propria.
    for _ in range(12):
        d_min = min(DIAS, key=lambda x: carga[x])
        d_max = max(DIAS, key=lambda x: carga[x])
        if (carga[d_min] >= MIN_DIA
                or carga[d_max] - carga[d_min] < 2 * SERIES_ACESSORIO):
            break
        cands = [g for g in plano[d_max]
                 if g not in ('perna', 'abs')
                 and plano[d_max][g] >= SERIES_ACESSORIO
                 and grupo_cabe_no_dia(g, d_min, dias_lift)
                 and no_dia[d_min].get(g, 0) + SERIES_ACESSORIO <= MAX_GRUPO_DIA
                 and carga[d_min] + SERIES_ACESSORIO <= (LIM_SEGUNDA
                                                         if d_min == 'segunda'
                                                         else TETO_DIA)]
        if not cands:
            break
        g = max(cands, key=lambda x: plano[d_max][x])
        plano[d_max][g] -= SERIES_ACESSORIO
        if plano[d_max][g] == 0:
            del plano[d_max][g]
        no_dia[d_max][g] -= SERIES_ACESSORIO
        carga[d_max] -= SERIES_ACESSORIO
        por(d_min, g, SERIES_ACESSORIO)

    return plano


def escolher_exercicios(plano_semana, dias_lift, semente, usos, semana):
    """Converte {dia: {grupo: n}} em {dia: [(exercicio, series)]}.
    Respeita a intensidade permitida em cada dia e nao repete o mesmo
    exercicio em dias seguidos."""
    out = {}
    anterior = set()
    dia_agach = [d for d in DIAS if dias_lift[d] == 'AGACHAMENTO'][0]
    for i, d in enumerate(DIAS):
        usados, linhas = set(), []
        # a familia do lift foco ja esta ocupada -- e o que impede o romanian
        # deadlift de cair no dia do peso morto
        # familias ja ocupadas: a do lift de hoje e -- para os movimentos de
        # cadeia posterior -- tambem a do lift de ontem. E o que impede o romanian
        # deadlift de cair no dia seguinte ao peso morto.
        fams = {familia(NOME_LIFT[dias_lift[d]])}
        # familias DURAS bloqueadas: as do lift de ontem e de amanha, e as do que
        # saiu ontem. Tabela propria -- o goblet e o smith nao entram aqui, por
        # isso podem seguir-se a um front squat sem problema.
        duras = set()
        for viz in (dia_anterior(d), dia_seguinte(d)):
            if viz:
                f = familia_dura(NOME_LIFT[dias_lift[viz]])
                if f:
                    duras.add(f)
        if dia_anterior(d):
            for x in anterior:
                f = familia_dura(x)
                if f:
                    duras.add(f)
        pares = sorted(plano_semana[d].items(), key=lambda kv: -kv[1])
        for g, n in pares:
            perm_pesado = pesados_ok(g, d, dias_lift)
            lista = [x for x in PREF[g]
                     if perm_pesado or ACC[x][4] == 'leve']
            if not lista:
                lista = [x for x in PREF[g] if ACC[x][4] == 'leve'] or PREF[g]
            fora = bloqueados(d, dias_lift)
            aj = AJUSTES.get((semana, d), {})
            vetados = aj.get('fora', [])
            pedidos = [x for x in aj.get('dentro', []) if ACC[x][0] == g]
            permitidos = [x for x in lista
                          if subgrupo(x) not in fora
                          and familia_dura(x) not in duras
                          and x not in vetados]
            if permitidos:
                lista = permitidos
            livres = [x for x in lista if familia(x) not in fams]
            if livres:
                lista = livres            # so cede se nao houver mesmo alternativa
            frescos = ([x for x in lista if x not in anterior]
                       if dia_anterior(d) else list(lista))
            # se as familias livres nao chegam para os blocos previstos, faz-se
            # menos exercicios com mais series -- nunca repetir familia no dia
            n_fam = len({familia(x) for x in lista})
            # Quantos exercicios usar: no maximo os frescos que existem, para nunca
            # repetir o de ontem so por causa da divisao. Blocos de 2 a 4 series.
            # um exercicio por cada 2 series -- e a regra, sem excepcoes
            k = max(1, n // SERIES_ACESSORIO)
            tamanhos = [SERIES_ACESSORIO] * k
            for bloco, s in enumerate(tamanhos):
                # duas passagens: primeiro os que nao sairam no dia anterior,
                # so depois os repetidos. Assim o fresco ganha sempre que exista.
                nome = None
                pools = (frescos, lista)
                # o que o Bruno pediu a mao para este dia vem primeiro
                pedidos_livres = [x for x in pedidos
                                  if x not in usados and x in lista]
                if pedidos_livres:
                    pools = (pedidos_livres, frescos, lista)
                # na perna, nos dias que nao sao do agachamento, a maquina abre e
                # o composto vem a seguir -- e trabalho acessorio, nao o prato
                # principal do dia
                perna_acessoria = (g == 'perna' and d != dia_agach)
                # o composto so abre quando o grupo leva 2+ exercicios no dia.
                # Se leva um so, escolhe-se pelo menos usado -- senao os pesados
                # apanhavam sempre esse slot e os isolamentos nunca saiam.
                if (bloco == 0 and perm_pesado and not perna_acessoria
                        and len(tamanhos) > 1 and not pedidos_livres):
                    # o composto abre o grupo, quando a regra deixa -- e a ordem
                    # certa de treino e rende mais do que a maquina
                    # so entre os frescos: se o unico composto do grupo saiu
                    # ontem, nao se repete so para o por primeiro
                    pes = [x for x in frescos if ACC[x][4] == 'pesado']
                    if pes:
                        pools = (pes, frescos, lista)
                for pool in pools:
                    disp = [x for x in pool if x not in usados]
                    if disp:
                        # o menos usado ate agora no ciclo -- equilibra a variedade
                        nome = min(disp, key=lambda x: (usos.get(x, 0),
                                                        PREF[g].index(x)))
                        break
                if nome is None:
                    nome = min(lista, key=lambda x: usos.get(x, 0))
                usos[nome] = usos.get(nome, 0) + 1
                usados.add(nome)
                fams.add(familia(nome))
                lista = [x for x in lista if familia(x) not in fams] or lista
                frescos = [x for x in frescos if familia(x) not in fams]
                linhas.append((nome, s))
        out[d] = linhas
        anterior = usados
    return out


# ---------------------------------------------------------------- CONSTRUCAO
def construir_semana(w, usos):
    dias_lift = calendario(w)
    grupos = alocar(dias_lift)
    exs = escolher_exercicios(grupos, dias_lift, w, usos, w + 1)
    aprox = lift_em_aproximacao(dias_lift)
    sem = {'semana': w + 1, 'tipo': 'progressao', 'ciclo': 1,
           'maximos': dias_lift['segunda'], 'lift_em_aproximacao': aprox,
           'grupo_em_aproximacao': GRUPO_ACC[aprox], 'dias': {}}
    for d in DIAS:
        ex = []
        if True:
            L = dias_lift[d]
            ex.append({'nome': NOME_LIFT[L],
                       'grupo': 'morto' if L == 'MORTO' else GRUPO_ACC[L],
                       'categoria': CATEGORIA['morto' if L == 'MORTO'
                                              else GRUPO_ACC[L]],
                       'foco': True, 'modo': MODO[d], 'intensidade': 'pesado',
                       'series': [[p, r] for p, r in LIFT[L][MODO[d]]]})
        for nome, s in exs[d]:
            g, peso, a, b, inten = ACC[nome]
            ex.append({'nome': nome, 'grupo': g, 'categoria': CATEGORIA[g],
                       'foco': False, 'intensidade': inten,
                       'series': series_acessorio(nome, d)})
        # sort estavel: mantem a ordem dentro de cada escalao, so empurra
        # braco, gemeos e abs para o fim
        ordem_g = {}
        for e in ex:
            if not e['foco'] and e['grupo'] not in ordem_g:
                ordem_g[e['grupo']] = len(ordem_g)
        ex.sort(key=lambda e: (0, 0, 0) if e['foco'] else
                (ORDEM_SESSAO[e['categoria']], ordem_g[e['grupo']],
                 1 if e['nome'] in ISOLAMENTO else 0))
        sem['dias'][d] = {'lift': dias_lift[d],
                          'modo': MODO[d], 'exercicios': ex}
    return sem


def construir():
    usos = {}          # contador partilhado pelas 4 semanas
    return {
      'versao': 2,
      'criado': '2026-08-25',
      'config': {
        'dias': DIAS,
        'rotacao': 'frente',
        'ciclo_semanas': 4,
        'ordem_circular': LIFTS,
        'modos': MODO,
        'descansos_seg': {'top_maximos': 300, 'lift_foco': 180,
                          'composto': 90, 'isolamento': 60},
        'categorias_obrigatorias_por_dia': OBRIGATORIAS,
      },
      'lifts_foco': {L: {'nome': NOME_LIFT[L],
                         'grupo': 'morto' if L == 'MORTO' else GRUPO_ACC[L],
                         'maximo_ciclo1': LIFT[L]['max_c1'],
                         'incremento_por_ciclo': LIFT[L]['inc'],
                         'maximos':   [[p, r] for p, r in LIFT[L]['maximos']],
                         'volume_5':  [[p, r] for p, r in LIFT[L]['volume_5']],
                         'volume_8':  [[p, r] for p, r in LIFT[L]['volume_8']],
                         'leve':      [[p, r] for p, r in LIFT[L]['leve']]}
                     for L in LIFTS},
      'acessorios': {n: {'grupo': ACC[n][0], 'categoria': CATEGORIA[ACC[n][0]],
                         'series': series_acessorio(n),
                         'intensidade': ACC[n][4]} for n in ACC},
      'regras': {
        'corpo_inteiro_todos_os_dias': OBRIGATORIAS,
        'aproximacao_bloqueia_pesados_em': ['quinta', 'sexta'],
        'teto_series_dia_maximos': LIM_SEGUNDA,
        'teto_series_outros_dias': TETO_DIA,
        'max_series_por_grupo_por_dia': MAX_GRUPO_DIA,
        'bracos': 'biceps em 2 dias, triceps nos outros 2 -- braco todos os dias',
        'perna_por_lift': PERNA_POR_LIFT,
        'interferencia': {L: {k: sorted(v) for k, v in reg.items()}
                          for L, reg in INTERFERE.items()},
        'subgrupos': SUBGRUPO,
        'perna_dia_do_agachamento': 'so o agachamento, mais nada',
        'abs_dias': ABS_DIAS,
        'min_series_por_dia': MIN_DIA,
        'familias': 'dois exercicios da mesma familia nunca no mesmo dia',
        'familia_por_exercicio': FAMILIA,
        'familia_dura': FAMILIA_DURA,
        'progressao_acessorios': ('dupla progressao: acerta o topo da faixa em todas '
                                  'as series -> +2,5 kg barra/halteres, '
                                  '+5 kg maquina/cabo'),
        'maximos_falhado': ('se o top sair facil sobe 5 kg e repete; se falhar, fica '
                            'no peso anterior e o ciclo seguinte nao sobe'),
      },
      'volume_alvo_semanal': ALVO,
      'calendario': [construir_semana(w, usos) for w in range(4)],
    }


# ------------------------------------------------------------------- DATAS
def carimbar_datas(plano):
    for i, sem in enumerate(plano['calendario']):
        base = DATA_INICIO + datetime.timedelta(days=7 * i)
        sem['inicio'] = base.isoformat()
        for d in DIAS:
            sem['dias'][d]['data'] = (base + datetime.timedelta(
                days=OFFSET_DIA[d])).isoformat()
    plano['config']['data_inicio'] = DATA_INICIO.isoformat()
    return plano


# --------------------------------------------------------------- MARKDOWN
def fmt(x):
    return ('%g' % x).replace('.', ',')


def linha_series(ex):
    n = len(ex['series'])
    if ex['foco']:
        partes = []
        for j, (p, r) in enumerate(ex['series']):
            t = '%s x %d' % (fmt(p), r)
            if ex['modo'] == 'maximos' and j == n - 2:
                t = '**%s**' % t
            elif ex['modo'] == 'maximos' and j == n - 1:
                t = '%s _(back-off)_' % t
            partes.append(t)
        return ' · '.join(partes)
    if ex['nome'] == 'Plank':
        return '2 × %d-%d s' % (ex['series'][0][1], ex['series'][1][1])
    if not ex['series'][0][0]:
        r1, r2 = ex['series'][0][1], ex['series'][1][1]
        if ex['categoria'] == 'abs':
            return '2 × %d-%d reps' % (r1, r2)
        return 'peso corporal · %d e %d reps' % (r1, r2)
    return ' · '.join('%s x %d' % (fmt(p), r) for p, r in ex['series'])


TITULO_MODO = {'maximos': 'MÁXIMOS', 'volume_5': 'pesado, 5 reps',
               'volume_8': 'médio, 6-8 reps', 'leve': 'leve, 8 reps'}
ICONE_CAT = {'perna': 'perna', 'empurrar': 'empurrar', 'puxar': 'puxar',
             'braco': 'braço', 'gemeos': 'gémeos', 'abs': 'abs'}


def md_semana(sem):
    L = []
    L.append('## Semana %d (%s) — máximos: %s\n' % (
        sem['semana'], sem['inicio'], NOME_LIFT[sem['maximos']].lower()))
    L.append('O %s está à terça e vai a **máximos na segunda seguinte** — por isso\n'
             'na quinta e na sexta não há nada de **%s** com barra livre, só máquina, '
             'para\nchegar recuperado.\n'
             % (NOME_LIFT[sem['lift_em_aproximacao']].lower(),
                sem['grupo_em_aproximacao']))
    for d in DIAS:
        dd = sem['dias'][d]
        tot = sum(len(e['series']) for e in dd['exercicios'])
        cab = NOME_LIFT[dd['lift']]
        L.append('### %s %s — %s · %s · %d séries\n' % (
            NOME_DIA[d], dd['data'][8:10] + '/' + dd['data'][5:7],
            cab, TITULO_MODO[dd['modo']], tot))
        L.append('| Exercício | | Séries | |')
        L.append('|---|---|:--:|---|')
        for ex in dd['exercicios']:
            nome = '**%s**' % ex['nome'] if ex['foco'] else ex['nome']
            n = len(ex['series'])
            L.append('| %s | _%s_ | %d | %s |' % (
                nome, ICONE_CAT[ex['categoria']], n, linha_series(ex)))
        L.append('')
    return '\n'.join(L)


def md_volume(plano):
    L = ['| Grupo | Alvo | S1 | S2 | S3 | S4 |', '|---|:--:|:--:|:--:|:--:|:--:|']
    ciclo = plano['calendario']
    for g in ['perna', 'peito', 'costas', 'ombro', 'biceps',
              'triceps', 'gemeos', 'abs', 'morto']:
        cels = []
        for sem in ciclo:
            v = 0
            for d in DIAS:
                for ex in sem['dias'][d]['exercicios']:
                    if ex['grupo'] == g:
                        v += len(ex['series'])
            cels.append(str(v))
        L.append('| %s | %d | %s |' % (g, ALVO[g], ' | '.join(cels)))
    return '\n'.join(L)


def md_quadro(plano):
    """Quadro resumo: uma tabela por semana, um dia por coluna."""
    L = ['## Quadro resumo', '',
         'Cada coluna e um dia. A primeira linha de cada quadro e o exercicio foco.', '']
    for sem in plano['calendario']:
        L.append('**Semana %d** — máximos: %s' % (
            sem['semana'], NOME_LIFT[sem['maximos']].lower()))
        L.append('')
        cabs, cols = [], []
        for d in DIAS:
            dd = sem['dias'][d]
            tot = sum(len(e['series']) for e in dd['exercicios'])
            cabs.append('%s %s<br>_%s · %d séries_' % (
                NOME_DIA[d], dd['data'][8:10] + '/' + dd['data'][5:7],
                TITULO_MODO[dd['modo']], tot))
            linhas = []
            for ex in dd['exercicios']:
                n = len(ex['series'])
                if ex['foco']:
                    linhas.append('**%s** %d×' % (ex['nome'], n))
                else:
                    linhas.append('%s %d×' % (ex['nome'], n))
            cols.append(linhas)
        L.append('| ' + ' | '.join(cabs) + ' |')
        L.append('|' + '---|' * len(DIAS))
        for i in range(max(len(c) for c in cols)):
            cel = [c[i] if i < len(c) else '' for c in cols]
            L.append('| ' + ' | '.join(cel) + ' |')
        L.append('')
    return '\n'.join(L)


def escrever_md(plano):
    ciclo = plano['calendario']
    L = ['# Plano de treino — Bruno', '',
         'Full body a sério: **todos os dias têm perna, empurrar, puxar e braço.**',
         'Os quatro exercícios foco são feitos **todas as semanas** e vão recuando '
         'um dia por semana.',
         'Segunda, terça, quinta e sexta.', '', '---', '',
         '## Como funciona', '',
         '**Cada lift recua um dia por semana:** segunda → sexta → quinta → terça '
         '→ segunda.',
         'Isso faz com que passe pelos quatro modos, sempre por ordem crescente '
         'de esforço:', '',
         '| Dia | Modo | O que é |', '|---|---|---|',
         '| **Sexta** | leve | 4×8, ~75% — recomeça a onda |',
         '| **Quinta** | pesado | 4×5 |',
         '| **Terça** | médio | 4×6-8 — descarga parcial antes do limite |',
         '| **Segunda** | **MÁXIMOS** | aproximações + single + back-off |',
         '',
         '**A ordem roda todas as semanas:**', '',
         '| | Segunda (máximos) | Terça (pesado) | Quinta (médio) | Sexta (leve) |',
         '|---|---|---|---|---|']
    for sem in ciclo:
        L.append('| **Semana %d** | %s | %s | %s | %s |' % (
            sem['semana'],
            NOME_LIFT[sem['dias']['segunda']['lift']],
            NOME_LIFT[sem['dias']['terca']['lift']],
            NOME_LIFT[sem['dias']['quinta']['lift']],
            NOME_LIFT[sem['dias']['sexta']['lift']]))
    L += ['| **Semana 5** | _volta à semana 1, com mais peso_ | | | |', '',
          'Duas coisas saem desta rotação sem terem de ser forçadas:', '',
          '**1.** O lift que está à sexta **nunca** é o dos máximos da segunda '
          'seguinte — por isso',
          'nenhum lift precisa de sair da semana. Fazes os quatro, todas as semanas.',
          '',
          '**2.** Logo a seguir aos máximos vêm **11 dias** sem esse lift. '
          'É a recuperação do',
          'esforço máximo, e chega sozinha.', '',
          '| Lift | Percurso no ciclo | Dias entre sessões |', '|---|---|---|']
    ordem_txt = {
        'MORTO': ('S1 seg **MÁX** → S2 sex leve → S3 qui pesado → S4 ter médio',
                  '**11** · 6 · 5 · 6'),
        'SUPINO': ('S1 ter médio → S2 seg **MÁX** → S3 sex leve → S4 qui pesado',
                   '6 · **11** · 6 · 5'),
        'AGACHAMENTO': ('S1 qui pesado → S2 ter médio → S3 seg **MÁX** → S4 sex leve',
                        '5 · 6 · **11** · 6'),
        'OMBRO': ('S1 sex leve → S2 qui pesado → S3 ter médio → S4 seg **MÁX**',
                  '6 · 5 · 6 · **11**'),
    }
    for Lf in LIFTS:
        L.append('| %s | %s | %s |' % (NOME_LIFT[Lf], ordem_txt[Lf][0],
                                       ordem_txt[Lf][1]))
    L += ['', '## As regras', '',
          '**1 — Todos os dias são corpo inteiro.** Cada sessão tem pelo menos um '
          'de perna, um de',
          'empurrar (peito ou ombro), um de puxar (costas) e um de braço. '
          'O peso morto **não** conta',
          'como perna — o dia do morto leva sempre quadricípite à parte.', '',
          '**2 — Todos os exercícios foco levam 4 séries. Todos os outros '
          'levam 2.** Sem excepções.', '',
          '**3 — O lift de terça vai a máximos na segunda seguinte.** Nessa '
          'semana, a quinta e a',
          'sexta não levam nada pesado desse grupo — só máquina e isolamento. '
          'Se o agachamento é',
          'na segunda, a sexta anterior tem perna, mas leve: leg extension sim, '
          'búlgaro não.', '',
          '**4 — Interferência entre dias seguidos.** Atenção: a quarta é dia de '
          'descanso, por isso',
          'só a segunda→terça e a quinta→sexta é que são dias seguidos a sério. '
          'Nesses pares:', '',
          '| Se o dia seguinte é… | Hoje não leva |', '|---|---|',
          '| Peso morto | cadeia posterior nem unilateral |',
          '| Agachamento | cadeia posterior nem unilateral |',
          '| Press de ombro | peito inclinado nem ombro |', '',
          'E no próprio dia do peso morto, a perna é só quadricípite — o morto '
          'já fez o posterior.', '',
          '**5 — Braços seguem o lift:** tríceps nos dias de empurrar (supino e '
          'press), bíceps nos',
          'de puxar (peso morto e agachamento). Dá 2 dias de cada.', '',
          '**6 — Nunca dois exercícios do mesmo movimento no mesmo dia.** '
          'Elevação lateral com',
          'halteres e na máquina são o mesmo movimento; peso morto e romanian '
          'também. Os que',
          'carregam a coluna a sério não aparecem sequer em dias seguidos.', '',
          '**7 — A perna depende do lift do dia:** dia do agachamento leva só o '
          'agachamento; dia do',
          'peso morto leva 2 séries; supino e press de ombro levam 4. '
          'Abdominais só segunda e quinta.', '',
          '## Volume semanal por grupo', '', md_volume(plano), '',
          'O peso morto conta à parte das costas — as 4 séries dele não entram '
          'nesse total.',
          'O volume é igual nas quatro semanas: **62 séries**.', '',
          '## Regras práticas', '',
          '**Descansos.** 4-5 min antes do top set dos máximos · 3 min nas outras '
          'séries do lift foco ·',
          '90 s nos compostos acessórios · 60 s nos isolamentos.', '',
          '**Acessórios.** Sobe o peso quando acertares o topo da faixa de reps '
          'em todas as séries:',
          '+2,5 kg na barra e nos halteres, +5 kg na máquina e no cabo.', '',
          '**Quando o máximo sai fácil** (sentiste que dava mais uma): sobe 5 kg '
          'e repete no ciclo seguinte.',
          '**Quando falha:** fica no peso anterior e o ciclo seguinte não sobe.', '',
          '## Progressão dos máximos', '',
          '| Lift | Ciclo 1 | Ciclo 2 | Ciclo 3 | Melhor de sempre |',
          '|---|:--:|:--:|:--:|---|']
    PR = {'MORTO': '200×1 (jul 2026)', 'AGACHAMENTO': '160×3 (mai 2026)',
          'SUPINO': '130×1 (mar 2026)', 'OMBRO': '70×1 (jul 2026)'}
    for Lf in LIFTS:
        m, inc = LIFT[Lf]['max_c1'], LIFT[Lf]['inc']
        L.append('| %s | %s | %s | %s | %s |' % (NOME_LIFT[Lf], fmt(m),
                                                 fmt(m + inc), fmt(m + 2 * inc), PR[Lf]))
    L += ['', 'Os números do ciclo 1 saem dos teus sets de agosto de 2026, '
          'recuados por causa das',
          'três semanas parado. Ao terceiro ciclo estás nos teus recordes.', '',
          '---', '', md_quadro(plano), '---', '']
    for sem in plano['calendario']:
        L.append(md_semana(sem))
        L += ['---', '']
    L += ['_Gerado por `gerar.py`. Para mudar a data de arranque, muda '
          '`DATA_INICIO` nesse ficheiro_',
          '_e volta a correr `python gerar.py` seguido de `python validar.py`._']
    return '\n'.join(L)


if __name__ == '__main__':
    plano = carimbar_datas(construir())
    with open(os.path.join(AQUI, 'plano-treino.json'), 'w', encoding='utf-8') as f:
        json.dump(plano, f, ensure_ascii=False, indent=2)
    with open(os.path.join(AQUI, 'Plano-Treino.md'), 'w', encoding='utf-8') as f:
        f.write(escrever_md(plano))
    print('plano-treino.json  -', len(plano['calendario']), 'semanas')
    print('Plano-Treino.md    - escrito')
