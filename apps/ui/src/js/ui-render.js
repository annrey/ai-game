async function loadGameState() {
      try {
        const { data } = await api('/state');
        updateUI(data);
      } catch (err) {
        console.error('Failed to load game state:', err);
      }
    }

    // 更新 UI
    function updateUI(state) {
      // 更新场景标题
      if (state.currentLocation) {
        document.querySelector('.scene-title').textContent = state.currentLocation;
      } else if (state.scene?.name) {
        document.querySelector('.scene-title').textContent = state.scene.name;
      }
      // 更新回合数
      if (state.turnCount !== undefined) {
        window.gameState.turnCount = state.turnCount;
      }
      const previewPrompt = document.getElementById('previewPrompt');
      if (previewPrompt && !previewPrompt.value && state.currentLocation) {
        previewPrompt.value = `${state.currentLocation} 像素风场景`;
      }
      
      // 更新世界状态统计
      if (state.presentNPCs) {
        const statNPCs = document.getElementById('statNPCs');
        if (statNPCs) statNPCs.textContent = state.presentNPCs.length;
      }
      
      // 更新玩家状态
      if (state.playerState) {
        const ps = state.playerState;
        
        // 更新世界探索度等
        const statExploration = document.getElementById('statExploration');
        if (statExploration && ps.explorationProgress !== undefined) {
          statExploration.textContent = ps.explorationProgress;
        }
        
        const statLocations = document.getElementById('statLocations');
        if (statLocations && ps.visitedLocations) {
          statLocations.textContent = ps.visitedLocations.length;
        }
        
        const statItems = document.getElementById('statItems');
        if (statItems && ps.inventory) {
          statItems.textContent = ps.inventory.length;
        }
        
        // 更新生命值
        if (ps.health !== undefined && ps.maxHealth !== undefined) {
          const healthBar = document.querySelector('.status-fill.health');
          if (healthBar) {
            const percent = Math.max(0, Math.min(100, (ps.health / ps.maxHealth) * 100));
            healthBar.style.width = `${percent}%`;
            healthBar.setAttribute('data-value', ps.health);
          }
        }
        
        // 更新魔力值
        if (ps.mana !== undefined && ps.maxMana !== undefined) {
          const manaBar = document.querySelector('.status-fill.mana');
          if (manaBar) {
            const percent = Math.max(0, Math.min(100, (ps.mana / ps.maxMana) * 100));
            manaBar.style.width = `${percent}%`;
            manaBar.setAttribute('data-value', ps.mana);
          }
        }
        
        // 更新体力值
        if (ps.stamina !== undefined && ps.maxStamina !== undefined) {
          const energyBar = document.querySelector('.status-fill.energy');
          if (energyBar) {
            const percent = Math.max(0, Math.min(100, (ps.stamina / ps.maxStamina) * 100));
            energyBar.style.width = `${percent}%`;
            energyBar.setAttribute('data-value', ps.stamina);
          }
        }
        
        // 更新物品栏
        if (Array.isArray(ps.inventory)) {
          const inventoryGrid = document.getElementById('inventoryGrid');
          if (inventoryGrid) {
            inventoryGrid.innerHTML = ''; // 清空现有
            
            const getItemIcon = (type) => {
              switch(type) {
                case 'weapon': return '🗡️';
                case 'armor': return '🛡️';
                case 'consumable': return '🧪';
                case 'quest': return '📜';
                case 'misc': return '🎒';
                default: return '📦';
              }
            };
            
            // 渲染现有物品
            ps.inventory.forEach(item => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'inventory-slot btn-reset focus-ring';
              btn.setAttribute('aria-label', `物品：${item.name} x${item.quantity}`);
              btn.title = `${item.name}\n${item.description || ''}\n数量: ${item.quantity}`;
              btn.textContent = getItemIcon(item.type);
              
              btn.addEventListener('click', () => {
                if (!window.gameState.isProcessing) {
                  processInput(`检查 ${item.name}`);
                }
              });
              
              if (item.quantity > 1) {
                const qtyBadge = document.createElement('span');
                qtyBadge.className = 'item-quantity';
                qtyBadge.textContent = item.quantity;
                qtyBadge.style.position = 'absolute';
                qtyBadge.style.bottom = '2px';
                qtyBadge.style.right = '4px';
                qtyBadge.style.fontSize = '10px';
                qtyBadge.style.color = '#fff';
                qtyBadge.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
                btn.style.position = 'relative';
                btn.appendChild(qtyBadge);
              }
              
              inventoryGrid.appendChild(btn);
            });
            
            // 填充空槽位 (假设一共8个槽位)
            const emptySlots = Math.max(0, 8 - ps.inventory.length);
            for (let i = 0; i < emptySlots; i++) {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'inventory-slot btn-reset focus-ring empty';
              btn.setAttribute('aria-label', '空槽位');
              btn.textContent = '+';
              inventoryGrid.appendChild(btn);
            }
            
            const summaryInventory = document.getElementById('summaryInventory');
            if (summaryInventory) {
              summaryInventory.textContent = `${ps.inventory.length} 件`;
            }
          }
        }

        // 更新任务日志
        if (Array.isArray(ps.quests)) {
          const questList = document.getElementById('questList');
          if (questList) {
            questList.innerHTML = ''; // 清空现有
            
            ps.quests.forEach(quest => {
              const div = document.createElement('div');
              div.className = `quest-item ${quest.status}`;
              
              const statusText = quest.status === 'active' ? '进行中' : quest.status === 'completed' ? '已完成' : '已失败';
              
              div.innerHTML = `
                <div class="quest-title">
                  <span>${quest.title}</span>
                  <span class="quest-status ${quest.status}">${statusText}</span>
                </div>
                <div class="quest-desc">${quest.description || '无详细描述'}</div>
              `;
              questList.appendChild(div);
            });

            if (ps.quests.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'quest-desc';
              empty.style.textAlign = 'center';
              empty.style.padding = '10px 0';
              empty.textContent = '暂无任务';
              questList.appendChild(empty);
            }
            
            const summaryQuests = document.getElementById('summaryQuests');
            if (summaryQuests) {
              const activeCount = ps.quests.filter(q => q.status === 'active').length;
              summaryQuests.textContent = `${activeCount} 进行中`;
            }
          }
        }
      }

      // 更新 NPC 名单
      if (Array.isArray(state.presentNPCs)) {
        const roster = document.getElementById('npcRoster');
        if (roster) {
          const getMoodEmoji = (mood) => {
            const emojiMap = {
              happy: '😊', calm: '😐', curious: '🤔', friendly: '🙂',
              tired: '😴', angry: '😠',
            };
            return emojiMap[mood] || '😐';
          };
          
          roster.innerHTML = state.presentNPCs.length === 0
            ? '<div class="quest-desc" style="text-align:center;padding:10px 0;">当前无 NPC</div>'
            : state.presentNPCs.map(npc => `
                <div class="quest-item">
                  <div class="quest-title">
                    <span>${getMoodEmoji(npc.mood)} ${escapeHtml(npc.name)}</span>
                    <span class="quest-status ${npc.disposition}">${dispositionLabel(npc.disposition)}</span>
                  </div>
                  <div class="quest-desc">${escapeHtml(npc.currentActivity || '—')}</div>
                </div>`).join('');
          const summaryNPCs = document.getElementById('summaryNPCs');
          if (summaryNPCs) summaryNPCs.textContent = state.presentNPCs.length ? `${state.presentNPCs.length} 人` : '';
        }
      }

      // 更新活跃剧情
      if (Array.isArray(state.activePlots)) {
        const plotList = document.getElementById('plotList');
        if (plotList) {
          plotList.innerHTML = state.activePlots.length === 0
            ? '<div class="quest-desc" style="text-align:center;padding:10px 0;">暂无活跃剧情</div>'
            : state.activePlots.map(p => `
                <div class="quest-item ${p.status === 'active' ? '' : 'completed'}">
                  <div class="quest-title">
                    <span>${escapeHtml(p.name)}</span>
                    <span class="quest-status ${p.status === 'active' ? 'active' : 'completed'}">${plotStatusLabel(p.status)}</span>
                  </div>
                  <div class="quest-desc">${escapeHtml(p.description || '')}</div>
                </div>`).join('');
          const summaryPlots = document.getElementById('summaryPlots');
          if (summaryPlots) {
            const activeCount = state.activePlots.filter(p => p.status === 'active').length;
            summaryPlots.textContent = activeCount ? `${activeCount} 进行中` : '';
          }
        }
      }

      // 更新游戏内时间
      const metaWorldTime = document.getElementById('metaWorldTime');
      if (metaWorldTime) {
        if (state.worldTime) {
          const wt = state.worldTime;
          const periodMap = {
            dawn: '黎明', morning: '清晨', noon: '正午', afternoon: '下午',
            dusk: '黄昏', evening: '傍晚', night: '夜晚', midnight: '深夜',
          };
          metaWorldTime.textContent = `⏱️ 第${wt.day}天 · ${periodMap[wt.period] || wt.period}`;
        } else {
          metaWorldTime.textContent = `⏱️ 第 ${window.gameState.turnCount} 回合`;
        }
      }
    }

    // 添加叙事内容
    function addNarrative(content, isPlayer = false) {
      const container = document.querySelector('.story-container');
      const block = document.createElement('article');
      block.className = 'narrative-block';
      block.style.animation = 'fadeInUp 0.6s ease-out';

      window.narrativeHistory.push({
        content,
        isPlayer,
        time: new Date(),
      });

      if (isPlayer) {
        block.innerHTML = `<div class="narrative-text" style="font-style: italic; opacity: 0.8;"><p>💭 ${escapeHtml(content)}</p></div>`;
      } else {
        block.innerHTML = `<div class="narrative-text"><p>${escapeHtml(content).replace(/\n/g, '</p><p>')}</p></div>`;
      }

      // 插入到选择卡片之前
      const choicesGrid = container.querySelector('.choices-grid');
      container.insertBefore(block, choicesGrid);

      // 滚动到底部
      block.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    

// Expose functions to window
window.loadGameState = loadGameState;
window.updateUI = updateUI;
window.addNarrative = addNarrative;
