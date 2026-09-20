# -*- coding: utf-8 -*-
"""
Mete o plano de treino na app Treinos (a PWA em Documents\\Treinos).

A app NAO tem importacao incremental: 'Importar backup' faz BD.limpar() antes de
gravar, ou seja apaga tudo o que la esta. Por isso este script nao gera um
ficheiro so com o plano -- FUNDE o plano com o backup do historico e produz um
ficheiro unico que traz as duas coisas.

Uso:
    python para_app.py <backup-da-app.json> [-o backup-com-plano.json]

O backup de entrada deve ser fresco: Exercicios -> Dados -> Guardar backup (JSON).
Se usares um backup velho, os treinos registados depois dele perdem-se.

As series do plano entram com feita=false -- e o visto verde por marcar. Enquanto
nao levam o visto nao contam para recordes, volume nem medias.
"""
import json, os, sys, argparse

AQUI = os.path.dirname(os.path.abspath(__file__))
PLANO = os.path.join(AQUI, 'plano-treino.json')

# Os quatro lifts foco tem nome portugues no plano e ingles na biblioteca da app.
NOME_NA_APP = {
    'Peso morto convencional': 'Deadlift',
    'Supino plano com barra': 'Flat Barbell Bench Press',
    'Agachamento com barra livre': 'Barbell Squat',
    'Press de ombro com barra': 'Barbell Shoulder Press',
}


def fundir(backup, plano):
    bib = {e['nome']: e for e in backup['exercicios']}
    tipos = {e['nome']: e['tipo'] for e in backup['exercicios']}

    # ids novos a seguir aos que ja existem, para nao pisar nada
    prox_sessao = max((s['id'] for s in backup['sessoes']), default=0) + 1
    prox_serie = max((s['id'] for s in backup['series']), default=0) + 1

    datas_existentes = {s['data'] for s in backup['sessoes']}
    sessoes, series, choques = [], [], []

    for sem in plano['calendario']:
        for dia in plano['config']['dias']:
            d = sem['dias'][dia]
            if d['data'] in datas_existentes:
                choques.append(d['data'])
                continue

            sessoes.append({
                'id': prox_sessao,
                'data': d['data'],
                'inicio': None,
                'fim': None,
                'notas': 'Semana %d - %s' % (sem['semana'], d['modo']),
            })

            ordem = 0
            for i, ex in enumerate(d['exercicios']):
                nome = NOME_NA_APP.get(ex['nome'], ex['nome'])
                if nome not in bib:
                    raise SystemExit('exercicio fora da biblioteca da app: ' + nome)
                eid = bib[nome]['id']
                por_tempo = tipos[nome] == 'peso_tempo'
                for peso, reps in ex['series']:
                    series.append({
                        'id': prox_serie,
                        'sessaoId': prox_sessao,
                        'exercicioId': eid,
                        'data': d['data'],
                        'ordemExercicio': i,
                        'ordem': ordem,
                        'peso': float(peso),
                        'reps': 0 if por_tempo else int(reps),
                        'rir': None,
                        'tempoSeg': int(reps) if por_tempo else None,
                        'distancia': None,
                        'supersetId': None,
                        'recordeOriginal': False,
                        'nota': None,
                        # o que faz da serie um plano e nao um registo
                        'feita': False,
                    })
                    prox_serie += 1
                    ordem += 1
            prox_sessao += 1

    novo = dict(backup)
    novo['sessoes'] = backup['sessoes'] + sessoes
    novo['series'] = backup['series'] + series
    novo['origem'] = (backup.get('origem', '') + ' + plano de treino').strip(' +')
    return novo, sessoes, series, choques


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('backup', help='backup JSON exportado da app')
    ap.add_argument('-o', '--saida', default=None)
    args = ap.parse_args()

    backup = json.load(open(args.backup, encoding='utf-8'))
    if backup.get('formato') != 'treinos-backup':
        raise SystemExit('isto nao e um backup da app Treinos')
    plano = json.load(open(PLANO, encoding='utf-8'))

    antes_ses = len(backup['sessoes'])
    antes_ser = len(backup['series'])
    novo, sessoes, series, choques = fundir(backup, plano)

    saida = args.saida or os.path.join(AQUI, 'backup-com-plano.json')
    with open(saida, 'w', encoding='utf-8') as f:
        json.dump(novo, f, ensure_ascii=False)

    print('BACKUP DE ENTRADA')
    print('  %d treinos, %d series   (ate %s)'
          % (antes_ses, antes_ser, max(s['data'] for s in backup['sessoes'])))
    print()
    print('PLANO ACRESCENTADO')
    print('  %d treinos, %d series por fazer' % (len(sessoes), len(series)))
    if sessoes:
        print('  de %s a %s' % (sessoes[0]['data'], sessoes[-1]['data']))
    if choques:
        print('  SALTADOS (ja havia treino nesse dia): %s' % ', '.join(choques))
    print()
    print('FICHEIRO')
    print('  %s' % saida)
    print('  %d treinos, %d series no total'
          % (len(novo['sessoes']), len(novo['series'])))
    print()
    print('Na app: Exercicios -> Dados -> Importar backup (JSON) -> Repor.')
    print('O plano fica com o visto por marcar; so conta depois de o fazeres.')


if __name__ == '__main__':
    main()
