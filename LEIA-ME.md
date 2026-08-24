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

- **Exercícios → Dados → Guardar backup (JSON)** — leva tudo, e é o mesmo
  ficheiro que a app sabe repor.
- **Guardar em CSV** — para abrir no Excel ou levar para outra app.

Enquanto a app estiver no ecrã principal, o iOS não lhe apaga os dados. Se for
usada só pelo Safari, ao fim de sete dias sem a abrir o iOS pode limpá-los.
**Adiciona-a ao ecrã principal e guarda um backup de vez em quando.**

---

## O que está aqui dentro

| Ficheiro | O que é |
|---|---|
| `index.html` | A app toda: estilos, lógica e gráficos, num ficheiro só. |
| `sw.js` | Service worker — é o que a faz abrir sem rede. |
| `manifest.json` | Diz ao iPhone como a instalar. |
| `icon-*.png` | Ícones. Refazem-se com `ferramentas/gerar_icones.py`. |
| `ferramentas/converter_fitnotes.py` | Converte a base do FitNotes para backup JSON. |
| `testes/` | Testes da lógica crítica. |

## Correr os testes

Precisa de Node (está em `C:\Users\BBrito\nodejs\node.exe`):

```
node --test testes/*.test.mjs
```

Os testes lêem a lógica directamente do `index.html`, entre os marcadores
`NÚCLEO:INÍCIO` e `NÚCLEO:FIM`. Mexer aí obriga a correr isto outra vez.

Os testes que usam o histórico real procuram `dados-reais/fitnotes.csv` e
`dados-reais/backup-fitnotes.json`. Essa pasta está no `.gitignore` de
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

**Volume.** Soma de repetições × peso. As séries de peso corporal contam para o
número de séries mas não somam volume — não se sabe quanto pesavas em cada dia,
e inventar um valor estragaria o gráfico.

**Cronómetro.** O iOS congela os temporizadores com o ecrã bloqueado. Este não
conta ao segundo: guarda a hora a que a série foi gravada e recalcula sempre a
partir do relógio, por isso volta certo mesmo depois de o telemóvel ficar no
bolso.
