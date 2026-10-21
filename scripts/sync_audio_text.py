"""
Ferramenta para sincronizar arquivos de áudio em inglês com texto e tradução,
gerando arquivos .json com timestamps milimétricos via Whisper (Word-Level).
"""

import sys
import os
import json
import re
import argparse
from pathlib import Path

def clean_token(text):
    return re.sub(r"[^a-zA-Z0-9]", "", text).lower()

def extract_word_timestamps(audio_path, model_name="openai/whisper-tiny.en"):
    """Executa Whisper extraindo timestamps exatos para cada palavra falada."""
    from transformers import pipeline

    print(f"[*] Carregando modelo Whisper ({model_name})...")
    pipe = pipeline(
        "automatic-speech-recognition",
        model=model_name,
        return_timestamps="word"
    )

    print(f"[*] Analisando áudio: {audio_path}")
    result = pipe(str(audio_path), return_timestamps="word")
    raw_words = result.get("chunks", [])

    cleaned = []
    for w in raw_words:
        token = clean_token(w["text"])
        if token:
            ts = w["timestamp"]
            s = ts[0] if ts[0] is not None else 0.0
            e = ts[1] if ts[1] is not None else s + 0.3
            cleaned.append({
                "orig": w["text"],
                "clean": token,
                "start": round(float(s), 2),
                "end": round(float(e), 2)
            })

    print(f"[+] Total de palavras reconhecidas no áudio: {len(cleaned)}")
    return cleaned

def align_sentences_with_words(sentences, word_tokens):
    """
    Alinha cada sentença (lista de dicts com 'en' e 'pt')
    com os limites de início e fim no áudio.
    """
    cur_idx = 0
    aligned = []

    for item in sentences:
        en_text = item["en"]
        tokens = [clean_token(w) for w in en_text.split() if clean_token(w)]
        if not tokens:
            continue

        first_token = tokens[0]
        last_token = tokens[-1]

        # Procurar token inicial próximo a partir da posição atual
        match_start = cur_idx
        for j in range(cur_idx, min(cur_idx + 18, len(word_tokens))):
            if word_tokens[j]["clean"] == first_token:
                match_start = j
                break

        # Estimar tamanho e procurar token final
        expected_end = min(match_start + len(tokens) - 1, len(word_tokens) - 1)
        for k in range(max(match_start, expected_end - 6), min(expected_end + 10, len(word_tokens))):
            if word_tokens[k]["clean"] == last_token:
                expected_end = k
                break

        start_time = word_tokens[match_start]["start"]
        end_time = word_tokens[expected_end]["end"]

        # Garantir ordem estrita e duração mínima
        if aligned and start_time < aligned[-1]["end"]:
            start_time = aligned[-1]["end"]
        if end_time <= start_time:
            end_time = round(start_time + 1.2, 2)

        aligned.append({
            "start": round(start_time, 2),
            "end": round(end_time, 2),
            "en": item["en"],
            "pt": item.get("pt", "")
        })

        cur_idx = expected_end + 1

    # Suavizar pequenos intervalos (gaps < 0.5s)
    for i in range(len(aligned) - 1):
        gap = aligned[i+1]["start"] - aligned[i]["end"]
        if 0 < gap < 0.5:
            aligned[i]["end"] = aligned[i+1]["start"]

    return aligned

def main():
    parser = argparse.ArgumentParser(description="Gera JSON sincronizado de áudio + texto em inglês e tradução.")
    parser.add_argument("--audio", required=True, help="Caminho do arquivo de áudio (.mp3)")
    parser.add_argument("--sentences", required=True, help="Caminho do arquivo JSON com as frases [{'en': '...', 'pt': '...'}]")
    parser.add_argument("--output", help="Caminho do arquivo .json de saída (padrão: mesmo nome do áudio)")

    args = parser.parse_args()

    audio_path = Path(args.audio).resolve()
    sentences_path = Path(args.sentences).resolve()
    output_path = Path(args.output).resolve() if args.output else audio_path.with_suffix(".json")

    if not audio_path.is_file():
        print(f"[!] Erro: Áudio não encontrado: {audio_path}")
        sys.exit(1)
    if not sentences_path.is_file():
        print(f"[!] Erro: Arquivo de frases não encontrado: {sentences_path}")
        sys.exit(1)

    with open(sentences_path, "r", encoding="utf-8") as f:
        sentences = json.load(f)

    words = extract_word_timestamps(audio_path)
    aligned = align_sentences_with_words(sentences, words)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(aligned, f, ensure_ascii=False, indent=2)

    print(f"\n[✓] Sincronização concluída com sucesso!")
    print(f"    Salvo em: {output_path}")
    print(f"    Total de frases sincronizadas: {len(aligned)}")

if __name__ == "__main__":
    main()
