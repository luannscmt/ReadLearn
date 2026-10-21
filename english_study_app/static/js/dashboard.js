/**
 * English Audio & PDF Study Station
 * Dashboard de Evolução + Histórico de Datas por Áudio
 * ------------------------------------------------------------------
 * Funcionalidades:
 *  - Botão "📊 Estatísticas" abre o dashboard (totais, dias de estudo,
 *    sequência, escutas por dia e evolução acumulada).
 *  - Botão "🗓️" de cada áudio abre o histórico de datas/horas escutadas.
 *  - Mantém a data de "última escuta" visível sob cada áudio da lista.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------
    // Elementos do DOM
    // ------------------------------------------------------------------
    const dashModal = document.getElementById('dashboardModal');
    const dashContent = document.getElementById('dashboardContent');
    const dashUpdatedAt = document.getElementById('dashboardUpdatedAt');
    const btnDashboard = document.getElementById('btnDashboard');
    const btnCloseDashboard = document.getElementById('btnCloseDashboard');

    const historyModal = document.getElementById('historyModal');
    const historyList = document.getElementById('historyList');
    const historyModalTitle = document.getElementById('historyModalTitle');
    const historyModalSub = document.getElementById('historyModalSub');
    const btnCloseHistory = document.getElementById('btnCloseHistory');

    const durationModal = document.getElementById('durationModal');
    const durationModalSub = document.getElementById('durationModalSub');
    const durationDetected = document.getElementById('durationDetected');
    const durationInput = document.getElementById('durationInput');
    const durationError = document.getElementById('durationError');
    const btnSaveDuration = document.getElementById('btnSaveDuration');
    const btnClearDuration = document.getElementById('btnClearDuration');
    const btnCloseDuration = document.getElementById('btnCloseDuration');

    const linkModal = document.getElementById('linkModal');
    const linkModalSub = document.getElementById('linkModalSub');
    const linkOptions = document.getElementById('linkOptions');
    const linkError = document.getElementById('linkError');
    const btnSaveLink = document.getElementById('btnSaveLink');
    const btnCloseLink = document.getElementById('btnCloseLink');

    const TOAST = document.getElementById('toastNotification');

    // Estado
    let dashboardData = null;
    let dashRange = 14;

    // ------------------------------------------------------------------
    // Utilitários de formatação (compartilhados com player.js via window)
    // ------------------------------------------------------------------
    function pad(n) {
        return String(n).padStart(2, '0');
    }

    // 'YYYY-MM-DD HH:MM:SS' -> 'DD/MM/AAAA HH:MM'
    window.formatDateTimeBr = function (ts) {
        if (!ts) return '';
        const m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (!m) return String(ts);
        return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    };

    // 'YYYY-MM-DD' -> 'DD/MM'
    function formatDateKeyShort(key) {
        const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return key;
        return `${m[3]}/${m[2]}`;
    }

    // 'YYYY-MM-DD' -> 'DD/MM/AAAA'
    function formatDateKeyFull(key) {
        const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return key;
        return `${m[3]}/${m[2]}/${m[1]}`;
    }

    function isoKeyOfDate(d) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // segundos -> '2h 05min' | '42min' | '50s'
    function formatSpan(seconds) {
        const total = parseInt(seconds || 0, 10);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
        if (m > 0) return `${m}min`;
        if (s > 0) return `${s}s`;
        return '0min';
    }

    // segundos -> '13:24' | '1:04:12' (duração de um arquivo)
    function formatClock(seconds) {
        const total = parseInt(seconds || 0, 10);
        if (!total) return '';
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Aceita '40' (segundos), '12:30' (min:seg) ou '1:02:03' (h:min:seg)
    function parseTimeInput(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const parts = raw.split(':').map(p => p.trim());
        const nums = [];
        for (const p of parts) {
            if (!/^\d+$/.test(p)) return null;
            nums.push(parseInt(p, 10));
        }
        let secs;
        if (nums.length === 1) secs = nums[0];
        else if (nums.length === 2) secs = nums[0] * 60 + nums[1];
        else if (nums.length === 3) secs = nums[0] * 3600 + nums[1] * 60 + nums[2];
        else return null;
        if (!Number.isFinite(secs) || secs < 1) return null;
        return secs;
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ------------------------------------------------------------------
    // Atualizar a linha "🗓️ última escuta" de um item de áudio da lista
    // (exposto no window para ser chamado pelo player.js)
    // ------------------------------------------------------------------
    window.updateAudioLastDate = function (item, rawValue) {
        if (!item) return;
        if (rawValue === undefined) {
            rawValue = item.getAttribute('data-last-played') || '';
        }
        let span = item.querySelector('.audio-last-date');
        const meta = item.querySelector('.audio-meta');
        if (!span && meta) {
            span = document.createElement('span');
            span.className = 'audio-last-date';
            span.title = 'Última vez que este áudio foi escutado';
            meta.appendChild(span);
        }
        if (!span) return;
        item.setAttribute('data-last-played', rawValue || '');
        if (rawValue) {
            span.textContent = '🗓️ ' + window.formatDateTimeBr(rawValue);
            span.style.display = '';
        } else {
            span.textContent = '';
            span.style.display = 'none';
        }
    };

    // ------------------------------------------------------------------
    // Pequeno toast reutilizável (evita conflito com o do player.js)
    // ------------------------------------------------------------------
    function showMiniToast(message) {
        if (!TOAST) return;
        TOAST.textContent = message;
        TOAST.classList.remove('hidden');
        TOAST.style.opacity = '1';
        clearTimeout(showMiniToast._timer);
        showMiniToast._timer = setTimeout(() => {
            TOAST.style.opacity = '0';
            setTimeout(() => TOAST.classList.add('hidden'), 300);
        }, 2500);
    }

    // ------------------------------------------------------------------
    // Gerenciamento dos modais
    // ------------------------------------------------------------------
    function hideAllModals() {
        if (dashModal) dashModal.classList.add('hidden');
        if (historyModal) historyModal.classList.add('hidden');
        if (durationModal) durationModal.classList.add('hidden');
        if (linkModal) linkModal.classList.add('hidden');
        const shortcuts = document.getElementById('shortcutsModal');
        if (shortcuts) shortcuts.classList.add('hidden');
    }

    if (btnDashboard) {
        btnDashboard.addEventListener('click', () => {
            hideAllModals();
            if (dashModal) dashModal.classList.remove('hidden');
            loadDashboard();
        });
    }
    if (btnCloseDashboard) {
        btnCloseDashboard.addEventListener('click', () => dashModal.classList.add('hidden'));
    }
    if (dashModal) {
        dashModal.addEventListener('click', (e) => {
            if (e.target === dashModal) dashModal.classList.add('hidden');
        });
    }
    if (btnCloseHistory) {
        btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));
    }
    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) historyModal.classList.add('hidden');
        });
    }
    if (btnCloseDuration) {
        btnCloseDuration.addEventListener('click', () => durationModal.classList.add('hidden'));
    }
    if (durationModal) {
        durationModal.addEventListener('click', (e) => {
            if (e.target === durationModal) durationModal.classList.add('hidden');
        });
    }
    if (btnCloseLink) {
        btnCloseLink.addEventListener('click', () => linkModal.classList.add('hidden'));
    }
    if (linkModal) {
        linkModal.addEventListener('click', (e) => {
            if (e.target === linkModal) linkModal.classList.add('hidden');
        });
    }

    // Fechar com Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideAllModals();
    });

    // ------------------------------------------------------------------
    // Histórico de datas de um áudio
    // ------------------------------------------------------------------
    const SOURCE_LABELS = {
        auto: { label: 'Automática', css: 'auto' },
        manual: { label: 'Manual', css: 'manual' },
        legacy: { label: 'Registro anterior', css: 'legacy' }
    };

    function emptyHistoryHtml(message) {
        return `<div class="dash-empty">${esc(message)}</div>`;
    }

    window.openAudioHistory = async function (path, title, lessonName, totalCount) {
        hideAllModals();
        if (historyModal) historyModal.classList.remove('hidden');
        if (historyModalTitle) historyModalTitle.textContent = '🗓️ ' + (title || 'Histórico de escutas');
        if (historyModalSub) {
            historyModalSub.textContent = lessonName
                ? `${lessonName} · ${totalCount}x no total`
                : `${totalCount}x no total`;
        }
        if (historyList) historyList.innerHTML = emptyHistoryHtml('Carregando histórico...');

        try {
            const res = await fetch('/api/audio/history?audio_path=' + encodeURIComponent(path));
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao carregar histórico');

            const events = data.history || [];
            if (!events.length) {
                if (historyList) {
                    historyList.innerHTML = emptyHistoryHtml(
                        'Nenhuma escuta registrada para este áudio ainda. ' +
                        'Termine de ouvi-lo (ou use o botão +1) para registrar a data.'
                    );
                }
                return;
            }

            let html = '<div class="history-summary">' +
                `${events.length} registro${events.length === 1 ? '' : 's'} de escuta · ` +
                `última: ${esc(window.formatDateTimeBr(events[0].listened_at))}` +
                '</div>';

            events.forEach((ev) => {
                const meta = SOURCE_LABELS[ev.source] || { label: ev.source, css: 'auto' };
                const qty = ev.count > 1 ? `${ev.count}x (agrupado)` : '1x';
                const datePart = ev.listened_at ? String(ev.listened_at).slice(0, 10) : '';
                const timePart = ev.listened_at ? String(ev.listened_at).slice(11, 16) : '';
                html += `
                    <div class="history-row" title="${esc(formatDateKeyFull(datePart))} às ${esc(timePart)}">
                        <span class="hist-date">${esc(window.formatDateTimeBr(ev.listened_at))}</span>
                        <span class="hist-tag hist-${esc(meta.css)}">${esc(meta.label)}</span>
                        <span class="hist-qty">${esc(qty)}</span>
                    </div>`;
            });

            if (historyList) historyList.innerHTML = html;
        } catch (err) {
            console.error('Erro ao carregar histórico:', err);
            if (historyList) historyList.innerHTML = emptyHistoryHtml('Erro ao carregar o histórico.');
        }
    };

    // Botão 🗓️ de cada áudio da lista lateral
    document.querySelectorAll('.btn-history').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.audio-item');
            if (!item) return;
            const path = item.getAttribute('data-audio-path');
            const title = item.getAttribute('data-audio-title');
            const lesson = item.getAttribute('data-lesson-name');
            const count = item.getAttribute('data-play-count') || '0';
            window.openAudioHistory(path, title, lesson, count);
        });
    });

    // ------------------------------------------------------------------
    // Dashboard
    // ------------------------------------------------------------------
    async function loadDashboard() {
        if (!dashContent) return;
        if (dashUpdatedAt) dashUpdatedAt.textContent = 'Atualizando...';
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao carregar dashboard');
            dashboardData = data;
            renderDashboard();
        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            dashContent.innerHTML = emptyHistoryHtml('Não foi possível carregar as estatísticas.') +
                '<div class="dash-note">Feche e abra novamente o dashboard para tentar outra vez.</div>';
        }
    }

    function renderDashboard() {
        const data = dashboardData;
        if (!data) return;
        const s = data.summary || {};
        const audios = data.audios || [];
        const recent = data.recent || [];

        if (dashUpdatedAt) {
            const now = new Date();
            dashUpdatedAt.textContent =
                `Atualizado em ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ` +
                `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        }

        // ----- Cartões de resumo -----
        const timeOk = !!s.time_available;
        const cards = [
            { icon: '🎧', value: s.total_listens || 0, label: 'Total de escutas' },
            { icon: '⏱️', value: s.total_listen_label || '0min', label: timeOk ? 'Tempo total escutado (≈)' : 'Tempo escutado', sub: timeOk ? null : 'sem duração dos áudios' },
            { icon: '📚', value: `${s.studied_audios || 0}/${s.total_audios || 0}`, label: 'Áudios estudados' },
            { icon: '🗓️', value: s.active_days || 0, label: 'Dias de estudo' },
            { icon: '🔥', value: (s.current_streak || 0) + (s.best_streak ? ` · melhor ${s.best_streak}` : ''), label: 'Sequência de dias' },
            { icon: '⚡', value: s.today_count || 0, label: 'Escutas hoje', sub: timeOk ? formatSpan(s.today_seconds) : null },
            { icon: '📅', value: s.week_count || 0, label: 'Últimos 7 dias', sub: timeOk ? formatSpan(s.week_seconds) : null },
            { icon: '📆', value: s.month_count || 0, label: 'Últimos 30 dias', sub: timeOk ? formatSpan(s.month_seconds) : null }
        ];

        const pct = Math.min(100, s.progress_pct || 0);
        let html = `
            <div class="dash-summary">
                ${cards.map(c => `
                    <div class="stat-card">
                        <span class="stat-icon">${c.icon}</span>
                        <span class="stat-value" title="${esc(c.label)}">${esc(c.value)}</span>
                        <span class="stat-label">${esc(c.label)}</span>
                        ${c.sub ? `<span class="stat-sub">⏱️ ${esc(c.sub)}</span>` : ''}
                    </div>`).join('')}
            </div>
            <div class="progress-block">
                <div class="progress-block-head">
                    <span>Progresso do acervo: ${s.studied_audios || 0} de ${s.total_audios || 0} áudios escutados (${pct}%)</span>
                </div>
                <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>

            <div class="dash-charts">
                <div class="dash-card">
                    <div class="dash-card-head">
                        <h4>📈 Escutas por dia</h4>
                        <div class="seg-control" id="dashRangeControl">
                            <button data-range="7" class="${dashRange === 7 ? 'active' : ''}">7d</button>
                            <button data-range="14" class="${dashRange === 14 ? 'active' : ''}">14d</button>
                            <button data-range="30" class="${dashRange === 30 ? 'active' : ''}">30d</button>
                        </div>
                    </div>
                    <div id="dashBarChart" class="bar-chart"></div>
                    <div id="dashBarLegend" class="chart-legend"></div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-head">
                        <h4>🚀 Evolução acumulada</h4>
                        <span class="card-head-total">Total: ${s.total_listens || 0}</span>
                    </div>
                    <div id="dashCumulative"></div>
                </div>
            </div>`;

        // ----- Recentemente escutados -----
        if (recent.length) {
            html += `
                <div class="dash-card">
                    <div class="dash-card-head"><h4>🕒 Recentemente escutados</h4></div>
                    <div class="recent-list">
                        ${recent.map(a => `
                            <button class="recent-chip" data-path="${esc(a.rel_path)}"
                                    data-title="${esc(a.title)}" data-lesson="${esc(a.lesson)}"
                                    data-count="${a.play_count || 0}" title="${esc(a.title)}">
                                <span class="recent-name">${esc(a.title)}</span>
                                <span class="recent-meta">${esc(a.lesson)} · ${esc(window.formatDateTimeBr(a.last_played))}</span>
                            </button>`).join('')}
                    </div>
                </div>`;
        }

        // ----- Detalhe por áudio -----
        const studied = audios.filter(a => a.play_count > 0)
            .sort((a, b) => (b.play_count - a.play_count) || String(b.last_played || '').localeCompare(String(a.last_played || '')));
        const unstudied = audios.filter(a => a.play_count === 0);
        const ordered = studied.concat(unstudied);

        html += `
            <div class="dash-card">
                <div class="dash-card-head">
                    <h4>🎵 Detalhe por áudio <span class="muted-head">(clique numa linha para ver as datas)</span></h4>
                </div>
                <div class="table-wrap">
                    <table class="audio-table">
                        <thead>
                            <tr>
                                <th>Lição</th>
                                <th>Áudio</th>
                                <th class="ta-right">Escutas</th>
                                <th>Duração</th>
                                <th>Tempo escutado (≈)</th>
                                <th>Última escuta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ordered.map(a => `
                                <tr class="dash-audio-row ${a.play_count === 0 ? 'row-muted' : ''}"
                                    data-path="${esc(a.rel_path)}" data-title="${esc(a.title)}"
                                    data-lesson="${esc(a.lesson)}" data-count="${a.play_count || 0}">
                                    <td class="cell-lesson">${esc(a.lesson)}</td>
                                    <td class="cell-title">${esc(a.title)}</td>
                                    <td class="ta-right"><span class="badge-count">${a.play_count || 0}x</span></td>
                                    <td class="cell-dur">
                                        <span class="dur-cell-label">${a.duration_label ? esc(a.duration_label) : '—'}</span>
                                        ${(a.duration_source === 'manual' || !a.duration_source)
                                            ? `<button class="btn-dur-edit" data-path="${esc(a.rel_path)}" title="${a.duration_source === 'manual' ? 'Ajustar duração informada' : 'Informar a duração deste áudio'}">✏️</button>`
                                            : ''}
                                    </td>
                                    <td class="cell-time">${a.listened_label ? esc(a.listened_label) : '—'}</td>
                                    <td class="cell-date">${a.last_played ? esc(window.formatDateTimeBr(a.last_played)) : '—'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <p class="dash-note">ℹ️ Registros de antes desta versão do app (que não guardavam data por escuta) aparecem na data da última escuta conhecida de cada áudio, identificados como "Registro anterior".</p>
            <p class="dash-note">⏱️ O tempo escutado é uma estimativa: duração do arquivo (lida do próprio MP3) multiplicada pelas escutas concluídas.</p>`;

        dashContent.innerHTML = html;

        renderBarChart();
        renderCumulativeChart();
        wireDashboardActions();
    }

    function renderBarChart() {
        const container = document.getElementById('dashBarChart');
        const legend = document.getElementById('dashBarLegend');
        if (!container || !dashboardData) return;

        // Mapas data -> escutas e data -> segundos estimados
        const byDay = {};
        const bySeconds = {};
        (dashboardData.daily || []).forEach(d => {
            byDay[d.date] = d.count;
            bySeconds[d.date] = d.seconds || 0;
        });
        const timeOk = !!(dashboardData.summary || {}).time_available;

        const series = [];
        const today = new Date();
        for (let i = dashRange - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = isoKeyOfDate(d);
            series.push({ key, count: byDay[key] || 0, seconds: bySeconds[key] || 0 });
        }
        const maxCount = Math.max(1, ...series.map(x => x.count));
        const anyActivity = series.some(x => x.count > 0);

        if (!anyActivity) {
            container.innerHTML = emptyHistoryHtml('Nenhuma escuta registrada neste período ainda.');
            if (legend) legend.innerHTML = '';
            return;
        }

        const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        container.innerHTML = series.map(item => {
            const pctH = item.count > 0 ? Math.max(4, Math.round((item.count / maxCount) * 100)) : 2;
            const d = new Date(item.key + 'T00:00:00');
            const isToday = item.key === isoKeyOfDate(new Date());
            const tip =
                `${esc(formatDateKeyFull(item.key))} · ${weekday[d.getDay()]} · ${item.count} escuta${item.count === 1 ? '' : 's'}` +
                (timeOk && item.seconds > 0 ? ` · ≈ ${formatSpan(item.seconds)}` : '');
            return `
                <div class="bar-col" title="${tip}">
                    <div class="bar-track"><div class="bar-fill ${item.count ? 'has' : ''} ${isToday ? 'today' : ''}" style="height:${pctH}%"></div></div>
                    <span class="bar-day">${String(d.getDate()).padStart(2, '0')}</span>
                </div>`;
        }).join('');

        if (legend) {
            const total = series.reduce((acc, x) => acc + x.count, 0);
            const daysActive = series.filter(x => x.count > 0).length;
            const totalSec = series.reduce((acc, x) => acc + (x.seconds || 0), 0);
            let rightText = `${total} escutas em ${daysActive} dia${daysActive === 1 ? '' : 's'}`;
            if (timeOk && totalSec > 0) rightText += ` · ≈ ${formatSpan(totalSec)}`;
            legend.innerHTML =
                `<span>${esc(formatDateKeyFull(series[0].key))} → ${esc(formatDateKeyFull(series[series.length - 1].key))}</span>` +
                `<span>${rightText}</span>`;
        }
    }

    function renderCumulativeChart() {
        const container = document.getElementById('dashCumulative');
        if (!container) return;
        const cumulative = (dashboardData.cumulative || []).filter(c => c.total > 0);
        if (!cumulative.length) {
            container.innerHTML = emptyHistoryHtml('Sem dados de evolução ainda — termine sua primeira escuta!');
            return;
        }

        const W = 660, H = 190, padL = 6, padR = 6, padT = 14, padB = 8;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;
        const maxV = Math.max(1, ...cumulative.map(c => c.total));
        const n = cumulative.length;

        const x = (i) => (n === 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1));
        const y = (v) => padT + plotH - (v / maxV) * plotH;

        const points = cumulative.map((c, i) => `${x(i).toFixed(1)},${y(c.total).toFixed(1)}`);

        let area = '';
        if (n === 1) {
            const cx = x(0), base = padT + plotH;
            area = `M ${(cx - 3).toFixed(1)},${base.toFixed(1)} ` +
                `L ${(cx - 3).toFixed(1)},${y(cumulative[0].total).toFixed(1)} ` +
                `L ${(cx + 3).toFixed(1)},${y(cumulative[0].total).toFixed(1)} ` +
                `L ${(cx + 3).toFixed(1)},${base.toFixed(1)} Z`;
        } else {
            area = `M ${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} ` +
                `L ${points.join(' L ')} ` +
                `L ${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
        }

        const last = cumulative[cumulative.length - 1];
        const first = cumulative[0];
        const grid = [0.25, 0.5, 0.75].map(f => {
            const gy = padT + plotH - f * plotH;
            return `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" style="stroke:var(--border-subtle);stroke-width:1" stroke-dasharray="3 4"/>`;
        }).join('');

        container.innerHTML = `
            <svg viewBox="0 0 ${W} ${H}" class="cum-svg" preserveAspectRatio="none" aria-label="Gráfico de evolução acumulada de escutas">
                <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.38"/>
                        <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0.03"/>
                    </linearGradient>
                </defs>
                ${grid}
                <path d="${area}" fill="url(#cumGrad)"/>
                <polyline points="${points.join(' ')}" fill="none"
                          style="stroke:var(--accent);stroke-width:2.5" stroke-linejoin="round" stroke-linecap="round"/>
            </svg>
            <div class="cum-foot">
                <span>Início: ${esc(formatDateKeyFull(first.date))}</span>
                <span class="cum-total">Total acumulado: ${esc(last.total)} escutas</span>
                <span>Hoje: ${esc(formatDateKeyFull(last.date))}</span>
            </div>`;
    }

    function wireDashboardActions() {
        // Troca de período do gráfico de barras
        const rangeControl = document.getElementById('dashRangeControl');
        if (rangeControl) {
            rangeControl.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    dashRange = parseInt(btn.getAttribute('data-range'), 10) || 14;
                    rangeControl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderBarChart();
                });
            });
        }

        // Chips de "recentemente escutados"
        document.querySelectorAll('.recent-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                window.openAudioHistory(
                    chip.getAttribute('data-path'),
                    chip.getAttribute('data-title'),
                    chip.getAttribute('data-lesson'),
                    chip.getAttribute('data-count')
                );
            });
        });

        // Linhas da tabela "detalhe por áudio"
        document.querySelectorAll('.dash-audio-row').forEach((row) => {
            row.addEventListener('click', () => {
                window.openAudioHistory(
                    row.getAttribute('data-path'),
                    row.getAttribute('data-title'),
                    row.getAttribute('data-lesson'),
                    row.getAttribute('data-count')
                );
            });
        });

        // Botão ✏️ (duração) dentro da tabela — não abre o histórico
        document.querySelectorAll('.btn-dur-edit').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = btn.closest('.dash-audio-row');
                openDurationEditor(
                    btn.getAttribute('data-path'),
                    row ? row.getAttribute('data-title') : ''
                );
            });
        });
    }

    // ------------------------------------------------------------------
    // Edição manual da duração de um áudio
    // ------------------------------------------------------------------
    let durationPath = null;
    let durationWasDashOpen = false;

    function updateDurationLink(el, p) {
        if (!el || !p) return;
        const src = p.source || '';
        el.classList.remove('dur-manual', 'dur-missing');
        el.setAttribute('data-dur', p.effective_seconds || '');
        el.setAttribute('data-dur-auto', p.auto_seconds || '');
        el.setAttribute('data-dur-source', src);
        if (!src) {
            el.textContent = '⏱️ informar duração';
            el.title = 'Duração não detectada — clique para informar o tempo';
            el.classList.add('dur-missing');
            return;
        }
        if (src === 'manual') {
            el.textContent = '⏱️ ' + (p.effective_label || formatClock(p.effective_seconds)) + ' ✎';
            el.title = 'Duração informada por você — clique para ajustar';
            el.classList.add('dur-manual');
        } else {
            el.textContent = '⏱️ ' + (p.effective_label || formatClock(p.effective_seconds));
            el.title = 'Duração detectada automaticamente — clique para ajustar';
        }
    }

    function applyDurationToSidebar(path, payload) {
        document.querySelectorAll('.audio-dur-link').forEach((el) => {
            if (el.getAttribute('data-path') === path) updateDurationLink(el, payload);
        });
    }

    async function openDurationEditor(path, title) {
        durationPath = path;
        durationWasDashOpen = !!(dashModal && !dashModal.classList.contains('hidden'));
        hideAllModals();
        if (!durationModal) return;
        durationModal.classList.remove('hidden');
        if (durationModalSub) durationModalSub.textContent = title || 'Informe o tempo deste áudio';
        if (durationDetected) durationDetected.innerHTML = '<span class="duration-loading">Consultando...</span>';
        if (durationInput) durationInput.value = '';
        if (durationError) durationError.textContent = '';
        if (btnClearDuration) btnClearDuration.classList.add('hidden');

        try {
            const res = await fetch('/api/audio/duration?audio_path=' + encodeURIComponent(path));
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao consultar');
            const p = data.duration || {};
            const parts = [];
            if (p.auto_seconds) {
                parts.push(`🔎 Detectado automaticamente: <b>${esc(p.auto_label)}</b>`);
            } else {
                parts.push('⚠️ Não foi possível detectar a duração automaticamente.');
            }
            if (p.manual_seconds) {
                parts.push(`💾 Salvo por você: <b>${esc(p.effective_label)}</b>`);
            }
            if (durationDetected) {
                durationDetected.innerHTML = parts.map(x => `<span>${x}</span>`).join('');
            }
            if (durationInput && p.manual_seconds) {
                durationInput.value = p.effective_label || formatClock(p.manual_seconds);
            }
            if (btnClearDuration) {
                if (p.manual_seconds) {
                    btnClearDuration.classList.remove('hidden');
                    btnClearDuration.textContent = p.auto_seconds
                        ? '↺ Usar detecção automática'
                        : '🗑️ Remover duração informada';
                } else {
                    btnClearDuration.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error('Erro ao consultar duração:', err);
            if (durationDetected) {
                durationDetected.innerHTML = '<span>Erro ao consultar a duração.</span>';
            }
        }
    }

    function showDurationError(message) {
        if (durationError) durationError.textContent = message;
    }

    async function submitDurationSave() {
        const secs = parseTimeInput(durationInput ? durationInput.value : '');
        if (!secs) {
            showDurationError('Digite um tempo válido (ex.: 40, 12:30 ou 1:02:03).');
            return;
        }
        try {
            const res = await fetch('/api/audio/duration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_path: durationPath, seconds: secs })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao salvar');
            finishDurationUpdate(data.duration, '⏱️ Duração salva no banco!');
        } catch (err) {
            console.error('Erro ao salvar duração:', err);
            showDurationError('Não foi possível salvar. Tente novamente.');
        }
    }

    async function submitDurationClear() {
        try {
            const res = await fetch('/api/audio/duration', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_path: durationPath })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao remover');
            finishDurationUpdate(data.duration, 'Duração manual removida.');
        } catch (err) {
            console.error('Erro ao remover duração:', err);
            showDurationError('Não foi possível remover. Tente novamente.');
        }
    }

    function finishDurationUpdate(payload, message) {
        if (durationModal) durationModal.classList.add('hidden');
        showMiniToast(message);
        applyDurationToSidebar(durationPath, payload);
        // Recarregar o dashboard se estava aberto (os totais de tempo mudaram)
        if (durationWasDashOpen && dashModal) {
            dashModal.classList.remove('hidden');
            loadDashboard();
        }
        durationWasDashOpen = false;
    }

    if (btnSaveDuration) btnSaveDuration.addEventListener('click', submitDurationSave);
    if (btnClearDuration) btnClearDuration.addEventListener('click', submitDurationClear);
    if (durationInput) {
        durationInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitDurationSave();
            }
        });
    }

    // Links de duração da lista lateral (clicar = informar/ajustar o tempo)
    document.querySelectorAll('.audio-dur-link').forEach((link) => {
        const onClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = link.closest('.audio-item');
            const title = item ? item.getAttribute('data-audio-title') : '';
            openDurationEditor(link.getAttribute('data-path'), title);
        };
        link.addEventListener('click', onClick);
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
            }
        });
    });

    // ------------------------------------------------------------------
    // Vínculo manual Áudio <-> PDF
    // ------------------------------------------------------------------
    let linkPath = null;
    let linkWasDashOpen = false;

    function findAudioItemEl(path) {
        const escapePath = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(path) : path;
        return document.querySelector(`.audio-item[data-audio-path="${escapePath}"]`);
    }

    async function openLinkEditor(path, title, lessonName) {
        linkPath = path;
        linkWasDashOpen = !!(dashModal && !dashModal.classList.contains('hidden'));
        hideAllModals();
        if (!linkModal) return;
        linkModal.classList.remove('hidden');
        if (linkModalSub) linkModalSub.textContent = [title, lessonName].filter(Boolean).join(' · ');
        if (linkError) linkError.textContent = '';
        if (linkOptions) linkOptions.innerHTML = '<p class="dash-empty">Carregando PDFs...</p>';
        if (btnSaveLink) btnSaveLink.disabled = false;

        // PDFs disponíveis: os da mesma lição (lidos da própria lista lateral)
        const itemEl = findAudioItemEl(path);
        const card = itemEl ? itemEl.closest('.lesson-card') : null;
        const pdfs = [];
        if (card) {
            card.querySelectorAll('.pdf-item').forEach((p) => {
                pdfs.push({
                    path: p.getAttribute('data-pdf-path'),
                    name: p.getAttribute('data-pdf-name') || p.getAttribute('data-pdf-path')
                });
            });
        }

        const pdfNameOf = (p) => {
            const found = pdfs.find(x => x.path === p);
            if (found) return found.name;
            return String(p).split('/').pop() || p;
        };

        try {
            const res = await fetch('/api/audio/link?audio_path=' + encodeURIComponent(path));
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao consultar vínculo');
            const info = data.link || {};

            if (!pdfs.length) {
                if (linkOptions) linkOptions.innerHTML = '<p class="dash-empty">Esta lição não tem nenhum PDF para vincular.</p>';
                if (btnSaveLink) btnSaveLink.disabled = true;
                return;
            }

            const currentManual = info.pdf_link_manual || '';
            let html = '';
            // Opção "automático" (sistema decide pelo nome/parte)
            const autoText = info.pdf_link_auto ? pdfNameOf(info.pdf_link_auto) : 'sistema escolhe pelo nome/parte';
            html += `
                <label class="link-option">
                    <input type="radio" name="linkPdfChoice" value="" ${currentManual ? '' : 'checked'}>
                    <span class="link-option-text">
                        <span class="link-opt-name">🤖 Automático (sistema)</span>
                        <span class="link-opt-sub">${esc(autoText)}</span>
                    </span>
                </label>`;
            // Um PDF por opção
            pdfs.forEach((p) => {
                html += `
                    <label class="link-option">
                        <input type="radio" name="linkPdfChoice" value="${esc(p.path)}" ${currentManual === p.path ? 'checked' : ''}>
                        <span class="link-option-text">
                            <span class="link-opt-name">📄 ${esc(p.name)}</span>
                        </span>
                    </label>`;
            });
            if (linkOptions) linkOptions.innerHTML = html;
        } catch (err) {
            console.error('Erro ao carregar vínculo:', err);
            if (linkOptions) linkOptions.innerHTML = '<p class="dash-empty">Erro ao carregar os PDFs.</p>';
        }
    }

    async function submitLinkSave() {
        if (!linkPath) return;
        const selected = document.querySelector('input[name="linkPdfChoice"]:checked');
        if (!selected) {
            if (linkError) linkError.textContent = 'Escolha um PDF ou a opção Automático.';
            return;
        }
        const pdfValue = selected.value || null;
        try {
            const res = await fetch('/api/audio/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_path: linkPath, pdf_path: pdfValue })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao salvar vínculo');
            const info = data.link || {};

            // Atualizar o item da lista lateral (afeta o próximo toque e o clique inverso PDF->áudio)
            const itemEl = findAudioItemEl(linkPath);
            if (itemEl) {
                itemEl.setAttribute('data-default-pdf', info.default_pdf || '');
                itemEl.setAttribute('data-manual-pdf', info.pdf_link_manual || '');
            }
            // Se este áudio estiver tocando agora, trocar o PDF aberto
            if (typeof window.applyPdfBinding === 'function') {
                window.applyPdfBinding(linkPath, info.default_pdf);
            }

            if (linkModal) linkModal.classList.add('hidden');
            showMiniToast(pdfValue
                ? '🔗 PDF vinculado a este áudio!'
                : 'Vínculo automático restaurado.');
            if (linkWasDashOpen && dashModal) {
                dashModal.classList.remove('hidden');
                loadDashboard();
            }
            linkWasDashOpen = false;
        } catch (err) {
            console.error('Erro ao salvar vínculo:', err);
            if (linkError) linkError.textContent = err.message || 'Não foi possível salvar. Tente novamente.';
        }
    }

    if (btnSaveLink) btnSaveLink.addEventListener('click', submitLinkSave);

    // Botões 🔗 de cada áudio da lista lateral
    document.querySelectorAll('.btn-link').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const item = btn.closest('.audio-item');
            const title = item ? item.getAttribute('data-audio-title') : '';
            const lesson = item ? item.getAttribute('data-lesson-name') : '';
            openLinkEditor(btn.getAttribute('data-path'), title, lesson);
        });
    });

    // ------------------------------------------------------------------
    // Marcar pasta/lição como concluída (vai para o fim da lista)
    // ------------------------------------------------------------------
    const lessonsContainer = document.getElementById('lessonsContainer');

    function sortLessonCards() {
        if (!lessonsContainer) return;
        const cards = Array.from(lessonsContainer.querySelectorAll('.lesson-card'));
        const todo = cards.filter(c => c.getAttribute('data-completed') !== '1');
        const done = cards.filter(c => c.getAttribute('data-completed') === '1');
        todo.forEach(c => lessonsContainer.appendChild(c));
        done.forEach(c => lessonsContainer.appendChild(c));
    }

    function setCardCompleted(card, completed) {
        card.classList.toggle('lesson-completed', completed);
        card.setAttribute('data-completed', completed ? '1' : '0');
        const checkbox = card.querySelector('.input-complete');
        if (checkbox) checkbox.checked = completed;
        const label = card.querySelector('.lesson-complete-toggle');
        if (label) {
            label.title = completed
                ? 'Desmarcar — ainda tenho áudios desta pasta para estudar'
                : 'Marcar como concluída — já estudei esta pasta';
        }
        const badges = card.querySelector('.lesson-badges');
        if (badges) {
            let doneBadge = badges.querySelector('.badge-done');
            if (completed && !doneBadge) {
                doneBadge = document.createElement('span');
                doneBadge.className = 'badge badge-done';
                doneBadge.title = 'Pasta concluída';
                doneBadge.textContent = '✅';
                badges.insertBefore(doneBadge, badges.firstChild);
            } else if (!completed && doneBadge) {
                doneBadge.remove();
            }
        }
    }

    async function toggleLessonComplete(input) {
        const card = input.closest('.lesson-card');
        if (!card) return;
        const lessonPath = input.getAttribute('data-path');
        const completed = input.checked;
        // Atualização otimista: marca e move a pasta imediatamente
        setCardCompleted(card, completed);
        sortLessonCards();
        try {
            const res = await fetch('/api/lesson/completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lesson_path: lessonPath, completed: completed })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha ao salvar');
            showMiniToast(completed
                ? '✅ Pasta marcada como concluída — foi para o fim da lista'
                : 'Pasta voltou para a lista de pendentes');
        } catch (err) {
            console.error('Erro ao marcar pasta:', err);
            setCardCompleted(card, !completed); // reverter em caso de erro
            sortLessonCards();
            showMiniToast('Não foi possível salvar a marcação.');
        }
    }

    // Clique no checkbox não pode abrir/fechar a pasta
    document.querySelectorAll('.lesson-complete-toggle').forEach((label) => {
        label.addEventListener('click', (e) => e.stopPropagation());
    });

    document.querySelectorAll('.input-complete').forEach((input) => {
        input.addEventListener('change', () => toggleLessonComplete(input));
    });

    // ------------------------------------------------------------------
    // Recarregar o dashboard automaticamente se estiver aberto
    // ------------------------------------------------------------------
    window.addEventListener('study:count-updated', () => {
        if (dashModal && !dashModal.classList.contains('hidden')) {
            loadDashboard();
        }
    });

    // ------------------------------------------------------------------
    // Inicialização: garantir que todos os itens mostrem a última data
    // ------------------------------------------------------------------
    document.querySelectorAll('.audio-item').forEach((item) => {
        window.updateAudioLastDate(item);
    });
});
