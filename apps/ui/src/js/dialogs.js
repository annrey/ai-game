function formatTime(d) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function openHistoryDialog() {
      const dialog = document.getElementById('historyDialog');
      const body = document.getElementById('historyBody');
      if (!dialog || !body) return;

      body.innerHTML = window.narrativeHistory
        .map((item, idx) => {
          const role = item.isPlayer ? '玩家' : '旁白';
          const t = formatTime(item.time);
          const safe = escapeHtml(item.content);
          return `
            <div class="history-item">
              <div class="history-meta">
                <span>${role}</span>
                <span>#${idx + 1} · ${t}</span>
              </div>
              <div class="history-text">${safe}</div>
            </div>
          `;
        })
        .join('');

      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    function closeHistoryDialog() {
      const dialog = document.getElementById('historyDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    function openLogDialog() {
      const dialog = document.getElementById('logDialog');
      const body = document.getElementById('logBody');
      if (!dialog || !body) return;

      body.innerHTML = window.logHistory
        .map((item, idx) => {
          const safe = escapeHtml(item.text);
          const t = escapeHtml(item.time || '');
          return `
            <div class="history-item">
              <div class="history-meta">
                <span>事件</span>
                <span>#${idx + 1} · ${t}</span>
              </div>
              <div class="history-text">${safe}</div>
            </div>
          `;
        })
        .join('');

      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    function closeLogDialog() {
      const dialog = document.getElementById('logDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    async function openSettingsDialog() {
      const dialog = document.getElementById('settingsDialog');
      if (!dialog) return;
      
      try {
        await refreshServerConfig();
        await refreshProviderModels();
        syncEngineControls();
      } catch (e) {
        addNarrative('⚠️ 设置加载失败，请检查服务器。', false);
      }
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    function closeSettingsDialog() {
      const dialog = document.getElementById('settingsDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    async function openWorldForgeDialog() {
      const dialog = document.getElementById('worldForgeDialog');
      if (!dialog) return;
      try {
        await refreshSaves();
        await refreshMemoriesRecent();
        await loadRuleBookText();
        syncWorldForgeControls();
      } catch (e) {
        addNarrative('⚠️ 塑造世界面板加载失败。', false);
      }
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    function closeWorldForgeDialog() {
      const dialog = document.getElementById('worldForgeDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    function syncSettingsControls() {
      const stSingleScreen = document.getElementById('stSingleScreen');
      const stCompact = document.getElementById('stCompact');
      const stFontSize = document.getElementById('stFontSize');
      const stStoryClamp = document.getElementById('stStoryClamp');
      const stLogPreview = document.getElementById('stLogPreview');
      const stHideChoiceDesc = document.getElementById('stHideChoiceDesc');
      const stShowSidebar = document.getElementById('stShowSidebar');
      const stShowRightPanel = document.getElementById('stShowRightPanel');
      const stShowWorld = document.getElementById('stShowWorld');
      const stShowCharacter = document.getElementById('stShowCharacter');
      const stShowInventory = document.getElementById('stShowInventory');
      const stShowQuests = document.getElementById('stShowQuests');
      const stShowLog = document.getElementById('stShowLog');
      const stShowSceneMeta = document.getElementById('stShowSceneMeta');
      const stShowCouncil = document.getElementById('stShowCouncil');
      const stShowReasoning = document.getElementById('stShowReasoning');
      const stShowCOT = document.getElementById('stShowCOT');
      const stAutoWorldTick = document.getElementById('stAutoWorldTick');
      const stIdleTimeout = document.getElementById('stIdleTimeout');

      if (stSingleScreen) stSingleScreen.checked = !!window.uiSettings.singleScreen;
      if (stCompact) stCompact.checked = !!window.uiSettings.compact;
      if (stFontSize) stFontSize.value = window.uiSettings.fontSize || 'normal';
      if (stStoryClamp) stStoryClamp.value = String(window.uiSettings.storyClamp || 9);
      if (stLogPreview) stLogPreview.value = String(window.uiSettings.logPreview || 5);
      if (stHideChoiceDesc) stHideChoiceDesc.checked = !!window.uiSettings.hideChoiceDesc;
      if (stShowSidebar) stShowSidebar.checked = !!window.uiSettings.showSidebar;
      if (stShowRightPanel) stShowRightPanel.checked = !!window.uiSettings.showRightPanel;
      if (stShowSceneMeta) stShowSceneMeta.checked = !!window.uiSettings.showSceneMeta;
      if (stShowCouncil) stShowCouncil.checked = !!window.uiSettings.showCouncil;
      if (stShowReasoning) stShowReasoning.checked = !!window.uiSettings.showReasoning;
      if (stShowCOT) stShowCOT.checked = !!window.uiSettings.showCOT;
      if (stShowWorld) stShowWorld.checked = !!window.uiSettings.showWorld;
      if (stShowCharacter) stShowCharacter.checked = !!window.uiSettings.showCharacter;
      if (stShowInventory) stShowInventory.checked = !!window.uiSettings.showInventory;
      if (stShowQuests) stShowQuests.checked = !!window.uiSettings.showQuests;
      if (stShowLog) stShowLog.checked = !!window.uiSettings.showLog;
      if (stAutoWorldTick) stAutoWorldTick.checked = !!window.uiSettings.autoWorldTick;
      if (stIdleTimeout) stIdleTimeout.value = String(window.uiSettings.idleTimeout || 30);
    }

    function setSelectValue(el, value) {
      if (!el) return;
      const v = value == null ? '' : String(value);
      const opt = Array.from(el.options || []).some(o => o.value === v);
      if (opt) el.value = v;
      else el.value = el.options?.[0]?.value ?? '';
    }

    function syncEngineControls() {
      const cfg = window.serverConfig?.gameConfig;
      const routing = window.serverConfig?.providerRouting;
      if (!cfg || !routing) return;

      setSelectValue(document.getElementById('stGameMode'), cfg.mode);
      setSelectValue(document.getElementById('quickGameMode'), cfg.mode);
      setSelectValue(document.getElementById('stLanguage'), cfg.language);
      const stStreaming = document.getElementById('stStreaming');
      const stEngineLogging = document.getElementById('stEngineLogging');
      const stMaxHistoryTurns = document.getElementById('stMaxHistoryTurns');
      const stMemoryMaxChars = document.getElementById('stMemoryMaxChars');
      const stAutoSaveInterval = document.getElementById('stAutoSaveInterval');

      if (stStreaming) stStreaming.checked = !!cfg.streaming;
      if (stEngineLogging) stEngineLogging.checked = !!cfg.logging;
      if (stMaxHistoryTurns) setSelectValue(stMaxHistoryTurns, cfg.maxHistoryTurns);
      if (stMemoryMaxChars) setSelectValue(stMemoryMaxChars, cfg.memoryMaxContextChars ?? 2000);
      if (stAutoSaveInterval) setSelectValue(stAutoSaveInterval, cfg.autoSaveInterval || 0);

      // 同步自动世界演化设置
      const stAutoWorldTick = document.getElementById('stAutoWorldTick');
      const stIdleTimeout = document.getElementById('stIdleTimeout');
      if (stAutoWorldTick) stAutoWorldTick.checked = !!cfg.autoWorldTick;
      if (stIdleTimeout) stIdleTimeout.value = String(cfg.idleTimeout || 30);

      const enabled = new Set(cfg.enabledAgents || []);
      const stAgentWorldKeeper = document.getElementById('stAgentWorldKeeper');
      const stAgentNPCDirector = document.getElementById('stAgentNPCDirector');
      const stAgentRuleArbiter = document.getElementById('stAgentRuleArbiter');
      const stAgentDramaCurator = document.getElementById('stAgentDramaCurator');
      if (stAgentWorldKeeper) stAgentWorldKeeper.checked = enabled.has('world-keeper');
      if (stAgentNPCDirector) stAgentNPCDirector.checked = enabled.has('npc-director');
      if (stAgentRuleArbiter) stAgentRuleArbiter.checked = enabled.has('rule-arbiter');
      if (stAgentDramaCurator) stAgentDramaCurator.checked = enabled.has('drama-curator');

      setSelectValue(document.getElementById('stDefaultProvider'), routing.defaultProvider);
      const stDefaultProvider = document.getElementById('stDefaultProvider');
      if (stDefaultProvider) {
        // removed openai disabled check
      }
      const stDefaultModel = document.getElementById('stDefaultModel');
      if (stDefaultModel) stDefaultModel.value = getDefaultModelFromRouting(routing) || '';

      const stProviderBaseURL = document.getElementById('stProviderBaseURL');
      const stProviderAPIKey = document.getElementById('stProviderAPIKey');
      if (stProviderBaseURL && stProviderAPIKey) {
        const p = routing.defaultProvider;
        const configForProvider = routing[p];
        let baseURL = '';
        let apiKey = '';
        if (configForProvider) {
          baseURL = configForProvider.baseURL || configForProvider.endpoint || configForProvider.host || '';
          apiKey = configForProvider.apiKey || '';
        }
        stProviderBaseURL.value = baseURL;
        stProviderAPIKey.value = apiKey;
        
        // Hide API key for Ollama
        const apiKeyControl = stProviderAPIKey.closest('.setting-control');
        if (apiKeyControl) {
          apiKeyControl.style.display = p === 'ollama' ? 'none' : 'flex';
        }
      }

      const overrides = routing.agentOverrides || {};
      const bindOverride = (role, selId, modelId) => {
        const sel = document.getElementById(selId);
        const model = document.getElementById(modelId);
        const ov = overrides[role];
        setSelectValue(sel, ov?.providerType || '');
        if (model) model.value = ov?.model || '';
      };
      bindOverride('narrator', 'stOverrideNarratorProvider', 'stOverrideNarratorModel');
      bindOverride('world-keeper', 'stOverrideWorldKeeperProvider', 'stOverrideWorldKeeperModel');
      bindOverride('npc-director', 'stOverrideNPCDirectorProvider', 'stOverrideNPCDirectorModel');
      bindOverride('rule-arbiter', 'stOverrideRuleArbiterProvider', 'stOverrideRuleArbiterModel');
      bindOverride('drama-curator', 'stOverrideDramaCuratorProvider', 'stOverrideDramaCuratorModel');

      setSelectValue(document.getElementById('archGameMode'), cfg.mode);
      setSelectValue(document.getElementById('archDefaultProvider'), routing.defaultProvider);
      const archStreaming = document.getElementById('archStreaming');
      const archEngineLogging = document.getElementById('archEngineLogging');
      const archMaxHistoryTurns = document.getElementById('archMaxHistoryTurns');
      const archMemoryMaxChars = document.getElementById('archMemoryMaxChars');
      const archAgentWorldKeeper = document.getElementById('archAgentWorldKeeper');
      const archAgentNPCDirector = document.getElementById('archAgentNPCDirector');
      const archAgentRuleArbiter = document.getElementById('archAgentRuleArbiter');
      const archAgentDramaCurator = document.getElementById('archAgentDramaCurator');
      if (archStreaming) archStreaming.checked = !!cfg.streaming;
      if (archEngineLogging) archEngineLogging.checked = !!cfg.logging;
      if (archMaxHistoryTurns) setSelectValue(archMaxHistoryTurns, cfg.maxHistoryTurns);
      if (archMemoryMaxChars) setSelectValue(archMemoryMaxChars, cfg.memoryMaxContextChars ?? 2000);
      if (archAgentWorldKeeper) archAgentWorldKeeper.checked = enabled.has('world-keeper');
      if (archAgentNPCDirector) archAgentNPCDirector.checked = enabled.has('npc-director');
      if (archAgentRuleArbiter) archAgentRuleArbiter.checked = enabled.has('rule-arbiter');
      if (archAgentDramaCurator) archAgentDramaCurator.checked = enabled.has('drama-curator');

      disableUnavailableProviderOptions(['stDefaultProvider', 'archDefaultProvider'], window.serverConfig?.availability || {});
    }

    function disableUnavailableProviderOptions(ids, availability) {
      for (const id of ids) {
        const sel = document.getElementById(id);
        if (!sel) continue;
        Array.from(sel.options || []).forEach((opt) => {
          if (!opt.value) return;
          if (Object.prototype.hasOwnProperty.call(availability || {}, opt.value)) {
            opt.disabled = availability?.[opt.value] === false;
          }
        });
      }
    }

    function renderSavesToSelect(saves, ids = ['wfSaveList']) {
      for (const id of ids) {
        const sel = document.getElementById(id);
        if (!sel) continue;
        sel.innerHTML = '';
        if (!(saves || []).length) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '暂无存档';
          sel.appendChild(opt);
          continue;
        }
        for (const s of (saves || [])) {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.name || s.id} · ${mapModeName(s.mode)} · ${String(s.updatedAt || '').slice(0, 19).replace('T', ' ')}`;
          sel.appendChild(opt);
        }
      }
    }

    function renderMemoriesToList(memories, ids = ['wfMemoryList']) {
      const text = !memories?.length
        ? '（暂无）'
        : memories
          .map((m) => {
            const t = m.type || '';
            const turn = m.turn != null ? `回合${m.turn}` : '';
            const imp = m.importance != null ? `imp:${Number(m.importance).toFixed(2)}` : '';
            return `- [${t}] ${turn} ${imp}\n  ${m.content}`;
          })
          .join('\n');
      for (const id of ids) {
        const box = document.getElementById(id);
        if (box) box.textContent = text;
      }
    }

    function syncWorldForgeControls() {
      const wfRuleBookText = document.getElementById('wfRuleBookText');
      if (wfRuleBookText && typeof currentRuleBookText === 'string') wfRuleBookText.value = currentRuleBookText;
    }

    let currentRuleBookText = '';

    async function loadRuleBookText() {
      const r = await safeApi('/rulebook');
      currentRuleBookText = r.data?.text || '';
      const wfRuleBookText = document.getElementById('wfRuleBookText');
      if (wfRuleBookText) wfRuleBookText.value = currentRuleBookText;
      return currentRuleBookText;
    }

    async function applyRuleBookText(text) {
      await safeApi('/rulebook', { method: 'POST', body: { text } });
      currentRuleBookText = text;
    }

    function getSelectedSaveId(ids = ['wfSaveList']) {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el?.value) return el.value;
      }
      return '';
    }

    async function refreshSaves() {
      const r = await safeApi('/saves');
      renderSavesToSelect(r.data?.saves || []);
    }

    async function refreshMemoriesRecent() {
      const r = await safeApi('/memories?limit=50');
      renderMemoriesToList(r.data?.memories || []);
    }

    async function searchMemories(q) {
      const r = await safeApi(`/memories/search?q=${encodeURIComponent(q)}`);
      renderMemoriesToList(r.data?.memories || []);
    }

    async function generatePreviewImage(prompt) {
      const img = document.getElementById('previewImage');
      if (!img || !prompt.trim()) return;
      const r = await safeApi('/preview/generate', {
        method: 'POST',
        body: { prompt: prompt.trim() },
      });
      img.src = r.data?.url || '/api/preview/default';
      if (r.data?.message) {
        addLogEntry(`预览图: ${r.data.message}`);
      }
    }

    async function refreshArchitecture() {
      const r = await safeApi('/architecture');
      const box = document.getElementById('architectureList');
      if (!box) return;
      box.innerHTML = (r.data?.features || []).map((item) => `
        <section class="architecture-card">
          <h4>${escapeHtml(item.module)}</h4>
          <p>${escapeHtml((item.responsibilities || []).join(' · '))}</p>
        </section>
      `).join('');
    }

    let onboardingStep = 0;
    function renderOnboardingStep() {
      document.querySelectorAll('.wizard-step').forEach((el, idx) => {
        el.classList.toggle('active', idx === onboardingStep);
      });
      document.querySelectorAll('[data-step-chip]').forEach((el, idx) => {
        el.classList.toggle('active', idx === onboardingStep);
      });
      const prev = document.getElementById('obPrev');
      const next = document.getElementById('obNext');
      const create = document.getElementById('obCreate');
      if (prev) prev.disabled = onboardingStep === 0;
      if (next) next.style.display = onboardingStep >= 2 ? 'none' : '';
      if (create) create.style.display = onboardingStep >= 2 ? '' : 'none';
    }

    function openOnboardingDialog() {
      const dialog = document.getElementById('onboardingDialog');
      if (!dialog) return;
      onboardingStep = 0;
      renderOnboardingStep();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeOnboardingDialog() {
      const dialog = document.getElementById('onboardingDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function submitOnboarding() {
      const payload = {
        worldName: document.getElementById('obWorldName')?.value || '',
        genre: document.getElementById('obGenre')?.value || '',
        tone: document.getElementById('obTone')?.value || '',
        conflict: document.getElementById('obConflict')?.value || '',
        playerName: document.getElementById('obPlayerName')?.value || '',
        playerRole: document.getElementById('obPlayerRole')?.value || '',
        playerBackground: document.getElementById('obPlayerBackground')?.value || '',
        location: document.getElementById('obLocation')?.value || '',
        weather: document.getElementById('obWeather')?.value || '',
        locationDescription: document.getElementById('obLocationDescription')?.value || '',
      };
      const hasInput = Object.values(payload).some(v => String(v).trim());
      closeOnboardingDialog();
      localStorage.setItem('worldOnboardingSeen', '1');
      if (!hasInput) return;
      await safeApi('/bootstrap/world', { method: 'POST', body: payload });
      await loadGameState();
      const prompt = [payload.worldName, payload.genre, payload.location].filter(Boolean).join(' ');
      if (prompt) {
        document.getElementById('previewPrompt').value = `${prompt} 像素风场景`;
      }
      addNarrative(`✅ 已创建世界「${payload.worldName || '新世界'}」与角色「${payload.playerName || '冒险者'}」。`, false);
    }

    async function openArchitectureDialog() {
      const dialog = document.getElementById('architectureDialog');
      if (!dialog) return;
      await refreshServerConfig();
      syncEngineControls();
      await refreshArchitecture();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeArchitectureDialog() {
      const dialog = document.getElementById('architectureDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function openSavesDialog() {
      const dialog = document.getElementById('savesDialog');
      if (!dialog) return;
      await refreshSavesList();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeSavesDialog() {
      const dialog = document.getElementById('savesDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function refreshSavesList() {
      const savesList = document.getElementById('savesList');
      if (!savesList) return;

      try {
        const r = await safeApi('/saves');
        const saves = r.data?.saves || [];

        if (saves.length === 0) {
          savesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--jade-600);">暂无存档</div>';
          return;
        }

        const modeNames = {
          'text-adventure': '文字冒险',
          'ai-battle': 'AI 对战',
          'npc-sandbox': 'NPC 沙盒',
          'chat-roleplay': '聊天角色扮演'
        };

        savesList.innerHTML = saves.map((s, idx) => `
          <div class="save-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(183, 229, 186, 0.3); border-radius: 8px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--jade-900);">${escapeHtml(s.name || s.id)}</div>
              <div style="font-size: 12px; color: var(--jade-600); font-family: 'Space Mono', monospace;">
                ${modeNames[s.mode] || s.mode} · ${new Date(s.updatedAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div class="setting-control" style="gap: 8px;">
              <button type="button" class="setting-btn btn-reset focus-ring" data-save-id="${escapeHtml(s.id)}" data-action="load">加载</button>
              <button type="button" class="setting-btn btn-reset focus-ring" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;" data-save-id="${escapeHtml(s.id)}" data-action="delete">删除</button>
            </div>
          </div>
        `).join('');

        // 绑定加载和删除按钮事件
        savesList.querySelectorAll('button[data-action="load"]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const saveId = btn.getAttribute('data-save-id');
            try {
              await safeApi('/load', { method: 'POST', body: { saveId } });
              await loadGameState();
              addNarrative('✅ 存档加载成功', false);
              closeSavesDialog();
            } catch (e) {
              addNarrative('⚠️ 存档加载失败', false);
            }
          });
        });

        savesList.querySelectorAll('button[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const saveId = btn.getAttribute('data-save-id');
            if (!confirm('确定要删除这个存档吗？')) return;
            try {
              await safeApi(`/saves/${saveId}`, { method: 'DELETE' });
              await refreshSavesList();
              addNarrative('✅ 存档已删除', false);
            } catch (e) {
              addNarrative('⚠️ 存档删除失败', false);
            }
          });
        });
      } catch (e) {
        savesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">加载存档列表失败</div>';
      }
    }

    async function openAchievementsDialog() {
      const dialog = document.getElementById('achievementsDialog');
      if (!dialog) return;
      await refreshAchievementsList();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeAchievementsDialog() {
      const dialog = document.getElementById('achievementsDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function refreshAchievementsList() {
      const achievementsList = document.getElementById('achievementsList');
      const progressText = document.getElementById('achievementProgressText');
      if (!achievementsList) return;

      try {
        const r = await safeApi('/achievements');
        const achievements = r.data?.achievements || [];
        const count = r.data?.count || { total: 0, unlocked: 0 };

        if (progressText) {
          progressText.textContent = `${count.unlocked} / ${count.total}`;
        }

        if (achievements.length === 0) {
          achievementsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--jade-600);">暂无成就数据</div>';
          return;
        }

        const typeNames = {
          'story': '剧情',
          'combat': '战斗',
          'exploration': '探索',
          'social': '社交',
          'collection': '收集',
          'special': '特殊'
        };

        achievementsList.innerHTML = achievements.map(a => {
          const isUnlocked = !!a.unlockedAt;
          const progress = a.maxProgress ? `${a.progress || 0} / ${a.maxProgress}` : '';
          return `
          <div class="achievement-item" style="display: flex; align-items: center; padding: 12px; background: ${isUnlocked ? 'rgba(92, 171, 124, 0.2)' : 'rgba(183, 229, 186, 0.3)'}; border-radius: 8px; margin-bottom: 8px; opacity: ${isUnlocked ? 1 : 0.7};">
            <div style="font-size: 32px; margin-right: 12px; filter: ${isUnlocked ? 'none' : 'grayscale(100%)'};">${a.secret && !isUnlocked ? '❓' : a.icon}</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: ${isUnlocked ? 'var(--jade-900)' : 'var(--jade-600)'};">${a.secret && !isUnlocked ? '???' : a.name}</div>
              <div style="font-size: 12px; color: var(--jade-600);">${a.secret && !isUnlocked ? '隐藏成就' : a.description}</div>
              <div style="font-size: 11px; color: var(--jade-500); font-family: 'Space Mono', monospace; margin-top: 4px;">
                ${typeNames[a.type] || a.type} ${progress ? '· ' + progress : ''} ${isUnlocked ? '· ✅ 已解锁' : ''}
              </div>
            </div>
          </div>
        `}).join('');
      } catch (e) {
        achievementsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">加载成就列表失败</div>';
      }
    }

    async function openMapDialog() {
      const dialog = document.getElementById('mapDialog');
      if (!dialog) return;
      await refreshMapList();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeMapDialog() {
      const dialog = document.getElementById('mapDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function refreshMapList() {
      const mapLocationsList = document.getElementById('mapLocationsList');
      const explorationText = document.getElementById('mapExplorationText');
      if (!mapLocationsList) return;

      try {
        const r = await safeApi('/state');
        const state = r.data;
        const visitedLocations = state?.playerState?.visitedLocations || [];
        const currentLocation = state?.currentLocation || '未知';

        if (explorationText) {
          explorationText.textContent = `已探索 ${visitedLocations.length} 个地点`;
        }

        if (visitedLocations.length === 0) {
          mapLocationsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--jade-600);">尚未探索任何地点</div>';
          return;
        }

        mapLocationsList.innerHTML = visitedLocations.map((loc, idx) => `
          <div class="location-item" style="display: flex; align-items: center; padding: 12px; background: ${loc === currentLocation ? 'rgba(92, 171, 124, 0.3)' : 'rgba(183, 229, 186, 0.3)'}; border-radius: 8px; margin-bottom: 8px; border: ${loc === currentLocation ? '2px solid var(--jade-500)' : 'none'};">
            <div style="font-size: 24px; margin-right: 12px;">${loc === currentLocation ? '📍' : '📌'}</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--jade-900);">${escapeHtml(loc)}</div>
              <div style="font-size: 11px; color: var(--jade-600); font-family: 'Space Mono', monospace;">
                ${loc === currentLocation ? '当前位置' : `探索顺序 #${idx + 1}`}
              </div>
            </div>
          </div>
        `).join('');
      } catch (e) {
        mapLocationsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">加载地图数据失败</div>';
      }
    }

    async function openCharacterDialog() {
      const dialog = document.getElementById('characterDialog');
      if (!dialog) return;
      await refreshCharacterData();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeCharacterDialog() {
      const dialog = document.getElementById('characterDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function refreshCharacterData() {
      const charName = document.getElementById('charName');
      const charRole = document.getElementById('charRole');
      const charBackground = document.getElementById('charBackground');
      const charStats = document.getElementById('charStats');
      const charInventory = document.getElementById('charInventory');

      try {
        const r = await safeApi('/state');
        const state = r.data;
        const playerState = state?.playerState || {};

        if (charName) charName.value = playerState.name || '';
        if (charRole) charRole.value = playerState.role || '';
        if (charBackground) charBackground.value = playerState.background || '';

        if (charStats) {
          const stats = [
            { name: '生命值', value: playerState.health || 0, max: playerState.maxHealth || 100, icon: '❤️' },
            { name: '法力值', value: playerState.mana || 0, max: playerState.maxMana || 50, icon: '💙' },
            { name: '体力值', value: playerState.stamina || 0, max: playerState.maxStamina || 100, icon: '💚' },
          ];

          charStats.innerHTML = stats.map(s => `
            <div style="background: rgba(183, 229, 186, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
              <div style="font-size: 20px; margin-bottom: 4px;">${s.icon}</div>
              <div style="font-size: 11px; color: var(--jade-600); font-family: 'Space Mono', monospace;">${s.name}</div>
              <div style="font-weight: 600; color: var(--jade-900);">${s.value} / ${s.max}</div>
              <div style="width: 100%; height: 4px; background: rgba(92, 171, 124, 0.2); border-radius: 2px; margin-top: 6px; overflow: hidden;">
                <div style="width: ${(s.value / s.max * 100)}%; height: 100%; background: var(--jade-500); border-radius: 2px;"></div>
              </div>
            </div>
          `).join('');
        }

        if (charInventory) {
          const inventory = playerState.inventory || [];
          if (inventory.length === 0) {
            charInventory.innerHTML = '<div style="color: var(--jade-600); font-size: 12px;">物品栏为空</div>';
          } else {
            charInventory.innerHTML = inventory.map(item => `
              <div style="background: rgba(183, 229, 186, 0.3); border-radius: 6px; padding: 6px 10px; font-size: 12px; color: var(--jade-900);">
                ${item.icon || '📦'} ${escapeHtml(item.name)} ${item.quantity > 1 ? `x${item.quantity}` : ''}
              </div>
            `).join('');
          }
        }
      } catch (e) {
        console.error('加载角色数据失败:', e);
      }
    }

    async function openLoreDialog() {
      const dialog = document.getElementById('loreDialog');
      if (!dialog) return;
      await refreshLoreData();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeLoreDialog() {
      const dialog = document.getElementById('loreDialog');
      if (!dialog) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    async function refreshLoreData() {
      const loreWorldInfo = document.getElementById('loreWorldInfo');
      const loreQuests = document.getElementById('loreQuests');
      const loreMemories = document.getElementById('loreMemories');

      try {
        // 获取游戏状态
        const stateRes = await safeApi('/state');
        const state = stateRes.data;

        // 获取记忆
        const memoriesRes = await safeApi('/memories');
        const memories = memoriesRes.data?.memories || [];

        // 世界设定
        if (loreWorldInfo) {
          const playerState = state?.playerState || {};
          loreWorldInfo.innerHTML = `
            <div style="margin-bottom: 8px;"><strong style="color: var(--jade-900);">世界名称:</strong> <span style="color: var(--jade-700);">${escapeHtml(playerState.worldName || '未命名世界')}</span></div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--jade-900);">题材:</strong> <span style="color: var(--jade-700);">${escapeHtml(playerState.genre || '未知')}</span></div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--jade-900);">氛围:</strong> <span style="color: var(--jade-700);">${escapeHtml(playerState.tone || '未知')}</span></div>
            <div><strong style="color: var(--jade-900);">当前位置:</strong> <span style="color: var(--jade-700);">${escapeHtml(state?.currentLocation || '未知')}</span></div>
          `;
        }

        // 任务日志
        if (loreQuests) {
          const quests = state?.activePlots || [];
          if (quests.length === 0) {
            loreQuests.innerHTML = '<div style="padding: 12px; color: var(--jade-600); text-align: center;">暂无进行中的任务</div>';
          } else {
            loreQuests.innerHTML = quests.map(q => `
              <div style="background: rgba(183, 229, 186, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                <div style="font-weight: 600; color: var(--jade-900);">${escapeHtml(q.name)}</div>
                <div style="font-size: 12px; color: var(--jade-600);">${escapeHtml(q.description || '')}</div>
                <div style="font-size: 11px; color: var(--jade-500); font-family: 'Space Mono', monospace; margin-top: 4px;">
                  状态: ${q.status === 'active' ? '进行中' : q.status === 'completed' ? '已完成' : '失败'}
                </div>
              </div>
            `).join('');
          }
        }

        // 重要记忆
        if (loreMemories) {
          const importantMemories = memories.slice(0, 10);
          if (importantMemories.length === 0) {
            loreMemories.innerHTML = '<div style="padding: 12px; color: var(--jade-600); text-align: center;">暂无重要记忆</div>';
          } else {
            loreMemories.innerHTML = importantMemories.map(m => `
              <div style="background: rgba(183, 229, 186, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                <div style="font-size: 12px; color: var(--jade-900);">${escapeHtml(m.content?.slice(0, 100) || '')}${m.content?.length > 100 ? '...' : ''}</div>
                <div style="font-size: 11px; color: var(--jade-500); font-family: 'Space Mono', monospace; margin-top: 4px;">
                  ${m.type === 'event' ? '事件' : m.type === 'dialogue' ? '对话' : '观察'} · ${new Date(m.timestamp).toLocaleString('zh-CN')}
                </div>
              </div>
            `).join('');
          }
        }
      } catch (e) {
        console.error('加载传说典籍数据失败:', e);
      }
    }

    // 转义 HTML
    const openHistoryBtn = document.getElementById('openHistory');
    const closeHistoryBtn = document.getElementById('closeHistory');
    const historyDialog = document.getElementById('historyDialog');
    if (openHistoryBtn) openHistoryBtn.addEventListener('click', openHistoryDialog);
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryDialog);
    if (historyDialog) {
      historyDialog.addEventListener('click', (e) => {
        const rect = historyDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeHistoryDialog();
      });
    }

    const openLogBtn = document.getElementById('openLog');
    const closeLogBtn = document.getElementById('closeLog');
    const logDialog = document.getElementById('logDialog');
    if (openLogBtn) openLogBtn.addEventListener('click', openLogDialog);
    if (closeLogBtn) closeLogBtn.addEventListener('click', closeLogDialog);
    if (logDialog) {
      logDialog.addEventListener('click', (e) => {
        const rect = logDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeLogDialog();
      });
    }

    const openSettingsBtn = document.getElementById('openSettings');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const navOpenSettings = document.getElementById('navOpenSettings');
    const settingsDialog = document.getElementById('settingsDialog');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsDialog);
    if (navOpenSettings) navOpenSettings.addEventListener('click', openSettingsDialog);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsDialog);
    if (settingsDialog) {
      settingsDialog.addEventListener('click', (e) => {
        const rect = settingsDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeSettingsDialog();
      });
    }

    const navOpenWorldForge = document.getElementById('navOpenWorldForge');
    const closeWorldForgeBtn = document.getElementById('closeWorldForge');
    const worldForgeDialog = document.getElementById('worldForgeDialog');
    const wfOpenOnboarding = document.getElementById('wfOpenOnboarding');
    if (navOpenWorldForge) navOpenWorldForge.addEventListener('click', openWorldForgeDialog);
    if (closeWorldForgeBtn) closeWorldForgeBtn.addEventListener('click', closeWorldForgeDialog);
    if (wfOpenOnboarding) wfOpenOnboarding.addEventListener('click', () => {
      closeWorldForgeDialog();
      openOnboardingDialog();
    });
    if (worldForgeDialog) {
      worldForgeDialog.addEventListener('click', (e) => {
        const rect = worldForgeDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeWorldForgeDialog();
      });
    }

    const openOnboardingBtn = document.getElementById('openOnboarding');
    const closeOnboardingBtn = document.getElementById('closeOnboarding');
    const onboardingDialog = document.getElementById('onboardingDialog');
    const obPrev = document.getElementById('obPrev');
    const obNext = document.getElementById('obNext');
    const obSkip = document.getElementById('obSkip');
    const obCreate = document.getElementById('obCreate');
    if (openOnboardingBtn) openOnboardingBtn.addEventListener('click', openOnboardingDialog);
    if (closeOnboardingBtn) closeOnboardingBtn.addEventListener('click', closeOnboardingDialog);
    if (obPrev) obPrev.addEventListener('click', () => { onboardingStep = Math.max(0, onboardingStep - 1); renderOnboardingStep(); });
    if (obNext) obNext.addEventListener('click', () => { onboardingStep = Math.min(2, onboardingStep + 1); renderOnboardingStep(); });
    if (obSkip) obSkip.addEventListener('click', () => { localStorage.setItem('worldOnboardingSeen', '1'); closeOnboardingDialog(); });
    if (obCreate) obCreate.addEventListener('click', async () => {
      try {
        await submitOnboarding();
      } catch {
        addNarrative('⚠️ 创建世界失败。', false);
      }
    });
    if (onboardingDialog) {
      onboardingDialog.addEventListener('click', (e) => {
        const rect = onboardingDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeOnboardingDialog();
      });
    }

    const navOpenArchitecture = document.getElementById('navOpenArchitecture');
    const closeArchitectureBtn = document.getElementById('closeArchitecture');
    const architectureDialog = document.getElementById('architectureDialog');
    if (navOpenArchitecture) navOpenArchitecture.addEventListener('click', openArchitectureDialog);
    if (closeArchitectureBtn) closeArchitectureBtn.addEventListener('click', closeArchitectureDialog);
    if (architectureDialog) {
      architectureDialog.addEventListener('click', (e) => {
        const rect = architectureDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeArchitectureDialog();
      });
    }

    const navOpenSaves = document.getElementById('navOpenSaves');
    const closeSavesBtn = document.getElementById('closeSaves');
    const savesDialog = document.getElementById('savesDialog');
    const savesRefresh = document.getElementById('savesRefresh');
    if (navOpenSaves) navOpenSaves.addEventListener('click', openSavesDialog);
    if (closeSavesBtn) closeSavesBtn.addEventListener('click', closeSavesDialog);
    if (savesRefresh) savesRefresh.addEventListener('click', refreshSavesList);
    if (savesDialog) {
      savesDialog.addEventListener('click', (e) => {
        const rect = savesDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeSavesDialog();
      });
    }

    const navOpenAchievements = document.getElementById('navOpenAchievements');
    const closeAchievementsBtn = document.getElementById('closeAchievements');
    const achievementsDialog = document.getElementById('achievementsDialog');
    const achievementsRefresh = document.getElementById('achievementsRefresh');
    if (navOpenAchievements) navOpenAchievements.addEventListener('click', openAchievementsDialog);
    if (closeAchievementsBtn) closeAchievementsBtn.addEventListener('click', closeAchievementsDialog);
    if (achievementsRefresh) achievementsRefresh.addEventListener('click', refreshAchievementsList);
    if (achievementsDialog) {
      achievementsDialog.addEventListener('click', (e) => {
        const rect = achievementsDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeAchievementsDialog();
      });
    }

    const navOpenMap = document.getElementById('navOpenMap');
    const closeMapBtn = document.getElementById('closeMap');
    const mapDialog = document.getElementById('mapDialog');
    if (navOpenMap) navOpenMap.addEventListener('click', openMapDialog);
    if (closeMapBtn) closeMapBtn.addEventListener('click', closeMapDialog);
    if (mapDialog) {
      mapDialog.addEventListener('click', (e) => {
        const rect = mapDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeMapDialog();
      });
    }

    const navOpenCharacter = document.getElementById('navOpenCharacter');
    const closeCharacterBtn = document.getElementById('closeCharacter');
    const characterDialog = document.getElementById('characterDialog');
    const charRefresh = document.getElementById('charRefresh');
    if (navOpenCharacter) navOpenCharacter.addEventListener('click', openCharacterDialog);
    if (closeCharacterBtn) closeCharacterBtn.addEventListener('click', closeCharacterDialog);
    if (charRefresh) charRefresh.addEventListener('click', refreshCharacterData);
    if (characterDialog) {
      characterDialog.addEventListener('click', (e) => {
        const rect = characterDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeCharacterDialog();
      });
    }

    const navOpenLore = document.getElementById('navOpenLore');
    const closeLoreBtn = document.getElementById('closeLore');
    const loreDialog = document.getElementById('loreDialog');
    const loreRefresh = document.getElementById('loreRefresh');
    if (navOpenLore) navOpenLore.addEventListener('click', openLoreDialog);
    if (closeLoreBtn) closeLoreBtn.addEventListener('click', closeLoreDialog);
    if (loreRefresh) loreRefresh.addEventListener('click', refreshLoreData);
    if (loreDialog) {
      loreDialog.addEventListener('click', (e) => {
        const rect = loreDialog.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) closeLoreDialog();
      });
    }

    const previewPrompt = document.getElementById('previewPrompt');
    const generatePreviewBtn = document.getElementById('generatePreview');
    if (generatePreviewBtn) generatePreviewBtn.addEventListener('click', async () => {
      try {
        const prompt = previewPrompt?.value || document.querySelector('.scene-title')?.textContent || '幻想世界 像素风场景';
        await generatePreviewImage(prompt);
      } catch {
        addNarrative('⚠️ 预览图生成失败。', false);
      }
    });

    const stSingleScreen = document.getElementById('stSingleScreen');
    const stCompact = document.getElementById('stCompact');
    const stFontSize = document.getElementById('stFontSize');
    const stStoryClamp = document.getElementById('stStoryClamp');
    const stLogPreview = document.getElementById('stLogPreview');
    const stHideChoiceDesc = document.getElementById('stHideChoiceDesc');
    const stShowSidebar = document.getElementById('stShowSidebar');
    const stShowRightPanel = document.getElementById('stShowRightPanel');
    const stShowSceneMeta = document.getElementById('stShowSceneMeta');
    const stShowCouncil = document.getElementById('stShowCouncil');
    const stShowReasoning = document.getElementById('stShowReasoning');
    const stShowWorld = document.getElementById('stShowWorld');
    const stShowCharacter = document.getElementById('stShowCharacter');
    const stShowInventory = document.getElementById('stShowInventory');
    const stShowLog = document.getElementById('stShowLog');

    if (stSingleScreen) stSingleScreen.addEventListener('change', () => updateSettings({ singleScreen: stSingleScreen.checked }));
    if (stCompact) stCompact.addEventListener('change', () => updateSettings({ compact: stCompact.checked }));
    if (stFontSize) stFontSize.addEventListener('change', () => updateSettings({ fontSize: stFontSize.value }));
    if (stStoryClamp) stStoryClamp.addEventListener('change', () => updateSettings({ storyClamp: Number(stStoryClamp.value) }));
    if (stLogPreview) stLogPreview.addEventListener('change', () => updateSettings({ logPreview: Number(stLogPreview.value) }));
    if (stHideChoiceDesc) stHideChoiceDesc.addEventListener('change', () => updateSettings({ hideChoiceDesc: stHideChoiceDesc.checked }));
    if (stShowSidebar) stShowSidebar.addEventListener('change', () => updateSettings({ showSidebar: stShowSidebar.checked }));
    if (stShowRightPanel) stShowRightPanel.addEventListener('change', () => updateSettings({ showRightPanel: stShowRightPanel.checked }));
    if (stShowSceneMeta) stShowSceneMeta.addEventListener('change', () => updateSettings({ showSceneMeta: stShowSceneMeta.checked }));
    if (stShowCouncil) stShowCouncil.addEventListener('change', () => updateSettings({ showCouncil: stShowCouncil.checked }));
    if (stShowReasoning) stShowReasoning.addEventListener('change', () => updateSettings({ showReasoning: stShowReasoning.checked }));
    if (stShowCOT) stShowCOT.addEventListener('change', () => updateSettings({ showCOT: stShowCOT.checked }));
    if (stShowWorld) stShowWorld.addEventListener('change', () => updateSettings({ showWorld: stShowWorld.checked }));
    if (stShowCharacter) stShowCharacter.addEventListener('change', () => updateSettings({ showCharacter: stShowCharacter.checked }));
    if (stShowInventory) stShowInventory.addEventListener('change', () => updateSettings({ showInventory: stShowInventory.checked }));
    if (stShowQuests) stShowQuests.addEventListener('change', () => updateSettings({ showQuests: stShowQuests.checked }));
    if (stShowLog) stShowLog.addEventListener('change', () => updateSettings({ showLog: stShowLog.checked }));
    
    const stAutoWorldTick = document.getElementById('stAutoWorldTick');
    const stIdleTimeout = document.getElementById('stIdleTimeout');
    if (stAutoWorldTick) stAutoWorldTick.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ autoWorldTick: stAutoWorldTick.checked });
        updateSettings({ autoWorldTick: stAutoWorldTick.checked });
        addNarrative(`✅ 自动世界演化已${stAutoWorldTick.checked ? '开启' : '关闭'}`, false);
      } catch (e) {
        addNarrative('⚠️ 自动世界演化设置失败。', false);
      }
    });
    if (stIdleTimeout) stIdleTimeout.addEventListener('change', async () => {
      try {
        const timeout = Number(stIdleTimeout.value);
        await applyEnginePatch({ idleTimeout: timeout });
        updateSettings({ idleTimeout: timeout });
        addNarrative(`✅ 闲置触发时长已设置为 ${timeout} 秒`, false);
      } catch (e) {
        addNarrative('⚠️ 闲置触发时长设置失败。', false);
      }
    });

    const stGameMode = document.getElementById('stGameMode');
    const stLanguage = document.getElementById('stLanguage');
    const stStreaming = document.getElementById('stStreaming');
    const stEngineLogging = document.getElementById('stEngineLogging');
    const stMaxHistoryTurns = document.getElementById('stMaxHistoryTurns');
    const stMemoryMaxChars = document.getElementById('stMemoryMaxChars');
    const stAutoSaveInterval = document.getElementById('stAutoSaveInterval');
    const stAgentWorldKeeper = document.getElementById('stAgentWorldKeeper');
    const stAgentNPCDirector = document.getElementById('stAgentNPCDirector');
    const stAgentRuleArbiter = document.getElementById('stAgentRuleArbiter');
    const stAgentDramaCurator = document.getElementById('stAgentDramaCurator');
    const archGameMode = document.getElementById('archGameMode');
    const archDefaultProvider = document.getElementById('archDefaultProvider');
    const archStreaming = document.getElementById('archStreaming');
    const archEngineLogging = document.getElementById('archEngineLogging');
    const archMaxHistoryTurns = document.getElementById('archMaxHistoryTurns');
    const archMemoryMaxChars = document.getElementById('archMemoryMaxChars');
    const archAgentWorldKeeper = document.getElementById('archAgentWorldKeeper');
    const archAgentNPCDirector = document.getElementById('archAgentNPCDirector');
    const archAgentRuleArbiter = document.getElementById('archAgentRuleArbiter');
    const archAgentDramaCurator = document.getElementById('archAgentDramaCurator');

    async function applyEnginePatch(patch) {
      await safeApi('/config', { method: 'POST', body: patch });
      await refreshServerConfig();
      syncEngineControls();
    }

    function collectEnabledAgents() {
      const roles = ['narrator'];
      if (stAgentWorldKeeper?.checked) roles.push('world-keeper');
      if (stAgentNPCDirector?.checked) roles.push('npc-director');
      if (stAgentRuleArbiter?.checked) roles.push('rule-arbiter');
      if (stAgentDramaCurator?.checked) roles.push('drama-curator');
      return roles;
    }

    if (stGameMode) stGameMode.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ mode: stGameMode.value });
        addNarrative(`✅ 已切换模式：${stGameMode.options[stGameMode.selectedIndex]?.textContent || stGameMode.value}`, false);
        if (typeof window.loadGameState === 'function') await window.loadGameState();
      } catch (e) {
        addNarrative('⚠️ 模式切换失败。', false);
      }
    });

    const quickGameMode = document.getElementById('quickGameMode');
    if (quickGameMode) quickGameMode.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ mode: quickGameMode.value });
        addNarrative(`✅ 已切换模式：${quickGameMode.options[quickGameMode.selectedIndex]?.textContent?.replace(' ▾', '') || quickGameMode.value}`, false);
        if (typeof window.loadGameState === 'function') await window.loadGameState();
      } catch (e) {
        addNarrative('⚠️ 模式切换失败。', false);
      }
    });

    if (stLanguage) stLanguage.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ language: stLanguage.value });
      } catch (e) {
        addNarrative('⚠️ 语言设置失败。', false);
      }
    });

    if (stStreaming) stStreaming.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ streaming: stStreaming.checked });
      } catch (e) {
        addNarrative('⚠️ 流式输出设置失败。', false);
      }
    });

    if (stEngineLogging) stEngineLogging.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ logging: stEngineLogging.checked });
      } catch (e) {
        addNarrative('⚠️ 引擎日志设置失败。', false);
      }
    });

    if (stMaxHistoryTurns) stMaxHistoryTurns.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ maxHistoryTurns: Number(stMaxHistoryTurns.value) });
      } catch (e) {
        addNarrative('⚠️ 历史轮数设置失败。', false);
      }
    });

    if (stMemoryMaxChars) stMemoryMaxChars.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ memoryMaxContextChars: Number(stMemoryMaxChars.value) });
      } catch (e) {
        addNarrative('⚠️ 记忆注入预算设置失败。', false);
      }
    });

    if (stAutoSaveInterval) stAutoSaveInterval.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ autoSaveInterval: Number(stAutoSaveInterval.value) });
        addNarrative(`✅ 自动存档间隔已设置为 ${stAutoSaveInterval.value} 回合。`, false);
      } catch (e) {
        addNarrative('⚠️ 自动存档设置失败。', false);
      }
    });

    const onAgentsChange = async () => {
      try {
        await applyEnginePatch({ enabledAgents: collectEnabledAgents() });
      } catch (e) {
        addNarrative('⚠️ 代理开关设置失败。', false);
      }
    };
    if (stAgentWorldKeeper) stAgentWorldKeeper.addEventListener('change', onAgentsChange);
    if (stAgentNPCDirector) stAgentNPCDirector.addEventListener('change', onAgentsChange);
    if (stAgentRuleArbiter) stAgentRuleArbiter.addEventListener('change', onAgentsChange);
    if (stAgentDramaCurator) stAgentDramaCurator.addEventListener('change', onAgentsChange);

    if (archGameMode) archGameMode.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ mode: archGameMode.value });
        await refreshArchitecture();
      } catch (e) {
        addNarrative('⚠️ 架构模式设置失败。', false);
      }
    });
    if (archStreaming) archStreaming.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ streaming: archStreaming.checked });
        await refreshArchitecture();
      } catch (e) {
        addNarrative('⚠️ 架构流式输出设置失败。', false);
      }
    });
    if (archEngineLogging) archEngineLogging.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ logging: archEngineLogging.checked });
      } catch (e) {
        addNarrative('⚠️ 架构日志设置失败。', false);
      }
    });
    if (archMaxHistoryTurns) archMaxHistoryTurns.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ maxHistoryTurns: Number(archMaxHistoryTurns.value) });
      } catch (e) {
        addNarrative('⚠️ 架构历史轮数设置失败。', false);
      }
    });
    if (archMemoryMaxChars) archMemoryMaxChars.addEventListener('change', async () => {
      try {
        await applyEnginePatch({ memoryMaxContextChars: Number(archMemoryMaxChars.value) });
      } catch (e) {
        addNarrative('⚠️ 架构记忆预算设置失败。', false);
      }
    });

    const onArchAgentsChange = async () => {
      try {
        const roles = ['narrator'];
        if (archAgentWorldKeeper?.checked) roles.push('world-keeper');
        if (archAgentNPCDirector?.checked) roles.push('npc-director');
        if (archAgentRuleArbiter?.checked) roles.push('rule-arbiter');
        if (archAgentDramaCurator?.checked) roles.push('drama-curator');
        await applyEnginePatch({ enabledAgents: roles });
        await refreshArchitecture();
      } catch (e) {
        addNarrative('⚠️ 架构代理设置失败。', false);
      }
    };
    if (archAgentWorldKeeper) archAgentWorldKeeper.addEventListener('change', onArchAgentsChange);
    if (archAgentNPCDirector) archAgentNPCDirector.addEventListener('change', onArchAgentsChange);
    if (archAgentRuleArbiter) archAgentRuleArbiter.addEventListener('change', onArchAgentsChange);
    if (archAgentDramaCurator) archAgentDramaCurator.addEventListener('change', onArchAgentsChange);

    const stDefaultProvider = document.getElementById('stDefaultProvider');
    const stDefaultModel = document.getElementById('stDefaultModel');
    const stApplyDefaultModel = document.getElementById('stApplyDefaultModel');
    const stScanModels = document.getElementById('stScanModels');

    async function applyProviderPatch(patch) {
      await safeApi('/providers/config', { method: 'POST', body: patch });
      await refreshServerConfig();
      syncEngineControls();
    }

    if (stDefaultProvider) stDefaultProvider.addEventListener('change', async () => {
      try {
        await applyProviderPatch({ defaultProvider: stDefaultProvider.value });
      } catch (e) {
        addNarrative('⚠️ 默认 Provider 设置失败。', false);
      }
    });

    if (archDefaultProvider) archDefaultProvider.addEventListener('change', async () => {
      try {
        await applyProviderPatch({ defaultProvider: archDefaultProvider.value });
        await refreshArchitecture();
      } catch (e) {
        addNarrative('⚠️ 架构默认 Provider 设置失败。', false);
      }
    });

    if (stApplyDefaultModel) stApplyDefaultModel.addEventListener('click', async () => {
      try {
        const routing = window.serverConfig?.providerRouting;
        const p = (routing?.defaultProvider) || stDefaultProvider?.value;
        const model = (stDefaultModel?.value || '').trim();
        if (!p) return;
        const patch = {};
        if (p === 'openai') patch.openai = { defaultModel: model || undefined };
        if (p === 'ollama') patch.ollama = { defaultModel: model || undefined };
        if (p === 'lmstudio') patch.lmstudio = { defaultModel: model || undefined };
        if (p === 'jan') patch.jan = { defaultModel: model || undefined };
        if (p === 'local') patch.local = { defaultModel: model || undefined };
        await applyProviderPatch(patch);
      } catch (e) {
        addNarrative('⚠️ 默认模型设置失败。', false);
      }
    });

    const stApplyProviderAdvanced = document.getElementById('stApplyProviderAdvanced');
    if (stApplyProviderAdvanced) stApplyProviderAdvanced.addEventListener('click', async () => {
      try {
        const routing = window.serverConfig?.providerRouting;
        const p = (routing?.defaultProvider) || stDefaultProvider?.value;
        const baseURL = (document.getElementById('stProviderBaseURL')?.value || '').trim();
        const apiKey = (document.getElementById('stProviderAPIKey')?.value || '').trim();
        if (!p) return;
        
        const patch = {};
        const updateData = {};
        
        if (apiKey && apiKey !== '***') {
          updateData.apiKey = apiKey;
        } else if (apiKey === '') {
          updateData.apiKey = ''; // Allow clearing
        }
        
        if (p === 'openai') {
          updateData.baseURL = baseURL;
          patch.openai = updateData;
        } else if (p === 'ollama') {
          updateData.host = baseURL;
          patch.ollama = updateData;
        } else {
          updateData.endpoint = baseURL;
          patch[p] = updateData;
        }
        
        await applyProviderPatch(patch);
        addNarrative('✅ 高级配置已保存。', false);
      } catch (e) {
        addNarrative('⚠️ 高级配置保存失败。', false);
      }
    });

    if (stScanModels) stScanModels.addEventListener('click', async () => {
      try {
        await refreshProviderModels();
      } catch (e) {
        addNarrative('⚠️ 扫描模型失败。', false);
      }
    });

    const stApplyOverrides = document.getElementById('stApplyOverrides');
    const stClearOverrides = document.getElementById('stClearOverrides');
    const overrideFields = [
      { role: 'narrator', provider: 'stOverrideNarratorProvider', model: 'stOverrideNarratorModel' },
      { role: 'world-keeper', provider: 'stOverrideWorldKeeperProvider', model: 'stOverrideWorldKeeperModel' },
      { role: 'npc-director', provider: 'stOverrideNPCDirectorProvider', model: 'stOverrideNPCDirectorModel' },
      { role: 'rule-arbiter', provider: 'stOverrideRuleArbiterProvider', model: 'stOverrideRuleArbiterModel' },
      { role: 'drama-curator', provider: 'stOverrideDramaCuratorProvider', model: 'stOverrideDramaCuratorModel' },
    ];

    if (stApplyOverrides) stApplyOverrides.addEventListener('click', async () => {
      try {
        const agentOverrides = {};
        for (const f of overrideFields) {
          const p = document.getElementById(f.provider)?.value || '';
          const m = (document.getElementById(f.model)?.value || '').trim();
          if (!p) continue;
          agentOverrides[f.role] = { providerType: p, model: m || undefined };
        }
        await applyProviderPatch({ agentOverrides });
      } catch (e) {
        addNarrative('⚠️ 覆盖设置失败。', false);
      }
    });

    if (stClearOverrides) stClearOverrides.addEventListener('click', async () => {
      try {
        const agentOverrides = {};
        for (const f of overrideFields) agentOverrides[f.role] = null;
        await applyProviderPatch({ agentOverrides });
      } catch (e) {
        addNarrative('⚠️ 清除覆盖失败。', false);
      }
    });

    const wfSaveName = document.getElementById('wfSaveName');
    const wfSaveBtn = document.getElementById('wfSaveBtn');
    const wfResetBtn = document.getElementById('wfResetBtn');
    const wfRefreshSaves = document.getElementById('wfRefreshSaves');
    const wfLoadBtn = document.getElementById('wfLoadBtn');

    if (wfSaveBtn) wfSaveBtn.addEventListener('click', async () => {
      try {
        const name = (wfSaveName?.value || '').trim();
        await safeApi('/save', { method: 'POST', body: { name: name || undefined } });
        await refreshSaves();
        addNarrative('✅ 已保存存档。', false);
      } catch (e) {
        addNarrative('⚠️ 保存失败。', false);
      }
    });

    if (wfRefreshSaves) wfRefreshSaves.addEventListener('click', async () => {
      try {
        await refreshSaves();
      } catch (e) {
        addNarrative('⚠️ 刷新存档失败。', false);
      }
    });

    if (wfLoadBtn) wfLoadBtn.addEventListener('click', async () => {
      try {
        const id = getSelectedSaveId();
        if (!id) return;
        await safeApi('/load', { method: 'POST', body: { saveId: id } });
        await loadGameState();
        addNarrative('✅ 已加载存档。', false);
      } catch (e) {
        addNarrative('⚠️ 加载失败。', false);
      }
    });

    if (wfResetBtn) wfResetBtn.addEventListener('click', async () => {
      try {
        await safeApi('/reset', { method: 'POST', body: {} });
        await loadGameState();
        addNarrative('✅ 已重置游戏。', false);
      } catch (e) {
        addNarrative('⚠️ 重置失败。', false);
      }
    });

    const wfMemoryQuery = document.getElementById('wfMemoryQuery');
    const wfMemorySearch = document.getElementById('wfMemorySearch');
    const wfMemoryRefresh = document.getElementById('wfMemoryRefresh');
    const wfClearMemories = document.getElementById('wfClearMemories');
    const wfNewSession = document.getElementById('wfNewSession');

    if (wfMemoryRefresh) wfMemoryRefresh.addEventListener('click', async () => {
      try {
        await refreshMemoriesRecent();
      } catch (e) {
        addNarrative('⚠️ 获取记忆失败。', false);
      }
    });

    if (wfMemorySearch) wfMemorySearch.addEventListener('click', async () => {
      try {
        const q = (wfMemoryQuery?.value || '').trim();
        if (!q) return;
        await searchMemories(q);
      } catch (e) {
        addNarrative('⚠️ 搜索记忆失败。', false);
      }
    });

    if (wfClearMemories) wfClearMemories.addEventListener('click', async () => {
      try {
        await safeApi('/memories/clear', { method: 'POST', body: {} });
        await refreshMemoriesRecent();
        addNarrative('✅ 已清空当前会话记忆。', false);
      } catch (e) {
        addNarrative('⚠️ 清空记忆失败。', false);
      }
    });

    if (wfNewSession) wfNewSession.addEventListener('click', async () => {
      try {
        await safeApi('/session/new', { method: 'POST', body: {} });
        await refreshServerConfig();
        syncEngineControls();
        await refreshMemoriesRecent();
        addNarrative('✅ 已创建新会话。', false);
      } catch (e) {
        addNarrative('⚠️ 新会话创建失败。', false);
      }
    });

    const wfRuleBookText = document.getElementById('wfRuleBookText');
    const wfLoadRuleBook = document.getElementById('wfLoadRuleBook');
    const wfApplyRuleBook = document.getElementById('wfApplyRuleBook');

    if (wfLoadRuleBook) wfLoadRuleBook.addEventListener('click', async () => {
      try {
        await loadRuleBookText();
      } catch (e) {
        addNarrative('⚠️ 读取规则书失败。', false);
      }
    });

    if (wfApplyRuleBook) wfApplyRuleBook.addEventListener('click', async () => {
      try {
        const text = wfRuleBookText?.value || '';
        await applyRuleBookText(text);
        addNarrative('✅ 已应用规则书。', false);
      } catch (e) {
        addNarrative('⚠️ 应用规则书失败。', false);
      }
    });

    
    // 初始化思维链 UI
    
    
    // 启动思维链轮询（每 1 秒检查一次）
    

    const backdrop = document.getElementById('drawerBackdrop');
    const openSidebarBtn = document.getElementById('openSidebar');
    const openRightPanelBtn = document.getElementById('openRightPanel');
    const sidebar = document.querySelector('.sidebar');

    

    function syncBackdropHidden() {
      const open = document.body.classList.contains('drawer-left-open') || document.body.classList.contains('drawer-right-open');
      backdrop.hidden = !open;
      document.body.classList.toggle('drawer-open', open);
    }

    function closeDrawers() {
      document.body.classList.remove('drawer-left-open');
      document.body.classList.remove('drawer-right-open');
      if (openSidebarBtn) openSidebarBtn.setAttribute('aria-expanded', 'false');
      if (openRightPanelBtn) openRightPanelBtn.setAttribute('aria-expanded', 'false');
      syncBackdropHidden();
    }

    function toggleLeftDrawer() {
      const willOpen = !document.body.classList.contains('drawer-left-open');
      document.body.classList.toggle('drawer-left-open', willOpen);
      document.body.classList.remove('drawer-right-open');
      if (openSidebarBtn) openSidebarBtn.setAttribute('aria-expanded', String(willOpen));
      if (openRightPanelBtn) openRightPanelBtn.setAttribute('aria-expanded', 'false');
      syncBackdropHidden();
    }

    function toggleRightDrawer() {
      const willOpen = !document.body.classList.contains('drawer-right-open');
      document.body.classList.toggle('drawer-right-open', willOpen);
      document.body.classList.remove('drawer-left-open');
      if (openRightPanelBtn) openRightPanelBtn.setAttribute('aria-expanded', String(willOpen));
      if (openSidebarBtn) openSidebarBtn.setAttribute('aria-expanded', 'false');
      syncBackdropHidden();
    }

    
    

    async function checkServerHealth() {
      const dot = document.getElementById('healthDot');
      const text = document.getElementById('healthText');
      if (!dot || !text) return;
      try {
        const res = await fetch(`${window.API_BASE}/api/health`, { method: 'GET' });
        if (res.ok) {
          dot.className = 'health-dot online';
          text.textContent = '在线';
        } else {
          dot.className = 'health-dot offline';
          text.textContent = '离线';
        }
      } catch (e) {
        dot.className = 'health-dot offline';
        text.textContent = '离线';
      }
    }
    
    

  

// Expose functions to window
window.formatTime = formatTime;
window.openHistoryDialog = openHistoryDialog;
window.closeHistoryDialog = closeHistoryDialog;
window.openLogDialog = openLogDialog;
window.closeLogDialog = closeLogDialog;
window.openSettingsDialog = openSettingsDialog;
window.closeSettingsDialog = closeSettingsDialog;
window.openWorldForgeDialog = openWorldForgeDialog;
window.closeWorldForgeDialog = closeWorldForgeDialog;
window.syncSettingsControls = syncSettingsControls;
window.setSelectValue = setSelectValue;
window.syncEngineControls = syncEngineControls;
window.disableUnavailableProviderOptions = disableUnavailableProviderOptions;
window.renderSavesToSelect = renderSavesToSelect;
window.renderMemoriesToList = renderMemoriesToList;
window.syncWorldForgeControls = syncWorldForgeControls;
window.loadRuleBookText = loadRuleBookText;
window.applyRuleBookText = applyRuleBookText;
window.getSelectedSaveId = getSelectedSaveId;
window.refreshSaves = refreshSaves;
window.refreshMemoriesRecent = refreshMemoriesRecent;
window.searchMemories = searchMemories;
window.generatePreviewImage = generatePreviewImage;
window.refreshArchitecture = refreshArchitecture;
window.renderOnboardingStep = renderOnboardingStep;
window.openOnboardingDialog = openOnboardingDialog;
window.closeOnboardingDialog = closeOnboardingDialog;
window.submitOnboarding = submitOnboarding;
window.openArchitectureDialog = openArchitectureDialog;
window.closeArchitectureDialog = closeArchitectureDialog;
window.openSavesDialog = openSavesDialog;
window.closeSavesDialog = closeSavesDialog;
window.refreshSavesList = refreshSavesList;
window.openAchievementsDialog = openAchievementsDialog;
window.closeAchievementsDialog = closeAchievementsDialog;
window.refreshAchievementsList = refreshAchievementsList;
window.openMapDialog = openMapDialog;
window.closeMapDialog = closeMapDialog;
window.refreshMapList = refreshMapList;
window.openCharacterDialog = openCharacterDialog;
window.closeCharacterDialog = closeCharacterDialog;
window.refreshCharacterData = refreshCharacterData;
window.openLoreDialog = openLoreDialog;
window.closeLoreDialog = closeLoreDialog;
window.refreshLoreData = refreshLoreData;
window.applyEnginePatch = applyEnginePatch;
window.collectEnabledAgents = collectEnabledAgents;
window.applyProviderPatch = applyProviderPatch;
window.syncBackdropHidden = syncBackdropHidden;
window.closeDrawers = closeDrawers;
window.toggleLeftDrawer = toggleLeftDrawer;
window.toggleRightDrawer = toggleRightDrawer;
window.checkServerHealth = checkServerHealth;
