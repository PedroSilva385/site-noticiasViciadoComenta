(function () {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  const speech = window.speechSynthesis;
  const state = {
    utterance: null,
    chunks: [],
    chunkIndex: 0,
    currentChunkText: '',
    currentBoundaryChar: 0,
    voice: null,
    rate: 1,
    speaking: false,
    paused: false,
    voicesPromise: null
  };

  function getArticleContentNode() {
    return document.querySelector('.artigo-conteudo');
  }

  function getArticleTitleText() {
    const titleNode = document.querySelector('.artigo-titulo');
    return titleNode ? titleNode.textContent.trim() : '';
  }

  function loadArticleVideo(container) {
    if (!container || container.dataset.videoLoaded === 'true') return;

    const videoId = String(container.dataset.videoId || '').trim();
    if (!videoId) return;

    const existingFrame = container.querySelector('iframe');
    if (existingFrame) {
      container.dataset.videoLoaded = 'true';
      container.classList.add('is-loaded');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`;
    iframe.title = container.dataset.videoTitle || 'Vídeo do artigo';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');

    container.appendChild(iframe);
    container.dataset.videoLoaded = 'true';
    container.classList.add('is-loaded');
  }

  function initArticleVideoEmbeds(root) {
    const scope = root || document;
    scope.querySelectorAll('.artigo-video[data-video-id]').forEach(function (container) {
      if (container.dataset.videoBound === 'true') return;

      const trigger = container.querySelector('[data-video-trigger]');
      if (!trigger) return;

      trigger.addEventListener('click', function () {
        loadArticleVideo(container);
      });

      container.dataset.videoBound = 'true';
    });
  }

  function getSpeakableText() {
    const contentNode = getArticleContentNode();
    if (!contentNode) return '';

    const clone = contentNode.cloneNode(true);
    clone.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
    clone.querySelectorAll('.live-edit-tools, #liveEditTools, .artigo-actions, .artigo-video, button').forEach((node) => node.remove());

    clone.querySelectorAll('a').forEach((link) => {
      const text = (link.textContent || '').trim();
      const replacement = document.createTextNode(text || 'link');
      link.replaceWith(replacement);
    });

    const contentText = (clone.innerText || clone.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

    const titleText = getArticleTitleText();
    const combined = [titleText, contentText].filter(Boolean).join('. ');
    return normalizeSpeakableText(combined);
  }

  function normalizeSpeakableText(text) {
    if (!text) return '';

    return String(text)
      .replace(/https?:\/\/\S+/gi, ' link disponível no artigo ')
      .replace(/\bwww\.\S+/gi, ' link disponível no artigo ')
      .replace(/&nbsp;|\u00A0/gi, ' ')
      .replace(/\b(\d+)\s*%/g, '$1 por cento')
      .replace(/\b(\d+)\s*€/g, '$1 euros')
      .replace(/\b(\d+)\s*gbps\b/gi, '$1 giga')
      .replace(/\b(\d+)\s*mbps\b/gi, '$1 mega')
      .replace(/[•·▪◦]/g, '. ')
      .replace(/\s*([,;:])\s*/g, '$1 ')
      .replace(/\s*([.!?])\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createButton(label, iconClass) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vc-tts-btn';
    button.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i> ${label}`;
    return button;
  }

  function setStatus(statusNode, message) {
    if (statusNode) statusNode.textContent = message;
  }

  function stopSpeaking() {
    speech.cancel();
    state.utterance = null;
    state.chunks = [];
    state.chunkIndex = 0;
    state.currentChunkText = '';
    state.currentBoundaryChar = 0;
    state.voice = null;
    state.speaking = false;
    state.paused = false;
  }

  function getVoices() {
    const voices = speech.getVoices();
    return Array.isArray(voices) ? voices : [];
  }

  function getVoiceScore(voice) {
    const lang = String(voice.lang || '').toLowerCase();
    const name = String(voice.name || '').toLowerCase();

    let score = 0;

    if (lang === 'pt-pt') score += 120;
    else if (lang.startsWith('pt-pt')) score += 110;
    else return -9999;

    if (/natural|neural|online|enhanced|premium/.test(name)) score += 45;
    if (/microsoft/.test(name)) score += 30;
    if (/google/.test(name)) score += 20;
    if (/female|feminina|mulher/.test(name)) score += 5;
    if (/espeak|festival|sam/.test(name)) score -= 80;

    if (voice.localService) score += 6;
    if (voice.default) score += 4;

    return score;
  }

  function waitForVoices(timeoutMs = 2500) {
    if (state.voicesPromise) return state.voicesPromise;

    state.voicesPromise = new Promise((resolve) => {
      const initialVoices = getVoices();
      if (initialVoices.length) {
        resolve(initialVoices);
        state.voicesPromise = null;
        return;
      }

      let resolved = false;
      const finish = function () {
        if (resolved) return;
        resolved = true;
        speech.removeEventListener('voiceschanged', onVoicesChanged);
        clearTimeout(timer);
        state.voicesPromise = null;
        resolve(getVoices());
      };

      const onVoicesChanged = function () {
        const voices = getVoices();
        if (voices.length) finish();
      };

      const timer = setTimeout(finish, timeoutMs);
      speech.addEventListener('voiceschanged', onVoicesChanged);
    });

    return state.voicesPromise;
  }

  function pickVoice() {
    const voices = getVoices()
      .filter((voice) => String(voice.lang || '').toLowerCase().startsWith('pt-pt'));

    if (!voices || !voices.length) return null;

    const ranked = voices
      .map((voice) => ({ voice, score: getVoiceScore(voice) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    return best && best.score > 0 ? best.voice : null;
  }

  async function resolvePtPtVoice() {
    let voice = pickVoice();
    if (voice) return voice;

    await waitForVoices(3000);
    voice = pickVoice();
    return voice;
  }

  function splitTextForSpeech(text) {
    if (!text || typeof text !== 'string') return [];

    const normalized = text
      .replace(/\s+/g, ' ')
      .replace(/([,;:])\s*/g, '$1 ')
      .replace(/([.!?])\s*/g, '$1 ')
      .trim();

    if (!normalized) return [];

    const baseParts = normalized
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const chunks = [];
    const maxChunkLength = 220;

    baseParts.forEach((part) => {
      if (part.length <= maxChunkLength) {
        chunks.push(part);
        return;
      }

      const commaParts = part
        .split(/(?<=[,;:])\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

      let current = '';
      commaParts.forEach((piece) => {
        const candidate = current ? `${current} ${piece}` : piece;
        if (candidate.length <= maxChunkLength) {
          current = candidate;
        } else {
          if (current) chunks.push(current);
          current = piece;
        }
      });

      if (current) chunks.push(current);
    });

    return chunks;
  }

  function getVoiceDisplayName(voice) {
    if (!voice) return 'Voz padrão do navegador';
    const lang = voice.lang ? ` (${voice.lang})` : '';
    return `${voice.name || 'Voz desconhecida'}${lang}`;
  }

  function speakCurrentChunk(statusNode, controls) {
    if (!state.speaking) return;

    const chunk = state.chunks[state.chunkIndex];
    if (!chunk) {
      state.speaking = false;
      state.paused = false;
      state.utterance = null;
      setStatus(statusNode, 'Leitura concluída.');
      refreshControls(controls);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    const voice = state.voice || pickVoice();
  state.currentChunkText = chunk;
  state.currentBoundaryChar = 0;

    utterance.lang = 'pt-PT';
    if (voice) utterance.voice = voice;

    utterance.rate = state.rate <= 1 ? 0.96 : 1.12;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = function () {
      if (state.utterance !== utterance) return;
      setStatus(statusNode, `A ler o artigo... (${state.chunkIndex + 1}/${state.chunks.length})`);
      refreshControls(controls);
    };

    utterance.onboundary = function (event) {
      if (state.utterance !== utterance) return;
      if (event && typeof event.charIndex === 'number' && Number.isFinite(event.charIndex)) {
        state.currentBoundaryChar = Math.max(0, event.charIndex);
      }
    };

    utterance.onend = function () {
      if (state.utterance !== utterance) return;
      if (!state.speaking) return;
      state.chunkIndex += 1;
      speakCurrentChunk(statusNode, controls);
    };

    utterance.onerror = function () {
      if (state.utterance !== utterance) return;
      state.speaking = false;
      state.paused = false;
      state.utterance = null;
      setStatus(statusNode, 'Não foi possível reproduzir a leitura.');
      refreshControls(controls);
    };

    state.utterance = utterance;
    speech.speak(utterance);
  }

  function resumeFromCurrentPosition(statusNode, controls) {
    if (!state.speaking || !state.chunks.length) return;

    const chunk = state.currentChunkText || state.chunks[state.chunkIndex] || '';
    const safeIndex = Math.max(0, Math.min(state.currentBoundaryChar || 0, Math.max(0, chunk.length - 1)));
    let remaining = chunk.slice(safeIndex).trim();

    if (!remaining || remaining.length < 3) {
      state.chunkIndex += 1;
      remaining = state.chunks[state.chunkIndex] || '';
    } else {
      state.chunks[state.chunkIndex] = remaining;
    }

    speech.cancel();
    state.utterance = null;
    state.paused = false;

    if (!remaining) {
      state.speaking = false;
      setStatus(statusNode, 'Leitura concluída.');
      refreshControls(controls);
      return;
    }

    setStatus(statusNode, `Velocidade alterada para x${state.rate === 1.5 ? '1,5' : '1'}.`);
    speakCurrentChunk(statusNode, controls);
  }

  async function startSpeaking(text, statusNode, controls) {
    if (!text) {
      setStatus(statusNode, 'Sem texto para leitura.');
      refreshControls(controls, statusNode);
      return;
    }

    stopSpeaking();
    const voice = await resolvePtPtVoice();

    if (!voice) {
      setStatus(statusNode, 'Sem voz pt-PT disponível neste dispositivo. Instale uma voz Portuguesa (Portugal) e volte a tentar.');
      refreshControls(controls);
      return;
    }

    const chunks = splitTextForSpeech(text);

    if (!chunks.length) {
      setStatus(statusNode, 'Sem texto para leitura.');
      refreshControls(controls);
      return;
    }

    state.voice = voice;
    state.chunks = chunks;
    state.chunkIndex = 0;
    state.speaking = true;
    state.paused = false;

    setStatus(statusNode, `Voz ativa: ${getVoiceDisplayName(voice)}`);
    refreshControls(controls);

    speakCurrentChunk(statusNode, controls);
  }

  function refreshControls(controls) {
    const { playBtn, pauseBtn, stopBtn, restartBtn, speed1Btn, speed15Btn } = controls;

    const isSpeaking = state.speaking;
    const isPaused = state.paused;

    playBtn.disabled = isSpeaking && !isPaused;
    pauseBtn.disabled = !isSpeaking;
    pauseBtn.innerHTML = isPaused
      ? '<i class="fas fa-play" aria-hidden="true"></i> Retomar'
      : '<i class="fas fa-pause" aria-hidden="true"></i> Pausar';
    stopBtn.disabled = !isSpeaking;
    restartBtn.disabled = false;
    speed1Btn.disabled = false;
    speed15Btn.disabled = false;

    speed1Btn.classList.toggle('vc-tts-active', state.rate <= 1);
    speed15Btn.classList.toggle('vc-tts-active', state.rate > 1);
  }

  function injectStyles() {
    if (document.getElementById('vc-tts-style')) return;

    const style = document.createElement('style');
    style.id = 'vc-tts-style';
    style.textContent = `
      .vc-tts-wrapper {
        margin: 16px 0 10px;
        padding: 12px;
        border: 1px solid rgba(0, 102, 204, 0.2);
        border-radius: 10px;
        background: rgba(0, 102, 204, 0.04);
      }
      .vc-tts-title {
        font-weight: 700;
        margin-bottom: 8px;
      }
      .vc-tts-controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .vc-tts-btn {
        border: 1px solid rgba(0, 102, 204, 0.28);
        background: #ffffff;
        color: #1a1f3a;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: filter 0.2s ease;
      }
      .vc-tts-btn:hover:not(:disabled) {
        filter: brightness(0.96);
      }
      .vc-tts-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .vc-tts-btn.vc-tts-active {
        background: #0066cc;
        color: #ffffff;
        border-color: #0066cc;
      }
      .vc-tts-status {
        margin-top: 8px;
        font-size: 0.85rem;
        opacity: 0.9;
      }
      body.dark .vc-tts-wrapper {
        border-color: rgba(96, 165, 250, 0.35);
        background: rgba(30, 58, 138, 0.2);
      }
      body.dark .vc-tts-btn {
        background: #1f2937;
        border-color: rgba(96, 165, 250, 0.5);
        color: #e5e7eb;
      }
      body.dark .vc-tts-btn.vc-tts-active {
        background: #0ea5e9;
        border-color: #0ea5e9;
        color: #ffffff;
      }
    `;

    document.head.appendChild(style);
  }

  function mountTtsControls() {
    if (document.getElementById('vc-tts-wrapper')) return true;

    const contentNode = getArticleContentNode();
    if (!contentNode) return false;

    const mountTarget = contentNode.parentElement || contentNode;
    if (!mountTarget) return false;

    injectStyles();

    const wrapper = document.createElement('div');
    wrapper.id = 'vc-tts-wrapper';
    wrapper.className = 'vc-tts-wrapper';

    const title = document.createElement('div');
    title.className = 'vc-tts-title';
    title.innerHTML = '<i class="fas fa-volume-up" aria-hidden="true"></i> Ouvir artigo';

    const controlsRow = document.createElement('div');
    controlsRow.className = 'vc-tts-controls';

    const playBtn = createButton('Ouvir', 'fas fa-play');
    const pauseBtn = createButton('Pausar', 'fas fa-pause');
    const stopBtn = createButton('Parar', 'fas fa-stop');
    const restartBtn = createButton('Reiniciar', 'fas fa-rotate-left');
    const speed1Btn = createButton('x1', 'fas fa-gauge');
    const speed15Btn = createButton('x1,5', 'fas fa-gauge-high');

    const status = document.createElement('div');
    status.className = 'vc-tts-status';
    status.textContent = 'Pronto para leitura.';

    const controls = { playBtn, pauseBtn, stopBtn, restartBtn, speed1Btn, speed15Btn };

    playBtn.addEventListener('click', async function () {
      if (state.speaking && state.paused) {
        speech.resume();
        state.paused = false;
        setStatus(status, 'Leitura retomada.');
        refreshControls(controls);
        return;
      }

      const text = getSpeakableText();
      await startSpeaking(text, status, controls);
    });

    pauseBtn.addEventListener('click', function () {
      if (!state.speaking) return;

      if (!state.paused) {
        speech.pause();
        state.paused = true;
        setStatus(status, 'Leitura em pausa.');
      } else {
        speech.resume();
        state.paused = false;
        setStatus(status, 'Leitura retomada.');
      }

      refreshControls(controls);
    });

    stopBtn.addEventListener('click', function () {
      if (!state.speaking) return;
      stopSpeaking();
      setStatus(status, 'Leitura parada.');
      refreshControls(controls);
    });

    restartBtn.addEventListener('click', async function () {
      const text = getSpeakableText();
      if (!text) {
        setStatus(status, 'Sem texto para leitura.');
        refreshControls(controls);
        return;
      }

      setStatus(status, 'A reiniciar leitura desde o início...');
      await startSpeaking(text, status, controls);
    });

    speed1Btn.addEventListener('click', function () {
      state.rate = 1;
      if (state.speaking) {
        resumeFromCurrentPosition(status, controls);
      } else {
        setStatus(status, 'Velocidade x1 ativa.');
      }

      refreshControls(controls);
    });

    speed15Btn.addEventListener('click', function () {
      state.rate = 1.5;

      if (state.speaking) {
        resumeFromCurrentPosition(status, controls);
      } else {
        setStatus(status, 'Velocidade x1,5 ativa.');
      }

      refreshControls(controls);
    });

    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(pauseBtn);
    controlsRow.appendChild(stopBtn);
    controlsRow.appendChild(restartBtn);
    controlsRow.appendChild(speed1Btn);
    controlsRow.appendChild(speed15Btn);

    wrapper.appendChild(title);
    wrapper.appendChild(controlsRow);
    wrapper.appendChild(status);

    mountTarget.insertBefore(wrapper, contentNode);

    refreshControls(controls);
    return true;
  }

  function initWhenReady() {
    initArticleVideoEmbeds(document);

    if (mountTtsControls()) return;

    const observer = new MutationObserver(function () {
      initArticleVideoEmbeds(document);

      if (mountTtsControls()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
    }, 10000);
  }

  window.addEventListener('beforeunload', stopSpeaking);
  speech.addEventListener('voiceschanged', function () {
    pickVoice();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhenReady);
  } else {
    initWhenReady();
  }
})();
