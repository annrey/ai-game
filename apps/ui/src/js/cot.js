// ========== 思维链 (Chain of Thought) 相关函数 ==========
    
    // 思维链轮询定时器
    window.cotPollingInterval = null;
    window.lastCOTId = null;
    window.cotEventSource = null;

    // 从 API 获取当前思维链
    async function getCOTFromAPI() {
      try {
        const res = await fetch(`${window.API_BASE}/api/cot/current`);
        if (!res.ok) return null;
        
        const data = await res.json();
        if (data.success && data.data.current) {
          return data.data.current;
        }
        return null;
      } catch (err) {
        console.error('Failed to fetch COT from API:', err);
        return null;
      }
    }

    // 从 API 获取思维链历史
    async function getCOTHistory(limit = 20, offset = 0, agentRole) {
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });
        if (agentRole) params.append('agentRole', agentRole);
        
        const res = await fetch(`${window.API_BASE}/api/cot/history?${params}`);
        if (!res.ok) return null;
        
        const data = await res.json();
        if (data.success) {
          return data.data;
        }
        return null;
      } catch (err) {
        console.error('Failed to fetch COT history:', err);
        return null;
      }
    }

    // 渲染思维链对象（来自 API）
    function renderCOTFromAPI(cot) {
      if (!cot) return;
      
      // 检查是否需要更新（通过 ID 判断）
      if (cot.id === window.lastCOTId) {
        return; // 没有变化，跳过
      }
      window.lastCOTId = cot.id;
      
      // 清空本地存储的思维链
      const container = document.getElementById('cotContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (!cot.steps || cot.steps.length === 0) {
        container.innerHTML = '<div class="cot-empty">暂无思维链记录</div>';
        return;
      }
      
      // 渲染所有步骤
      cot.steps.forEach((step, index) => {
        const stepData = {
          type: step.step,
          content: step.content,
          agent: cot.agentRole,
          timestamp: cot.timestamp,
        };
        const stepEl = renderCOTStep(stepData, index);
        container.appendChild(stepEl);
      });
      
      // 滚动到底部
      container.scrollTop = container.scrollHeight;
      
      // 更新摘要
      updateCOTSummaryFromAPI(cot);
    }

    // 更新思维链摘要（API 版本）
    function updateCOTSummaryFromAPI(cot) {
      const summary = document.getElementById('summaryCOT');
      if (!summary || !cot) return;
      
      if (!cot.steps || cot.steps.length === 0) {
        summary.textContent = '';
        return;
      }
      
      const stepCounts = {};
      cot.steps.forEach(step => {
        const type = step.step || 'unknown';
        stepCounts[type] = (stepCounts[type] || 0) + 1;
      });
      
      const parts = [];
      const typeLabels = {
        observation: '观察',
        analysis: '分析',
        reasoning: '推理',
        decision: '决策',
        action: '行动'
      };
      
      Object.entries(stepCounts).forEach(([type, count]) => {
        const label = typeLabels[type] || type;
        parts.push(`${label} ${count}`);
      });
      
      summary.textContent = parts.join(' · ') || `${cot.steps.length} 条记录`;
    }

    // 启动思维链轮询
    function startCOTPolling(intervalMs = 1000) {
      // 优先使用 SSE 事件流
      if (window.EventSource) {
        try {
          window.cotEventSource = new EventSource(`${window.API_BASE}/api/cot/events`);
          
          window.cotEventSource.addEventListener('cot-update', (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.data) {
                renderCOTFromAPI(data.data);
              }
            } catch (err) {
              console.error('Failed to parse COT event:', err);
            }
          });
          
          window.cotEventSource.addEventListener('connected', (event) => {
            console.log('[COT Events] Connected:', JSON.parse(event.data).message);
          });
          
          window.cotEventSource.onerror = (err) => {
            console.error('[COT Events] Error:', err);
            // SSE 连接失败时降级到轮询
            stopCOTPolling();
            startPollingFallback(intervalMs);
          };
          
          console.log('[COT Events] Using SSE for real-time updates');
        } catch (err) {
          console.error('Failed to initialize SSE, falling back to polling:', err);
          startPollingFallback(intervalMs);
        }
      } else {
        // 不支持 EventSource 时使用轮询
        startPollingFallback(intervalMs);
      }
    }

    // 轮询降级方案
    function startPollingFallback(intervalMs) {
      if (window.cotPollingInterval) {
        clearInterval(window.cotPollingInterval);
      }
      
      window.cotPollingInterval = setInterval(async () => {
        const cot = await getCOTFromAPI();
        if (cot) {
          renderCOTFromAPI(cot);
        }
      }, intervalMs);
      
      console.log('[COT Polling] Using polling for updates');
    }

    // 停止思维链轮询
    function stopCOTPolling() {
      if (window.cotPollingInterval) {
        clearInterval(window.cotPollingInterval);
        window.cotPollingInterval = null;
      }
      if (window.cotEventSource) {
        window.cotEventSource.close();
        window.cotEventSource = null;
      }
      window.lastCOTId = null;
    }

    // 获取当前思维链
    function getCOT() {
      try {
        const raw = localStorage.getItem('chainOfThought');
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to load chain of thought:', err);
      }
      return [];
    }

    // 保存思维链
    function saveCOT(cot) {
      try {
        localStorage.setItem('chainOfThought', JSON.stringify(cot));
      } catch (err) {
        console.error('Failed to save chain of thought:', err);
      }
    }

    // 格式化时间戳
    function formatCOTTimestamp(date) {
      const now = new Date();
      const diff = now - date;
      
      if (diff < 1000) return '刚刚';
      if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    // 获取步骤类型的图标和标签
    function getCOTStepTypeConfig(type) {
      const config = {
        observation: { icon: '👁️', label: '观察' },
        analysis: { icon: '🔍', label: '分析' },
        reasoning: { icon: '🧠', label: '推理' },
        decision: { icon: '⚖️', label: '决策' },
        action: { icon: '⚡', label: '行动' }
      };
      return config[type] || { icon: '💭', label: '思考' };
    }

    // 渲染单个思维链步骤
    function renderCOTStep(step, index) {
      const typeConfig = getCOTStepTypeConfig(step.type);
      const timestamp = step.timestamp ? formatCOTTimestamp(new Date(step.timestamp)) : '';
      const agentName = step.agent || 'AI';
      
      const stepEl = document.createElement('div');
      stepEl.className = `cot-step ${step.type}`;
      stepEl.setAttribute('data-cot-index', index);
      
      stepEl.innerHTML = `
        <div class="cot-step-header">
          <div class="cot-step-title ${step.type}">
            <span class="cot-step-icon">${typeConfig.icon}</span>
            <span>${typeConfig.label}</span>
          </div>
          <span class="cot-step-agent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a3 3 0 0 1 3 3v1a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <circle cx="12" cy="13" r="8"/>
            </svg>
            ${agentName}
          </span>
          <span class="cot-step-timestamp">${timestamp}</span>
        </div>
        <div class="cot-step-content">${step.content || ''}</div>
      `;
      
      return stepEl;
    }

    // 渲染思维链
    function renderChainOfThought(cot) {
      const container = document.getElementById('cotContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (!cot || cot.length === 0) {
        container.innerHTML = '<div class="cot-empty">暂无思维链记录</div>';
        return;
      }
      
      // 渲染所有步骤（最新的在底部）
      cot.forEach((step, index) => {
        const stepEl = renderCOTStep(step, index);
        container.appendChild(stepEl);
      });
      
      // 滚动到底部以显示最新的思维步骤
      container.scrollTop = container.scrollHeight;
    }

    // 更新思维链 UI
    function updateCOTUI(cot) {
      if (!cot) {
        cot = getCOT();
      }
      
      renderChainOfThought(cot);
      updateCOTSummary(cot);
    }

    // 更新思维链摘要
    function updateCOTSummary(cot) {
      const summary = document.getElementById('summaryCOT');
      if (!summary) return;
      
      if (!cot || cot.length === 0) {
        summary.textContent = '';
        return;
      }
      
      const stepCounts = {};
      cot.forEach(step => {
        const type = step.type || 'unknown';
        stepCounts[type] = (stepCounts[type] || 0) + 1;
      });
      
      const parts = [];
      const typeLabels = {
        observation: '观察',
        analysis: '分析',
        reasoning: '推理',
        decision: '决策',
        action: '行动'
      };
      
      Object.entries(stepCounts).forEach(([type, count]) => {
        const label = typeLabels[type] || type;
        parts.push(`${label} ${count}`);
      });
      
      summary.textContent = parts.join(' · ') || `${cot.length} 条记录`;
    }

    // 添加新的思维链步骤
    function addCOTStep(type, content, agent = 'AI') {
      const cot = getCOT();
      const newStep = {
        type,
        content,
        agent,
        timestamp: new Date().toISOString()
      };
      cot.push(newStep);
      
      // 限制历史记录数量
      const maxSteps = 50;
      if (cot.length > maxSteps) {
        cot.splice(0, cot.length - maxSteps);
      }
      
      saveCOT(cot);
      updateCOTUI(cot);
    }

    // 清除思维链历史
    function clearCOT() {
      saveCOT([]);
      updateCOTUI([]);
    }

    // 导出思维链为 JSON
    async function exportCOTAsJSON() {
      try {
        const data = await getCOTHistory(100, 0);
        if (!data || !data.items || data.items.length === 0) {
          addNarrative('⚠️ 没有可导出的思维链数据', false);
          return;
        }
        
        const jsonStr = JSON.stringify(data.items, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chain-of-thought-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addNarrative(`✅ 已导出 ${data.items.length} 条思维链记录`, false);
      } catch (err) {
        console.error('Failed to export COT:', err);
        addNarrative('⚠️ 导出失败', false);
      }
    }

    // 导出思维链为文本
    async function exportCOTAsText() {
      try {
        const data = await getCOTHistory(100, 0);
        if (!data || !data.items || data.items.length === 0) {
          addNarrative('⚠️ 没有可导出的思维链数据', false);
          return;
        }
        
        const textLines = [];
        textLines.push('思维链导出');
        textLines.push('============');
        textLines.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
        textLines.push(`共 ${data.items.length} 条记录\n`);
        
        data.items.forEach((cot, index) => {
          textLines.push(`\n[记录 ${index + 1}]`);
          textLines.push(`代理：${cot.agentRole}`);
          textLines.push(`时间：${new Date(cot.timestamp).toLocaleString('zh-CN')}`);
          textLines.push(`步骤数：${cot.steps.length}\n`);
          
          cot.steps.forEach((step, stepIndex) => {
            const stepTypeMap = {
              observation: '观察',
              analysis: '分析',
              reasoning: '推理',
              decision: '决策',
              action: '行动'
            };
            const stepLabel = stepTypeMap[step.step] || step.step;
            textLines.push(`  ${stepIndex + 1}. [${stepLabel}]`);
            textLines.push(`     ${step.content.replace(/\n/g, '\n     ')}`);
            textLines.push('');
          });
          
          textLines.push('---');
        });
        
        const blob = new Blob([textLines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chain-of-thought-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addNarrative(`✅ 已导出 ${data.items.length} 条思维链记录为文本`, false);
      } catch (err) {
        console.error('Failed to export COT:', err);
        addNarrative('⚠️ 导出失败', false);
      }
    }

    

// Expose functions to window
window.getCOTFromAPI = getCOTFromAPI;
window.getCOTHistory = getCOTHistory;
window.renderCOTFromAPI = renderCOTFromAPI;
window.updateCOTSummaryFromAPI = updateCOTSummaryFromAPI;
window.startCOTPolling = startCOTPolling;
window.startPollingFallback = startPollingFallback;
window.stopCOTPolling = stopCOTPolling;
window.getCOT = getCOT;
window.saveCOT = saveCOT;
window.formatCOTTimestamp = formatCOTTimestamp;
window.getCOTStepTypeConfig = getCOTStepTypeConfig;
window.renderCOTStep = renderCOTStep;
window.renderChainOfThought = renderChainOfThought;
window.updateCOTUI = updateCOTUI;
window.updateCOTSummary = updateCOTSummary;
window.addCOTStep = addCOTStep;
window.clearCOT = clearCOT;
window.exportCOTAsJSON = exportCOTAsJSON;
window.exportCOTAsText = exportCOTAsText;
