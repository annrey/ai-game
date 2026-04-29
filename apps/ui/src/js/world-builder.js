/**
 * 世界构建器 (World Builder)
 *
 * 深度可视化世界编辑系统：
 * - 交互式地图编辑器
 * - 角色创建器（属性雷达图）
 * - 派系关系图
 * - 任务链编辑器
 * - 时间线可视化
 */

// ============ 世界构建器状态 ============
let worldBuilderState = {
  activeTab: 'overview',
  worldData: null,
  selectedLocation: null,
  selectedCharacter: null,
  selectedFaction: null,
  mapZoom: 1,
  mapOffset: { x: 0, y: 0 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },
};

// ============ 初始化 ============
function initWorldBuilder() {
  setupWorldBuilderTabs();
  setupMapEditor();
  setupCharacterCreator();
  setupFactionEditor();
  setupQuestEditor();
  setupTimelineEditor();

  const navOpenWorldBuilder = document.getElementById('navOpenWorldBuilder');
  const openWorldBuilder = document.getElementById('openWorldBuilder');
  const closeWorldBuilder = document.getElementById('closeWorldBuilder');

  if (navOpenWorldBuilder) navOpenWorldBuilder.addEventListener('click', openWorldBuilderDialog);
  if (openWorldBuilder) openWorldBuilder.addEventListener('click', openWorldBuilderDialog);
  if (closeWorldBuilder) closeWorldBuilder.addEventListener('click', closeWorldBuilderDialog);
}

// ============ 对话框控制 ============
function openWorldBuilderDialog() {
  const dialog = document.getElementById('worldBuilderDialog');
  if (!dialog) return;

  if (!worldBuilderState.worldData) {
    createNewWorld();
  }

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  renderWorldOverview();
}

function closeWorldBuilderDialog() {
  const dialog = document.getElementById('worldBuilderDialog');
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

// ============ 标签页切换 ============
function setupWorldBuilderTabs() {
  document.querySelectorAll('.wb-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.wbTab;
      switchWorldBuilderTab(tabName);
    });
  });
}

function switchWorldBuilderTab(tabName) {
  worldBuilderState.activeTab = tabName;

  document.querySelectorAll('.wb-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.wbTab === tabName);
  });

  document.querySelectorAll('.wb-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.wbPanel === tabName);
  });

  switch (tabName) {
    case 'overview':
      renderWorldOverview();
      break;
    case 'map':
      renderMapEditor();
      break;
    case 'characters':
      renderCharacterList();
      break;
    case 'factions':
      renderFactionGraph();
      break;
    case 'quests':
      renderQuestTree();
      break;
    case 'timeline':
      renderTimeline();
      break;
  }
}

// ============ 世界概览 ============
function createNewWorld() {
  worldBuilderState.worldData = {
    metadata: {
      id: generateId(),
      name: '未命名世界',
      description: '',
      author: '玩家',
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      tags: [],
      genre: '',
      tone: '',
      visibility: 'private',
    },
    settings: {
      world_name: '未命名世界',
      genre: '',
      tone: '',
      conflict: '',
      magic_system: '',
      technology_level: '',
      time_system: {
        day_length_minutes: 1440,
        season_enabled: true,
        seasons: ['春', '夏', '秋', '冬'],
        season_length_days: 90,
        year_length_days: 360,
      },
      economy_system: {
        currency_name: '金币',
        starting_gold: 100,
        inflation_rate: 0,
        trade_routes: [],
      },
      weather_system: {
        climate_type: 'temperate',
        weather_events: [],
        temperature_range: [0, 30],
      },
      custom_rules: [],
    },
    map: {
      locations: [],
      connections: [],
      regions: [],
      default_start_location: '',
      map_style: {
        background_color: '#F0FAF2',
        location_colors: {},
        connection_color: '#288760',
        region_opacity: 0.3,
      },
    },
    characters: [],
    factions: [],
    quests: [],
    timeline: {
      eras: [],
      events: [],
      current_era: '',
      current_year: 1,
      current_season: '春',
      day: 1,
      time_of_day: 'morning',
    },
    rules: [],
    assets: [],
  };
}

function renderWorldOverview() {
  const container = document.getElementById('wbOverviewContent');
  if (!container || !worldBuilderState.worldData) return;

  const { metadata, settings, characters, factions, quests, map } = worldBuilderState.worldData;

  container.innerHTML = `
    <div class="wb-overview-grid">
      <div class="wb-card wb-card-primary">
        <div class="wb-card-header">
          <span class="wb-card-icon">🌍</span>
          <span class="wb-card-title">世界信息</span>
        </div>
        <div class="wb-card-body">
          <div class="wb-form-group">
            <label>世界名称</label>
            <input type="text" class="wb-input" id="wbWorldName" value="${metadata.name}" placeholder="给你的世界起个名字">
          </div>
          <div class="wb-form-group">
            <label>题材</label>
            <select class="wb-select" id="wbGenre">
              <option value="">选择题材</option>
              <option value="fantasy" ${settings.genre === 'fantasy' ? 'selected' : ''}>奇幻</option>
              <option value="scifi" ${settings.genre === 'scifi' ? 'selected' : ''}>科幻</option>
              <option value="wuxia" ${settings.genre === 'wuxia' ? 'selected' : ''}>武侠</option>
              <option value="modern" ${settings.genre === 'modern' ? 'selected' : ''}>现代</option>
              <option value="horror" ${settings.genre === 'horror' ? 'selected' : ''}>恐怖</option>
              <option value="steampunk" ${settings.genre === 'steampunk' ? 'selected' : ''}>蒸汽朋克</option>
            </select>
          </div>
          <div class="wb-form-group">
            <label>氛围</label>
            <input type="text" class="wb-input" id="wbTone" value="${settings.tone}" placeholder="例如：阴郁、明亮、悬疑">
          </div>
          <div class="wb-form-group">
            <label>核心冲突</label>
            <textarea class="wb-textarea" id="wbConflict" placeholder="世界面临什么危机？">${settings.conflict}</textarea>
          </div>
        </div>
      </div>

      <div class="wb-card">
        <div class="wb-card-header">
          <span class="wb-card-icon">📊</span>
          <span class="wb-card-title">世界统计</span>
        </div>
        <div class="wb-card-body">
          <div class="wb-stat-grid">
            <div class="wb-stat-item">
              <div class="wb-stat-value">${map.locations.length}</div>
              <div class="wb-stat-label">地点</div>
            </div>
            <div class="wb-stat-item">
              <div class="wb-stat-value">${characters.length}</div>
              <div class="wb-stat-label">角色</div>
            </div>
            <div class="wb-stat-item">
              <div class="wb-stat-value">${factions.length}</div>
              <div class="wb-stat-label">派系</div>
            </div>
            <div class="wb-stat-item">
              <div class="wb-stat-value">${quests.length}</div>
              <div class="wb-stat-label">任务</div>
            </div>
          </div>
        </div>
      </div>

      <div class="wb-card">
        <div class="wb-card-header">
          <span class="wb-card-icon">⚙️</span>
          <span class="wb-card-title">系统设定</span>
        </div>
        <div class="wb-card-body">
          <div class="wb-form-group">
            <label>货币名称</label>
            <input type="text" class="wb-input" id="wbCurrency" value="${settings.economy_system.currency_name}">
          </div>
          <div class="wb-form-group">
            <label>起始金币</label>
            <input type="number" class="wb-input" id="wbStartingGold" value="${settings.economy_system.starting_gold}">
          </div>
          <div class="wb-form-group">
            <label>气候类型</label>
            <select class="wb-select" id="wbClimate">
              <option value="temperate" ${settings.weather_system.climate_type === 'temperate' ? 'selected' : ''}>温带</option>
              <option value="tropical" ${settings.weather_system.climate_type === 'tropical' ? 'selected' : ''}>热带</option>
              <option value="arid" ${settings.weather_system.climate_type === 'arid' ? 'selected' : ''}>干旱</option>
              <option value="polar" ${settings.weather_system.climate_type === 'polar' ? 'selected' : ''}>极地</option>
            </select>
          </div>
        </div>
      </div>

      <div class="wb-card wb-card-wide">
        <div class="wb-card-header">
          <span class="wb-card-icon">📜</span>
          <span class="wb-card-title">世界描述</span>
        </div>
        <div class="wb-card-body">
          <textarea class="wb-textarea" id="wbDescription" rows="6" placeholder="详细描述你的世界...">${metadata.description}</textarea>
        </div>
      </div>
    </div>

    <div class="wb-actions-bar">
      <button type="button" class="wb-btn wb-btn-secondary" id="wbExport">📤 导出</button>
      <button type="button" class="wb-btn wb-btn-secondary" id="wbImport">📥 导入</button>
      <button type="button" class="wb-btn wb-btn-primary" id="wbSaveWorld">💾 保存世界</button>
      <button type="button" class="wb-btn wb-btn-success" id="wbPlayWorld">🎮 开始冒险</button>
    </div>
  `;

  // 绑定事件
  document.getElementById('wbSaveWorld')?.addEventListener('click', saveWorld);
  document.getElementById('wbPlayWorld')?.addEventListener('click', playWorld);
  document.getElementById('wbExport')?.addEventListener('click', exportWorld);
  document.getElementById('wbImport')?.addEventListener('click', importWorld);
}

// ============ 地图编辑器 ============
function setupMapEditor() {
  const canvas = document.getElementById('wbMapCanvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', handleMapMouseDown);
  canvas.addEventListener('mousemove', handleMapMouseMove);
  canvas.addEventListener('mouseup', handleMapMouseUp);
  canvas.addEventListener('wheel', handleMapWheel);
}

function renderMapEditor() {
  const canvas = document.getElementById('wbMapCanvas');
  if (!canvas || !worldBuilderState.worldData) return;

  const ctx = canvas.getContext('2d');
  const { map } = worldBuilderState.worldData;

  // 设置画布大小
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // 清空画布
  ctx.fillStyle = map.map_style.background_color || '#F0FAF2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制网格
  drawMapGrid(ctx, canvas.width, canvas.height);

  // 绘制连接
  map.connections.forEach((conn) => {
    const from = map.locations.find((l) => l.id === conn.from_location);
    const to = map.locations.find((l) => l.id === conn.to_location);
    if (from && to) {
      drawConnection(ctx, from, to, conn, map.map_style.connection_color);
    }
  });

  // 绘制地点
  map.locations.forEach((location) => {
    drawLocation(ctx, location, map.map_style);
  });

  // 更新地点列表
  updateLocationList();
}

function drawMapGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(40, 135, 96, 0.08)';
  ctx.lineWidth = 1;
  const gridSize = 40 * worldBuilderState.mapZoom;

  for (let x = worldBuilderState.mapOffset.x % gridSize; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = worldBuilderState.mapOffset.y % gridSize; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawConnection(ctx, from, to, conn, color) {
  const zoom = worldBuilderState.mapZoom;
  const offset = worldBuilderState.mapOffset;

  const x1 = from.coordinates.x * zoom + offset.x;
  const y1 = from.coordinates.y * zoom + offset.y;
  const x2 = to.coordinates.x * zoom + offset.x;
  const y2 = to.coordinates.y * zoom + offset.y;

  ctx.strokeStyle = color || '#288760';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;

  if (conn.connection_type === 'portal') {
    ctx.setLineDash([5, 5]);
  } else if (conn.connection_type === 'secret') {
    ctx.setLineDash([2, 8]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawLocation(ctx, location, style) {
  const zoom = worldBuilderState.mapZoom;
  const offset = worldBuilderState.mapOffset;

  const x = location.coordinates.x * zoom + offset.x;
  const y = location.coordinates.y * zoom + offset.y;
  const radius = (location.size === 'large' ? 20 : location.size === 'small' ? 10 : 14) * zoom;

  const typeKey = location.location_type?.toLowerCase() || 'settlement';
  const color = style.location_colors[typeKey] || '#5CAB7C';

  // 绘制地点圆圈
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // 边框
  ctx.strokeStyle = '#1A5A40';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 选中高亮
  if (worldBuilderState.selectedLocation === location.id) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 危险度指示器
  if (location.danger_level > 5) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 0, 0, ${location.danger_level / 10})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 标签
  ctx.fillStyle = '#1A5A40';
  ctx.font = `${12 * zoom}px 'Crimson Text', serif`;
  ctx.textAlign = 'center';
  ctx.fillText(location.name, x, y + radius + 16 * zoom);
}

function handleMapMouseDown(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - worldBuilderState.mapOffset.x) / worldBuilderState.mapZoom;
  const y = (e.clientY - rect.top - worldBuilderState.mapOffset.y) / worldBuilderState.mapZoom;

  // 检查是否点击了地点
  const clickedLocation = worldBuilderState.worldData?.map.locations.find((l) => {
    const dx = l.coordinates.x - x;
    const dy = l.coordinates.y - y;
    return Math.sqrt(dx * dx + dy * dy) < 20;
  });

  if (clickedLocation) {
    worldBuilderState.selectedLocation = clickedLocation.id;
    showLocationEditor(clickedLocation);
  } else {
    worldBuilderState.isDragging = true;
    worldBuilderState.dragStart = { x: e.clientX, y: e.clientY };
  }

  renderMapEditor();
}

function handleMapMouseMove(e) {
  if (!worldBuilderState.isDragging) return;

  const dx = e.clientX - worldBuilderState.dragStart.x;
  const dy = e.clientY - worldBuilderState.dragStart.y;

  worldBuilderState.mapOffset.x += dx;
  worldBuilderState.mapOffset.y += dy;
  worldBuilderState.dragStart = { x: e.clientX, y: e.clientY };

  renderMapEditor();
}

function handleMapMouseUp() {
  worldBuilderState.isDragging = false;
}

function handleMapWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  worldBuilderState.mapZoom = Math.max(0.3, Math.min(3, worldBuilderState.mapZoom * delta));
  renderMapEditor();
}

function showLocationEditor(location) {
  const panel = document.getElementById('wbLocationEditor');
  if (!panel) return;

  panel.innerHTML = `
    <div class="wb-editor-header">
      <h4>📍 ${location.name}</h4>
      <button class="wb-btn-icon" onclick="deleteLocation('${location.id}')">🗑️</button>
    </div>
    <div class="wb-editor-body">
      <div class="wb-form-group">
        <label>名称</label>
        <input type="text" class="wb-input" id="locName" value="${location.name}">
      </div>
      <div class="wb-form-group">
        <label>类型</label>
        <select class="wb-select" id="locType">
          <option value="settlement" ${location.location_type === 'settlement' ? 'selected' : ''}>聚落</option>
          <option value="dungeon" ${location.location_type === 'dungeon' ? 'selected' : ''}>地牢</option>
          <option value="wilderness" ${location.location_type === 'wilderness' ? 'selected' : ''}>野外</option>
          <option value="landmark" ${location.location_type === 'landmark' ? 'selected' : ''}>地标</option>
          <option value="shop" ${location.location_type === 'shop' ? 'selected' : ''}>商店</option>
          <option value="tavern" ${location.location_type === 'tavern' ? 'selected' : ''}>酒馆</option>
        </select>
      </div>
      <div class="wb-form-group">
        <label>描述</label>
        <textarea class="wb-textarea" id="locDesc" rows="3">${location.description}</textarea>
      </div>
      <div class="wb-form-group">
        <label>危险度 (${location.danger_level}/10)</label>
        <input type="range" class="wb-range" id="locDanger" min="1" max="10" value="${location.danger_level}">
      </div>
      <button class="wb-btn wb-btn-primary" onclick="saveLocationEdit('${location.id}')">保存</button>
    </div>
  `;
  panel.style.display = 'block';
}

function addNewLocation() {
  if (!worldBuilderState.worldData) return;

  const id = generateId();
  const newLocation = {
    id,
    name: '新地点',
    description: '',
    location_type: 'settlement',
    terrain: 'plains',
    coordinates: { x: 200, y: 200 },
    size: 'medium',
    danger_level: 1,
    resources: [],
    npcs: [],
    points_of_interest: [],
    weather_override: null,
    is_hidden: false,
    discovery_requirements: [],
  };

  worldBuilderState.worldData.map.locations.push(newLocation);
  worldBuilderState.selectedLocation = id;
  renderMapEditor();
  showLocationEditor(newLocation);
}

// ============ 角色创建器 ============
function setupCharacterCreator() {
  // 初始化角色创建器事件
}

function renderCharacterList() {
  const container = document.getElementById('wbCharacterList');
  if (!container || !worldBuilderState.worldData) return;

  const { characters } = worldBuilderState.worldData;

  let html = `
    <div class="wb-toolbar">
      <button class="wb-btn wb-btn-primary" onclick="addNewCharacter()">➕ 新建角色</button>
      <button class="wb-btn wb-btn-secondary" onclick="importCharacter()">📥 导入</button>
    </div>
    <div class="wb-character-grid">
  `;

  characters.forEach((char) => {
    html += `
      <div class="wb-character-card ${char.is_player ? 'is-player' : ''}" onclick="editCharacter('${char.id}')">
        <div class="wb-char-avatar">${getCharacterEmoji(char)}</div>
        <div class="wb-char-info">
          <div class="wb-char-name">${char.name} ${char.is_player ? '(主角)' : ''}</div>
          <div class="wb-char-role">${char.character_type || '人类'}</div>
          <div class="wb-char-power">战力: ${calculatePowerLevel(char)}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

function getCharacterEmoji(char) {
  const typeEmojis = {
    human: '👤', elf: '🧝', dwarf: '⛏️', orc: '👹',
    beast: '🐺', undead: '💀', construct: '🤖',
    spirit: '👻', dragon: '🐉',
  };
  return typeEmojis[char.character_type?.toLowerCase()] || '👤';
}

function calculatePowerLevel(char) {
  const attrs = char.attributes || {};
  const sum = (attrs.strength || 10) + (attrs.agility || 10) +
              (attrs.intelligence || 10) + (attrs.charisma || 10) +
              (attrs.endurance || 10);
  return Math.floor(sum / 5);
}

function addNewCharacter() {
  if (!worldBuilderState.worldData) return;

  const id = generateId();
  const newChar = {
    id,
    name: '新角色',
    title: '',
    character_type: 'human',
    appearance: {
      gender: 'unspecified',
      age: 25,
      height_cm: 170,
      build: 'average',
      skin_color: '',
      hair_color: '',
      hair_style: '',
      eye_color: '',
      facial_features: '',
      distinguishing_marks: [],
      clothing_style: '',
      portrait_description: '',
    },
    attributes: {
      strength: 10, agility: 10, intelligence: 10, charisma: 10,
      endurance: 10, luck: 10, magic: 10, perception: 10,
    },
    skills: [],
    background: {
      origin: '', upbringing: '', pivotal_event: '', motivation: '',
      fears: [], desires: [], secrets: [],
    },
    personality: {
      traits: [], alignment: 'neutral', temperament: 'balanced',
      speech_style: '', decision_making: '',
    },
    inventory: { max_slots: 20, gold: 0, items: [] },
    relationships: [],
    stats: {
      health: 100, max_health: 100, mana: 50, max_mana: 50,
      stamina: 100, max_stamina: 100, experience: 0, level: 1,
      reputation: 0, status_effects: [],
    },
    is_player: false,
    is_hostile: false,
  };

  worldBuilderState.worldData.characters.push(newChar);
  renderCharacterList();
  editCharacter(id);
}

function editCharacter(charId) {
  const char = worldBuilderState.worldData?.characters.find((c) => c.id === charId);
  if (!char) return;

  worldBuilderState.selectedCharacter = charId;

  const container = document.getElementById('wbCharacterEditor');
  if (!container) return;

  container.innerHTML = `
    <div class="wb-char-editor">
      <div class="wb-char-editor-header">
        <div class="wb-char-avatar-large">${getCharacterEmoji(char)}</div>
        <div class="wb-char-header-info">
          <input type="text" class="wb-input wb-char-name-input" value="${char.name}" id="charName">
          <select class="wb-select" id="charType">
            <option value="human" ${char.character_type === 'human' ? 'selected' : ''}>人类</option>
            <option value="elf" ${char.character_type === 'elf' ? 'selected' : ''}>精灵</option>
            <option value="dwarf" ${char.character_type === 'dwarf' ? 'selected' : ''}>矮人</option>
            <option value="orc" ${char.character_type === 'orc' ? 'selected' : ''}>兽人</option>
            <option value="beast" ${char.character_type === 'beast' ? 'selected' : ''}>野兽</option>
          </select>
          <label class="wb-checkbox">
            <input type="checkbox" id="charIsPlayer" ${char.is_player ? 'checked' : ''}> 主角
          </label>
        </div>
      </div>

      <div class="wb-char-tabs">
        <button class="wb-char-tab active" data-char-tab="attributes">属性</button>
        <button class="wb-char-tab" data-char-tab="appearance">外观</button>
        <button class="wb-char-tab" data-char-tab="background">背景</button>
        <button class="wb-char-tab" data-char-tab="skills">技能</button>
      </div>

      <div class="wb-char-panel active" data-char-panel="attributes">
        <div class="wb-radar-chart-container">
          <canvas id="charRadarChart" width="300" height="300"></canvas>
        </div>
        <div class="wb-attributes-grid">
          ${renderAttributeSliders(char)}
        </div>
      </div>

      <div class="wb-char-panel" data-char-panel="appearance">
        <div class="wb-form-group"><label>性别</label>
          <select class="wb-select" id="charGender">
            <option value="unspecified">未指定</option>
            <option value="male" ${char.appearance.gender === 'male' ? 'selected' : ''}>男</option>
            <option value="female" ${char.appearance.gender === 'female' ? 'selected' : ''}>女</option>
          </select>
        </div>
        <div class="wb-form-group"><label>年龄</label>
          <input type="number" class="wb-input" id="charAge" value="${char.appearance.age}">
        </div>
        <div class="wb-form-group"><label>身高 (cm)</label>
          <input type="number" class="wb-input" id="charHeight" value="${char.appearance.height_cm}">
        </div>
        <div class="wb-form-group"><label>体型</label>
          <select class="wb-select" id="charBuild">
            <option value="petite">娇小</option>
            <option value="slim" ${char.appearance.build === 'slim' ? 'selected' : ''}>苗条</option>
            <option value="average" ${char.appearance.build === 'average' ? 'selected' : ''}>平均</option>
            <option value="athletic" ${char.appearance.build === 'athletic' ? 'selected' : ''}>运动型</option>
            <option value="muscular" ${char.appearance.build === 'muscular' ? 'selected' : ''}>肌肉型</option>
          </select>
        </div>
        <div class="wb-form-group"><label>发色</label>
          <input type="text" class="wb-input" id="charHairColor" value="${char.appearance.hair_color}">
        </div>
        <div class="wb-form-group"><label>瞳色</label>
          <input type="text" class="wb-input" id="charEyeColor" value="${char.appearance.eye_color}">
        </div>
        <div class="wb-form-group"><label>服装风格</label>
          <input type="text" class="wb-input" id="charClothing" value="${char.appearance.clothing_style}">
        </div>
        <div class="wb-form-group"><label>显著特征</label>
          <textarea class="wb-textarea" id="charFeatures">${char.appearance.distinguishing_marks.join('\n')}</textarea>
        </div>
      </div>

      <div class="wb-char-panel" data-char-panel="background">
        <div class="wb-form-group"><label>出身</label>
          <input type="text" class="wb-input" id="charOrigin" value="${char.background.origin}">
        </div>
        <div class="wb-form-group"><label>成长经历</label>
          <textarea class="wb-textarea" id="charUpbringing">${char.background.upbringing}</textarea>
        </div>
        <div class="wb-form-group"><label>关键事件</label>
          <textarea class="wb-textarea" id="charPivotal">${char.background.pivotal_event}</textarea>
        </div>
        <div class="wb-form-group"><label>动机</label>
          <textarea class="wb-textarea" id="charMotivation">${char.background.motivation}</textarea>
        </div>
      </div>

      <div class="wb-char-panel" data-char-panel="skills">
        <div class="wb-skills-list" id="charSkillsList">
          ${renderSkillsList(char)}
        </div>
        <button class="wb-btn wb-btn-secondary" onclick="addSkillToCharacter('${char.id}')">➕ 添加技能</button>
      </div>

      <div class="wb-editor-actions">
        <button class="wb-btn wb-btn-primary" onclick="saveCharacter('${char.id}')">💾 保存角色</button>
        <button class="wb-btn wb-btn-danger" onclick="deleteCharacter('${char.id}')">🗑️ 删除</button>
      </div>
    </div>
  `;

  // 绑定标签页
  container.querySelectorAll('.wb-char-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.wb-char-tab').forEach((t) => t.classList.remove('active'));
      container.querySelectorAll('.wb-char-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector(`[data-char-panel="${tab.dataset.charTab}"]`).classList.add('active');
    });
  });

  // 绘制雷达图
  setTimeout(() => drawRadarChart(char), 100);

  // 绑定属性滑块
  container.querySelectorAll('.wb-attr-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      updateRadarChart(char);
    });
  });
}

function renderAttributeSliders(char) {
  const attrs = char.attributes || {};
  const attrNames = {
    strength: '力量', agility: '敏捷', intelligence: '智力', charisma: '魅力',
    endurance: '耐力', luck: '幸运', magic: '魔力', perception: '感知',
  };

  return Object.entries(attrNames).map(([key, label]) => `
    <div class="wb-attr-item">
      <label>${label}</label>
      <div class="wb-attr-control">
        <input type="range" class="wb-attr-slider" id="attr_${key}" min="1" max="20" value="${attrs[key] || 10}">
        <span class="wb-attr-value">${attrs[key] || 10}</span>
      </div>
    </div>
  `).join('');
}

function drawRadarChart(char) {
  const canvas = document.getElementById('charRadarChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 100;

  const attrs = char.attributes || {};
  const values = [
    attrs.strength || 10,
    attrs.agility || 10,
    attrs.intelligence || 10,
    attrs.charisma || 10,
    attrs.endurance || 10,
    attrs.luck || 10,
    attrs.magic || 10,
    attrs.perception || 10,
  ];
  const labels = ['力量', '敏捷', '智力', '魅力', '耐力', '幸运', '魔力', '感知'];
  const count = values.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制网格
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(92, 171, 124, 0.2)';
    ctx.lineWidth = 1;
    for (let j = 0; j < count; j++) {
      const angle = (Math.PI * 2 / count) * j - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius * i / 5);
      const y = centerY + Math.sin(angle) * (radius * i / 5);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 绘制轴线
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(92, 171, 124, 0.3)';
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();

    // 标签
    const labelX = centerX + Math.cos(angle) * (radius + 20);
    const labelY = centerY + Math.sin(angle) * (radius + 20);
    ctx.fillStyle = '#1A5A40';
    ctx.font = '12px "Crimson Text", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], labelX, labelY);
  }

  // 绘制数据
  ctx.beginPath();
  ctx.fillStyle = 'rgba(92, 171, 124, 0.4)';
  ctx.strokeStyle = '#5CAB7C';
  ctx.lineWidth = 2;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
    const value = values[i] / 20;
    const x = centerX + Math.cos(angle) * (radius * value);
    const y = centerY + Math.sin(angle) * (radius * value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function updateRadarChart(char) {
  const attrs = ['strength', 'agility', 'intelligence', 'charisma', 'endurance', 'luck', 'magic', 'perception'];
  attrs.forEach((attr) => {
    const slider = document.getElementById(`attr_${attr}`);
    if (slider) {
      char.attributes[attr] = parseInt(slider.value);
      slider.nextElementSibling.textContent = slider.value;
    }
  });
  drawRadarChart(char);
}

function renderSkillsList(char) {
  if (!char.skills || char.skills.length === 0) {
    return '<div class="wb-empty-state">暂无技能</div>';
  }

  return char.skills.map((skill) => `
    <div class="wb-skill-item">
      <div class="wb-skill-name">${skill.name}</div>
      <div class="wb-skill-level">
        <div class="wb-skill-bar">
          <div class="wb-skill-fill" style="width: ${(skill.level / skill.max_level) * 100}%"></div>
        </div>
        <span>Lv.${skill.level}/${skill.max_level}</span>
      </div>
    </div>
  `).join('');
}

// ============ 派系图 ============
function setupFactionEditor() {}

function renderFactionGraph() {
  const container = document.getElementById('wbFactionGraph');
  if (!container || !worldBuilderState.worldData) return;

  const { factions } = worldBuilderState.worldData;

  let html = `
    <div class="wb-toolbar">
      <button class="wb-btn wb-btn-primary" onclick="addNewFaction()">➕ 新建派系</button>
    </div>
  `;

  if (factions.length === 0) {
    html += '<div class="wb-empty-state">还没有派系，创建一个吧！</div>';
  } else {
    html += '<div class="wb-faction-list">';
    factions.forEach((faction) => {
      html += `
        <div class="wb-faction-card" onclick="editFaction('${faction.id}')">
          <div class="wb-faction-icon">${getFactionIcon(faction)}</div>
          <div class="wb-faction-info">
            <div class="wb-faction-name">${faction.name}</div>
            <div class="wb-faction-type">${faction.faction_type || '组织'}</div>
            <div class="wb-faction-members">成员: ${faction.members?.length || 0}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function getFactionIcon(faction) {
  const icons = {
    kingdom: '👑', empire: '🏛️', guild: '⚒️', cult: '🔮',
    tribe: '🏕️', corporation: '🏢', rebelgroup: '⚔️',
  };
  return icons[faction.faction_type?.toLowerCase()] || '🏛️';
}

// ============ 任务树 ============
function setupQuestEditor() {}

function renderQuestTree() {
  const container = document.getElementById('wbQuestTree');
  if (!container || !worldBuilderState.worldData) return;

  const { quests } = worldBuilderState.worldData;

  let html = `
    <div class="wb-toolbar">
      <button class="wb-btn wb-btn-primary" onclick="addNewQuest()">➕ 新建任务</button>
    </div>
  `;

  if (quests.length === 0) {
    html += '<div class="wb-empty-state">还没有任务，创建一个吧！</div>';
  } else {
    html += '<div class="wb-quest-list">';
    quests.forEach((quest) => {
      const typeColors = {
        main: '#FF6B6B', side: '#4ECDC4', daily: '#95E1D3',
        event: '#FFD93D', bounty: '#FF8C42',
      };
      const color = typeColors[quest.quest_type] || '#5CAB7C';

      html += `
        <div class="wb-quest-card" style="border-left-color: ${color}">
          <div class="wb-quest-header">
            <span class="wb-quest-type" style="background: ${color}">${quest.quest_type || '任务'}</span>
            <span class="wb-quest-name">${quest.name}</span>
          </div>
          <div class="wb-quest-desc">${quest.description}</div>
          <div class="wb-quest-meta">
            <span>目标: ${quest.objectives?.length || 0}</span>
            <span>奖励: ${quest.rewards?.experience || 0} EXP</span>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============ 时间线 ============
function setupTimelineEditor() {}

function renderTimeline() {
  const container = document.getElementById('wbTimeline');
  if (!container || !worldBuilderState.worldData) return;

  const { timeline } = worldBuilderState.worldData;

  let html = `
    <div class="wb-toolbar">
      <button class="wb-btn wb-btn-primary" onclick="addNewEra()">➕ 新时期</button>
      <button class="wb-btn wb-btn-secondary" onclick="addNewEvent()">📅 新事件</button>
    </div>
  `;

  if (timeline.eras.length === 0 && timeline.events.length === 0) {
    html += '<div class="wb-empty-state">时间线还是空的</div>';
  } else {
    html += '<div class="wb-timeline">';

    timeline.eras.forEach((era) => {
      html += `
        <div class="wb-timeline-era">
          <div class="wb-era-marker"></div>
          <div class="wb-era-content">
            <div class="wb-era-name">${era.name}</div>
            <div class="wb-era-years">${era.start_year}年 - ${era.end_year || '至今'}</div>
            <div class="wb-era-desc">${era.description}</div>
          </div>
        </div>
      `;
    });

    timeline.events.forEach((event) => {
      html += `
        <div class="wb-timeline-event">
          <div class="wb-event-marker"></div>
          <div class="wb-event-content">
            <div class="wb-event-name">${event.name}</div>
            <div class="wb-event-time">${event.year}年 ${event.season}</div>
            <div class="wb-event-desc">${event.description}</div>
          </div>
        </div>
      `;
    });

    html += '</div>';
  }

  container.innerHTML = html;
}

// ============ 工具函数 ============
function generateId() {
  return 'wb_' + Math.random().toString(36).substr(2, 9);
}

function saveWorld() {
  if (!worldBuilderState.worldData) return;
  worldBuilderState.worldData.metadata.updated_at = Date.now();

  const blob = new Blob([JSON.stringify(worldBuilderState.worldData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${worldBuilderState.worldData.metadata.name}.world.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportWorld() {
  saveWorld();
}

function importWorld() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        worldBuilderState.worldData = JSON.parse(event.target.result);
        renderWorldOverview();
        alert('世界导入成功！');
      } catch (err) {
        alert('导入失败：' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function playWorld() {
  if (!worldBuilderState.worldData) return;

  const world = worldBuilderState.worldData;
  const player = world.characters.find((c) => c.is_player);

  if (!player) {
    alert('请至少设置一个主角角色！');
    switchWorldBuilderTab('characters');
    return;
  }

  if (world.map.locations.length === 0) {
    alert('请至少创建一个地点！');
    switchWorldBuilderTab('map');
    return;
  }

  // 构建创世数据
  const payload = {
    world: {
      worldName: world.settings.world_name,
      genre: world.settings.genre,
      tone: world.settings.tone,
      conflict: world.settings.conflict,
      magicSystem: world.settings.magic_system,
      technologyLevel: world.settings.technology_level,
      factions: world.factions.map((f) => f.name).join('、'),
      notableLocations: world.map.locations.map((l) => l.name).join('、'),
      worldHistory: world.timeline.eras.map((e) => e.description).join('\n'),
      worldRules: world.settings.custom_rules.join('\n'),
    },
    character: {
      playerName: player.name,
      playerRole: player.title || '冒险者',
      playerBackground: player.background?.upbringing || '',
      appearance: `${player.appearance?.hair_color}发，${player.appearance?.eye_color}瞳`,
      personality: player.personality?.traits?.join('、'),
      goals: player.background?.motivation,
      skills: player.skills?.map((s) => s.name).join('、'),
      statsPreset: 'custom',
      customStats: {
        strength: player.attributes?.strength || 10,
        agility: player.attributes?.agility || 10,
        intelligence: player.attributes?.intelligence || 10,
        charisma: player.attributes?.charisma || 10,
        endurance: player.attributes?.endurance || 10,
        luck: player.attributes?.luck || 10,
      },
    },
    start: {
      location: world.map.default_start_location || world.map.locations[0]?.name,
      weather: world.settings.weather_system?.climate_type === 'temperate' ? '晴朗' : '阴天',
      locationDescription: world.map.locations[0]?.description,
    },
  };

  try {
    const r = await safeApi('/creator/bootstrap', {
      method: 'POST',
      body: payload,
    });

    closeWorldBuilderDialog();
    addNarrative(`🌍 ${r.data?.message || '世界创建成功！'}`, false);
    await loadGameState();

    const quickGameMode = document.getElementById('quickGameMode');
    if (quickGameMode) quickGameMode.value = 'creator-mode';
  } catch (e) {
    console.error('启动世界失败:', e);
    alert('启动世界失败: ' + e.message);
  }
}

// ============ 初始化 ============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorldBuilder);
} else {
  initWorldBuilder();
}

// 暴露全局函数
window.openWorldBuilderDialog = openWorldBuilderDialog;
window.closeWorldBuilderDialog = closeWorldBuilderDialog;
window.switchWorldBuilderTab = switchWorldBuilderTab;
window.addNewLocation = addNewLocation;
window.addNewCharacter = addNewCharacter;
window.editCharacter = editCharacter;
window.saveCharacter = saveCharacter;
window.deleteCharacter = deleteCharacter;
window.addNewFaction = addNewFaction;
window.addNewQuest = addNewQuest;
window.addNewEra = addNewEra;
window.addNewEvent = addNewEvent;
