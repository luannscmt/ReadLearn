---
name: audio-sync-generator
description: Extrai timestamps com precisão milimétrica de arquivos de áudio em inglês usando Whisper (Word-Level) e alinha sentenças em inglês com tradução em português para gerar arquivos de sincronização (.json).
---

# Audio Sync Generator (Whisper Word-Level Alignment)

Esta Skill ensina qualquer IA ou desenvolvedor a gerar arquivos de **texto sincronizado com áudio (`.json`)** com precisão de milissegundos para o **English Study Station** (ou qualquer reprodutor estilo Karaokê/Teleprompter).

---

## 🧠 Como funciona a sincronização exata?

Modelos de Inteligência Artificial para voz (como o **Whisper da OpenAI**) costumam transcrever frases em blocos de até 30 segundos. Para uma leitura fluida que acompanha a fala humana, blocos grandes causam atrasos.

A técnica utilizada nesta Skill consiste em:
1. **Ativar o Word-Level Timestamps (`return_timestamps="word"`)**: O Whisper analisa a matriz de atenção acústica do áudio e extrai o início (`start`) e fim (`end`) de **cada palavra falada individualmente**.
2. **Alinhamento Fonético Guloso**:
   - Pega cada sentença original do texto (em inglês) e sua tradução (em português).
   - Localiza o primeiro termo no fluxo de palavras do áudio (`sentença.start = primeira_palavra.start`).
   - Localiza o último termo no fluxo de palavras do áudio (`sentença.end = ultima_palavra.end`).
3. **Exportação Estruturada**: Gera o arquivo `.json` com o mesmo nome do áudio no mesmo diretório.

---

## 📦 Pré-requisitos no Ambiente Python

O ambiente precisa apenas das bibliotecas padrão do ecossistema Hugging Face:

```bash
pip install torch transformers huggingface_hub
```

*(O modelo `openai/whisper-tiny.en` tem apenas ~150 MB, roda rápido em CPU sem precisar de placa de vídeo dedicada e fica salvo em cache local após o primeiro download).*

---

## 📄 Formato do Arquivo de Saída (`.json`)

O arquivo gerado deve ser salvo com o **mesmo nome do arquivo de áudio** (ex: `Nome Do Audio.json` ao lado de `Nome Do Audio.mp3`):

```json
[
  {
    "start": 3.48,
    "end": 6.6,
    "en": "There was once a farmer and his wife.",
    "pt": "Era uma vez um fazendeiro e sua esposa."
  },
  {
    "start": 6.6,
    "end": 13.22,
    "en": "She had been married before, her first husband had died, and now she was married again.",
    "pt": "Ela havia sido casada antes, seu primeiro marido havia morrido, e agora ela estava casada novamente."
  }
]
```

---

## 🤖 Instruções para a IA (Workflow Passo a Passo)

Quando o usuário pedir para sincronizar uma nova lição ou áudio:

### Passo 1: Obter o Texto e a Tradução
1. Ler o texto em inglês (diretamente do PDF da lição via `pypdf` ou fornecido pelo usuário).
2. Dividir o texto em frases naturais (pontos finais, exclamações, interrogações e quebras de diálogo).
3. Gerar a tradução fiel de cada frase para o português.
4. Salvar temporariamente como uma lista de objetos: `[{"en": "...", "pt": "..."}]`.

### Passo 2: Executar o Script de Sincronização
Execute o utilitário já configurado no projeto:

```bash
python scripts/sync_audio_text.py --audio "caminho/do/audio.mp3" --sentences "caminho/temporario/frases.json" --output "caminho/do/audio.json"
```

### Passo 3: Script Python Autocontido (Código Fonte)

Caso o script não esteja no projeto, utilize o código abaixo:

```python
import json
import re
from pathlib import Path
from transformers import pipeline

def clean(text):
    return re.sub(r"[^a-zA-Z0-9]", "", text).lower()

def sync_audio_with_sentences(audio_path, sentences, output_json_path):
    # 1. Extração por palavra
    pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en", return_timestamps="word")
    res = pipe(str(audio_path), return_timestamps="word")
    
    words = []
    for w in res.get("chunks", []):
        t = clean(w["text"])
        if t:
            ts = w["timestamp"]
            words.append({"clean": t, "start": ts[0] or 0.0, "end": ts[1] or ts[0] + 0.3})

    # 2. Alinhamento de frases
    cur = 0
    result = []
    for item in sentences:
        tokens = [clean(w) for w in item["en"].split() if clean(w)]
        if not tokens: continue
        
        m_start = cur
        for j in range(cur, min(cur + 15, len(words))):
            if words[j]["clean"] == tokens[0]:
                m_start = j
                break
                
        m_end = min(m_start + len(tokens) - 1, len(words) - 1)
        for k in range(max(m_start, m_end - 5), min(m_end + 8, len(words))):
            if words[k]["clean"] == tokens[-1]:
                m_end = k
                break
                
        s = round(words[m_start]["start"], 2)
        e = round(words[m_end]["end"], 2)
        if result and s < result[-1]["end"]: s = result[-1]["end"]
        if e <= s: e = round(s + 1.2, 2)
        
        result.append({"start": s, "end": e, "en": item["en"], "pt": item.get("pt", "")})
        cur = m_end + 1

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
```

---

## 💡 Dicas de Qualidade
- **Nomes Idênticos**: Salve o arquivo JSON com o mesmo nome exato do arquivo MP3 (ex: `Lesson 01.mp3` -> `Lesson 01.json`). O sistema reconhece e ativa o leitor sincronizado automaticamente!
- **Frases de Diálogo**: Mantenha as aspas e travessões no texto em inglês para leitura agradável.
- **Evite Estimativas**: Nunca estime tempos dividindo palavras por minuto (WPM); a fala humana varia de velocidade a cada frase. Use sempre a extração acústica do Whisper.
