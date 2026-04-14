import './state.js';
import './api.js';
import './settings.js';
import './cot.js';
import './ui-render.js';
import './dialogs.js';
import './core.js';
import './guide.js';


    // 游戏状态
    window.gameState = {
      turnCount: 0,
      isProcessing: false,
    };

    window.narrativeHistory = [];

    window.logHistory = [];

    document.querySelectorAll('.narrative-block').forEach((block) => {
      const text = block.querySelector('.narrative-text')?.textContent?.trim();
      if (!text) return;
      window.narrativeHistory.push({
        content: text,
        isPlayer: false,
        time: new Date(),
      });
    });

    document.querySelectorAll('#logContainer .log-entry').forEach((entry) => {
      const time = entry.querySelector('.log-time')?.textContent?.trim() || '';
      const text = entry.textContent?.replace(time, '').trim() || '';
      if (!text) return;
      window.logHistory.push({ time, text });
    });

    
// 初始化引导系统
    async function initGuideSystem() {
      try {
        const res = await fetch(`${window.API_BASE}/api/guide/progress`);
        if (res.ok) {
          const data = await res.json();
          guideState = { ...guideState, ...data };
          updateGuideUI();
        }
      } catch (e) {
        console.log('引导系统初始化失败，使用默认状态');
      }
    }

    // 更新引导 UI
    function updateGuideUI() {
      const progressText = document.getElementById('guideProgressText');
      const progressBar = document.getElementById('guideProgressBar');
      const guideBrief = document.getElementById('guideBrief');
      const stepTitle = document.getElementById('guideStepTitle');
      const stepDesc = document.getElementById('guideStepDesc');
      const startBtn = document.getElementById('guideStartBtn');
      const nextBtn = document.getElementById('guideNextBtn');
      const hintBtn = document.getElementById('guideHintBtn');
      const skipBtn = document.getElementById('guideSkipBtn');
      const inputContainer = document.getElementById('guideInputContainer');

      if (!progressText || !progressBar) return;

      progressText.textContent = `${guideState.progress}%`;
      progressBar.style.width = `${guideState.progress}%`;

      if (guideState.isCompleted) {
        guideBrief.textContent = '已完成';
        stepTitle.textContent = '引导完成';
        stepDesc.textContent = '恭喜你完成了所有引导步骤！';
        startBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        hintBtn.style.display = 'none';
        skipBtn.style.display = 'none';
        inputContainer.style.display = 'none';
      } else if (guideState.isActive && guideState.currentStep) {
        guideBrief.textContent = '进行中';
        stepTitle.textContent = guideState.currentStep.title || '当前步骤';
        stepDesc.textContent = guideState.currentStep.description || '';
        startBtn.style.display = 'none';
        nextBtn.style.display = 'inline-flex';
        hintBtn.style.display = 'inline-flex';
        skipBtn.style.display = 'inline-flex';
        inputContainer.style.display = 'block';
      } else {
        guideBrief.textContent = '未开始';
        stepTitle.textContent = '未开始';
        stepDesc.textContent = '点击"开始引导"按钮开始';
        startBtn.style.display = 'inline-flex';
        nextBtn.style.display = 'none';
        hintBtn.style.display = 'none';
        skipBtn.style.display = 'none';
        inputContainer.style.display = 'none';
      }
    }

    // 开始引导
    async function startGuide() {
      try {
        const res = await fetch(`${window.API_BASE}/api/guide/step/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId: 'ai-config' }),
        });
        if (res.ok) {
          const data = await res.json();
          guideState = { ...guideState, ...data, isActive: true };
          updateGuideUI();
          updateGuideDialog('你好，冒险者！我是引路人，将引导你开启这段旅程。让我们从配置 AI 服务开始吧！');
        }
      } catch (e) {
        addNarrative('⚠️ 启动引导失败，请重试。', false);
      }
    }

    // 完成引导步骤
    async function completeGuideStep() {
      try {
        const res = await fetch(`${window.API_BASE}/api/guide/step/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId: guideState.currentStep?.id }),
        });
        if (res.ok) {
          const data = await res.json();
          guideState = { ...guideState, ...data };
          updateGuideUI();
          if (data.nextStep) {
            updateGuideDialog(`很好！你完成了"${guideState.currentStep?.title}"。接下来是"${data.nextStep.title}"。`);
          } else {
            updateGuideDialog('恭喜你完成了所有引导步骤！现在你可以自由探索这个世界了！');
          }
        }
      } catch (e) {
        addNarrative('⚠️ 完成步骤失败，请重试。', false);
      }
    }

    // 获取提示
    async function getGuideHint() {
      try {
        const res = await fetch(`${window.API_BASE}/api/guide/hint`);
        if (res.ok) {
          const data = await res.json();
          updateGuideDialog(`💡 提示：${data.hint}`);
        }
      } catch (e) {
        updateGuideDialog('💡 提示：请按照步骤说明操作，或者向我提问。');
      }
    }

    // 跳过引导步骤
    async function skipGuideStep() {
      if (!confirm('确定要跳过当前步骤吗？你可能会错过重要信息。')) return;
      
      try {
        const res = await fetch(`${window.API_BASE}/api/guide/step/skip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId: guideState.currentStep?.id }),
        });
        if (res.ok) {
          const data = await res.json();
          guideState = { ...guideState, ...data };
          updateGuideUI();
          updateGuideDialog('已跳过当前步骤。让我们继续下一步。');
        }
      } catch (e) {
        addNarrative('⚠️ 跳过步骤失败，请重试。', false);
      }
    }

    // 发送引导消息
    async function sendGuideMessage() {
      const input = document.getElementById('guideInput');
      const message = input?.value?.trim();
      if (!message) return;

      try {
        const res = await fetch(`${window.API_BASE}/api/guide/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        if (res.ok) {
          const data = await res.json();
          updateGuideDialog(data.response || '引路人正在思考...');
          if (input) input.value = '';
        }
      } catch (e) {
        updateGuideDialog('⚠️ 发送消息失败，请重试。');
      }
    }

    // 更新引导对话框
    function updateGuideDialog(text) {
      const dialogText = document.getElementById('guideDialogText');
      if (dialogText) {
        dialogText.innerHTML = text.replace(/\n/g, '<br>');
      }
    }

    // 初始化引导系统
    initGuideSystem().catch(console.error);
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeDrawers);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHistoryDialog();
        closeLogDialog();
        closeSettingsDialog();
        closeWorldForgeDialog();
        closeOnboardingDialog();
        closeArchitectureDialog();
        closeDrawers();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) closeDrawers();
    });

    syncBackdropHidden();

    // 初始化
    loadGameState();

    refreshServerConfig()
      .then(() => {
        syncEngineControls();
        const hint = fmtProvidersHint(window.serverConfig?.availability);
        if (hint === '无可用 Provider') {
          addNarrative('⚠️ 没有可用的 AI Provider，请检查配置。', false);
        }
      })
      .catch(() => {});

    refreshProviderModels().catch(() => {});

    if (!localStorage.getItem('worldOnboardingSeen')) {
      setTimeout(() => openOnboardingDialog(), 300);
    }

    // 健康检查轮询
    

// Extracted init code
document.querySelectorAll('details.panel-section[data-panel]').forEach((details) => {
  details.addEventListener('toggle', () => {
    const key = details.getAttribute('data-panel');
    if (!key) return;
    updateSettings({ panelOpen: { [key]: details.open } });
  });
});
applySettings(window.uiSettings);
syncSettingsControls();
updateCOTUI();
startCOTPolling(1000);

const sidebar = document.querySelector('.sidebar');
const openSidebarBtn = document.getElementById('openSidebar');
const openRightPanelBtn = document.getElementById('openRightPanel');

if (sidebar) sidebar.id = 'sidebar';
if (openSidebarBtn) openSidebarBtn.addEventListener('click', toggleLeftDrawer);
if (openRightPanelBtn) openRightPanelBtn.addEventListener('click', toggleRightDrawer);
setInterval(checkServerHealth, 5000);
checkServerHealth();