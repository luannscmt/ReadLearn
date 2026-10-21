# 🎧 English Audio & PDF Study Station

Aplicação web desenvolvida em **Flask** para estudo de inglês através da técnica de escuta ativa e leitura simultânea (*Listening & Reading*).

---

## 🚀 Como Iniciar

Você tem duas formas simples de iniciar:

### Opção 1 (Mais fácil - 1 clique):
- Dê um duplo clique no arquivo **`iniciar.bat`**. O navegador abrirá automaticamente.

### Opção 2 (Via Terminal):
```bash
python run.py
```
Acesse no seu navegador: **`http://127.0.0.1:5000`**

---

## ✨ Principais Funcionalidades

1. **Leitor de Texto Sincronizado (Karaokê / Teleprompter) 💬**:
   - O texto em inglês sobe e destaca a frase falada no exato momento pelo narrador.
   - **Opção de Tradução**: Ative o checkbox `[x] Tradução (PT)` para exibir a tradução em português embaixo de cada frase, ou desative para imersão 100% em inglês.
   - **Clique para ouvir**: Clique em qualquer frase do texto para pular o áudio diretamente para ela.
   - **Abas de alternância**: Alterne livremente entre o texto sincronizado e o PDF original nas abas no topo.

2. **Split-Screen (Áudio + PDF/Texto lado a lado)**:
   - Ouça o áudio e acompanhe o texto na mesma tela, sem precisar alternar de janelas.
   - Botão para abrir o PDF em nova aba em tela cheia se desejar.

2. **Escaneamento Dinâmico de Pastas**:
   - Basta criar uma nova subpasta e colar seus arquivos `.mp3` e `.pdf`.
   - O sistema detecta automaticamente ao clicar no botão **"🔄 Atualizar Pastas"** no topo da tela (não precisa reiniciar o servidor).
   - Suporta pastas com múltiplos narradores (ex: Jack Hannaford com Jake, John, Moira, Natalie).
   - Suporta pastas com múltiplos PDFs e lições em partes (ex: MLBOR Part 1, Part 2, etc.) com seletor de PDF integrado.
   - **Vínculo manual Áudio ↔ PDF (🔗)**: se o sistema associar o PDF errado a um áudio, clique no **🔗** do áudio e escolha o PDF correto. O vínculo fica salvo no banco e vale nos dois sentidos (áudio→PDF e clicar no PDF abre o áudio certo).
   - **Pastas concluídas ✅**: marque com o checkbox no cabeçalho da pasta que você já estudou — ela ganha visual de "concluída" e **vai para o fim da lista** (salvo no banco). As pastas pendentes ficam no topo, prontas para o próximo estudo.

3. **Contador de Repetições Inteligente**:
   - Salvo em banco de dados SQLite local (`data/study_stats.db`).
   - **Contagem automática**: ao terminar a escuta (ou atingir 95% do áudio), o sistema registra +1 escuta automaticamente.
   - **Controle manual**: botões `+1` e `-` para você ajustar a contagem a qualquer momento.
   - Badges visuais mostrando quantas vezes cada áudio individual foi escutado e o total por lição.
   - Cada escuta agora é registrada com **data e hora exatas** em uma tabela de histórico.

4. **Controles Focados em Estudo**:
   - **Velocidade de reprodução**: alterne entre `0.75x`, `1.0x`, `1.25x` e `1.5x`.
   - **Voltar 5s / Avançar 10s**: perfeito para repetir trechos e frases com pronúncia difícil.
   - **Modo Loop / Repetição contínua (`🔁`)**: para praticar shadowing e escuta repetida do áudio todo.
   - **Repetição de Trecho de Frase (`🔂 A-B`)**: selecione o segundo de início (ex: 10s) e de fim (ex: 20s ou 30s) com barrinhas e botões de ajuste fino (-1s / +1s). O player fica repetindo apenas aquela frase específica sem parar!
   - **Tema Escuro / Claro**: alterne no botão de lua/sol para maior conforto visual.

5. **Datas de Escuta por Áudio 🗓️**:
   - Cada áudio da lista mostra a **última data** em que foi escutado.
   - O botão **🗓️** de cada áudio abre o **histórico completo** com todas as datas/horas (automáticas e manuais).
   - A **duração aproximada** de cada arquivo aparece ao lado do tamanho (⏱️).
   - **Clique na duração (⏱️)** de qualquer áudio para informar ou ajustar o tempo **manualmente** quando o sistema não detectar — o valor fica salvo no banco de dados e passa a valer nos totais de tempo.

6. **Dashboard de Evolução 📊**:
   - Botão **"📊 Estatísticas"** no topo abre um painel com:
     - Total de escutas, áudios estudados (x/y + %), dias de estudo e sequência de dias (streak atual e recorde).
     - **⏱️ Tempo total escutado (estimado)** — com subtotais de hoje, dos últimos 7 e 30 dias.
     - Gráfico **"Escutas por dia"** (7/14/30 dias) e **"Evolução acumulada"**.
     - Lista dos áudios mais recentes e tabela detalhada por áudio (duração, tempo escutado e datas — clique na linha para ver o histórico).
   - Registros feitos antes desta versão aparecem na **data da última escuta conhecida** de cada áudio, identificados como *"Registro anterior"*.
   - O tempo é uma **estimativa**: duração do arquivo (lida do próprio MP3) × escutas concluídas.

---

## ⌨️ Atalhos do Teclado

| Tecla | Ação |
|---|---|
| <kbd>Espaço</kbd> | Reproduzir / Pausar |
| <kbd>←</kbd> (Seta Esquerda) | Voltar 5 segundos |
| <kbd>→</kbd> (Seta Direita) | Avançar 10 segundos |
| <kbd>R</kbd> | Alternar repetição contínua (Loop Geral) |
| <kbd>L</kbd> | Alternar repetição de trecho específico (Loop A-B) |
| <kbd>M</kbd> | Silenciar / Ativar Som |
| <kbd>+</kbd> | Adicionar +1 escuta manualmente |
| <kbd>Esc</kbd> | Fechar telas ou modais |

---

## 📁 Como Adicionar Novas Lições

Basta criar uma nova pasta aqui dentro com o nome que quiser (ex: `3 - The Three Little Pigs`) e colocar os arquivos dentro dela:
- Áudios suportados: `.mp3`, `.m4a`, `.wav`, `.ogg`, `.aac`, `.flac`
- Textos suportados: `.pdf` (PDF clássico) e `.json` (Texto sincronizado com tradução)

Para gerar textos sincronizados automaticamente para novos áudios, consulte o guia passo a passo:  
👉 **[COMO_SINCRONIZAR_NOVOS_AUDIOS.md](COMO_SINCRONIZAR_NOVOS_AUDIOS.md)**

Depois, basta clicar no botão **"Atualizar Pastas"** na barra superior da aplicação web!
