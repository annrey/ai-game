/**
 * 创世模式前端逻辑
 * 处理世界和角色的创建、预设加载
 */

let selectedPreset = null;
let creatorPresetData = {};

function openCreatorDialog() {
  const dialog = document.getElementById('creatorDialog');
  if (!dialog) return;
  switchCreatorTab('presets');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeCreatorDialog() {
  const dialog = document.getElementById('creatorDialog');
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function switchCreatorTab(tabName) {
  document.querySelectorAll('.creator-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.creatorTab === tabName);
  });
  document.querySelectorAll('.creator-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.creatorPanel === tabName);
  });
}

function selectPresetCard(card) {
  document.querySelectorAll('.creator-preset-card').forEach((c) => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  selectedPreset = card.dataset.preset;
}

async function loadPresetToForm() {
  if (!selectedPreset) {
    alert('请先选择一个预设模板');
    return;
  }

  if (selectedPreset === 'custom') {
    switchCreatorTab('world');
    return;
  }

  try {
    const res = await fetch(`${window.API_BASE}/api/creator/presets/${selectedPreset}`);
    const data = await res.json();
    if (!data.success) {
      alert(data.error || '加载预设失败');
      return;
    }

    const preset = data.data;
    creatorPresetData = preset;

    // 填充世界设定
    const worldFields = {
      crWorldName: preset.world?.worldName,
      crGenre: preset.world?.genre,
      crTone: preset.world?.tone,
      crConflict: preset.world?.conflict,
      crMagicSystem: preset.world?.magicSystem,
      crTechnology: preset.world?.technologyLevel,
      crFactions: preset.world?.factions,
      crLocations: preset.world?.notableLocations,
      crHistory: preset.world?.worldHistory,
      crWorldRules: preset.world?.worldRules,
    };

    Object.entries(worldFields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    });

    // 填充角色设定
    const charFields = {
      crPlayerRole: preset.character?.playerRole,
      crPlayerBackground: preset.character?.playerBackground,
      crStatsPreset: preset.character?.statsPreset || 'balanced',
    };

    Object.entries(charFields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    });

    // 填充起点设定
    const startFields = {
      crLocation: preset.start?.location,
      crWeather: preset.start?.weather,
      crTimeOfDay: preset.start?.timeOfDay,
      crOpeningScene: preset.start?.openingScene || preset.start?.locationDescription,
      crLocationDesc: preset.start?.locationDescription,
    };

    Object.entries(startFields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    });

    // 触发属性预设显示
    const statsPreset = document.getElementById('crStatsPreset');
    if (statsPreset) {
      statsPreset.dispatchEvent(new Event('change'));
    }

    switchCreatorTab('world');
  } catch (e) {
    console.error('加载预设失败:', e);
    alert('加载预设失败');
  }
}

async function quickStartCreator() {
  if (!selectedPreset) {
    alert('请先选择一个预设模板');
    return;
  }

  if (selectedPreset === 'custom') {
    switchCreatorTab('world');
    return;
  }

  try {
    const r = await safeApi('/creator/quickstart', {
      method: 'POST',
      body: { presetKey: selectedPreset },
    });

    closeCreatorDialog();
    addNarrative(`🌍 ${r.data?.message || '创世模式已启动'}`, false);
    await loadGameState();

    // 更新游戏模式显示
    const quickGameMode = document.getElementById('quickGameMode');
    if (quickGameMode) quickGameMode.value = 'creator-mode';
  } catch (e) {
    console.error('快速启动失败:', e);
    alert('快速启动失败: ' + e.message);
  }
}

async function createWorldFromForm() {
  const worldName = document.getElementById('crWorldName')?.value?.trim();
  const playerName = document.getElementById('crPlayerName')?.value?.trim();

  if (!worldName) {
    alert('请填写世界名称');
    switchCreatorTab('world');
    return;
  }

  const payload = {
    world: {
      worldName,
      genre: document.getElementById('crGenre')?.value || '',
      tone: document.getElementById('crTone')?.value || '',
      conflict: document.getElementById('crConflict')?.value || '',
      worldRules: document.getElementById('crWorldRules')?.value || '',
      magicSystem: document.getElementById('crMagicSystem')?.value || '',
      technologyLevel: document.getElementById('crTechnology')?.value || '',
      factions: document.getElementById('crFactions')?.value || '',
      notableLocations: document.getElementById('crLocations')?.value || '',
      worldHistory: document.getElementById('crHistory')?.value || '',
    },
    character: {
      playerName: playerName || '冒险者',
      playerRole: document.getElementById('crPlayerRole')?.value || '',
      playerBackground: document.getElementById('crPlayerBackground')?.value || '',
      appearance: document.getElementById('crAppearance')?.value || '',
      personality: document.getElementById('crPersonality')?.value || '',
      goals: document.getElementById('crGoals')?.value || '',
      skills: document.getElementById('crSkills')?.value || '',
      equipment: document.getElementById('crEquipment')?.value || '',
      statsPreset: document.getElementById('crStatsPreset')?.value || 'balanced',
    },
    start: {
      location: document.getElementById('crLocation')?.value || '',
      weather: document.getElementById('crWeather')?.value || '',
      locationDescription: document.getElementById('crLocationDesc')?.value || '',
      startingNPCs: document.getElementById('crStartingNPCs')?.value || '',
      openingScene: document.getElementById('crOpeningScene')?.value || '',
      timeOfDay: document.getElementById('crTimeOfDay')?.value || '',
    },
  };

  // 如果选择了自定义属性
  const statsPreset = document.getElementById('crStatsPreset')?.value;
  if (statsPreset === 'custom') {
    payload.character.customStats = {
      strength: parseInt(document.getElementById('crStatStr')?.value || '12', 10),
      agility: parseInt(document.getElementById('crStatAgi')?.value || '12', 10),
      intelligence: parseInt(document.getElementById('crStatInt')?.value || '12', 10),
      charisma: parseInt(document.getElementById('crStatCha')?.value || '12', 10),
      endurance: parseInt(document.getElementById('crStatEnd')?.value || '12', 10),
      luck: parseInt(document.getElementById('crStatLck')?.value || '12', 10),
    };
  }

  try {
    const r = await safeApi('/creator/bootstrap', {
      method: 'POST',
      body: payload,
    });

    closeCreatorDialog();
    addNarrative(`🌍 ${r.data?.message || `世界「${worldName}」创建成功！`}`, false);
    await loadGameState();

    // 更新游戏模式显示
    const quickGameMode = document.getElementById('quickGameMode');
    if (quickGameMode) quickGameMode.value = 'creator-mode';
  } catch (e) {
    console.error('创建世界失败:', e);
    alert('创建世界失败: ' + e.message);
  }
}

function resetCreatorForm() {
  const fields = [
    'crWorldName', 'crGenre', 'crTone', 'crConflict', 'crMagicSystem',
    'crTechnology', 'crFactions', 'crLocations', 'crHistory', 'crWorldRules',
    'crPlayerName', 'crPlayerRole', 'crAppearance', 'crPersonality',
    'crPlayerBackground', 'crGoals', 'crSkills', 'crEquipment',
    'crLocation', 'crWeather', 'crTimeOfDay', 'crStartingNPCs',
    'crOpeningScene', 'crLocationDesc',
  ];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const statsPreset = document.getElementById('crStatsPreset');
  if (statsPreset) statsPreset.value = 'balanced';

  const customStats = document.getElementById('crCustomStats');
  if (customStats) customStats.style.display = 'none';

  document.querySelectorAll('.creator-preset-card').forEach((c) => {
    c.classList.remove('selected');
  });
  selectedPreset = null;
  creatorPresetData = {};

  switchCreatorTab('presets');
}

// 初始化事件监听
function initCreatorMode() {
  // 标签切换
  document.querySelectorAll('.creator-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchCreatorTab(tab.dataset.creatorTab);
    });
  });

  // 预设卡片选择
  document.querySelectorAll('.creator-preset-card').forEach((card) => {
    card.addEventListener('click', () => selectPresetCard(card));
  });

  // 打开/关闭对话框
  const openCreator = document.getElementById('openCreator');
  const navOpenCreator = document.getElementById('navOpenCreator');
  const closeCreator = document.getElementById('closeCreator');

  if (openCreator) openCreator.addEventListener('click', openCreatorDialog);
  if (navOpenCreator) navOpenCreator.addEventListener('click', openCreatorDialog);
  if (closeCreator) closeCreator.addEventListener('click', closeCreatorDialog);

  // 按钮事件
  const loadPresetBtn = document.getElementById('creatorLoadPreset');
  const quickStartBtn = document.getElementById('creatorQuickStart');
  const createBtn = document.getElementById('creatorCreate');
  const resetBtn = document.getElementById('creatorReset');

  if (loadPresetBtn) loadPresetBtn.addEventListener('click', loadPresetToForm);
  if (quickStartBtn) quickStartBtn.addEventListener('click', quickStartCreator);
  if (createBtn) createBtn.addEventListener('click', createWorldFromForm);
  if (resetBtn) resetBtn.addEventListener('click', resetCreatorForm);

  // 属性预设切换
  const statsPreset = document.getElementById('crStatsPreset');
  if (statsPreset) {
    statsPreset.addEventListener('change', (e) => {
      const customStats = document.getElementById('crCustomStats');
      if (customStats) {
        customStats.style.display = e.target.value === 'custom' ? 'block' : 'none';
      }
    });
  }
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCreatorMode);
} else {
  initCreatorMode();
}

// 导出全局函数
window.openCreatorDialog = openCreatorDialog;
window.closeCreatorDialog = closeCreatorDialog;
window.switchCreatorTab = switchCreatorTab;
