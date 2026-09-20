# O gerador antigo, o que vivia no OneDrive

Isto é o que estava em `OneDrive - OPKO Health\Claude\Treino` até **2026-09-20**. Não corria em
repo nenhum: se o PC se perdesse, perdia-se. Veio para aqui antes de a pasta ser apagada.

**Não é o gerador de hoje.** Desde 13/09 o plano faz-se dentro da app (`index.html` e
`ferramentas\`), e é esse que se mexe. Isto fica como história: o `gerar.py` é o motor que
montou o plano de 25/08, e o `para_pdf.py` é o que fez o PDF que ainda se lê.

| Ficheiro | O que é |
|---|---|
| `gerar.py` | o motor: monta o plano semana a semana (45 KB) |
| `validar.py` | as regras que o plano tinha de cumprir |
| `para_app.py` | exportava o plano para o formato da app |
| `para_pdf.py` | montava o `Plano-Treino.html` e o `.pdf` |

## O que aqui NÃO está, e porquê

**Este repositório é público** — tem de ser, é ele que serve a app por GitHub Pages em
`bbrito-opko.github.io/treinos/`. Tudo o que entra aqui fica à vista de qualquer pessoa.

Por isso o **plano em si** não está aqui. O `plano-treino.json` e o `Plano-Treino.md` / `.html`
/ `.pdf` são pesos, séries e progressões de uma pessoa concreta, e ficaram em `dados-reais\`,
que o `.gitignore` deixa de fora — a mesma regra que já valia para todos os outros dados reais
deste repositório. Estão no disco, não no GitHub.

O código é outra coisa: um gerador de planos de treino não diz nada sobre ninguém.
