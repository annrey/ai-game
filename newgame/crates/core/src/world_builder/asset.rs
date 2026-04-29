/**
 * 世界资源与资产系统
 *
 * 管理世界中的视觉和音频资源：
 * - 地图纹理与图标
 * - 角色立绘
 * - 背景音乐
 * - 环境音效
 */

use serde::{Deserialize, Serialize};

/// 世界资产
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldAsset {
    pub id: String,
    pub name: String,
    pub asset_type: AssetType,
    pub file_path: String,
    pub description: String,
    pub tags: Vec<String>,
    pub metadata: AssetMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetType {
    MapTexture,
    LocationIcon,
    CharacterPortrait,
    ItemIcon,
    BackgroundMusic,
    AmbientSound,
    SoundEffect,
    UIElement,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u32>,
    pub file_size: u64,
    pub format: String,
    pub author: Option<String>,
    pub license: Option<String>,
}

/// 资产库
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetLibrary {
    pub assets: Vec<WorldAsset>,
    pub categories: Vec<AssetCategory>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetCategory {
    pub id: String,
    pub name: String,
    pub asset_type: AssetType,
    pub asset_ids: Vec<String>,
}
