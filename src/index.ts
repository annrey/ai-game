/**
 * AI 说书人委员会 — 游戏引擎主入口
 */

export { GameEngine } from './engine/game-engine.js';
export type { EngineOptions, TurnResult } from './engine/game-engine.js';
export { EventBus, GameEvents } from './engine/event-bus.js';
export type { GameEventType } from './engine/event-bus.js';
export { StateStore, createDefaultSceneState } from './engine/state-store.js';
export { SceneManager } from './engine/scene-manager.js';

export { ProviderFactory } from './providers/provider-factory.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { OllamaProvider } from './providers/ollama-provider.js';
export { LocalProvider } from './providers/local-provider.js';

export { Narrator } from './agents/narrator.js';
export { WorldKeeper } from './agents/world-keeper.js';
export { NPCDirector } from './agents/npc-director.js';
export { RuleArbiter } from './agents/rule-arbiter.js';
export { DramaCurator } from './agents/drama-curator.js';

export { createTextAdventure, quickStartAdventure } from './modes/text-adventure.js';
export { createAIBattle } from './modes/ai-battle.js';
export { createNPCSandbox, SandboxTemplates } from './modes/npc-sandbox.js';
export { createChatRoleplay, RoleplayTemplates } from './modes/chat-roleplay.js';

export { MemoryManager, MemoryStore } from './memory/index.js';
export type { MemoryEntry, MemoryType, MemoryManagerConfig } from './memory/index.js';

export type * from './types/game.js';
