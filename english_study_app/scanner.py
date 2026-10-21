import os
import re
from pathlib import Path
from .config import BASE_DIR, AUDIO_EXTENSIONS, PDF_EXTENSIONS, SYNC_EXTENSIONS, IGNORED_DIRS
from .database import (
    get_all_stats,
    get_manual_durations,
    get_audio_pdf_links,
    get_completed_lessons,
)
from .audio_duration import estimate_audio_duration, format_clock

def natural_sort_key(s):
    """Ordenação natural para que 'Part 2' venha antes de 'Part 10'."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', str(s))]

def format_file_size(size_bytes):
    """Formata tamanho de arquivo em formato legível."""
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"

def find_best_pdf_match(audio_filename, pdfs):
    """
    Encontra o PDF mais relevante para o áudio:
    - Se houver só 1 PDF, retorna ele.
    - Se houver múltiplos, tenta casar números ou partes (ex: 'Part 1', 'M01V03').
    """
    if not pdfs:
        return None
    if len(pdfs) == 1:
        return pdfs[0]["rel_path"]

    audio_lower = audio_filename.lower()

    # Procurar por padrões de 'part X'
    part_match = re.search(r'part\s*(\d+)', audio_lower)
    if part_match:
        part_num = part_match.group(1)
        for pdf in pdfs:
            if f"part {part_num}" in pdf["name"].lower() or f"part{part_num}" in pdf["name"].lower():
                return pdf["rel_path"]

    # Procurar códigos de lição comuns no início (ex: M01, V03, etc.)
    code_match = re.search(r'([m|v]\d+)', audio_lower)
    if code_match:
        code = code_match.group(1)
        for pdf in pdfs:
            if code in pdf["name"].lower():
                return pdf["rel_path"]

    # Se não achar correspondência exata, retorna o primeiro PDF
    return pdfs[0]["rel_path"]

def find_best_sync_match(audio_filename, sync_files):
    """
    Encontra o arquivo de sincronização (JSON) mais relevante para o áudio:
    - Se houver correspondência exata de nome (stem), retorna ele.
    - Se houver só 1 arquivo de sincronização na pasta, retorna ele.
    - Tenta casar 'Part X' ou códigos.
    """
    if not sync_files:
        return None
    
    audio_stem = Path(audio_filename).stem.lower()
    for sf in sync_files:
        if sf["title"].lower() == audio_stem:
            return sf["rel_path"]

    if len(sync_files) == 1:
        return sync_files[0]["rel_path"]

    # Procurar por padrões de 'part X'
    part_match = re.search(r'part\s*(\d+)', audio_stem)
    if part_match:
        part_num = part_match.group(1)
        for sf in sync_files:
            if f"part {part_num}" in sf["name"].lower() or f"part{part_num}" in sf["name"].lower():
                return sf["rel_path"]

    return sync_files[0]["rel_path"]

def scan_study_folders():
    """
    Varre os diretórios em busca de pastas que contenham arquivos de áudio ou PDF.
    Retorna uma lista estruturada de lições/pastas com seus respectivos arquivos e contagens.
    """
    stats = get_all_stats()
    manual_durations = get_manual_durations()
    pdf_links = get_audio_pdf_links()
    completed_lessons = get_completed_lessons()
    lessons = []

    # Iterar sobre subpastas na raiz
    for entry in sorted(os.scandir(BASE_DIR), key=lambda e: natural_sort_key(e.name)):
        if not entry.is_dir() or entry.name in IGNORED_DIRS or entry.name.startswith('.'):
            continue

        folder_path = Path(entry.path)
        folder_rel_path = folder_path.relative_to(BASE_DIR).as_posix()

        # Coletar arquivos de áudio, PDF e sincronização nesta pasta (e subpastas se houver)
        audios = []
        pdfs = []
        sync_files = []

        for root, _, files in os.walk(folder_path):
            root_path = Path(root)
            for f in sorted(files, key=natural_sort_key):
                if f.startswith('.') or f.lower() == 'desktop.ini':
                    continue

                ext = Path(f).suffix.lower()
                full_file_path = root_path / f
                rel_file_path = full_file_path.relative_to(BASE_DIR).as_posix()

                try:
                    file_size = full_file_path.stat().st_size
                except OSError:
                    file_size = 0

                if ext in AUDIO_EXTENSIONS:
                    stat_info = stats.get(rel_file_path, {"play_count": 0, "last_played": None})
                    duration_auto = estimate_audio_duration(full_file_path)
                    duration_manual = manual_durations.get(rel_file_path)
                    if duration_manual:
                        duration_seconds = duration_manual
                        duration_source = "manual"
                    elif duration_auto:
                        duration_seconds = duration_auto
                        duration_source = "auto"
                    else:
                        duration_seconds = None
                        duration_source = None
                    audios.append({
                        "name": f,
                        "title": Path(f).stem,
                        "rel_path": rel_file_path,
                        "extension": ext,
                        "size": format_file_size(file_size),
                        "duration_seconds": duration_seconds,
                        "duration_label": format_clock(duration_seconds) if duration_seconds else None,
                        "duration_auto": duration_auto,
                        "duration_source": duration_source,
                        "play_count": stat_info["play_count"],
                        "last_played": stat_info["last_played"],
                        "default_pdf": None, # será atribuído após coletar os PDFs
                        "sync_file": None   # será atribuído após coletar os arquivos de sincronização
                    })
                elif ext in PDF_EXTENSIONS:
                    pdfs.append({
                        "name": f,
                        "title": Path(f).stem,
                        "rel_path": rel_file_path,
                        "size": format_file_size(file_size)
                    })
                elif ext in SYNC_EXTENSIONS:
                    sync_files.append({
                        "name": f,
                        "title": Path(f).stem,
                        "rel_path": rel_file_path,
                        "size": format_file_size(file_size)
                    })

        # Atribuir o melhor PDF e arquivo de sincronização para cada áudio
        for audio in audios:
            auto_pdf = find_best_pdf_match(audio["name"], pdfs)
            manual_pdf = pdf_links.get(audio["rel_path"])
            audio["pdf_link_auto"] = auto_pdf
            audio["pdf_link_manual"] = manual_pdf
            audio["default_pdf"] = manual_pdf or auto_pdf
            audio["sync_file"] = find_best_sync_match(audio["name"], sync_files)

        # Só incluir se tiver pelo menos um áudio, PDF ou arquivo de sincronização
        if audios or pdfs or sync_files:
            total_listens = sum(a["play_count"] for a in audios)
            lessons.append({
                "id": folder_rel_path.replace("/", "_").replace(" ", "_"),
                "name": entry.name,
                "rel_path": folder_rel_path,
                "completed": folder_rel_path in completed_lessons,
                "audios": audios,
                "pdfs": pdfs,
                "sync_files": sync_files,
                "total_audios": len(audios),
                "total_pdfs": len(pdfs),
                "total_sync_files": len(sync_files),
                "total_listens": total_listens
            })

    # Pastas concluídas vão para o final da lista (as não concluídas ficam no topo,
    # prontas para o próximo estudo)
    lessons.sort(key=lambda lesson: (1 if lesson["completed"] else 0, natural_sort_key(lesson["name"])))
    return lessons
