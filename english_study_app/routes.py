import urllib.parse
from datetime import date, timedelta
from pathlib import Path
from flask import Blueprint, render_template, jsonify, request, send_from_directory, abort
from .config import BASE_DIR, AUDIO_EXTENSIONS, PDF_EXTENSIONS, SYNC_EXTENSIONS
from .scanner import scan_study_folders
from .database import (
    increment_play_count,
    set_play_count,
    get_all_stats,
    get_audio_history,
    get_dashboard_stats,
    get_manual_duration,
    set_manual_duration,
    delete_manual_duration,
    set_audio_pdf_link,
    delete_audio_pdf_link,
    set_lesson_completed,
)
from .audio_duration import estimate_audio_duration, format_clock, format_span

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    lessons = scan_study_folders()
    return render_template("index.html", lessons=lessons)

@main_bp.route("/api/lessons")
def api_lessons():
    """Retorna a estrutura completa de lições e contagens em formato JSON."""
    lessons = scan_study_folders()
    return jsonify({"success": True, "lessons": lessons})

@main_bp.route("/api/listen/increment", methods=["POST"])
def api_increment_listen():
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    delta = data.get("delta", 1)
    source = data.get("source", "auto")

    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    result = increment_play_count(audio_path, delta, source)
    return jsonify({"success": True, "stat": result})

@main_bp.route("/api/listen/set", methods=["POST"])
def api_set_listen():
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    count = data.get("count", 0)

    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    result = set_play_count(audio_path, count)
    return jsonify({"success": True, "stat": result})

@main_bp.route("/api/audio/history")
def api_audio_history():
    """Histórico completo de datas/horas em que um áudio específico foi escutado."""
    audio_path = request.args.get("audio_path", "")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    rows = get_audio_history(audio_path)
    return jsonify({"success": True, "audio_path": audio_path, "history": rows})

def _normalize_audio_path(audio_path):
    """Normaliza o caminho do áudio para o formato relativo usado no banco."""
    if not audio_path:
        return None
    return audio_path.replace("\\", "/")

def _duration_payload(audio_path):
    """Resolve a duração de um áudio: manual (banco) tem prioridade sobre a automática."""
    audio_path = _normalize_audio_path(audio_path)
    auto = None
    candidate = (BASE_DIR / audio_path).resolve()
    try:
        candidate.relative_to(BASE_DIR)
        if candidate.is_file():
            auto = estimate_audio_duration(candidate)
    except (ValueError, OSError):
        auto = None

    manual = get_manual_duration(audio_path)
    effective = manual if manual is not None else auto
    return {
        "audio_path": audio_path,
        "auto_seconds": auto,
        "auto_label": format_clock(auto) if auto else None,
        "manual_seconds": manual,
        "effective_seconds": effective,
        "effective_label": format_clock(effective) if effective else None,
        "source": "manual" if manual is not None else ("auto" if auto else None),
    }

@main_bp.route("/api/audio/duration", methods=["GET"])
def api_audio_duration_get():
    """Consulta a duração (manual/automática) de um áudio."""
    audio_path = request.args.get("audio_path", "")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400
    return jsonify({"success": True, "duration": _duration_payload(audio_path)})

@main_bp.route("/api/audio/duration", methods=["POST"])
def api_audio_duration_set():
    """Salva no banco a duração informada manualmente para um áudio."""
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    seconds = data.get("seconds")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400
    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Informe um tempo válido em segundos."}), 400
    if seconds < 1 or seconds > 12 * 3600:
        return jsonify({"success": False, "error": "O tempo deve estar entre 1 segundo e 12 horas."}), 400

    set_manual_duration(audio_path, seconds)
    return jsonify({"success": True, "duration": _duration_payload(audio_path)})

@main_bp.route("/api/audio/duration", methods=["DELETE"])
def api_audio_duration_delete():
    """Remove a duração manual e volta a usar a detecção automática."""
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    delete_manual_duration(audio_path)
    return jsonify({"success": True, "duration": _duration_payload(audio_path)})

@main_bp.route("/api/lesson/completed", methods=["POST"])
def api_lesson_completed():
    """
    Marca/desmarca uma pasta (lição) como concluída.
    Pastas concluídas vão para o final da lista principal.
    """
    data = request.get_json() or {}
    lesson_path = data.get("lesson_path")
    if not lesson_path:
        return jsonify({"success": False, "error": "lesson_path é obrigatório"}), 400

    completed = bool(data.get("completed", False))
    result = set_lesson_completed(lesson_path, completed)
    return jsonify({"success": True, "lesson": result})

def _audio_link_info(audio_path):
    """Consulta a associação áudio<->PDF já aplicando o vínculo manual (se houver)."""
    audio_path = audio_path.replace("\\", "/")
    lessons = scan_study_folders()
    for lesson in lessons:
        for a in lesson["audios"]:
            if a["rel_path"] == audio_path:
                return {
                    "audio_path": audio_path,
                    "lesson": lesson["name"],
                    "pdf_link_auto": a.get("pdf_link_auto"),
                    "pdf_link_manual": a.get("pdf_link_manual"),
                    "default_pdf": a.get("default_pdf"),
                }
    return None

@main_bp.route("/api/audio/link", methods=["GET"])
def api_audio_link_get():
    """Consulta o vínculo atual (manual/automático) entre um áudio e seu PDF."""
    audio_path = request.args.get("audio_path", "")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    info = _audio_link_info(audio_path)
    if not info:
        return jsonify({"success": False, "error": "Áudio não encontrado."}), 404
    return jsonify({"success": True, "link": info})

@main_bp.route("/api/audio/link", methods=["POST"])
def api_audio_link_set():
    """
    Define (ou remove, com pdf_path vazio) o vínculo manual áudio->PDF.
    O vínculo fica salvo no banco e tem prioridade sobre a associação automática.
    """
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    pdf_path = data.get("pdf_path") or None
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    audio_path = audio_path.replace("\\", "/")
    if pdf_path:
        pdf_path = pdf_path.replace("\\", "/")

    # Validar que o áudio existe e que o PDF pertence à mesma lição
    lessons = scan_study_folders()
    audio_entry = None
    lesson_pdfs = []
    for lesson in lessons:
        for a in lesson["audios"]:
            if a["rel_path"] == audio_path:
                audio_entry = a
                lesson_pdfs = [p["rel_path"] for p in lesson["pdfs"]]
                break
        if audio_entry:
            break
    if not audio_entry:
        return jsonify({"success": False, "error": "Áudio não encontrado."}), 404
    if pdf_path and pdf_path not in lesson_pdfs:
        return jsonify({
            "success": False,
            "error": "O PDF escolhido não pertence à mesma lição deste áudio."
        }), 400

    if pdf_path:
        set_audio_pdf_link(audio_path, pdf_path)
    else:
        delete_audio_pdf_link(audio_path)

    info = _audio_link_info(audio_path)
    return jsonify({"success": True, "link": info})

@main_bp.route("/api/audio/link", methods=["DELETE"])
def api_audio_link_delete():
    """Remove o vínculo manual áudio->PDF (volta ao automático)."""
    data = request.get_json() or {}
    audio_path = data.get("audio_path")
    if not audio_path:
        return jsonify({"success": False, "error": "audio_path é obrigatório"}), 400

    delete_audio_pdf_link(audio_path)
    info = _audio_link_info(audio_path)
    if not info:
        return jsonify({"success": False, "error": "Áudio não encontrado."}), 404
    return jsonify({"success": True, "link": info})

@main_bp.route("/api/dashboard")
def api_dashboard():
    """
    Dados agregados do dashboard de evolução:
    resumo (inclui tempo total escutado), séries diária/acumulada,
    atividade recente e detalhe por áudio.
    """
    lessons = scan_study_folders()
    stats_data = get_dashboard_stats()
    audios_by_path = stats_data.pop("audios")

    # Metadados (nome da lição, título, tamanho, duração) vindos da varredura
    meta = {}
    for lesson in lessons:
        for a in lesson["audios"]:
            meta[a["rel_path"]] = {
                "lesson": lesson["name"],
                "title": a["title"],
                "size": a["size"],
                "duration_seconds": a.get("duration_seconds"),
                "duration_label": a.get("duration_label"),
                "duration_auto": a.get("duration_auto"),
                "duration_source": a.get("duration_source"),
            }

    audios = []
    for path in sorted(meta):
        m = meta[path]
        st = audios_by_path.get(path, {"play_count": 0, "last_played": None, "events": []})
        events = sorted(st["events"], key=lambda e: e["listened_at"], reverse=True)
        dur = m["duration_seconds"]
        listened_seconds = int(round(st["play_count"] * dur)) if dur else None
        audios.append({
            "rel_path": path,
            "lesson": m["lesson"],
            "title": m["title"],
            "size": m["size"],
            "duration_seconds": dur,
            "duration_label": m["duration_label"],
            "duration_auto": m["duration_auto"],
            "duration_source": m["duration_source"],
            "play_count": st["play_count"],
            "last_played": st["last_played"],
            "events": events,
            "listened_seconds": listened_seconds,
            "listened_label": format_span(listened_seconds) if listened_seconds is not None else None,
        })

    # ---- Tempo escutado (estimado): duração do arquivo x escutas registradas ----
    day_seconds = {}
    total_seconds = 0.0
    for a in audios:
        dur = a["duration_seconds"]
        if not dur:
            continue
        events = a.get("events") or []
        if events:
            for ev in events:
                sec = float(ev["count"]) * dur
                total_seconds += sec
                day_key = ev["listened_at"][:10]
                day_seconds[day_key] = day_seconds.get(day_key, 0.0) + sec
        elif a.get("play_count") and a.get("last_played"):
            sec = float(a["play_count"]) * dur
            total_seconds += sec
            day_key = a["last_played"][:10]
            day_seconds[day_key] = day_seconds.get(day_key, 0.0) + sec

    today = date.today()

    def sum_recent_days(n):
        return sum(
            day_seconds.get((today - timedelta(days=i)).isoformat(), 0.0)
            for i in range(n)
        )

    summary = stats_data.get("summary", {})
    summary["total_audios"] = len(audios)
    studied = [a for a in audios if a["play_count"] > 0]
    summary["studied_audios"] = len(studied)
    summary["progress_pct"] = round(
        (summary["studied_audios"] / summary["total_audios"] * 100)
        if summary["total_audios"] else 0.0,
        1
    )
    summary["time_available"] = any(a.get("duration_seconds") for a in audios)
    summary["total_listen_seconds"] = int(round(total_seconds))
    summary["today_seconds"] = int(round(sum_recent_days(1)))
    summary["week_seconds"] = int(round(sum_recent_days(7)))
    summary["month_seconds"] = int(round(sum_recent_days(30)))
    summary["total_listen_label"] = format_span(int(round(total_seconds)))

    # Anexar segundos estimados à série diária (para tooltips/legendas)
    daily = []
    for d in stats_data.get("daily", []):
        entry = dict(d)
        entry["seconds"] = int(round(day_seconds.get(d["date"], 0.0)))
        daily.append(entry)

    recent = sorted(
        [a for a in audios if a.get("last_played")],
        key=lambda a: a["last_played"],
        reverse=True,
    )[:6]
    # Enviar só o essencial para a lista de recentes
    recent_light = [
        {k: a[k] for k in ("rel_path", "lesson", "title", "play_count", "last_played")}
        for a in recent
    ]

    stats_data["summary"] = summary
    stats_data["daily"] = daily
    stats_data["audios"] = audios
    stats_data["recent"] = recent_light
    return jsonify({"success": True, **stats_data})

@main_bp.route("/media/audio/<path:filepath>")
def stream_audio(filepath):
    """
    Serve o arquivo de áudio suportando requisições parciais (Range requests)
    para permitir avançar/retroceder na barra de progresso do player.
    """
    filepath = urllib.parse.unquote(filepath)
    file_path = (BASE_DIR / filepath).resolve()

    # Prevenir Directory Traversal
    try:
        file_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403)

    if not file_path.is_file() or file_path.suffix.lower() not in AUDIO_EXTENSIONS:
        abort(404)

    return send_from_directory(
        file_path.parent,
        file_path.name,
        conditional=True
    )

@main_bp.route("/media/pdf/<path:filepath>")
def view_pdf(filepath):
    """Serve o arquivo PDF inline para exibição no leitor incorporado."""
    filepath = urllib.parse.unquote(filepath)
    file_path = (BASE_DIR / filepath).resolve()

    # Prevenir Directory Traversal
    try:
        file_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403)

    if not file_path.is_file() or file_path.suffix.lower() not in PDF_EXTENSIONS:
        abort(404)

    return send_from_directory(
        file_path.parent,
        file_path.name,
        mimetype="application/pdf",
        as_attachment=False
    )

@main_bp.route("/media/sync/<path:filepath>")
def view_sync(filepath):
    """Serve o arquivo de sincronização (JSON) para o leitor interativo."""
    filepath = urllib.parse.unquote(filepath)
    file_path = (BASE_DIR / filepath).resolve()

    # Prevenir Directory Traversal
    try:
        file_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403)

    if not file_path.is_file() or file_path.suffix.lower() not in SYNC_EXTENSIONS:
        abort(404)

    return send_from_directory(
        file_path.parent,
        file_path.name,
        mimetype="application/json",
        as_attachment=False
    )
