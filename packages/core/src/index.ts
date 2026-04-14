/**
 * AI 说书人委员会 — 游戏引擎主入口
 */

export { GameEngine } from './engine/game-engine.js';
export type { EngineOptions, TurnResult } from './engine/game-engine.js';
export { EventBus, GameEvents } from './engine/event-bus.js';
export type { GameEventType } from './engine/event-bus.js';
export { StateStore, createDefaultSceneState } from './engine/state-store.js';
export { SceneManager } from './engine/scene-manager.js';
export { GuideManager } from './engine/guide-manager.js';
export { RustGameEngineBridge } from './engine/rust-bridge.js';

export * from './providers/base-provider.js';
export { ProviderFactory, printLocalModelGuide } from './providers/provider-factory.js';
export type { ProviderFactoryConfig } from './providers/provider-factory.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { OllamaProvider } from './providers/ollama-provider.js';
export { LocalProvider } from './providers/local-provider.js';

export { Narrator } from './agents/narrator.js';
export { WorldKeeper } from './agents/world-keeper.js';
export { NPCDirector } from './agents/npc-director.js';
export { RuleArbiter } from './agents/rule-arbiter.js';
export { DramaCurator } from './agents/drama-curator.js';
export { GuideAgent } from './agents/guide-agent.js';

export { createTextAdventure, quickStartAdventure } from './modes/text-adventure.js';
export { createAIBattle } from './modes/ai-battle.js';
export { createNPCSandbox, SandboxTemplates } from './modes/npc-sandbox.js';
export { createChatRoleplay, RoleplayTemplates } from './modes/chat-roleplay.js';
export { createStardewValley, StardewTemplates } from './modes/stardew-valley.js';

export { SERVER, LIMITS, HISTORY, MEMORY } from './constants.js';
export { loadTestConfig } from './utils/config.js';

// Extensions
export * from './extensions/extension-loader.js';

