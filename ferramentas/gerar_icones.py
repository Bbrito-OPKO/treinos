# -*- coding: utf-8 -*-
"""
Desenha os icones da app em PNG, sem depender de nenhuma biblioteca.

Escreve os PNG byte a byte (zlib + struct, ambos da biblioteca padrao) porque
o Pillow pode nao estar instalado e um icone e coisa de mais para justificar
uma dependencia. Sao formas simples: um fundo escuro com cantos redondos e uma
barra de musculacao branca ao meio.

Uso:
    python gerar_icones.py            (escreve na pasta acima)
"""

import os
import struct
import zlib

# As cores da app: o mesmo fundo do tema escuro e o azul dos graficos.
FUNDO = (11, 13, 16)
AZUL = (59, 130, 246)
BRANCO = (232, 237, 244)


def escrever_png(caminho, largura, altura, pixeis):
    """Monta um PNG RGB de 8 bits a partir de uma lista de linhas."""
    linhas = bytearray()
    for y in range(altura):
        linhas.append(0)                      # filtro 0: nenhum
        for x in range(largura):
            linhas.extend(pixeis[y][x])

    def bloco(tipo, dados):
        c = struct.pack('>I', len(dados)) + tipo + dados
        return c + struct.pack('>I', zlib.crc32(tipo + dados) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += bloco(b'IHDR', struct.pack('>IIBBBBB', largura, altura, 8, 2, 0, 0, 0))
    png += bloco(b'IDAT', zlib.compress(bytes(linhas), 9))
    png += bloco(b'IEND', b'')

    with open(caminho, 'wb') as f:
        f.write(png)


def misturar(fundo, frente, alfa):
    """Mistura duas cores. O alfa e o que da o contorno suave."""
    return tuple(int(fundo[i] + (frente[i] - fundo[i]) * alfa) for i in range(3))


def cobertura_retangulo(x, y, x0, y0, x1, y1, raio=0):
    """Quanto do pixel (x, y) cai dentro do retangulo, entre 0 e 1.

    Amostra 3x3 dentro do pixel: chega para o contorno nao ficar aos degraus
    e e muito mais simples do que fazer as contas de area a serio.
    """
    dentro = 0
    for sy in range(3):
        for sx in range(3):
            px = x + (sx + 0.5) / 3.0
            py = y + (sy + 0.5) / 3.0
            if not (x0 <= px <= x1 and y0 <= py <= y1):
                continue
            if raio > 0:
                # Nos cantos, so conta se estiver dentro do circulo do canto.
                cx = min(max(px, x0 + raio), x1 - raio)
                cy = min(max(py, y0 + raio), y1 - raio)
                if (px - cx) ** 2 + (py - cy) ** 2 > raio ** 2:
                    continue
            dentro += 1
    return dentro / 9.0


def desenhar(tamanho, margem_segura=0.0):
    """Desenha o icone.

    margem_segura encolhe o desenho para dentro: e o que os icones "maskable"
    precisam, porque o Android pode cortar-lhes as bordas.
    """
    u = tamanho / 100.0                       # uma unidade = 1% do lado
    recuo = tamanho * margem_segura
    util = tamanho - 2 * recuo

    # Fundo com cantos redondos (ou quadrado, no maskable, que ja e cortado).
    raio_fundo = 0 if margem_segura else tamanho * 0.22

    pixeis = [[FUNDO for _ in range(tamanho)] for _ in range(tamanho)]

    for y in range(tamanho):
        for x in range(tamanho):
            if raio_fundo:
                c = cobertura_retangulo(x, y, 0, 0, tamanho - 1, tamanho - 1, raio_fundo)
                # Fora dos cantos fica transparente-ish: como o PNG e RGB sem
                # alfa, usa-se preto, que e o que o iOS poe por tras.
                pixeis[y][x] = misturar((0, 0, 0), FUNDO, c)
            else:
                pixeis[y][x] = FUNDO

    # A barra: um varao ao meio e dois discos de cada lado.
    meio = recuo + util / 2.0
    esp_varao = util * 0.055
    comp_varao = util * 0.62

    def pintar(x0, y0, x1, y1, cor, raio=0):
        for y in range(max(0, int(y0) - 2), min(tamanho, int(y1) + 3)):
            for x in range(max(0, int(x0) - 2), min(tamanho, int(x1) + 3)):
                c = cobertura_retangulo(x, y, x0, y0, x1, y1, raio)
                if c > 0:
                    pixeis[y][x] = misturar(pixeis[y][x], cor, c)

    # Varao
    pintar(meio - comp_varao / 2, meio - esp_varao / 2,
           meio + comp_varao / 2, meio + esp_varao / 2, BRANCO, esp_varao / 2)

    # Discos: o de dentro maior, o de fora mais pequeno, dos dois lados
    for lado in (-1, 1):
        for i, (dist, altura, largura, cor) in enumerate([
            (0.21, 0.42, 0.075, BRANCO),
            (0.32, 0.27, 0.065, AZUL),
        ]):
            cx = meio + lado * util * dist
            pintar(cx - util * largura / 2, meio - util * altura / 2,
                   cx + util * largura / 2, meio + util * altura / 2,
                   cor, util * largura / 2 * 0.6)

    return pixeis


def main():
    destino = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    trabalhos = [
        ('icon-180.png', 180, 0.0),
        ('icon-192.png', 192, 0.0),
        ('icon-512.png', 512, 0.0),
        # O maskable leva 12% de margem de cada lado: e a zona que o Android
        # pode cortar para encaixar o icone na forma do sistema.
        ('icon-512-maskable.png', 512, 0.12),
    ]
    for nome, tamanho, margem in trabalhos:
        caminho = os.path.join(destino, nome)
        escrever_png(caminho, tamanho, tamanho, desenhar(tamanho, margem))
        print('%s  %dx%d  %.1f KB' % (nome, tamanho, tamanho,
                                      os.path.getsize(caminho) / 1024))


if __name__ == '__main__':
    main()
