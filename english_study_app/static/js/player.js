/**
 * English Audio & PDF Study Station
 * Gerenciador de Player de Áudio, Leitor de PDF, Contadores, Rolagem e Pastas
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const audio = document.getElementById('audioElement');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const btnSkipBack = document.getElementById('btnSkipBack');
    const btnSkipForward = document.getElementById('btnSkipForward');
    const btnLoop = document.getElementById('btnLoop');
    const btnSequence = document.getElementById('btnSequence');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBarFill = document.getElementById('progressBarFill');
    const currentTimeDisplay = document.getElementById('currentTime');
    const totalDurationDisplay = document.getElementById('totalDuration');
    const currentTitle = document.getElementById('currentTitle');
    const currentSubtitle = document.getElementById('currentSubtitle');
    const currentCountDisplay = document.getElementById('currentCountDisplay');
    const btnIncCount = document.getElementById('btnIncCount');
    const btnDecCount = document.getElementById('btnDecCount');
    const autoCountToggle = document.getElementById('autoCountToggle');
    const volumeSlider = document.getElementById('volumeSlider');
    const btnMute = document.getElementById('btnMute');
    const speedChips = document.querySelectorAll('.chip-speed');

    // A-B Loop Elements
    const btnToggleAB = document.getElementById('btnToggleAB');
    const abLoopPanel = document.getElementById('abLoopPanel');
    const abLoopStatus = document.getElementById('abLoopStatus');
    const btnSetA = document.getElementById('btnSetA');
    const btnSetB = document.getElementById('btnSetB');
    const btnAminus = document.getElementById('btnAminus');
    const btnAplus = document.getElementById('btnAplus');
    const btnBminus = document.getElementById('btnBminus');
    const btnBplus = document.getElementById('btnBplus');
    const displayTimeA = document.getElementById('displayTimeA');
    const displayTimeB = document.getElementById('displayTimeB');
    const sliderLoopA = document.getElementById('sliderLoopA');
    const sliderLoopB = document.getElementById('sliderLoopB');
    const loopRegionHighlight = document.getElementById('loopRegionHighlight');
    const loopMarkerA = document.getElementById('loopMarkerA');
    const loopMarkerB = document.getElementById('loopMarkerB');

    // PDF Elements
    const pdfIframe = document.getElementById('pdfIframe');
    const pdfPlaceholder = document.getElementById('pdfPlaceholder');
    const pdfCurrentTitle = document.getElementById('pdfCurrentTitle');
    const btnOpenPdfNewTab = document.getElementById('btnOpenPdfNewTab');
    const pdfSelectorWrapper = document.getElementById('pdfSelectorWrapper');
    const pdfSelectDropdown = document.getElementById('pdfSelectDropdown');

    // Elementos do Leitor Sincronizado
    const syncViewerContainer = document.getElementById('syncViewerContainer');
    const viewerIcon = document.getElementById('viewerIcon');
    const readerTabs = document.getElementById('readerTabs');
    const tabSyncText = document.getElementById('tabSyncText');
    const tabPdf = document.getElementById('tabPdf');
    const toggleTranslationLabel = document.getElementById('toggleTranslationLabel');
    const toggleTranslation = document.getElementById('toggleTranslation');
    const btnAutoScroll = document.getElementById('btnAutoScroll');
    const fontSizeControls = document.getElementById('fontSizeControls');
    const btnFontDec = document.getElementById('btnFontDec');
    const btnFontInc = document.getElementById('btnFontInc');

    // Top actions & Modals
    const btnRefresh = document.getElementById('btnRefresh');
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const btnShortcuts = document.getElementById('btnShortcuts');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const toast = document.getElementById('toastNotification');

    // Search
    const searchInput = document.getElementById('lessonSearch');
    const clearSearch = document.getElementById('clearSearch');

    // State
    let currentAudioItem = null;
    let allLessons = [];
    let isCountedThisSession = false;
    let isABLoopActive = false;
    let isSequential = false;
    let loopA = 0;
    let loopB = 10;
    let currentSyncData = [];
    let currentActiveSentenceIndex = -1;
    let isAutoScroll = true;
    let activeReaderTab = 'sync';
    let currentFontSize = 1.0;

    // --- Formatador de Tempo (00:00) ---
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- Notificação Toast ---
    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    // --- Carregar Dados de Lições da API ---
    async function loadLessonsData() {
        try {
            const res = await fetch('/api/lessons');
            const data = await res.json();
            if (data.success) {
                allLessons = data.lessons;
            }
        } catch (err) {
            console.error('Erro ao buscar dados das lições:', err);
        }
    }

    // --- Carregar Arquivo PDF no Leitor ---
    function loadPdfFile(pdfRelPath) {
        if (!pdfRelPath) {
            pdfPlaceholder.style.display = 'flex';
            pdfIframe.style.display = 'none';
            pdfCurrentTitle.textContent = 'Nenhum PDF selecionado';
            btnOpenPdfNewTab.style.display = 'none';
            return;
        }

        const pdfUrl = `/media/pdf/${encodeURI(pdfRelPath)}`;
        pdfIframe.src = pdfUrl;
        pdfIframe.style.display = 'block';
        pdfPlaceholder.style.display = 'none';

        const filename = pdfRelPath.split('/').pop();
        pdfCurrentTitle.textContent = filename;

        btnOpenPdfNewTab.href = pdfUrl;
        btnOpenPdfNewTab.style.display = 'inline-flex';

        // Destacar o PDF ativo na lista lateral
        document.querySelectorAll('.pdf-item').forEach(item => {
            if (item.getAttribute('data-pdf-path') === pdfRelPath) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // --- Atualizar Seção de PDF da Lição ---
    function updatePdfSection(lessonName, defaultPdf) {
        const lesson = allLessons.find(l => l.name === lessonName);

        if (!lesson || !lesson.pdfs || lesson.pdfs.length === 0) {
            const card = document.querySelector(`.lesson-card[data-lesson-name="${lessonName}"]`);
            const firstPdfInCard = card ? card.querySelector('.pdf-item') : null;
            if (firstPdfInCard) {
                const pdfPath = firstPdfInCard.getAttribute('data-pdf-path');
                loadPdfFile(pdfPath);
            } else {
                loadPdfFile(null);
            }
            pdfSelectorWrapper.style.display = 'none';
            return;
        }

        // Preencher o dropdown com os PDFs da lição
        pdfSelectDropdown.innerHTML = '';
        lesson.pdfs.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.rel_path;
            opt.textContent = p.name;
            if (p.rel_path === defaultPdf) {
                opt.selected = true;
            }
            pdfSelectDropdown.appendChild(opt);
        });

        pdfSelectorWrapper.style.display = lesson.pdfs.length > 1 ? 'flex' : 'none';

        const targetPdf = defaultPdf || lesson.pdfs[0].rel_path;
        loadPdfFile(targetPdf);
    }

    // --- Alternar Visão entre Texto Sincronizado e PDF ---
    function setReaderView(viewMode) {
        activeReaderTab = viewMode;
        if (viewMode === 'sync') {
            tabSyncText.classList.add('active');
            tabPdf.classList.remove('active');
            syncViewerContainer.style.display = 'flex';
            pdfIframe.style.display = 'none';
            pdfPlaceholder.style.display = 'none';
            toggleTranslationLabel.style.display = 'flex';
            btnAutoScroll.style.display = 'inline-flex';
            fontSizeControls.style.display = 'flex';
            btnOpenPdfNewTab.style.display = 'none';
            viewerIcon.textContent = '💬';
            if (pdfSelectorWrapper) pdfSelectorWrapper.style.display = 'none';
        } else {
            tabSyncText.classList.remove('active');
            tabPdf.classList.add('active');
            syncViewerContainer.style.display = 'none';
            pdfIframe.style.display = 'block';
            pdfPlaceholder.style.display = 'none';
            toggleTranslationLabel.style.display = 'none';
            btnAutoScroll.style.display = 'none';
            fontSizeControls.style.display = 'none';
            btnOpenPdfNewTab.style.display = 'inline-flex';
            viewerIcon.textContent = '📄';
            if (pdfSelectorWrapper && pdfSelectDropdown.children.length > 1) {
                pdfSelectorWrapper.style.display = 'flex';
            }
        }
    }

    if (tabSyncText) {
        tabSyncText.addEventListener('click', () => setReaderView('sync'));
    }
    if (tabPdf) {
        tabPdf.addEventListener('click', () => setReaderView('pdf'));
    }

    // Toggle de Tradução (PT)
    if (toggleTranslation) {
        toggleTranslation.addEventListener('change', (e) => {
            syncViewerContainer.classList.toggle('hide-translation', !e.target.checked);
        });
    }

    // Toggle de Auto-scroll
    if (btnAutoScroll) {
        btnAutoScroll.addEventListener('click', () => {
            isAutoScroll = !isAutoScroll;
            btnAutoScroll.classList.toggle('active', isAutoScroll);
            showToast(isAutoScroll ? 'Auto-scroll ativado' : 'Auto-scroll pausado');
        });
    }

    // Controles de Tamanho de Fonte
    if (btnFontInc) {
        btnFontInc.addEventListener('click', () => {
            currentFontSize = Math.min(1.4, currentFontSize + 0.08);
            syncViewerContainer.style.fontSize = `${currentFontSize}rem`;
        });
    }
    if (btnFontDec) {
        btnFontDec.addEventListener('click', () => {
            currentFontSize = Math.max(0.85, currentFontSize - 0.08);
            syncViewerContainer.style.fontSize = `${currentFontSize}rem`;
        });
    }

    // --- Carregar Arquivo de Sincronização (JSON) ---
    async function loadSyncFile(syncRelPath) {
        if (!syncRelPath) {
            currentSyncData = [];
            syncViewerContainer.innerHTML = '';
            return false;
        }
        try {
            const res = await fetch(`/media/sync/${encodeURI(syncRelPath)}?t=${Date.now()}`);
            if (!res.ok) throw new Error('Falha ao buscar sync JSON');
            currentSyncData = await res.json();
            renderSyncSentences();
            return true;
        } catch (err) {
            console.error('Erro ao carregar sync JSON:', err);
            currentSyncData = [];
            syncViewerContainer.innerHTML = '';
            return false;
        }
    }

    // --- Renderizar Frases Sincronizadas ---
    function renderSyncSentences() {
        syncViewerContainer.innerHTML = '';
        currentActiveSentenceIndex = -1;

        currentSyncData.forEach((item, index) => {
            const block = document.createElement('div');
            block.className = 'sync-sentence-block';
            block.id = `sync-sentence-${index}`;
            block.setAttribute('data-start', item.start);
            block.setAttribute('data-end', item.end);
            block.setAttribute('data-index', index);
            block.title = 'Clique para ouvir esta frase';

            const pEn = document.createElement('p');
            pEn.className = 'sync-sentence-en';
            pEn.textContent = item.en;

            const pPt = document.createElement('p');
            pPt.className = 'sync-sentence-pt';
            pPt.textContent = item.pt;

            block.appendChild(pEn);
            block.appendChild(pPt);

            // Clicar na frase salta o áudio para o segundo exato
            block.addEventListener('click', () => {
                audio.currentTime = item.start;
                if (audio.paused) {
                    audio.play();
                    playPauseIcon.textContent = '⏸';
                }
            });

            syncViewerContainer.appendChild(block);
        });
    }

    // --- Atualizar Destaque e Rolagem Automática da Frase Ativa ---
    function updateSyncTextHighlight(currentTime) {
        if (!currentSyncData || currentSyncData.length === 0) return;

        let activeIndex = -1;
        for (let i = 0; i < currentSyncData.length; i++) {
            const item = currentSyncData[i];
            if (currentTime >= item.start && currentTime < item.end) {
                activeIndex = i;
                break;
            }
        }

        // Se estiver em uma pausa breve entre frases, manter a última frase falada
        if (activeIndex === -1) {
            for (let i = currentSyncData.length - 1; i >= 0; i--) {
                if (currentTime >= currentSyncData[i].start) {
                    activeIndex = i;
                    break;
                }
            }
        }

        if (activeIndex !== currentActiveSentenceIndex && activeIndex >= 0) {
            currentActiveSentenceIndex = activeIndex;

            document.querySelectorAll('.sync-sentence-block').forEach((el, idx) => {
                if (idx === activeIndex) {
                    el.classList.add('active');
                    if (isAutoScroll && activeReaderTab === 'sync' && syncViewerContainer) {
                        // Posiciona a frase mais para cima (terço superior da tela)
                        const containerRect = syncViewerContainer.getBoundingClientRect();
                        const elRect = el.getBoundingClientRect();
                        const targetScroll = syncViewerContainer.scrollTop + (elRect.top - containerRect.top) - (containerRect.height * 0.22);
                        syncViewerContainer.scrollTo({
                            top: Math.max(0, targetScroll),
                            behavior: 'smooth'
                        });
                    }
                } else {
                    el.classList.remove('active');
                }
            });
        }
    }

    // --- Selecionar e Tocar Áudio ---
    function selectAudio(itemElement, autoPlay = true) {
        document.querySelectorAll('.audio-item').forEach(el => el.classList.remove('active'));
        itemElement.classList.add('active');

        currentAudioItem = itemElement;
        isCountedThisSession = false;

        const audioPath = itemElement.getAttribute('data-audio-path');
        const audioTitle = itemElement.getAttribute('data-audio-title');
        const lessonName = itemElement.getAttribute('data-lesson-name');
        const defaultPdf = itemElement.getAttribute('data-default-pdf');
        const playCount = parseInt(itemElement.getAttribute('data-play-count') || '0', 10);

        // Atualizar painel do player
        currentTitle.textContent = audioTitle;
        currentSubtitle.textContent = lessonName;
        currentCountDisplay.textContent = playCount;
        btnPlayPause.disabled = false;

        // Configurar áudio
        const audioUrl = `/media/audio/${encodeURI(audioPath)}`;
        audio.src = audioUrl;

        if (autoPlay) {
            audio.play().then(() => {
                playPauseIcon.textContent = '⏸';
            }).catch(err => {
                console.log('Autoplay bloqueado pelo navegador:', err);
                playPauseIcon.textContent = '▶';
            });
        } else {
            playPauseIcon.textContent = '▶';
        }

        const syncFile = itemElement.getAttribute('data-sync-file');

        // Carregar Texto Sincronizado se existir, ou PDF
        if (syncFile) {
            loadSyncFile(syncFile).then(hasSync => {
                if (hasSync) {
                    if (readerTabs) readerTabs.style.display = defaultPdf ? 'inline-flex' : 'none';
                    setReaderView('sync');
                    pdfCurrentTitle.textContent = audioTitle;
                } else {
                    if (readerTabs) readerTabs.style.display = 'none';
                    setReaderView('pdf');
                    updatePdfSection(lessonName, defaultPdf);
                }
            });
            if (defaultPdf) {
                updatePdfSection(lessonName, defaultPdf);
                setReaderView('sync');
            }
        } else {
            currentSyncData = [];
            if (readerTabs) readerTabs.style.display = 'none';
            setReaderView('pdf');
            updatePdfSection(lessonName, defaultPdf);
        }

        // Rolar suavemente para garantir que o áudio ativo fique visível
        itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // --- Modo foco: pasta aberta ocupa todo o espaço ---
    const lessonsContainer = document.getElementById('lessonsContainer');

    function updateFocusMode() {
        if (!lessonsContainer) return;
        const searching = searchInput && searchInput.value.trim().length > 0;
        const hasOpen = !!lessonsContainer.querySelector('.lesson-card.open');
        lessonsContainer.classList.toggle('focus', hasOpen && !searching);
    }

    // --- Lógica de Abertura / Fechamento de Pastas (Accordion Único) ---
    function toggleLessonFolder(cardElement) {
        const isOpen = cardElement.classList.contains('open');
        const content = cardElement.querySelector('.lesson-content');
        const chevron = cardElement.querySelector('.chevron-icon');
        const folderIcon = cardElement.querySelector('.folder-icon');

        if (isOpen) {
            // Fechar pasta
            cardElement.classList.remove('open');
            if (content) content.style.display = 'none';
            if (chevron) chevron.textContent = '▶';
            if (folderIcon) folderIcon.textContent = '📁';
        } else {
            // Fechar as outras pastas para liberar 100% de espaço vertical para a pasta aberta
            document.querySelectorAll('.lesson-card.open').forEach(openCard => {
                if (openCard !== cardElement) {
                    openCard.classList.remove('open');
                    const openContent = openCard.querySelector('.lesson-content');
                    if (openContent) openContent.style.display = 'none';
                    const openChevron = openCard.querySelector('.chevron-icon');
                    if (openChevron) openChevron.textContent = '▶';
                    const openFolder = openCard.querySelector('.folder-icon');
                    if (openFolder) openFolder.textContent = '📁';
                }
            });

            // Abrir pasta clicada
            cardElement.classList.add('open');
            if (content) content.style.display = 'block';
            if (chevron) chevron.textContent = '▼';
            if (folderIcon) folderIcon.textContent = '📂';

            // Ao abrir, se nada desta lição estiver tocando, carregar o primeiro áudio e PDF da pasta
            const currentItemLesson = currentAudioItem ? currentAudioItem.getAttribute('data-lesson-name') : null;
            const lessonName = cardElement.getAttribute('data-lesson-name');

            if (currentItemLesson !== lessonName) {
                // Verificar se tem PDF
                const firstPdf = cardElement.querySelector('.pdf-item');
                if (firstPdf) {
                    const pdfPath = firstPdf.getAttribute('data-pdf-path');
                    loadPdfFile(pdfPath);
                }

                // Verificar se tem áudio para preparar no player
                const firstAudio = cardElement.querySelector('.audio-item');
                if (firstAudio) {
                    selectAudio(firstAudio, false);
                }
            }
        }

        updateFocusMode();
    }

    // Registrar evento de clique nos cabeçalhos das pastas
    document.querySelectorAll('.lesson-header').forEach(header => {
        header.addEventListener('click', () => {
            const card = header.closest('.lesson-card');
            if (card) {
                toggleLessonFolder(card);
            }
        });
    });

    // Registrar evento de clique nos PDFs da lista (com sincronização de áudio)
    document.querySelectorAll('.pdf-item').forEach(item => {
        item.addEventListener('click', () => {
            const pdfPath = item.getAttribute('data-pdf-path');
            const pdfName = item.getAttribute('data-pdf-name') || '';
            const card = item.closest('.lesson-card');
            loadPdfFile(pdfPath);

            // Sincronizar com o áudio correspondente da lição (ex: Part 1 com Audio 1, Part 2 com Audio 2)
            if (card) {
                const audios = card.querySelectorAll('.audio-item');
                let matchedAudio = null;

                // 1) Vínculo manual configurado pelo usuário tem prioridade
                audios.forEach((a) => {
                    const manualPdf = a.getAttribute('data-manual-pdf');
                    if (!matchedAudio && manualPdf && manualPdf === pdfPath) {
                        matchedAudio = a;
                    }
                });

                // 2) Tentar casar por parte/número (ex: 'Part 1')
                const partMatch = pdfName.toLowerCase().match(/part\s*(\d+)/i);
                if (partMatch) {
                    const partNum = partMatch[1];
                    for (const a of audios) {
                        const aTitle = (a.getAttribute('data-audio-title') || '').toLowerCase();
                        if (aTitle.includes('part ' + partNum) || aTitle.includes('part' + partNum)) {
                            matchedAudio = a;
                            break;
                        }
                    }
                }

                if (!matchedAudio) {
                    const allPdfsInCard = Array.from(card.querySelectorAll('.pdf-item'));
                    const pdfIdx = allPdfsInCard.indexOf(item);
                    if (pdfIdx >= 0 && pdfIdx < audios.length) {
                        matchedAudio = audios[pdfIdx];
                    }
                }

                if (matchedAudio) {
                    selectAudio(matchedAudio, true);
                }
            }
        });
    });

    // Registrar evento de clique nos áudios da lista
    document.querySelectorAll('.audio-item').forEach(item => {
        item.addEventListener('click', () => {
            selectAudio(item, true);
        });
    });

    // --- Controles de Reprodução ---
    btnPlayPause.addEventListener('click', () => {
        if (!audio.src) return;
        if (audio.paused) {
            audio.play();
            playPauseIcon.textContent = '⏸';
        } else {
            audio.pause();
            playPauseIcon.textContent = '▶';
        }
    });

    btnSkipBack.addEventListener('click', () => {
        if (audio.duration) {
            audio.currentTime = Math.max(0, audio.currentTime - 5);
        }
    });

    btnSkipForward.addEventListener('click', () => {
        if (audio.duration) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        }
    });

    btnLoop.addEventListener('click', () => {
        audio.loop = !audio.loop;
        btnLoop.classList.toggle('active', audio.loop);
        // Loop e sequência são mutuamente exclusivos
        if (audio.loop && isSequential) {
            setSequential(false);
        }
        showToast(audio.loop ? '🔁 Repetição contínua ativada' : 'Repetição contínua desativada');
    });

    // --- Reprodução em Sequência (tocar a pasta inteira, parando no último) ---
    function getLessonAudioItems() {
        if (!currentAudioItem) return [];
        const card = currentAudioItem.closest('.lesson-card');
        if (!card) return [];
        return Array.from(card.querySelectorAll('.audio-item'));
    }

    function setSequential(enabled) {
        isSequential = !!enabled;
        if (btnSequence) btnSequence.classList.toggle('active', isSequential);
        try { localStorage.setItem('english_study_sequential', isSequential ? '1' : '0'); } catch (e) {}
    }

    function maybePlayNext() {
        if (!isSequential || audio.loop || isABLoopActive) return;
        const items = getLessonAudioItems();
        const idx = items.indexOf(currentAudioItem);
        if (idx >= 0 && idx < items.length - 1) {
            selectAudio(items[idx + 1], true);
            showToast(`▶▶ Sequência: ${idx + 2} de ${items.length}`);
        } else {
            showToast('▶▶ Fim da pasta — sequência concluída');
        }
    }

    if (btnSequence) {
        btnSequence.addEventListener('click', () => {
            setSequential(!isSequential);
            if (isSequential && audio.loop) {
                audio.loop = false;
                btnLoop.classList.remove('active');
            }
            showToast(isSequential
                ? '▶▶ Sequência ativada — tocará a pasta inteira'
                : 'Sequência desativada');
        });
    }

    // --- Lógica de Repetição de Trecho (Loop A-B) ---
    function updateABVisuals() {
        if (!audio.duration) return;

        loopA = Math.max(0, Math.min(loopA, audio.duration - 1));
        loopB = Math.max(loopA + 1, Math.min(loopB, audio.duration));

        displayTimeA.textContent = formatTime(loopA);
        displayTimeB.textContent = formatTime(loopB);
        abLoopStatus.textContent = `${formatTime(loopA)} ➔ ${formatTime(loopB)}`;

        sliderLoopA.max = Math.floor(audio.duration);
        sliderLoopA.value = Math.floor(loopA);
        sliderLoopB.max = Math.floor(audio.duration);
        sliderLoopB.value = Math.ceil(loopB);

        if (isABLoopActive) {
            const leftPercent = (loopA / audio.duration) * 100;
            const rightPercent = (loopB / audio.duration) * 100;
            const widthPercent = Math.max(0, rightPercent - leftPercent);

            loopRegionHighlight.style.left = `${leftPercent}%`;
            loopRegionHighlight.style.width = `${widthPercent}%`;
            loopRegionHighlight.style.display = 'block';

            loopMarkerA.style.left = `${leftPercent}%`;
            loopMarkerA.style.display = 'block';

            loopMarkerB.style.left = `${rightPercent}%`;
            loopMarkerB.style.display = 'block';
        } else {
            loopRegionHighlight.style.display = 'none';
            loopMarkerA.style.display = 'none';
            loopMarkerB.style.display = 'none';
        }
    }

    function toggleABLoop() {
        isABLoopActive = !isABLoopActive;
        btnToggleAB.classList.toggle('active', isABLoopActive);
        abLoopPanel.style.display = isABLoopActive ? 'flex' : 'none';

        if (isABLoopActive) {
            if (loopB <= loopA || loopB > (audio.duration || 60)) {
                loopA = Math.floor(audio.currentTime);
                loopB = Math.min((audio.duration || 60), loopA + 10);
            }
            audio.currentTime = loopA;
            if (audio.paused) {
                audio.play();
                playPauseIcon.textContent = '⏸';
            }
            showToast(`🔂 Repetindo trecho: ${formatTime(loopA)} até ${formatTime(loopB)}`);
        } else {
            showToast('Repetição de trecho desativada');
        }
        updateABVisuals();
    }

    btnToggleAB.addEventListener('click', toggleABLoop);

    btnSetA.addEventListener('click', () => {
        loopA = Math.floor(audio.currentTime);
        if (loopA >= loopB) loopB = Math.min(audio.duration || 60, loopA + 5);
        updateABVisuals();
        audio.currentTime = loopA;
        showToast(`Início (A) definido: ${formatTime(loopA)}`);
    });

    btnSetB.addEventListener('click', () => {
        loopB = Math.ceil(audio.currentTime);
        if (loopB <= loopA) loopA = Math.max(0, loopB - 5);
        updateABVisuals();
        showToast(`Fim (B) definido: ${formatTime(loopB)}`);
    });

    btnAminus.addEventListener('click', () => {
        loopA = Math.max(0, loopA - 1);
        updateABVisuals();
        audio.currentTime = loopA;
    });

    btnAplus.addEventListener('click', () => {
        if (loopA + 1 < loopB) loopA += 1;
        updateABVisuals();
        audio.currentTime = loopA;
    });

    btnBminus.addEventListener('click', () => {
        if (loopB - 1 > loopA) loopB -= 1;
        updateABVisuals();
    });

    btnBplus.addEventListener('click', () => {
        loopB = Math.min(audio.duration || 60, loopB + 1);
        updateABVisuals();
    });

    sliderLoopA.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        loopA = Math.min(val, loopB - 1);
        updateABVisuals();
        audio.currentTime = loopA;
    });

    sliderLoopB.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        loopB = Math.max(val, loopA + 1);
        updateABVisuals();
    });

    // Barra de Progresso
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            // Repetição de trecho A-B
            if (isABLoopActive) {
                if (audio.currentTime >= loopB) {
                    audio.currentTime = loopA;
                    if (audio.paused) audio.play();
                } else if (audio.currentTime < loopA - 0.5) {
                    audio.currentTime = loopA;
                }
            }

            const percent = (audio.currentTime / audio.duration) * 100;
            progressBarFill.style.width = `${percent}%`;
            currentTimeDisplay.textContent = formatTime(audio.currentTime);

            // Contar automaticamente se escutou mais de 95% (quando não está em loop A-B)
            if (!isABLoopActive && !isCountedThisSession && autoCountToggle.checked && (audio.currentTime / audio.duration) >= 0.95) {
                incrementCurrentAudioCount(1, true);
                isCountedThisSession = true;
            }

            // Sincronização e rolagem do texto com o áudio
            updateSyncTextHighlight(audio.currentTime);
        }
    });

    audio.addEventListener('loadedmetadata', () => {
        totalDurationDisplay.textContent = formatTime(audio.duration);
        updateABVisuals();
    });

    audio.addEventListener('ended', () => {
        playPauseIcon.textContent = '▶';
        if (!isCountedThisSession && autoCountToggle.checked) {
            incrementCurrentAudioCount(1, true);
            isCountedThisSession = true;
        }
        maybePlayNext();
    });

    progressBarContainer.addEventListener('click', (e) => {
        if (!audio.duration) return;
        const rect = progressBarContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const targetPercent = Math.max(0, Math.min(1, clickX / width));
        audio.currentTime = targetPercent * audio.duration;
    });

    // Velocidade de Reprodução
    speedChips.forEach(chip => {
        chip.addEventListener('click', () => {
            speedChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const speed = parseFloat(chip.getAttribute('data-speed'));
            audio.playbackRate = speed;
        });
    });

    // Volume
    volumeSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value;
        btnMute.textContent = audio.volume == 0 ? '🔇' : (audio.volume < 0.5 ? '🔉' : '🔊');
    });

    btnMute.addEventListener('click', () => {
        audio.muted = !audio.muted;
        btnMute.textContent = audio.muted ? '🔇' : '🔊';
    });

    // --- Gerenciamento do Contador de Escutas ---
    async function incrementCurrentAudioCount(delta = 1, fromAuto = false) {
        if (!currentAudioItem) return;

        const audioPath = currentAudioItem.getAttribute('data-audio-path');
        try {
            const res = await fetch('/api/listen/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio_path: audioPath,
                    delta: delta,
                    source: fromAuto ? 'auto' : 'manual'
                })
            });
            const data = await res.json();
            if (data.success) {
                const newCount = data.stat.play_count;
                const lastPlayed = data.stat.last_played || '';

                // Atualizar display
                currentCountDisplay.textContent = newCount;
                currentAudioItem.setAttribute('data-play-count', newCount);
                currentAudioItem.setAttribute('data-last-played', lastPlayed);

                // Atualizar a data de última escuta mostrada no item da lista
                if (typeof window.updateAudioLastDate === 'function') {
                    window.updateAudioLastDate(currentAudioItem, lastPlayed);
                }

                // Atualizar badge do item
                const badge = currentAudioItem.querySelector('.badge-count');
                if (badge) {
                    badge.textContent = `${newCount}x`;
                    badge.classList.add('highlight');
                    setTimeout(() => badge.classList.remove('highlight'), 1000);
                }

                // Atualizar badge total da pasta
                updateLessonTotalBadge();

                // Avisar o dashboard (se estiver aberto) para recarregar
                window.dispatchEvent(new Event('study:count-updated'));

                if (fromAuto) {
                    showToast(`🎧 Parabéns! +1 Escuta registrada (${newCount}x total)`);
                } else if (delta > 0) {
                    showToast(`+1 Escuta adicionada (${newCount}x)`);
                } else {
                    showToast(`Contador ajustado (${newCount}x)`);
                }
            }
        } catch (err) {
            console.error('Erro ao atualizar contador:', err);
        }
    }

    function updateLessonTotalBadge() {
        if (!currentAudioItem) return;
        const lessonCard = currentAudioItem.closest('.lesson-card');
        if (!lessonCard) return;

        let sum = 0;
        lessonCard.querySelectorAll('.audio-item').forEach(item => {
            sum += parseInt(item.getAttribute('data-play-count') || '0', 10);
        });

        const lessonTotalBadge = lessonCard.querySelector('.badge-listens');
        if (lessonTotalBadge) {
            lessonTotalBadge.textContent = `${sum} 🎧`;
        }
    }

    btnIncCount.addEventListener('click', () => incrementCurrentAudioCount(1));
    btnDecCount.addEventListener('click', () => incrementCurrentAudioCount(-1));

    // --- Busca e Filtro ---
    function applySearch(query) {
        document.querySelectorAll('.lesson-card').forEach(card => {
            const lessonName = card.getAttribute('data-lesson-name').toLowerCase();
            const matchesLesson = lessonName.includes(query);
            let hasMatchingItem = false;

            // Filtrar PDFs
            card.querySelectorAll('.pdf-item').forEach(pdfItem => {
                const pdfName = pdfItem.getAttribute('data-pdf-name').toLowerCase();
                if (pdfName.includes(query) || matchesLesson) {
                    pdfItem.style.display = 'flex';
                    hasMatchingItem = true;
                } else {
                    pdfItem.style.display = 'none';
                }
            });

            // Filtrar Áudios
            card.querySelectorAll('.audio-item').forEach(item => {
                const audioTitle = item.getAttribute('data-audio-title').toLowerCase();
                if (audioTitle.includes(query) || matchesLesson) {
                    item.style.display = 'flex';
                    hasMatchingItem = true;
                } else {
                    item.style.display = 'none';
                }
            });

            const content = card.querySelector('.lesson-content');
            if (matchesLesson || hasMatchingItem) {
                card.style.display = 'block';
                if (content) content.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Restaura a visão normal (respeitando a pasta aberta) ao limpar a busca
    function resetSearchView() {
        document.querySelectorAll('.lesson-card').forEach(card => {
            card.style.display = '';
            const content = card.querySelector('.lesson-content');
            const isOpen = card.classList.contains('open');
            if (content) content.style.display = isOpen ? 'block' : 'none';
        });
        document.querySelectorAll('.audio-item, .pdf-item').forEach(el => el.style.display = '');
        updateFocusMode();
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        clearSearch.classList.toggle('hidden', query.length === 0);

        if (query.length === 0) {
            resetSearchView();
            return;
        }

        // A busca sempre mostra os resultados sem o modo foco
        if (lessonsContainer) lessonsContainer.classList.remove('focus');
        applySearch(query);
    });

    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.classList.add('hidden');
        resetSearchView();
    });

    // --- Atualizar Pastas (Re-scan) ---
    btnRefresh.addEventListener('click', () => {
        btnRefresh.disabled = true;
        const icon = btnRefresh.querySelector('.icon');
        if (icon) icon.style.animation = 'spin 1s infinite linear';

        try {
            window.location.reload();
        } catch (err) {
            console.error(err);
            btnRefresh.disabled = false;
        }
    });

    // --- Tema Claro / Escuro ---
    const savedTheme = localStorage.getItem('english_study_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    btnThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('english_study_theme', newTheme);
    });

    // --- Modal de Atalhos ---
    btnShortcuts.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
    btnCloseModal.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) shortcutsModal.classList.add('hidden');
    });

    // --- Atalhos de Teclado ---
    window.addEventListener('keydown', (e) => {
        if (document.activeElement === searchInput) return;

        if (e.code === 'Space') {
            e.preventDefault();
            btnPlayPause.click();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            btnSkipBack.click();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            btnSkipForward.click();
        } else if (e.key === 'r' || e.key === 'R') {
            btnLoop.click();
        } else if (e.key === 's' || e.key === 'S') {
            btnSequence.click();
        } else if (e.key === 'l' || e.key === 'L') {
            btnToggleAB.click();
        } else if (e.key === 'm' || e.key === 'M') {
            btnMute.click();
        } else if (e.key === '+' || e.key === '=') {
            btnIncCount.click();
        } else if (e.key === 'Escape') {
            shortcutsModal.classList.add('hidden');
        }
    });

    // --- Aplicar vínculo manual de PDF ao player (se o áudio estiver tocando) ---
    window.applyPdfBinding = function (audioPath, defaultPdf) {
        if (currentAudioItem && currentAudioItem.getAttribute('data-audio-path') === audioPath) {
            const lessonName = currentAudioItem.getAttribute('data-lesson-name');
            updatePdfSection(lessonName, defaultPdf);
        }
    };

    // --- Restaurar preferência de reprodução em sequência ---
    try {
        if (localStorage.getItem('english_study_sequential') === '1') {
            setSequential(true);
        }
    } catch (e) {}

    // --- Inicialização: começa na lista limpa (todas as pastas fechadas) ---
    loadLessonsData().then(() => {
        updateFocusMode();
        // Se alguma pasta já vier aberta, prepara o primeiro áudio/PDF dela
        const initialCard = document.querySelector('.lesson-card.open');
        if (initialCard) {
            const firstAudio = initialCard.querySelector('.audio-item');
            if (firstAudio) {
                selectAudio(firstAudio, false);
            } else {
                const firstPdf = initialCard.querySelector('.pdf-item');
                if (firstPdf) {
                    loadPdfFile(firstPdf.getAttribute('data-pdf-path'));
                }
            }
        }
    });
});
