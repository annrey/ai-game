/**
 * 角色创建系统
 *
 * 深度角色定制：
 * - 属性点分配系统
 * - 技能树
 * - 外观定制
 * - 背景故事生成
 * - 关系网络
 */

use serde::{Deserialize, Serialize};

/// 角色定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterDefinition {
    pub id: String,
    pub name: String,
    pub title: Option<String>,
    pub character_type: CharacterType,
    pub appearance: Appearance,
    pub attributes: Attributes,
    pub skills: Vec<Skill>,
    pub background: Background,
    pub personality: Personality,
    pub inventory: Inventory,
    pub relationships: Vec<Relationship>,
    pub stats: CharacterStats,
    pub is_player: bool,
    pub is_hostile: bool,
}

impl CharacterDefinition {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            title: None,
            character_type: CharacterType::Human,
            appearance: Appearance::default(),
            attributes: Attributes::default(),
            skills: vec![],
            background: Background::default(),
            personality: Personality::default(),
            inventory: Inventory::default(),
            relationships: vec![],
            stats: CharacterStats::default(),
            is_player: false,
            is_hostile: false,
        }
    }

    pub fn set_player(mut self) -> Self {
        self.is_player = true;
        self
    }

    pub fn add_skill(&mut self, skill: Skill) {
        self.skills.push(skill);
    }

    pub fn add_relationship(&mut self, relationship: Relationship) {
        self.relationships.push(relationship);
    }

    pub fn add_item(&mut self, item: Item) {
        self.inventory.items.push(item);
    }

    /// 计算角色总战力
    pub fn calculate_power_level(&self) -> u32 {
        let attr_sum = self.attributes.strength as u32
            + self.attributes.agility as u32
            + self.attributes.intelligence as u32
            + self.attributes.charisma as u32
            + self.attributes.endurance as u32;

        let skill_bonus: u32 = self.skills.iter().map(|s| s.level as u32 * 2).sum();

        attr_sum + skill_bonus
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CharacterType {
    Human,
    Elf,
    Dwarf,
    Orc,
    Beast,
    Undead,
    Construct,
    Spirit,
    Dragon,
    Custom(String),
}

/// 外观
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appearance {
    pub gender: Gender,
    pub age: u32,
    pub height_cm: u32,
    pub build: BodyBuild,
    pub skin_color: String,
    pub hair_color: String,
    pub hair_style: String,
    pub eye_color: String,
    pub facial_features: String,
    pub distinguishing_marks: Vec<String>,
    pub clothing_style: String,
    pub portrait_description: String,
}

impl Default for Appearance {
    fn default() -> Self {
        Self {
            gender: Gender::Unspecified,
            age: 25,
            height_cm: 170,
            build: BodyBuild::Average,
            skin_color: String::new(),
            hair_color: String::new(),
            hair_style: String::new(),
            eye_color: String::new(),
            facial_features: String::new(),
            distinguishing_marks: vec![],
            clothing_style: String::new(),
            portrait_description: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Gender {
    Male,
    Female,
    NonBinary,
    Unspecified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BodyBuild {
    Petite,
    Slim,
    Average,
    Athletic,
    Muscular,
    Heavy,
}

/// 属性值
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attributes {
    pub strength: u8,
    pub agility: u8,
    pub intelligence: u8,
    pub charisma: u8,
    pub endurance: u8,
    pub luck: u8,
    pub magic: u8,
    pub perception: u8,
}

impl Default for Attributes {
    fn default() -> Self {
        Self {
            strength: 10,
            agility: 10,
            intelligence: 10,
            charisma: 10,
            endurance: 10,
            luck: 10,
            magic: 10,
            perception: 10,
        }
    }
}

impl Attributes {
    pub fn total_points(&self) -> u32 {
        self.strength as u32
            + self.agility as u32
            + self.intelligence as u32
            + self.charisma as u32
            + self.endurance as u32
            + self.luck as u32
            + self.magic as u32
            + self.perception as u32
    }

    pub fn remaining_points(&self, max: u32) -> i32 {
        max as i32 - self.total_points() as i32
    }
}

/// 技能
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: SkillCategory,
    pub level: u8,
    pub max_level: u8,
    pub experience: u32,
    pub prerequisites: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillCategory {
    Combat,
    Magic,
    Stealth,
    Crafting,
    Social,
    Survival,
    Knowledge,
    Custom(String),
}

/// 背景故事
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Background {
    pub origin: String,
    pub upbringing: String,
    pub pivotal_event: String,
    pub motivation: String,
    pub fears: Vec<String>,
    pub desires: Vec<String>,
    pub secrets: Vec<String>,
}

impl Default for Background {
    fn default() -> Self {
        Self {
            origin: String::new(),
            upbringing: String::new(),
            pivotal_event: String::new(),
            motivation: String::new(),
            fears: vec![],
            desires: vec![],
            secrets: vec![],
        }
    }
}

/// 性格特质
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Personality {
    pub traits: Vec<String>,
    pub alignment: Alignment,
    pub temperament: Temperament,
    pub speech_style: String,
    pub decision_making: String,
}

impl Default for Personality {
    fn default() -> Self {
        Self {
            traits: vec![],
            alignment: Alignment::Neutral,
            temperament: Temperament::Balanced,
            speech_style: String::new(),
            decision_making: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Alignment {
    LawfulGood,
    NeutralGood,
    ChaoticGood,
    LawfulNeutral,
    Neutral,
    ChaoticNeutral,
    LawfulEvil,
    NeutralEvil,
    ChaoticEvil,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Temperament {
    Optimistic,
    Pessimistic,
    Realistic,
    Idealistic,
    Cynical,
    Balanced,
}

/// 角色状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStats {
    pub health: i32,
    pub max_health: i32,
    pub mana: i32,
    pub max_mana: i32,
    pub stamina: i32,
    pub max_stamina: i32,
    pub experience: u32,
    pub level: u32,
    pub reputation: i32,
    pub status_effects: Vec<StatusEffect>,
}

impl Default for CharacterStats {
    fn default() -> Self {
        Self {
            health: 100,
            max_health: 100,
            mana: 50,
            max_mana: 50,
            stamina: 100,
            max_stamina: 100,
            experience: 0,
            level: 1,
            reputation: 0,
            status_effects: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEffect {
    pub name: String,
    pub effect_type: EffectType,
    pub duration_turns: i32,
    pub magnitude: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EffectType {
    Buff,
    Debuff,
    Dot,
    Hot,
    Control,
}

/// 物品栏
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inventory {
    pub max_slots: u32,
    pub gold: i32,
    pub items: Vec<Item>,
}

impl Default for Inventory {
    fn default() -> Self {
        Self {
            max_slots: 20,
            gold: 0,
            items: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub description: String,
    pub item_type: ItemType,
    pub rarity: Rarity,
    pub quantity: u32,
    pub attributes: Vec<ItemAttribute>,
    pub is_equipped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemType {
    Weapon,
    Armor,
    Accessory,
    Consumable,
    Material,
    Quest,
    Key,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
    Unique,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemAttribute {
    pub name: String,
    pub value: i32,
}

/// 关系
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub target_character_id: String,
    pub relationship_type: RelationshipType,
    pub affinity: i32,
    pub history: Vec<String>,
    pub is_known: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    Family,
    Friend,
    Rival,
    Enemy,
    Lover,
    Mentor,
    Student,
    Ally,
    Neutral,
    Custom(String),
}
