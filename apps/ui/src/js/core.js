function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // 处理玩家输入
    async function processInput(input) {
      if (window.gameState.isProcessing || !input.trim()) return;

      window.gameState.isProcessing = true;
      const textarea = document.getElementById('playerInput');
      const sendBtn = document.querySelector('.send-btn');
      textarea.disabled = true;
      sendBtn.disabled = true;
      
      if (window.idleTimer) clearTimeout(window.idleTimer);

      // 显示玩家输入
      if (input !== '<WAIT>') {
        addNarrative(input, true);
        textarea.value = '';
        textarea.style.height = 'auto';
      }

      try {
        const useStream = window.serverConfig?.gameConfig?.streaming ?? false;
        if (useStream) {
          const container = document.querySelector('.story-container');
          const choicesGrid = container.querySelector('.choices-grid');
          const block = document.createElement('article');
          block.className = 'narrative-block';
          block.style.animation = 'fadeInUp 0.6s ease-out';
          const contentEl = document.createElement('div');
          contentEl.className = 'narrative-text';
          const p = document.createElement('p');
          contentEl.appendChild(p);
          block.appendChild(contentEl);
          container.insertBefore(block, choicesGrid);

          const res = await fetch(`${window.API_BASE}/api/turn/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input }),
          });
          if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let full = '';
          let buffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the incomplete line in buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const payload = JSON.parse(line);
                if (payload.type === 'agent') {
                  addReasoningLog(payload.role, payload.content);
                  // 同步获取思维链
                  getCOTFromAPI().then(cot => {
                    if (cot) renderCOTFromAPI(cot);
                  });
                } else if (payload.type === 'chunk') {
                  full += payload.content;
                  p.innerHTML = escapeHtml(full).replace(/\n/g, '<br>');
                  block.scrollIntoView({ behavior: 'smooth', block: 'end' });
                } else if (payload.type === 'done') {
                  // handle done if needed
                }
              } catch (e) {
                console.error('Failed to parse stream line:', line, e);
              }
            }
          }
          if (buffer.trim()) {
            try {
              const payload = JSON.parse(buffer);
              if (payload.type === 'agent') {
                addReasoningLog(payload.role, payload.content);
              } else if (payload.type === 'chunk') {
                full += payload.content;
                p.innerHTML = escapeHtml(full).replace(/\n/g, '<br>');
              }
            } catch (e) {}
          }
          block.scrollIntoView({ behavior: 'smooth', block: 'end' });

          window.narrativeHistory.push({ content: full, isPlayer: false, time: new Date() });

          try {
            const tc = await safeApi('/turn-count');
            window.gameState.turnCount = tc.data?.turnCount ?? (window.gameState.turnCount + 1);
          } catch {
            window.gameState.turnCount = window.gameState.turnCount + 1;
          }

          addLogEntry(`回合 ${window.gameState.turnCount}: 玩家行动`);
        } else {
          const r = await safeApi('/turn', {
            method: 'POST',
            body: { input },
          });

          if (r.data?.agentDetails) {
            r.data.agentDetails.forEach(ad => addReasoningLog(ad.from, ad.content));
          }

          // 同步获取思维链
          const cot = await getCOTFromAPI();
          if (cot) {
            renderCOTFromAPI(cot);
          }

          if (r.data?.narrative) {
            addNarrative(r.data.narrative);
          }

          window.gameState.turnCount = r.data?.stateSnapshot?.turnCount || window.gameState.turnCount + 1;
          addLogEntry(`回合 ${window.gameState.turnCount}: 玩家行动`);
        }

      } catch (err) {
        console.error('Failed to process turn:', err);
        addNarrative('⚠️ 连接失败，请检查服务器是否运行。', false);
      } finally {
        window.gameState.isProcessing = false;
        textarea.disabled = false;
        sendBtn.disabled = false;
        if (input !== '<WAIT>') {
          textarea.focus();
        }
        await loadGameState(); // 更新界面状态
        resetIdleTimer();
      }
    }

    // 添加日志条目
    function addLogEntry(text) {
      const logContainer = document.getElementById('logContainer');
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      entry.innerHTML = `<span class="log-time">${time}</span>${escapeHtml(text)}`;
      logContainer.insertBefore(entry, logContainer.firstChild);
      window.logHistory.unshift({ time, text });
      renderLogPreview(Number(window.uiSettings.logPreview) || defaultSettings.logPreview);
      updateSummaries();
    }

    // 添加推演日志条目
    function addReasoningLog(role, content) {
      const container = document.getElementById('reasoningLogs');
      if (!container) return;
      const entry = document.createElement('div');
      entry.className = 'reasoning-entry';
      entry.style.borderLeft = '2px solid var(--jade-500)';
      entry.style.paddingLeft = '8px';
      entry.style.marginBottom = '4px';
      
      const roleNameMap = {
        'narrator': '旁白',
        'world-keeper': '世界观守护者',
        'npc-director': 'NPC导演',
        'rule-arbiter': '规则仲裁者',
        'drama-curator': '剧情策划'
      };
      
      const roleDisplayName = roleNameMap[role] || role;
      
      entry.innerHTML = `
        <div style="font-weight: bold; color: var(--jade-500); margin-bottom: 2px;">${escapeHtml(roleDisplayName)}</div>
        <div style="color: var(--jade-900); opacity: 0.9;">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
      `;
      container.appendChild(entry);
      container.scrollTop = container.scrollHeight;
    }

    // 输入框自动调整高度
    const textarea = document.getElementById('playerInput');
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // 发送按钮
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput(textarea.value);
      }
    });

    document.querySelector('.send-btn').addEventListener('click', () => {
      processInput(textarea.value);
    });

    // 选择卡片点击
    document.querySelectorAll('.choice-card').forEach(card => {
      card.addEventListener('click', function() {
        const text = this.querySelector('.choice-text').textContent;
        processInput(text);
      });
    });

    // 导航项切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function() {
        if (this.dataset.navUtility === 'true') return;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(i => i.removeAttribute('aria-current'));
        this.setAttribute('aria-current', 'page');
      });
    });

    const toggleSingleScreenBtn = document.getElementById('toggleSingleScreen');
    if (toggleSingleScreenBtn) {
      toggleSingleScreenBtn.addEventListener('click', () => {
        updateSettings({ singleScreen: !window.uiSettings.singleScreen });
      });
    }

    

// Expose functions to window
window.escapeHtml = escapeHtml;
window.processInput = processInput;
window.addLogEntry = addLogEntry;
window.addReasoningLog = addReasoningLog;
