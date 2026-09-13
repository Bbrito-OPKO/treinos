# Treinos

App de registo de treinos de musculação para iPhone. Funciona sem rede, os dados
ficam todos no telemóvel e nunca saem de lá.

---

## Pôr no iPhone

Precisa de ser servida por **https** — o service worker, que é o que faz a app
abrir sem rede, não corre num ficheiro aberto pelo iCloud ou pelos Ficheiros.
São 10 minutos, uma vez só.

### GitHub Pages

1. No GitHub, criar um repositório novo chamado `treinos`, **público**
   (o Pages só é grátis em repositórios públicos). A app não leva dados
   nenhuns — o histórico fica no telemóvel.
2. Enviar o conteúdo desta pasta:

   ```
   cd C:\Users\BBrito\Documents\Treinos
   git init
   git add .
   git commit -m "Primeira versão"
   git branch -M main
   git remote add origin https://github.com/<o-teu-utilizador>/treinos.git
   git push -u origin main
   ```

3. No GitHub: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
4. Ao fim de um ou dois minutos fica em
   `https://<o-teu-utilizador>.github.io/treinos/`.
5. Abrir esse endereço **no Safari do iPhone** (tem de ser o Safari — no Chrome
   do iPhone não dá para adicionar ao ecrã principal).
6. Botão de **Partilhar** → **Adicionar ao ecrã principal** → Adicionar.

A partir daí abre pelo ícone, em ecrã inteiro, sem barra de endereço. Basta
abri-la uma vez com internet; depois disso funciona em modo de avião.

### Actualizar mais tarde

`git add . && git commit -m "..." && git push`. A app vai buscar a versão nova
sozinha na abertura seguinte — não é preciso reinstalar nada.

---

## Trazer o histórico do FitNotes

Há dois caminhos. O primeiro é melhor.

### 1. Pela base do FitNotes (recomendado)

O ficheiro `.fitnotesdb` guarda coisas que o CSV deita fora: a ordem das séries
dentro do treino, os supersets, as marcações de recorde e as pesagens.

```
python ferramentas\converter_fitnotes.py "caminho\para\FitNotes.fitnotesdb" -o backup.json
```

O conversor não toca no ficheiro original — trabalha sobre uma cópia, em modo
só-leitura. No fim mostra os números para conferir.

Depois, na app: **Exercícios → Dados → Importar backup (JSON)**.

### 2. Pelo CSV

**Exercícios → Dados → Importar CSV do FitNotes**. A app mostra o que vai
importar (séries, treinos, exercícios, intervalo de datas e contagem por grupo)
**antes** de mexer em alguma coisa.

Aceita o formato do FitNotes de iPhone (com colunas `Weight (kg)` e
`Weight (lbs)`), o do Android (com `Weight` e `Weight Unit`), ficheiros sem
cabeçalho, separador `;`, vírgula decimal e datas em vários formatos.

> **O histórico não traz RIR.** O FitNotes tem a coluna mas nunca a preencheu:
> nas 28.747 séries está toda vazia. As análises de esforço começam a contar a
> partir da primeira série que registares aqui.

---

## Backups

Os dados vivem na IndexedDB do telemóvel. **Não há servidor e não há cópia
nenhuma noutro sítio.**

- **Mais → Definições → Guardar backup (JSON)** — leva tudo menos as
  definições (é lá que fica a chave da IA), e é o mesmo ficheiro que a app sabe
  repor.
- **Guardar em CSV** — para abrir no Excel ou levar para outra app.

Ao importar um backup há duas opções:

- **Juntar** (a de defeito) — não apaga nada. O que vem no backup escreve por
  cima do mesmo registo (pelo id); o que só existe na app fica. Se um id do
  backup aponta para outra coisa (outro dia, outro exercício), não junta nada e
  diz porquê: é um backup de outra app. Atenção: não sabe o que apagaste depois
  do backup — juntar um backup antigo traz de volta séries que tiraste.
- **Repor** — apaga e escreve o backup. Pede dois toques.

Enquanto a app estiver no ecrã principal, o iOS não lhe apaga os dados. Se for
usada só pelo Safari, ao fim de sete dias sem a abrir o iOS pode limpá-los.
**Adiciona-a ao ecrã principal e guarda um backup de vez em quando.**

---

## O plano de treino

**Plano** (na barra) mostra o ciclo de 4 semanas, dia a dia, com o que já foi
feito. **Ciclo seguinte** gera as 4 semanas a seguir:

- cada lift sobe o seu incremento (morto 7,5 · agachamento 5 · supino e ombro
  2,5) e as séries dele sobem na mesma proporção, arredondadas a 2,5 kg;
- tocar num exercício tira-o desse dia e o plano refaz-se;
- o plano passa pelas **17 regras** antes de se poder gravar — se uma falha, o
  botão fica desligado e diz qual;
- grava no Treino como séries por fazer; dias que já têm treino ficam como estão.

O gerador é a tradução do `gerar.py` (`OneDrive\Claude\Treino`) e o validador a
do `validar.py`. A prova de que a tradução está certa: com a configuração de
partida, a app gera **exatamente** o `plano-treino.json` que o Python gerou.
A prova 16 do Python nunca olhava (comparava uma lista com o número 1); na app
está corrigida.

Os ciclos ficam na base, em `definicoes.planoCiclos`.

### Sugestões (a app a olhar para o que fizeste)

Aparecem no topo do **Plano** (e um aviso no **Treino**), cada uma com o número
que a justifica e **Aceitar / Ignorar**. Nada muda sozinho. As regras:

| Sugestão | Quando | Aceitar faz |
|---|---|---|
| Empurrar o plano | Faltaste à **segunda** ou à **quinta** e não treinaste nenhum dia do plano depois disso. Terça e sexta não empurram. | Todos os treinos por fazer, desse dia em diante, passam 7 dias. Se uma data de destino já tem outro treino, não mexe em nada. |
| Carga de um acessório | O que fizeste (kg, reps e RIR quando há) aguenta uma carga um passo acima ou abaixo (2,5 kg abaixo de 60, 5 acima). Sem RIR: chegar às reps conta como RIR 2, não chegar como RIR 0. Quem faz o plano tal e qual fica igual. | Muda a carga no catálogo e refaz as séries por fazer desse exercício. |
| Tirar um acessório | 3 sessões do plano sem passar a anterior. | Sai no ciclo seguinte; o gerador escolhe outro. |
| Semana mais leve | Numa semana com 3+ treinos, 30% das séries ficaram 2+ reps aquém ou 4+ foram a RIR 0. | A semana seguinte fica a -10%. |

**Máximos.** No ciclo seguinte, cada lift sobe a partir do melhor single feito
no dia de máximos. Se falhou o single, ou não fez esse dia, não sobe. A folha do
ciclo seguinte diz a razão de cada um.

As decisões ficam na loja `sugestoes` (pela chave); uma sugestão ignorada não volta.
As sessões do plano guardam a identidade em `plano: { ciclo, semana, dia }` — é o
que as deixa mudar de data sem se perderem. As do ciclo 1 reconhecem-se pela nota
"Semana N - modo".

## Comida

A alimentação assenta num **plano fixo**, e não em registar tudo todos os dias:

- **Plano de treino** (seg, ter, qui, sex) e **plano de descanso** (qua, sáb, dom),
  cada um com os alimentos e as gramas por refeição. Montam-se nos botões com o
  mesmo nome; o de descanso pode começar como cópia do de treino, e qualquer um
  pode vir do que ficou registado num dia.
- **Um dia sem registos conta como o plano** desse tipo de dia. O ecrã mostra-o
  com "· plano". Mexer num alimento (ou "+ Hoje foi diferente") passa **só esse
  dia** a registado, com o plano copiado para lá; o plano não muda.
- **O plano tem versões.** Mudá-lo conta a partir de hoje: os dias de antes
  continuam a contar com o plano que se comia nessa altura (é o que mantém o gasto
  medido certo).

Adicionar um alimento (a um plano ou a um dia) abre a pesquisa:

- **Tabela do INSA** (1376 alimentos, v 7.1 - 2026) — funciona sem rede. A
  pesquisa ignora acentos e aceita as palavras por qualquer ordem; o que já usaste
  vem primeiro, e os pratos compostos descem.
- **Open Food Facts** — por nome (botão no fim da lista) ou **código de barras**
  (câmara, ou o número escrito à mão). Um produto usado fica guardado e passa a
  aparecer na pesquisa sem rede.
- **Criar alimento** — com os valores do rótulo por 100 g.

Cada item guarda uma cópia dos valores: atualizar a tabela não muda o que já foi
comido. O peso corporal está em **Peso corporal ›**.

### Objetivo, avaliação da semana e ajustes ao plano

**Objetivo** (idade, altura, sexo, atividade, objetivo) mostra a proteína alvo
(2,2 / 2,0 / 1,8 g/kg para perder / manter / ganhar), o gasto pela fórmula
(Mifflin-St Jeor × atividade), o **gasto medido** quando há 21 dias de pesagens
(média do que se comeu — plano ou registo — menos a tendência do peso × 7700
kcal/kg) e as kcal do plano.

**Avaliação da semana** (botão azul quando há sugestões ou passou uma semana sem
medir): a **cintura** (fita à altura do umbigo, de manhã, em jejum), a tendência
do peso e da cintura, e **as sugestões**, com Aceitar/Ok e Ignorar:

| Sugestão | Quando | Aceitar faz |
|---|---|---|
| ± kcal no plano | Tendência do peso (21 dias, 3+ pesagens em 14+ dias) 0,15+ kg/semana longe do alvo: perder −0,5 · manter 0 · ganhar +0,25. Ajuste = diferença × 7700 / 7, a 50 kcal, no máximo ±300. | Mostra e aplica as gramas: sobem ou descem os alimentos em que os hidratos dão metade das kcal ou mais (arroz, massa, pão, aveia); a proteína fica. Se for para tirar mais do que os hidratos têm, entra a gordura. Gramas a 5 g, nunca abaixo de 30%. Versão nova do plano a partir de hoje. |
| Não mexer: estás a perder gordura | A perder (ou a manter) com o peso a descer menos do que o alvo, mas a cintura a descer 0,25+ cm/semana. | Nada — é para não cortar comida quando o físico está a mudar bem. |
| O plano tem pouca proteína | A média do plano (4 dias de treino, 3 de descanso) abaixo de 85% do alvo. | Nada; diz quanto frango ou iogurte grego falta. |
| Pesa-te 3+ vezes por semana | Menos de 3 pesagens em 14 dias e sem tendência. | Nada. |

**Tabela do INSA.** Refaz-se com o Excel do PortFIR
(`portfir.insa.min-saude.pt` › Composição de Alimentos › Descarregar Excel):

```
python ferramentas\converter_insa.py dados-reais\insa_tca.xlsx
```

As condições do INSA pedem a fonte visível onde os dados aparecem — está no fim
do ecrã da Comida. Mudar o `alimentos-insa.json` obriga a subir o nome da cache
no `sw.js`, senão os telemóveis ficam com a tabela antiga.

**Código de barras.** O Safari do iPhone não tem leitor nativo; usa-se a ZXing
(`zxing-browser.min.js`, @zxing/browser 0.1.5, licença MIT em
`zxing-browser.LICENSE.txt`), guardada ao lado da app para abrir sem rede.

---

A barra: **Treino · Plano · Comida · Análises · Mais**. O Peso está dentro da
Comida; Histórico, Exercícios e Definições dentro do Mais.

---

## O que está aqui dentro

| Ficheiro | O que é |
|---|---|
| `index.html` | A app toda: estilos, lógica e gráficos, num ficheiro só. |
| `sw.js` | Service worker — é o que a faz abrir sem rede. |
| `manifest.json` | Diz ao iPhone como a instalar. |
| `icon-*.png` | Ícones. Refazem-se com `ferramentas/gerar_icones.py`. |
| `ferramentas/converter_fitnotes.py` | Converte a base do FitNotes para backup JSON. |
| `alimentos-insa.json` | Tabela do INSA convertida (só os valores que a Comida usa). |
| `zxing-browser.min.js` | Leitor de código de barras (MIT). |
| `ferramentas/converter_insa.py` | Excel do INSA → `alimentos-insa.json`. |
| `ferramentas/provar_migracao.mjs` | Prova, num Chrome a sério e com o backup real, que mudar a versão da base não perde nada. Correr sempre que a versão da IndexedDB subir. |
| `testes/` | Testes da lógica crítica. |

## Correr os testes

Precisa de Node (está em `C:\Users\BBrito\nodejs\node.exe`):

```
node --test testes/*.test.mjs
```

Os testes lêem a lógica directamente do `index.html`, entre os marcadores
`NÚCLEO:INÍCIO` e `NÚCLEO:FIM`. Mexer aí obriga a correr isto outra vez.

Os testes que usam o histórico real procuram em `dados-reais/`:
`fitnotes.csv`, `backup-fitnotes.json`, `treinos-2026-09-13.json` (backup da
app), `backup-com-plano.json`, `plano-treino.json` e `para_app_esperado.json`
(os dois últimos são a referência do gerador em Python). Essa pasta está no `.gitignore` de
propósito — são seis anos de treinos e o repositório é público. Sem ela, esses
testes dizem que foram saltados em vez de passarem a testar nada.

---

## Notas

**1RM teórico.** Mostram-se as duas fórmulas porque discordam de propósito: a
Epley é mais generosa em repetições altas e a Brzycki mais conservadora. Com uma
repetição as duas devolvem o próprio peso. Acima de 15 repetições qualquer
estimativa vale pouco, e a Brzycki deixa de ter significado das 37 para cima.

**Recordes.** Uma série é recorde quando nenhuma anterior do mesmo exercício a
bate ao mesmo tempo no peso e nas repetições. Não foi inventado: a regra foi
medida contra as 1187 séries que o próprio FitNotes já tinha marcado como
recorde, e bate certo nas 1187, sem nenhuma a mais nem a menos.

**Carga máxima por repetições.** A marca para 8 repetições não é o melhor peso
feito com exactamente 8: é o melhor peso feito com 8 **ou mais**. Quem faz 10
com 111,5 kg fez 8 com 111,5 pelo caminho. Por isso a coluna «máx» nunca sobe
quando as repetições sobem.

**O visto verde.** Uma série pode estar planeada e ainda por fazer — é o que
acontece quando copias um treino de outro dia. Enquanto não tem o visto, não
conta para nada: nem recordes, nem volume, nem médias de RIR. Sem isso bastava
copiar um treino que nunca se fez para inventar um recorde.

**Volume.** Soma de repetições × peso. As séries de peso corporal contam para o
número de séries mas não somam volume — não se sabe quanto pesavas em cada dia,
e inventar um valor estragaria o gráfico.

**Cronómetro.** O iOS congela os temporizadores com o ecrã bloqueado. Este não
conta ao segundo: guarda a hora a que a série foi gravada e recalcula sempre a
partir do relógio, por isso volta certo mesmo depois de o telemóvel ficar no
bolso.
