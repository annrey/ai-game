import { Extension } from '@openclaw/plugin-sdk';
import { ProviderFactory } from '../providers/provider-factory.js';

export class ExtensionLoader {
  private extensions: Map<string, Extension> = new Map();
  private providerFactory?: ProviderFactory;

  constructor(providerFactory?: ProviderFactory) {
    this.providerFactory = providerFactory;
  }

  setProviderFactory(factory: ProviderFactory) {
    this.providerFactory = factory;
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
      console.error(`加载扩展 ${modulePath} 失败:`, error);
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

    // 调用激活钩子
    if (extension.activate) {
      await extension.activate();
    }

    this.extensions.set(extension.manifest.id, extension);

    // 根据扩展类型处理
    switch (extension.type) {
      case 'provider':
        if (this.providerFactory) {
          this.providerFactory.registerProviderExtension(extension);
        } else {
          console.warn(`ProviderFactory 未设置，无法注册 Provider 扩展 ${extension.manifest.id}`);
        }
        break;
      case 'mode':
        // TODO: 注册到模式管理器
        console.log(`注册了新的游戏模式: ${extension.manifest.name}`);
        break;
      case 'game':
        // TODO: 注册到游戏管理器
        console.log(`注册了新的小游戏: ${extension.manifest.name}`);
        break;
      case 'skill':
        // TODO: 注册到技能管理器
        console.log(`注册了新的技能: ${extension.manifest.name}`);
        break;
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

    this.extensions.delete(id);
    // TODO: 从各管理器中移除注册的组件
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
