// API 客户端
    window.API_BASE = '';

    async function api(endpoint, options = {}) {
      const res = await fetch(`${window.API_BASE}/api${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        let errMsg = `API error: ${res.status}`;
        if (data && typeof data === 'object' && data.error) {
          errMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          try {
            const parsed = JSON.parse(errMsg);
            if (Array.isArray(parsed) && parsed[0].message) {
              errMsg = parsed.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            }
          } catch (e) {}
        } else if (typeof data === 'string') {
          errMsg = data;
        }
        throw new Error(errMsg);
      }
      return data;
    }

    async function safeApi(endpoint, options = {}) {
      try {
        const r = await api(endpoint, options);
        if (r && typeof r === 'object' && r.success === false) {
          throw new Error(r.error || 'Unknown error');
        }
        return r;
      } catch (e) {
        alert(`请求失败: ${e.message}`);
        throw e;
      }
    }

    window.serverConfig = null;
    window.idleTimer = null;

    // 重置闲置定时器
    function resetIdleTimer() {
      if (window.idleTimer) clearTimeout(window.idleTimer);
      
      const stAutoWorldTick = document.getElementById('stAutoWorldTick');
      const stIdleTimeout = document.getElementById('stIdleTimeout');
      
      if (!stAutoWorldTick || !stAutoWorldTick.checked || window.gameState.isProcessing) return;
      
      const timeoutMs = parseInt(stIdleTimeout?.value || '30', 10) * 1000;
      
      window.idleTimer = setTimeout(() => {
        if (!window.gameState.isProcessing && stAutoWorldTick.checked) {
          const inputEl = document.getElementById('playerInput');
          if (inputEl && inputEl.value.trim() === '') {
            processInput('<WAIT>');
          } else {
            resetIdleTimer(); // 如果用户输入了一半但停住了，继续等待
          }
        }
      }, timeoutMs);
    }

    // 节流处理高频事件
    window.lastInteraction = 0;
    function handleInteraction() {
      const now = Date.now();
      if (now - window.lastInteraction > 1000) { // 限制为每秒最多重置一次
        window.lastInteraction = now;
        resetIdleTimer();
      }
    }

    // 监听用户交互重置定时器
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, handleInteraction, { passive: true });
    });
    window.providerModels = null;

    function fmtProvidersHint(availability) {
      if (!availability) return '';
      const ok = Object.entries(availability).filter(([, v]) => v).map(([k]) => k);
      return ok.length ? `可用: ${ok.join(', ')}` : '无可用 Provider';
    }

    function mapModeName(mode) {
      const map = {
        'text-adventure': '文字冒险',
        'ai-battle': 'AI 对战',
        'npc-sandbox': 'NPC 沙盒',
        'chat-roleplay': '聊天角色扮演',
        'stardew-valley': '星露谷模拟',
      };
      return map[mode] || mode;
    }

    function dispositionLabel(d) {
      return { friendly: '友好', neutral: '中立', hostile: '敌对', unknown: '未知' }[d] || d;
    }

    function plotStatusLabel(s) {
      return { active: '进行中', foreshadowed: '伏笔', resolved: '已解决', hidden: '隐藏' }[s] || s;
    }

    async function refreshServerConfig() {
      const cfg = await safeApi('/config');
      window.serverConfig = cfg.data;

      // 更新 Provider 指示器
      const routing = window.serverConfig?.providerRouting;
      const availability = window.serverConfig?.availability;
      if (routing) {
        const p = routing.defaultProvider || '—';
        const model = getDefaultModelFromRouting(routing) || '';
        const available = availability?.[p];
        const dot = document.getElementById('providerDot');
        const label = document.getElementById('providerLabel');
        if (dot) dot.className = `health-dot ${available === true ? 'online' : available === false ? 'offline' : ''}`;
        if (label) label.textContent = model ? `${p} · ${model}` : p;
      }

      return window.serverConfig;
    }

    async function refreshProviderModels() {
      const r = await safeApi('/providers');
      window.providerModels = r.data?.models || {};
      try {
        updateModelDatalist(window.providerModels);
        renderModelList(window.providerModels);
      } catch {}
      return window.providerModels;
    }

    function normalizeModelId(m) {
      if (!m) return '';
      if (typeof m === 'string') return m;
      return m.id || m.name || '';
    }

    function collectModelIds(models) {
      const ids = new Set();
      for (const list of Object.values(models || {})) {
        for (const m of (list || [])) {
          const id = normalizeModelId(m);
          if (id) ids.add(id);
        }
      }
      return Array.from(ids).sort((a, b) => a.localeCompare(b));
    }

    function updateModelDatalist(models) {
      const dl = document.getElementById('modelDatalist');
      if (!dl) return;
      const ids = collectModelIds(models);
      dl.innerHTML = '';
      for (const id of ids) {
        const opt = document.createElement('option');
        opt.value = id;
        dl.appendChild(opt);
      }
    }

    function renderModelList(models) {
      const box = document.getElementById('stModelList');
      if (!box) return;
      const groups = [];
      for (const [provider, list] of Object.entries(models || {})) {
        const ids = (list || []).map(normalizeModelId).filter(Boolean);
        if (!ids.length) continue;
        groups.push(`【${provider}】\n${ids.map(i => `- ${i}`).join('\n')}`);
      }
      box.textContent = groups.length ? groups.join('\n\n') : '（未检测到可用模型；若使用 Ollama，请先确保 ollama serve 已运行）';
    }

    function getDefaultModelFromRouting(routing) {
      const p = routing?.defaultProvider;
      if (!p) return '';
      if (p === 'openai') return routing?.openai?.defaultModel || '';
      if (p === 'ollama') return routing?.ollama?.defaultModel || '';
      if (p === 'lmstudio') return routing?.lmstudio?.defaultModel || '';
      if (p === 'jan') return routing?.jan?.defaultModel || '';
      if (p === 'local') return routing?.local?.defaultModel || '';
      return '';
    }

    

// Expose functions to window
window.api = api;
window.safeApi = safeApi;
window.resetIdleTimer = resetIdleTimer;
window.handleInteraction = handleInteraction;
window.fmtProvidersHint = fmtProvidersHint;
window.mapModeName = mapModeName;
window.dispositionLabel = dispositionLabel;
window.plotStatusLabel = plotStatusLabel;
window.refreshServerConfig = refreshServerConfig;
window.refreshProviderModels = refreshProviderModels;
window.normalizeModelId = normalizeModelId;
window.collectModelIds = collectModelIds;
window.updateModelDatalist = updateModelDatalist;
window.renderModelList = renderModelList;
window.getDefaultModelFromRouting = getDefaultModelFromRouting;
