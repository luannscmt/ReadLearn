import sqlite3
from datetime import date, datetime, timedelta
from .config import DB_PATH

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Cria as tabelas necessárias e, na primeira execução, migra o histórico antigo
    (que só guardava a última data) para a tabela de histórico de escutas.
    """
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listen_stats (
                audio_path TEXT PRIMARY KEY,
                play_count INTEGER NOT NULL DEFAULT 0,
                last_played TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS listen_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audio_path TEXT NOT NULL,
                listened_at TIMESTAMP NOT NULL,
                count INTEGER NOT NULL DEFAULT 1,
                source TEXT NOT NULL DEFAULT 'auto'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audio_durations (
                audio_path TEXT PRIMARY KEY,
                duration_seconds INTEGER NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audio_pdf_links (
                audio_path TEXT PRIMARY KEY,
                pdf_path TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS lesson_completed (
                lesson_path TEXT PRIMARY KEY,
                completed_at TIMESTAMP NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_listen_history_path ON listen_history(audio_path)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_listen_history_date ON listen_history(listened_at)"
        )
        _seed_legacy_history(conn)
        conn.commit()

def _seed_legacy_history(conn):
    """
    Versões antigas só guardavam play_count + last_played (uma data por áudio).
    Para não perder esse histórico no dashboard, criamos um único registro agregado
    ('legacy') com a data da última escuta conhecida. É feito apenas uma vez.
    """
    rows = conn.execute(
        "SELECT audio_path, play_count, last_played FROM listen_stats "
        "WHERE play_count > 0 AND last_played IS NOT NULL"
    ).fetchall()
    for row in rows:
        exists = conn.execute(
            "SELECT 1 FROM listen_history "
            "WHERE audio_path = ? AND source = 'legacy' LIMIT 1",
            (row["audio_path"],)
        ).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO listen_history (audio_path, listened_at, count, source) "
                "VALUES (?, ?, ?, 'legacy')",
                (row["audio_path"], row["last_played"], row["play_count"])
            )

def get_all_stats():
    """Retorna dicionário com contagens e datas mapeadas pelo audio_path relativo."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT audio_path, play_count, last_played FROM listen_stats")
        results = {}
        for row in cursor.fetchall():
            results[row["audio_path"]] = {
                "play_count": row["play_count"],
                "last_played": row["last_played"]
            }
        return results

def get_audio_stat(audio_path: str):
    """Retorna a contagem e última execução de um áudio específico."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT play_count, last_played FROM listen_stats WHERE audio_path = ?",
            (audio_path,)
        )
        row = cursor.fetchone()
        if row:
            return {"play_count": row["play_count"], "last_played": row["last_played"]}
        return {"play_count": 0, "last_played": None}

def _remove_history_events(conn, audio_path: str, amount: int):
    """
    Remove eventos do histórico do mais recente para o mais antigo (usado quando
    o usuário decrementa a contagem com '-'), mantendo a soma consistente.
    """
    while amount > 0:
        row = conn.execute(
            "SELECT id, count FROM listen_history "
            "WHERE audio_path = ? ORDER BY id DESC LIMIT 1",
            (audio_path,)
        ).fetchone()
        if not row:
            break
        remove = min(amount, row["count"])
        if remove >= row["count"]:
            conn.execute("DELETE FROM listen_history WHERE id = ?", (row["id"],))
        else:
            conn.execute(
                "UPDATE listen_history SET count = count - ? WHERE id = ?",
                (remove, row["id"])
            )
        amount -= remove

def increment_play_count(audio_path: str, delta: int = 1, source: str = "auto"):
    """
    Incrementa ou decrementa a contagem de um áudio.

    - delta > 0: também adiciona um evento no histórico com data/hora (source: auto|manual).
    - delta < 0: remove o evento mais recente do histórico para manter consistência.
    """
    audio_path = audio_path.replace("\\", "/")
    delta = int(delta)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    last_played = now
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT play_count FROM listen_stats WHERE audio_path = ?",
            (audio_path,)
        )
        row = cursor.fetchone()
        if row:
            new_count = max(0, row["play_count"] + delta)
            conn.execute(
                "UPDATE listen_stats SET play_count = ?, last_played = ? WHERE audio_path = ?",
                (new_count, now, audio_path)
            )
        else:
            new_count = max(0, delta)
            conn.execute(
                "INSERT INTO listen_stats (audio_path, play_count, last_played) VALUES (?, ?, ?)",
                (audio_path, new_count, now)
            )

        if delta > 0:
            conn.execute(
                "INSERT INTO listen_history (audio_path, listened_at, count, source) "
                "VALUES (?, ?, ?, ?)",
                (audio_path, now, delta, source if source in ("auto", "manual", "legacy") else "auto")
            )
        elif delta < 0:
            _remove_history_events(conn, audio_path, -delta)
            # Recalcular a última data real a partir do histórico restante
            newest = conn.execute(
                "SELECT MAX(listened_at) AS m FROM listen_history WHERE audio_path = ?",
                (audio_path,)
            ).fetchone()
            last_played = newest["m"]
            conn.execute(
                "UPDATE listen_stats SET last_played = ? WHERE audio_path = ?",
                (last_played, audio_path)
            )
            new_count = max(0, new_count)
        conn.commit()
        return {"audio_path": audio_path, "play_count": new_count, "last_played": last_played}

def set_play_count(audio_path: str, count: int):
    """Define diretamente o valor do contador."""
    audio_path = audio_path.replace("\\", "/")
    count = max(0, int(count))
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO listen_stats (audio_path, play_count, last_played)
            VALUES (?, ?, ?)
            ON CONFLICT(audio_path) DO UPDATE SET
                play_count = excluded.play_count,
                last_played = excluded.last_played
        """, (audio_path, count, now))
        conn.commit()
        return {"audio_path": audio_path, "play_count": count, "last_played": now}

def get_audio_history(audio_path: str):
    """Retorna todos os eventos de escuta de um áudio (mais recentes primeiro)."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, listened_at, count, source FROM listen_history "
            "WHERE audio_path = ? ORDER BY listened_at DESC, id DESC",
            (audio_path,)
        ).fetchall()
        return [dict(r) for r in rows]

def _current_streak(day_keys: set):
    """Dias consecutivos com escuta terminando hoje (ou ontem, se hoje ainda não houve)."""
    streak = 0
    d = date.today()
    if d.isoformat() not in day_keys:
        d -= timedelta(days=1)
    while d.isoformat() in day_keys:
        streak += 1
        d -= timedelta(days=1)
    return streak

def _best_streak(day_keys: set):
    """Maior sequência de dias consecutivos com escuta já alcançada."""
    best = current = 0
    prev = None
    for key in sorted(day_keys):
        d = date.fromisoformat(key)
        if prev is not None and (d - prev).days == 1:
            current += 1
        else:
            current = 1
        best = max(best, current)
        prev = d
    return best

def get_dashboard_stats():
    """
    Agrega contadores e histórico para o dashboard:
    - resumo (totais, dias ativos, sequências, hoje/semana/mês)
    - série diária de escutas
    - série acumulada (evolução)
    - mapa de áudios com seus eventos de histórico
    """
    with get_db_connection() as conn:
        stats_rows = conn.execute(
            "SELECT audio_path, play_count, last_played FROM listen_stats"
        ).fetchall()
        history_rows = conn.execute(
            "SELECT audio_path, listened_at, count, source FROM listen_history "
            "ORDER BY listened_at ASC, id ASC"
        ).fetchall()

    day_totals = {}
    audios = {}
    for h in history_rows:
        day = h["listened_at"][:10]
        day_totals[day] = day_totals.get(day, 0) + h["count"]
        a = audios.setdefault(
            h["audio_path"], {"play_count": 0, "last_played": None, "events": []}
        )
        a["events"].append({
            "listened_at": h["listened_at"],
            "count": h["count"],
            "source": h["source"]
        })
    for s in stats_rows:
        a = audios.setdefault(
            s["audio_path"], {"play_count": 0, "last_played": None, "events": []}
        )
        a["play_count"] = s["play_count"]
        a["last_played"] = s["last_played"]

    day_keys = set(day_totals)
    today = date.today()
    today_key = today.isoformat()

    today_count = day_totals.get(today_key, 0)
    week_count = sum(
        day_totals.get((today - timedelta(days=i)).isoformat(), 0) for i in range(7)
    )
    month_count = sum(
        day_totals.get((today - timedelta(days=i)).isoformat(), 0) for i in range(30)
    )

    daily = [
        {"date": d, "count": day_totals[d]}
        for d in sorted(day_totals)
        if day_totals[d] > 0
    ]

    cumulative = []
    running = 0
    for d in daily:
        running += d["count"]
        cumulative.append({"date": d["date"], "total": running})

    summary = {
        "total_listens": sum(a["play_count"] for a in audios.values()),
        "active_days": len(day_totals),
        "today_count": today_count,
        "week_count": week_count,
        "month_count": month_count,
        "current_streak": _current_streak(day_keys),
        "best_streak": _best_streak(day_keys),
        "first_date": daily[0]["date"] if daily else None,
        "last_date": daily[-1]["date"] if daily else None,
    }

    return {
        "summary": summary,
        "daily": daily,
        "cumulative": cumulative,
        "audios": audios,
    }

def get_manual_durations():
    """
    Retorna as durações informadas manualmente pelo usuário, mapeadas por
    audio_path. Estas duram mais que a detecção automática no cálculo do tempo.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT audio_path, duration_seconds FROM audio_durations"
        ).fetchall()
        return {r["audio_path"]: r["duration_seconds"] for r in rows}

def get_manual_duration(audio_path: str):
    """Retorna a duração manual de um áudio específico (ou None)."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT duration_seconds FROM audio_durations WHERE audio_path = ?",
            (audio_path,)
        ).fetchone()
        return row["duration_seconds"] if row else None

def set_manual_duration(audio_path: str, seconds: int):
    """Salva (ou substitui) a duração informada manualmente para um áudio."""
    audio_path = audio_path.replace("\\", "/")
    seconds = int(seconds)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO audio_durations (audio_path, duration_seconds, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(audio_path) DO UPDATE SET
                duration_seconds = excluded.duration_seconds,
                updated_at = excluded.updated_at
        """, (audio_path, seconds, now))
        conn.commit()
    return {"audio_path": audio_path, "duration_seconds": seconds}

def delete_manual_duration(audio_path: str):
    """Remove a duração manual (volta a usar a detecção automática, se houver)."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        conn.execute(
            "DELETE FROM audio_durations WHERE audio_path = ?",
            (audio_path,)
        )
        conn.commit()
    return {"audio_path": audio_path, "duration_seconds": None}

def get_audio_pdf_links():
    """
    Retorna os vínculos manuais áudio->PDF, mapeados por audio_path.
    Quando um áudio está aqui, o PDF indicado tem prioridade sobre a
    associação automática feita pelo sistema.
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT audio_path, pdf_path FROM audio_pdf_links"
        ).fetchall()
        return {r["audio_path"]: r["pdf_path"] for r in rows}

def get_audio_pdf_link(audio_path: str):
    """Retorna o PDF vinculado manualmente a um áudio (ou None)."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT pdf_path FROM audio_pdf_links WHERE audio_path = ?",
            (audio_path,)
        ).fetchone()
        return row["pdf_path"] if row else None

def set_audio_pdf_link(audio_path: str, pdf_path: str):
    """Salva (ou substitui) o vínculo manual áudio->PDF."""
    audio_path = audio_path.replace("\\", "/")
    pdf_path = pdf_path.replace("\\", "/")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO audio_pdf_links (audio_path, pdf_path, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(audio_path) DO UPDATE SET
                pdf_path = excluded.pdf_path,
                updated_at = excluded.updated_at
        """, (audio_path, pdf_path, now))
        conn.commit()
    return {"audio_path": audio_path, "pdf_path": pdf_path}

def delete_audio_pdf_link(audio_path: str):
    """Remove o vínculo manual (volta a usar a associação automática)."""
    audio_path = audio_path.replace("\\", "/")
    with get_db_connection() as conn:
        conn.execute(
            "DELETE FROM audio_pdf_links WHERE audio_path = ?",
            (audio_path,)
        )
        conn.commit()
    return {"audio_path": audio_path, "pdf_path": None}

def get_completed_lessons():
    """
    Retorna o conjunto de pastas/lições marcadas como concluídas
    (identificadas pelo caminho relativo da pasta).
    """
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT lesson_path FROM lesson_completed"
        ).fetchall()
        return {r["lesson_path"] for r in rows}

def set_lesson_completed(lesson_path: str, completed: bool):
    """Marca (completed=True) ou desmarca (False) uma pasta como concluída."""
    lesson_path = lesson_path.replace("\\", "/")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        if completed:
            conn.execute("""
                INSERT INTO lesson_completed (lesson_path, completed_at)
                VALUES (?, ?)
                ON CONFLICT(lesson_path) DO UPDATE SET
                    completed_at = excluded.completed_at
            """, (lesson_path, now))
        else:
            conn.execute(
                "DELETE FROM lesson_completed WHERE lesson_path = ?",
                (lesson_path,)
            )
        conn.commit()
    return {"lesson_path": lesson_path, "completed": bool(completed)}
