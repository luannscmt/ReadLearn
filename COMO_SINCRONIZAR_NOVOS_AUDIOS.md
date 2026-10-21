# 📖 Guia para IA: Como Gerar Textos Sincronizados para Novos Áudios

Este documento é um **manual de instruções para qualquer Inteligência Artificial (IA)** ou desenvolvedor que for adicionar um novo texto sincronizado ao projeto **English Study Station**, para que fique com a **mesma experiência e qualidade de `1 - Jack Hannaford`**.

---

## 🎯 Objetivo
Transformar qualquer áudio (`.mp3`) de uma lição em um leitor interativo onde:
1. O texto em inglês sobe acompanhando a voz do narrador com precisão milimétrica.
2. A frase ativa fica destacada em azul no terço superior da tela.
3. O aluno pode clicar em `[x] Tradução (PT)` para exibir ou ocultar a tradução em português embaixo de cada frase.
4. O aluno pode clicar em qualquer frase para o áudio saltar imediatamente para ela.

---

## ⚙️ Regras e Configurações Obrigatórias

Para o sistema reconhecer o arquivo automaticamente sem que o usuário precise configurar nada:

1. **Localização**: O arquivo `.json` DEVE ser salvo **dentro da mesma pasta do áudio**.
2. **Nome do Arquivo**: O arquivo `.json` DEVE ter **exatamente o mesmo nome do arquivo de áudio**:
   - Exemplo de áudio: `The Endless Tale Harry Complete Audio.mp3`
   - Nome do arquivo sincronizado: `The Endless Tale Harry Complete Audio.json`
3. **Codificação**: Salvar sempre em **UTF-8** (`ensure_ascii=False`).
4. **Estrutura do JSON**:
   ```json
   [
     {
       "start": 3.48,
       "end": 6.60,
       "en": "There was once a farmer and his wife.",
       "pt": "Era uma vez um fazendeiro e sua esposa."
     }
   ]
   ```
   - `start` (número float): Segundo exato em que a frase começa no áudio.
   - `end` (número float): Segundo exato em que a frase termina no áudio.
   - `en` (string): Frase em inglês com pontuação e maiúsculas corretas.
   - `pt` (string): Tradução natural e contextualizada para português do Brasil.

---

## 📋 Passo a Passo para a IA Executar

Quando o usuário pedir para gerar a sincronização de uma nova lição (ex: `2 - The Endless Tale`):

### Passo 1: Extrair o Texto em Inglês
Verifique a pasta da lição.
- Se já existir um arquivo PDF (ex: `PDF The Endless Tale Texto Completo.pdf`), a IA pode extrair o texto completo via Python:
  ```python
  import pypdf
  reader = pypdf.PdfReader("caminho_do_pdf.pdf")
  full_text = " ".join([page.extract_text() for page in reader.pages])
  ```
- Se o usuário colar o texto no chat, use o texto fornecido por ele.

### Passo 2: Dividir em Sentenças Agradáveis para Estudo
- **Tamanho ideal**: Frases de 1 a 2 linhas (evite blocos gigantescos de parágrafo inteiro).
- **Quebras naturais**: Divida por pontos finais (`.`), exclamações (`!`), interrogações (`?`) e travessões/aspas de diálogos.
- **Tradução**: Gere a tradução fiel de cada frase para português.
- Salve uma lista temporária em JSON:
  ```json
  [
    {"en": "Sentence in English 1.", "pt": "Frase em português 1."},
    {"en": "Sentence in English 2.", "pt": "Frase em português 2."}
  ]
  ```

### Passo 3: Executar a Sincronização Acústica (Whisper Word-Level)
O projeto já conta com o script automatizado [`scripts/sync_audio_text.py`](scripts/sync_audio_text.py).

Basta rodar no terminal:
```bash
python scripts/sync_audio_text.py --audio "PASTA/NOME_DO_AUDIO.mp3" --sentences "caminho_temporario_frases.json" --output "PASTA/NOME_DO_AUDIO.json"
```

O script fará automaticamente:
1. O carregamento do Whisper com `return_timestamps="word"`.
2. O cálculo exato do segundo inicial e final de cada frase falada no áudio.
3. A criação do arquivo `.json` final alinhado.

---

## 💻 Script Autocontido de Referência (Caso precise rodar direto)

Se a IA preferir executar em um único script Python sem arquivos temporários, este é o código completo:

```python
import json
import re
from pathlib import Path
from transformers import pipeline

def clean_token(text):
    return re.sub(r"[^a-zA-Z0-9]", "", text).lower()

def generate_synced_lesson(audio_path_str, sentences_list, output_json_path_str):
    audio_path = Path(audio_path_str)
    output_path = Path(output_json_path_str)
    
    # 1. Extração fonética por palavra via Whisper
    pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en", return_timestamps="word")
    raw = pipe(str(audio_path), return_timestamps="word")
    
    words = []
    for w in raw.get("chunks", []):
        t = clean_token(w["text"])
        if t:
            ts = w["timestamp"]
            words.append({
                "clean": t,
                "start": ts[0] or 0.0,
                "end": ts[1] or (ts[0] + 0.3 if ts[0] else 0.3)
            })

    # 2. Alinhamento de cada frase com o início e fim da voz
    cur_idx = 0
    synced = []
    
    for item in sentences_list:
        tokens = [clean_token(w) for w in item["en"].split() if clean_token(w)]
        if not tokens:
            continue
            
        m_start = cur_idx
        for j in range(cur_idx, min(cur_idx + 18, len(words))):
            if words[j]["clean"] == tokens[0]:
                m_start = j
                break
                
        m_end = min(m_start + len(tokens) - 1, len(words) - 1)
        for k in range(max(m_start, m_end - 6), min(m_end + 10, len(words))):
            if words[k]["clean"] == tokens[-1]:
                m_end = k
                break
                
        s = round(words[m_start]["start"], 2)
        e = round(words[m_end]["end"], 2)
        if synced and s < synced[-1]["end"]:
            s = synced[-1]["end"]
        if e <= s:
            e = round(s + 1.2, 2)
            
        synced.append({
            "start": s,
            "end": e,
            "en": item["en"],
            "pt": item.get("pt", "")
        })
        cur_idx = m_end + 1

    # 3. Suavizar gaps curtos
    for i in range(len(synced) - 1):
        gap = synced[i+1]["start"] - synced[i]["end"]
        if 0 < gap < 0.5:
            synced[i]["end"] = synced[i+1]["start"]

    # 4. Salvar arquivo final
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(synced, f, ensure_ascii=False, indent=2)
        
    print(f"Sucesso! Gerado {output_path} com {len(synced)} frases sincronizadas.")
```

---

## 💬 Prompt Pronto para o Usuário Usar com Qualquer IA

Você pode simplesmente copiar e colar este prompt para qualquer IA:

> *"Por favor, leia as instruções no arquivo `COMO_SINCRONIZAR_NOVOS_AUDIOS.md` deste projeto. Em seguida, gere o arquivo `.json` de texto sincronizado com tradução para a lição **[INFORME O NOME DA PASTA AQUI, ex: 2 - The Endless Tale]**, deixando exatamente com as mesmas configurações de `1 - Jack Hannaford`."*
