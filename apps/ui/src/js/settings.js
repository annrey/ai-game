const defaultSettings = {
      singleScreen: true,
      compact: false,
      fontSize: 'normal',
      storyClamp: 9,
      logPreview: 5,
      hideChoiceDesc: false,
      showSidebar: true,
      showRightPanel: true,
      showSceneMeta: true,
      showCouncil: true,
      showReasoning: true,
      showCOT: true,
      showWorld: true,
      showCharacter: true,
      showInventory: true,
      showQuests: true,
      showLog: true,
      autoWorldTick: true,
      idleTimeout: 30,
      panelOpen: {
        reasoning: true,
        cot: true,
        world: true,
        character: true,
        inventory: true,
        quests: true,
        log: true,
      },
    };

    function loadSettings() {
      try {
        const raw = localStorage.getItem('uiSettingsV1');
        if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
      } catch {}
      try {
        const legacy = localStorage.getItem('singleScreen');
        if (legacy === '1') return { ...defaultSettings, singleScreen: true };
      } catch {}
      return { ...defaultSettings };
    }

    function saveSettings(s) {
      try {
        localStorage.setItem('uiSettingsV1', JSON.stringify(s));
      } catch {}
      try {
        localStorage.setItem('singleScreen', s.singleScreen ? '1' : '0');
      } catch {}
    }

    window.uiSettings = loadSettings();

    function setStoryClampLines(n) {
      const val = Number(n);
      if (!Number.isFinite(val)) return;
      document.documentElement.style.setProperty('--story-clamp-lines', String(Math.max(3, Math.min(val, 16))));
    }

    function renderLogPreview(maxItems) {
      const container = document.getElementById('logContainer');
      if (!container) return;
      const entries = Array.from(container.querySelectorAll('.log-entry'));
      entries.forEach((el, idx) => {
        el.style.display = idx < maxItems ? '' : 'none';
      });
    }

    function updateSummaries() {
      const world = document.getElementById('summaryWorld');
      if (world) {
        const values = Array.from(document.querySelectorAll('[data-panel="world"] .stat-card')).map((card) => {
          const v = card.querySelector('.stat-value')?.textContent?.trim() || '';
          const l = card.querySelector('.stat-label')?.textContent?.trim() || '';
          if (!v || !l) return '';
          const cleaned = l.replace(/\s+/g, ' ').trim();
          const suffix = cleaned.includes('%') ? '%' : '';
          const label = cleaned.replace('%', '').trim();
          return `${label} ${v}${suffix}`;
        }).filter(Boolean);
        world.textContent = values.join(' · ');
      }

      const ch = document.getElementById('summaryCharacter');
      if (ch) {
        const parts = Array.from(document.querySelectorAll('[data-panel="character"] .status-bar')).map((bar) => {
          const name = bar.querySelector('.status-name')?.textContent?.trim() || '';
          const v = bar.querySelector('.status-fill')?.getAttribute('data-value')?.trim() || '';
          return name && v ? `${name} ${v}%` : '';
        }).filter(Boolean);
        ch.textContent = parts.join(' · ');
      }

      const inv = document.getElementById('summaryInventory');
      if (inv) {
        const grid = document.getElementById('inventoryGrid');
        const slots = grid ? Array.from(grid.querySelectorAll('.inventory-slot')) : [];
        const filled = slots.filter((s) => !s.classList.contains('empty')).length;
        inv.textContent = slots.length ? `已占用 ${filled}/${slots.length}` : '';
      }

      const lg = document.getElementById('summaryLog');
      if (lg) {
        lg.textContent = window.logHistory.length ? `共 ${window.logHistory.length} 条 · 预览 ${window.uiSettings.logPreview} 条` : '';
      }

      // 更新思维链摘要
      const cot = getCOT();
      updateCOTSummary(cot);
    }

    function applySettings(s) {
      document.body.classList.toggle('single-screen', !!s.singleScreen);
      document.body.classList.toggle('compact', !!s.compact);

      document.body.classList.toggle('font-small', s.fontSize === 'small');
      document.body.classList.toggle('font-large', s.fontSize === 'large');

      document.body.classList.toggle('hide-choice-desc', !!s.hideChoiceDesc);

      document.body.classList.toggle('hide-scene-meta', !s.showSceneMeta);
      document.body.classList.toggle('hide-council', !s.showCouncil);

      document.body.classList.toggle('hide-sidebar', !s.showSidebar);
      document.body.classList.toggle('hide-right-panel', !s.showRightPanel);

      const toggleSingleScreenBtn = document.getElementById('toggleSingleScreen');
      if (toggleSingleScreenBtn) toggleSingleScreenBtn.setAttribute('aria-pressed', String(!!s.singleScreen));

      setStoryClampLines(s.storyClamp);
      renderLogPreview(Number(s.logPreview) || defaultSettings.logPreview);

      const panels = {
        cot: document.querySelector('[data-panel="chain-of-thought"]'),
        reasoning: document.querySelector('[data-panel="reasoning"]'),
        world: document.querySelector('[data-panel="world"]'),
        character: document.querySelector('[data-panel="character"]'),
        inventory: document.querySelector('[data-panel="inventory"]'),
        quests: document.querySelector('[data-panel="quests"]'),
        plots: document.querySelector('[data-panel="plots"]'),
        npcs: document.querySelector('[data-panel="npcs"]'),
        log: document.querySelector('[data-panel="log"]'),
      };

      if (panels.cot) panels.cot.hidden = !s.showCOT;
      if (panels.reasoning) panels.reasoning.hidden = !s.showReasoning;
      if (panels.world) panels.world.hidden = !s.showWorld;
      if (panels.character) panels.character.hidden = !s.showCharacter;
      if (panels.inventory) panels.inventory.hidden = !s.showInventory;
      if (panels.quests) panels.quests.hidden = !s.showQuests;
      if (panels.log) panels.log.hidden = !s.showLog;

      if (panels.cot && s.panelOpen?.cot !== undefined) panels.cot.open = !!s.panelOpen.cot;
      if (panels.reasoning && s.panelOpen?.reasoning !== undefined) panels.reasoning.open = !!s.panelOpen.reasoning;
      if (panels.world && s.panelOpen?.world !== undefined) panels.world.open = !!s.panelOpen.world;
      if (panels.character && s.panelOpen?.character !== undefined) panels.character.open = !!s.panelOpen.character;
      if (panels.inventory && s.panelOpen?.inventory !== undefined) panels.inventory.open = !!s.panelOpen.inventory;
      if (panels.quests && s.panelOpen?.quests !== undefined) panels.quests.open = !!s.panelOpen.quests;
      if (panels.plots && s.panelOpen?.plots !== undefined) panels.plots.open = !!s.panelOpen.plots;
      if (panels.npcs && s.panelOpen?.npcs !== undefined) panels.npcs.open = !!s.panelOpen.npcs;
      if (panels.log && s.panelOpen?.log !== undefined) panels.log.open = !!s.panelOpen.log;

      const openSidebarBtn = document.getElementById('openSidebar');
      if (openSidebarBtn) openSidebarBtn.style.display = s.showSidebar ? '' : 'none';
      const openRightPanelBtn = document.getElementById('openRightPanel');
      if (openRightPanelBtn) openRightPanelBtn.style.display = s.showRightPanel ? '' : 'none';

      if (!s.showSidebar) {
        document.body.classList.remove('drawer-left-open');
        if (openSidebarBtn) openSidebarBtn.setAttribute('aria-expanded', 'false');
      }

      if (!s.showRightPanel) {
        document.body.classList.remove('drawer-right-open');
        if (openRightPanelBtn) openRightPanelBtn.setAttribute('aria-expanded', 'false');
      }

      const backdrop = document.getElementById('drawerBackdrop');
      const anyDrawerOpen = document.body.classList.contains('drawer-left-open') || document.body.classList.contains('drawer-right-open');
      if (backdrop) backdrop.hidden = !anyDrawerOpen;
      document.body.classList.toggle('drawer-open', anyDrawerOpen);

      updateSummaries();
    }

    function updateSettings(partial) {
      window.uiSettings = {
        ...window.uiSettings,
        ...partial,
        panelOpen: {
          ...window.uiSettings.panelOpen,
          ...(partial.panelOpen || {}),
        },
      };
      saveSettings(window.uiSettings);
      applySettings(window.uiSettings);
    }

    // ========== 思维链函数结束 ==========

    // 加载游戏状态
    

// Expose functions to window
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.setStoryClampLines = setStoryClampLines;
window.renderLogPreview = renderLogPreview;
window.updateSummaries = updateSummaries;
window.applySettings = applySettings;
window.updateSettings = updateSettings;
