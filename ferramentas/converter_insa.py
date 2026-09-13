# -*- coding: utf-8 -*-
"""
Converte a Tabela da Composicao de Alimentos do INSA (Excel) para o ficheiro
que a app le: alimentos-insa.json, so com o que a aba Comida usa.

    python ferramentas/converter_insa.py dados-reais/insa_tca.xlsx

O Excel descarrega-se em https://portfir.insa.min-saude.pt/ (Composicao de
Alimentos > Descarregar Excel da TCA). As condicoes do INSA pedem a fonte
visivel onde os dados aparecem: vai no proprio JSON (campo "fonte") e a app
mostra-a no ecra da Comida.

Valores por 100 g de parte edivel; nas bebidas alcoolicas, por 100 ml.
Celulas vazias, "tr" (vestigios) ou "<x" contam como 0 — e o que interessa
para somar macros num dia, e fica dito no campo "notas".
"""
import json
import os
import re
import sys

import openpyxl

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# O que se procura no cabecalho (comeco do texto, sem acentos nem espacos a mais)
COLUNAS = {
    'cod': 'cod',
    'nome': 'nome do alimento',
    'grupo': 'nivel 1',
    'kcal': 'energia [kcal]',
    'gordura': 'lipidos [g]',
    'hidratos': 'hidratos de carbono [g]',
    'acucares': 'acucares [g]',
    'sal': 'sal [g]',
    'fibra': 'fibra [g]',
    'proteina': 'proteinas [g]',
}
ORDEM = ['cod', 'nome', 'grupo', 'kcal', 'proteina', 'hidratos', 'gordura', 'fibra', 'acucares', 'sal']


def normalizar(texto):
    t = str(texto or '').lower()
    for a, b in (('áàâã', 'a'), ('éê', 'e'), ('í', 'i'), ('óôõ', 'o'), ('ú', 'u'), ('ç', 'c')):
        for ch in a:
            t = t.replace(ch, b)
    return re.sub(r'\s+', ' ', t).strip()


def numero(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(',', '.')
    if not s or s.lower() in ('tr', 'vtr', 'n.d.', 'nd', '-'):
        return 0.0
    if s.startswith('<'):
        return 0.0
    try:
        return float(s)
    except ValueError:
        raise SystemExit('valor que nao percebo: %r' % v)


def main():
    origem = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dados-reais', 'insa_tca.xlsx')
    destino = os.path.join(RAIZ, 'alimentos-insa.json')
    wb = openpyxl.load_workbook(origem, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    versao = re.search(r'v\s*([\d.]+\s*-\s*\d{4})', ws.title)
    linhas = list(ws.iter_rows(values_only=True))

    # a linha do cabecalho e a que tem "Cod" na primeira coluna
    i_cab = next(i for i, r in enumerate(linhas) if normalizar(r[0]) == 'cod')
    cab = [normalizar(c) for c in linhas[i_cab]]
    idx = {}
    for chave, procura in COLUNAS.items():
        achadas = [i for i, c in enumerate(cab) if c.startswith(procura)]
        if len(achadas) != 1:
            raise SystemExit('coluna %s: %d candidatas no cabecalho' % (chave, len(achadas)))
        idx[chave] = achadas[0]

    alimentos = []
    for r in linhas[i_cab + 1:]:
        if not r[idx['cod']] or not r[idx['nome']]:
            continue
        a = {
            'cod': str(r[idx['cod']]).strip(),
            'nome': str(r[idx['nome']]).strip(),
            'grupo': str(r[idx['grupo']] or '').strip(),
        }
        for k in ORDEM[3:]:
            a[k] = round(numero(r[idx[k]]), 1)
        alimentos.append([a[k] for k in ORDEM])

    fonte = ('Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde '
             'Doutor Ricardo Jorge, I. P.- INSA. v %s' % (versao.group(1) if versao else '?'))
    saida = {
        'fonte': fonte,
        'campos': ORDEM,
        'notas': 'por 100 g de parte edível (bebidas alcoólicas: por 100 ml); '
                 'vestígios e valores abaixo do limite contam como 0',
        'alimentos': alimentos,
    }
    with open(destino, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(saida, f, ensure_ascii=False, separators=(',', ':'))
    print('alimentos:', len(alimentos))
    print('fonte:', fonte)
    print('ficheiro:', destino, os.path.getsize(destino), 'bytes')


if __name__ == '__main__':
    main()
