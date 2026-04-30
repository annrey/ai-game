import { Extension } from '@openclaw/plugin-sdk';
import { ProviderFactory } from '../providers/provider-factory.js';

export type ExtensionHandler = (extension: Extension) => Promise<void> | void;

export class ExtensionLoader {
  private extensions: Map<string, Extension> = new Map();
  private providerFactory?: ProviderFactory;
  private modeHandlers: ExtensionHandler[] = [];
  private gameHandlers: ExtensionHandler[] = [];
  private skillHandlers: ExtensionHandler[] = [];
  private unloadHandlers: Map<string, ExtensionHandler[]> = new Map();

  constructor(providerFactory?: ProviderFactory) {
    this.providerFactory = providerFactory;
  }

  setProviderFactory(factory: ProviderFactory) {
    this.providerFactory = factory;
  }

  /** 注册模式扩展处理器 */
  onModeExtension(handler: ExtensionHandler): void {
    this.modeHandlers.push(handler);
  }

  /** 注册游戏扩展处理器 */
  onGameExtension(handler: ExtensionHandler): void {
    this.gameHandlers.push(handler);
  }

  /** 注册技能扩展处理器 */
  onSkillExtension(handler: ExtensionHandler): void {
    this.skillHandlers.push(handler);
  }

  /** 注册卸载处理器 */
  onUnload(extensionId: string, handler: ExtensionHandler): void {
    if (!this.unloadHandlers.has(extensionId)) {
      this.unloadHandlers.set(extensionId, []);
    }
    this.unloadHandlers.get(extensionId)!.push(handler);
  }

  /**
   * 动态加载扩展模块
   * @param modulePath 模块路径（绝对路径或能被 Node.js 解析的路径）
   */
  async loadExtension(modulePath: string): Promise<Extension> {
    try {
      const module = await import(modulePath);
      const extension = module.default as Extension;

      if (!extension || !extension.manifest) {
        throw new Error(`模块 ${modulePath} 不是一个有效的扩展`);
      }

      await this.registerExtension(extension);
      return extension;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`加载扩展 ${modulePath} 失败:`, errMsg);
      throw error;
    }
  }

  /**
   * 注册扩展并进行分类初始化
   */
  async registerExtension(extension: Extension): Promise<void> {
    if (this.extensions.has(extension.manifest.id)) {
      console.warn(`扩展 ${extension.manifest.id} 已经被注册过了`);
      return;
    }

    if (extension.activate) {
      await extension.activate();
    }

    this.extensions.set(extension.manifest.id, extension);

    switch (extension.type) {
      case 'provider':
        if (this.providerFactory) {
          this.providerFactory.registerProviderExtension(extension);
        } else {
          console.warn(`ProviderFactory 未设置，无法注册 Provider 扩展 ${extension.manifest.id}`);
        }
        break;
      case 'mode': {
        let handled = false;
        for (const handler of this.modeHandlers) {
          await handler(extension);
          handled = true;
        }
        if (!handled) {
          console.warn(`没有注册的模式处理器，扩展 "${extension.manifest.name}" 的模式功能未生效`);
        }
        break;
      }
      case 'game': {
        let handled = false;
        for (const handler of this.gameHandlers) {
          await handler(extension);
          handled = true;
        }
        if (!handled) {
          console.warn(`没有注册的游戏处理器，扩展 "${extension.manifest.name}" 的游戏功能未生效`);
        }
        break;
      }
      case 'skill': {
        let handled = false;
        for (const handler of this.skillHandlers) {
          await handler(extension);
          handled = true;
        }
        if (!handled) {
          console.warn(`没有注册的技能处理器，扩展 "${extension.manifest.name}" 的技能功能未生效`);
        }
        break;
      }
    }
  }

  /**
   * 卸载扩展
   */
  async unloadExtension(id: string): Promise<void> {
    const extension = this.extensions.get(id);
    if (!extension) return;

    if (extension.deactivate) {
      await extension.deactivate();
    }

    const handlers = this.unloadHandlers.get(id);
    if (handlers) {
      for (const handler of handlers) {
        await handler(extension);
      }
      this.unloadHandlers.delete(id);
    }

    this.extensions.delete(id);
  }

  /**
   * 获取所有已注册的扩展
   */
  getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * 获取指定扩展
   */
  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }
}
