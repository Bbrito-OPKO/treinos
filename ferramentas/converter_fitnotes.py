# -*- coding: utf-8 -*-
"""
Converte a base do FitNotes de iPhone (.fitnotesdb, formato Core Data) para o
ficheiro de backup JSON que a app Treinos importa.

Porque nao se usa o CSV: o CSV do FitNotes deita fora a ordem das series dentro
do treino, os supersets, as marcacoes de recorde, as pesagens e as horas de
inicio/fim. A base guarda tudo isso. Correr uma vez, fora da app.

Uso:
    python converter_fitnotes.py <ficheiro.fitnotesdb> [-o backup.json]

O ficheiro original NUNCA e alterado: e copiado para uma pasta temporaria e
aberto em modo so-leitura.
"""

import argparse
import collections
import datetime
import json
import os
import shutil
import sqlite3
import sys
import tempfile

# O Core Data conta os segundos a partir de 2001-01-01, nao de 1970.
EPOCA_APPLE = datetime.datetime(2001, 1, 1)

# Os grupos musculares do FitNotes vem em ingles (categorias criadas pela
# importacao do Android) ou em espanhol (categorias de fabrica da app iOS).
# Ambos os nomes apontam para o mesmo grupo na app.
# A chave e sempre minusculas e sem acentos (ver _chave), por isso "Biceps" e
# "Biceps" com acento entram os dois por "biceps" e nao ha duplicados.
GRUPOS = {
    "chest": "Peito",       "pecho": "Peito",
    "back": "Costas",       "espalda": "Costas",
    "legs": "Pernas",       "piernas": "Pernas",
    "shoulders": "Ombros",  "hombros": "Ombros",
    "biceps": "Bíceps",
    "triceps": "Tríceps",
    "abs": "Abdominais",    "abdominales": "Abdominais",
    "core": "Abdominais",
    "cardio": "Cardio",
}

# ZEXERCISE.ZKINDINT diz como o exercicio se mede.
TIPOS = {
    3: "peso_reps",         # o normal: kg + repeticoes
    9: "peso_tempo",        # pranchas e afins: kg + duracao
    12: "distancia_tempo",  # cardio: distancia + duracao
}

# ZWORKOUTSET usa sentinelas em vez de NULL para "nao preenchido".
SENTINELAS = {-999999.0, -1.0, -1}

# A base guarda o peso em centesimos de kg, como inteiro: 7000 sao 70,00 kg.
# Confirmado de tres maneiras: o valor 7000 corresponde a "70.00" no CSV
# exportado, o maximo 25000 corresponde aos 250 kg do CSV, e ZWEIGHTKG a
# dividir por ZWEIGHTLBS da 0,45358, que e o factor de libras para quilos.
ESCALA_PESO = 100.0

# A distancia aparece no CSV com as mesmas duas casas decimais que o peso
# ("0.00"), o que aponta para a mesma escala. Nao da para confirmar com
# medicoes porque todas as 117 series de cardio tem distancia zero.
ESCALA_DISTANCIA = 100.0


def _chave(texto):
    """Minusculas e sem acentos, para casar nomes de categoria de forma segura."""
    import unicodedata
    sem_acento = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.strip().lower()


def _sem_sentinela(valor):
    """Devolve None quando o campo esta vazio (a base marca-o com -1/-999999)."""
    if valor is None or valor in SENTINELAS:
        return None
    return valor


def _data(segundos):
    """Converte um instante Core Data para AAAA-MM-DD."""
    if segundos is None:
        return None
    return (EPOCA_APPLE + datetime.timedelta(seconds=segundos)).date().isoformat()


def _instante(segundos):
    """Converte um instante Core Data para ISO completo."""
    if segundos is None:
        return None
    return (EPOCA_APPLE + datetime.timedelta(seconds=segundos)).isoformat(timespec="seconds")


def _grupo(nome_categoria):
    """Traduz o nome da categoria para o grupo muscular da app."""
    if not nome_categoria:
        return "Outros"
    return GRUPOS.get(_chave(nome_categoria), nome_categoria.strip())


def abrir_copia_so_leitura(caminho):
    """Copia a base para uma pasta temporaria e abre-a em modo ro.

    Nunca abrimos o ficheiro original: o SQLite escreve journals mesmo em
    leituras, e esta base e o unico registo de 6 anos de treinos.
    """
    pasta = tempfile.mkdtemp(prefix="fitnotes_")
    copia = os.path.join(pasta, "base.db")
    shutil.copy2(caminho, copia)
    ligacao = sqlite3.connect("file:" + copia + "?mode=ro", uri=True)
    ligacao.row_factory = sqlite3.Row
    # A base tem acentos em espanhol; nao queremos rebentar num byte estranho.
    ligacao.text_factory = lambda b: b.decode("utf-8", "replace")
    return ligacao, pasta


def ler_exercicios(bd):
    """Biblioteca de exercicios, com grupo muscular e descanso por defeito."""
    exercicios = {}
    consulta = """
        SELECT e.Z_PK, e.ZNAME, e.ZKINDINT, e.ZRESTTIME, e.ZNOTES,
               cat.ZNAME AS cat_nome, cat.ZNAMEKEYRAW AS cat_chave
        FROM ZEXERCISE e
        LEFT JOIN ZEXERCISECATEGORY cat ON cat.Z_PK = e.ZCATEGORY
    """
    for linha in bd.execute(consulta):
        # ZNAMEKEYRAW e o nome em ingles das categorias de fabrica; para as
        # categorias criadas na importacao so existe ZNAME (ja em ingles).
        categoria = linha["cat_chave"] or linha["cat_nome"]
        descanso = _sem_sentinela(linha["ZRESTTIME"])
        exercicios[linha["Z_PK"]] = {
            "id": linha["Z_PK"],
            "nome": (linha["ZNAME"] or "Sem nome").strip(),
            "grupo": _grupo(categoria),
            "tipo": TIPOS.get(linha["ZKINDINT"], "peso_reps"),
            "descansoSeg": int(descanso) if descanso else None,
            "notas": (linha["ZNOTES"] or "").strip() or None,
            "arquivado": False,
        }
    return exercicios


def ler_sessoes(bd):
    """Um treino por dia, salvo os dias em que houve dois."""
    sessoes = {}
    consulta = """
        SELECT Z_PK, ZDATE, ZSTARTTIME, ZSTOPTIME, ZNOTES
        FROM ZWORKOUT ORDER BY ZDATE
    """
    for linha in bd.execute(consulta):
        sessoes[linha["Z_PK"]] = {
            "id": linha["Z_PK"],
            "data": _data(linha["ZDATE"]),
            "inicio": _instante(linha["ZSTARTTIME"]),
            "fim": _instante(linha["ZSTOPTIME"]),
            "notas": (linha["ZNOTES"] or "").strip() or None,
        }
    return sessoes


def ler_series(bd, datas_das_sessoes):
    """Todas as series, pela ordem real em que foram feitas no treino.

    A ordem sai de duas colunas: ZWORKOUTEXERCISE.ZINDEX diz em que posicao do
    treino entrou o exercicio, e ZWORKOUTSET.ZINDEX diz a posicao da serie
    dentro desse exercicio.

    ATENCAO: o ZINDEX nao e 0, 1, 2. E uma chave de ordenacao de 64 bits (so
    tem 104 valores distintos em toda a base, do genero -7378697629483820808).
    Ordena bem, mas nao se pode somar nem contar com ela. Por isso, depois de
    ler tudo pela ordem certa, as posicoes sao renumeradas de 0 para cima, que
    e o que a app usa quando grava uma serie nova.
    """
    series = []
    consulta = """
        SELECT s.Z_PK, s.ZWORKOUT, s.ZEXERCISE, s.ZINDEX AS idx_serie,
               we.ZINDEX AS idx_exercicio, we.ZSUPERSET,
               s.ZWEIGHTKG, s.ZREPS, s.ZRIR, s.ZTIME,
               s.ZDISTANCEAMOUNT, s.ZDISTANCEUNITINT,
               s.ZISALLTIMERECORD, s.ZNOTES
        FROM ZWORKOUTSET s
        JOIN ZWORKOUTEXERCISE we ON we.Z_PK = s.ZWORKOUTEXERCISE
        ORDER BY s.ZWORKOUT, we.ZINDEX, s.ZINDEX
    """
    for linha in bd.execute(consulta):
        peso = _sem_sentinela(linha["ZWEIGHTKG"])
        reps = _sem_sentinela(linha["ZREPS"])
        tempo = _sem_sentinela(linha["ZTIME"])
        distancia = _sem_sentinela(linha["ZDISTANCEAMOUNT"])
        series.append({
            "id": linha["Z_PK"],
            "sessaoId": linha["ZWORKOUT"],
            "exercicioId": linha["ZEXERCISE"],
            # A data repete-se aqui de proposito: e por ela que a app indexa as
            # series na IndexedDB, e sem isso qualquer grafico obrigava a ler
            # as 1130 sessoes so para saber em que dia caiu cada serie.
            "data": datas_das_sessoes.get(linha["ZWORKOUT"]),
            "ordemExercicio": linha["idx_exercicio"],
            "ordem": linha["idx_serie"],
            "peso": round(float(peso) / ESCALA_PESO, 2) if peso is not None else None,
            "reps": int(reps) if reps is not None else None,
            # A base tem coluna de RIR mas nunca foi preenchida: vale -999999
            # nas 28.747 series. Entra vazio e passa a contar de hoje em diante.
            "rir": _sem_sentinela(linha["ZRIR"]),
            "tempoSeg": int(tempo) if tempo else None,
            "distancia": float(distancia) / ESCALA_DISTANCIA if distancia else None,
            "supersetId": linha["ZSUPERSET"],
            # Guardamos a marca de recorde da propria app para se poder conferir
            # a nossa deteccao de PR contra uma fonte independente.
            "recordeOriginal": bool(linha["ZISALLTIMERECORD"]),
            "nota": (linha["ZNOTES"] or "").strip() or None,
        })

    # Renumerar: 'ordem' e a posicao da serie no treino todo (0, 1, 2...) e
    # 'ordemExercicio' e a posicao do exercicio nesse treino. A lista ja vem
    # ordenada pela consulta, por isso basta contar.
    posicao = {}
    for s in series:
        p = posicao.setdefault(s["sessaoId"], {"n": 0, "exercicios": {}})
        if s["exercicioId"] not in p["exercicios"]:
            p["exercicios"][s["exercicioId"]] = len(p["exercicios"])
        s["ordemExercicio"] = p["exercicios"][s["exercicioId"]]
        s["ordem"] = p["n"]
        p["n"] += 1

    return series


def ler_pesagens(bd):
    """Historico de peso corporal (tipo Body Weight nas medicoes)."""
    consulta = """
        SELECT m.ZDATE, m.ZVALUE
        FROM ZFNMEASUREMENT m
        JOIN ZMEASUREMENTTYPE t ON t.Z_PK = m.ZTYPE
        WHERE lower(coalesce(t.ZNAMEKEYRAW, t.ZNAME)) = 'body weight'
        ORDER BY m.ZDATE
    """
    # Cada pesagem leva id proprio: ha dias com duas medicoes e usar a data
    # como chave faria a segunda apagar a primeira.
    return [{"id": i + 1, "data": _data(l["ZDATE"]), "kg": round(float(l["ZVALUE"]), 2)}
            for i, l in enumerate(bd.execute(consulta))]


def converter(caminho_bd):
    bd, pasta_temp = abrir_copia_so_leitura(caminho_bd)
    try:
        exercicios = ler_exercicios(bd)
        sessoes = ler_sessoes(bd)
        series = ler_series(bd, {s["id"]: s["data"] for s in sessoes.values()})
        pesagens = ler_pesagens(bd)
    finally:
        bd.close()
        shutil.rmtree(pasta_temp, ignore_errors=True)

    # So exportamos os exercicios que foram mesmo usados: a biblioteca do
    # FitNotes traz 275, mas a maioria nunca viu uma serie.
    usados = {s["exercicioId"] for s in series}
    exercicios = {k: v for k, v in exercicios.items() if k in usados}

    # A app deixa treinos abertos sem nenhuma serie (dias em que se abriu o
    # treino e nao se chegou a registar nada). Nao valem nada no historico.
    com_series = {s["sessaoId"] for s in series}
    vazias = [s for s in sessoes.values() if s["id"] not in com_series]
    sessoes = {k: v for k, v in sessoes.items() if k in com_series}

    return {
        "formato": "treinos-backup",
        "versao": 1,
        "origem": "FitNotes iOS (.fitnotesdb)",
        "exercicios": sorted(exercicios.values(), key=lambda e: (e["grupo"], e["nome"])),
        "sessoes": sorted(sessoes.values(), key=lambda s: s["data"]),
        "series": series,
        "pesagens": pesagens,
        "descartado": {"sessoesVazias": [s["data"] for s in vazias]},
    }


def avisos_de_sanidade(backup):
    """Apanha escalas erradas antes de os dados irem parar a app.

    A base guarda o peso em centesimos de kg. Esquecer a divisao passa
    despercebido nos recordes (a ordem nao muda) mas multiplica todos os
    graficos de volume por 100. Este teste ve se os numeros fazem sentido.
    """
    avisos = []
    pesos = [s["peso"] for s in backup["series"] if s["peso"]]
    if pesos:
        maximo = max(pesos)
        if maximo > 500:
            avisos.append("ATENCAO: peso maximo de %.0f kg. A escala esta errada?" % maximo)
        if maximo < 5:
            avisos.append("ATENCAO: peso maximo de %.2f kg. A escala esta errada?" % maximo)
    reps = [s["reps"] for s in backup["series"] if s["reps"]]
    if reps and max(reps) > 200:
        avisos.append("ATENCAO: %d repeticoes numa serie." % max(reps))
    # As posicoes tem de ser ordinais pequenos: o ZINDEX cru da base sao
    # numeros de 64 bits que estragam qualquer conta feita com eles.
    ordens = [s["ordem"] for s in backup["series"]] + \
             [s["ordemExercicio"] for s in backup["series"]]
    if ordens and (min(ordens) < 0 or max(ordens) > 500):
        avisos.append("ATENCAO: ordens entre %d e %d. Ficaram por renumerar?"
                      % (min(ordens), max(ordens)))
    corporais = [p["kg"] for p in backup["pesagens"]]
    if corporais and (min(corporais) < 30 or max(corporais) > 250):
        avisos.append("ATENCAO: peso corporal entre %.1f e %.1f kg." % (min(corporais), max(corporais)))
    return avisos


def resumo(backup):
    """Os numeros que se conferem contra o CSV antes de importar."""
    series = backup["series"]
    datas = sorted({s["data"] for s in backup["sessoes"]})
    grupos = collections.Counter(e["grupo"] for e in backup["exercicios"])
    pesos = [s["peso"] for s in series if s["peso"]]
    volume = sum((s["peso"] or 0) * (s["reps"] or 0) for s in series)
    return "\n".join([
        "  exercicios ...... %d" % len(backup["exercicios"]),
        "  sessoes ......... %d em %d dias distintos" % (len(backup["sessoes"]), len(datas)),
        "  series .......... %d" % len(series),
        "  intervalo ....... %s -> %s" % (datas[0], datas[-1]) if datas else "  intervalo ....... -",
        "  pesagens ........ %d" % len(backup["pesagens"]),
        "  recordes na app . %d" % sum(1 for s in series if s["recordeOriginal"]),
        "  series com RIR .. %d" % sum(1 for s in series if s["rir"] is not None),
        "  descartado ...... %d treino(s) sem series: %s" % (
            len(backup["descartado"]["sessoesVazias"]),
            ", ".join(backup["descartado"]["sessoesVazias"]) or "-"),
        "  peso por serie .. %.1f a %.1f kg" % (min(pesos), max(pesos)) if pesos else "  peso ............ -",
        "  volume total .... %.0f kg" % volume,
        "  grupos .......... " + ", ".join("%s:%d" % (g, n) for g, n in sorted(grupos.items())),
    ])


def main():
    ap = argparse.ArgumentParser(description="Converte .fitnotesdb para backup JSON da app Treinos")
    ap.add_argument("base", help="caminho do ficheiro .fitnotesdb")
    ap.add_argument("-o", "--saida", default="backup-fitnotes.json")
    args = ap.parse_args()

    if not os.path.isfile(args.base):
        sys.exit("Nao encontrei o ficheiro: " + args.base)

    backup = converter(args.base)
    with open(args.saida, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, separators=(",", ":"))

    tamanho = os.path.getsize(args.saida) / 1024 / 1024
    print("Escrito %s (%.1f MB)\n" % (args.saida, tamanho))
    print(resumo(backup))
    for aviso in avisos_de_sanidade(backup):
        print("\n  " + aviso)


if __name__ == "__main__":
    main()
