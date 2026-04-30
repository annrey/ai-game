use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use strum_macros::{Display, EnumString};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreatureCategory {
    Humanoid,
    Animal,
    Monster,
    Mythical,
    Undead,
    Construct,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreatureType {
    Human,
    Elf,
    Dwarf,
    Orc,
    Goblin,
    Halfling,
    Wolf,
    Bear,
    Deer,
    Rabbit,
    Eagle,
    Snake,
    Horse,
    GoblinRaider,
    OrcWarrior,
    Troll,
    GiantSpider,
    Slime,
    Dragon,
    Phoenix,
    Unicorn,
    Griffin,
    Skeleton,
    Zombie,
    Ghost,
    Vampire,
    Golem,
    Automation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CreatureAlignment {
    Hostile,
    Predatory,
    Territorial,
    Neutral,
    Cautious,
    Friendly,
    Domesticated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ActivityCycle {
    Diurnal,
    Nocturnal,
    Crepuscular,
    Continuous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SocialStructure {
    Solitary,
    Pair,
    Pack,
    Herd,
    Colony,
    Hive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Diet {
    Herbivore,
    Carnivore,
    Omnivore,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorPattern {
    pub activity_cycle: ActivityCycle,
    pub social_structure: SocialStructure,
    pub diet: Diet,
    pub territory_size: f32,
    pub migration_pattern: Option<String>,
    pub fears: Vec<String>,
    pub attractions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatureAbility {
    pub id: String,
    pub name: String,
    pub description: String,
    pub ability_type: String,
    pub trigger: String,
    pub effect: String,
    pub cooldown: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcologicalNiche {
    pub preferred_terrains: Vec<super::terrain::TerrainType>,
    pub avoided_terrains: Vec<super::terrain::TerrainType>,
    pub preferred_climate: super::terrain::ClimateType,
    pub required_resources: Vec<super::terrain::ResourceType>,
    pub predators: Vec<CreatureType>,
    pub prey: Vec<CreatureType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Domestication {
    pub owner_id: String,
    pub loyalty: f32,
    pub trained_commands: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatureRelationship {
    pub target_id: String,
    pub disposition: f32,
    pub history: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Creature {
    pub id: String,
    pub name: String,
    pub category: CreatureCategory,
    pub creature_type: CreatureType,
    pub display_name: String,
    pub description: String,
    pub health: i32,
    pub max_health: i32,
    pub stamina: i32,
    pub max_stamina: i32,
    pub mood: String,
    pub alignment: CreatureAlignment,
    pub behavior: BehaviorPattern,
    pub abilities: Vec<CreatureAbility>,
    pub niche: EcologicalNiche,
    pub current_location_id: String,
    pub current_space_id: Option<String>,
    pub relationships: HashMap<String, CreatureRelationship>,
    pub memories: Vec<String>,
    pub domestication: Option<Domestication>,
}

impl Creature {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        category: CreatureCategory,
        creature_type: CreatureType,
        display_name: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            category,
            creature_type,
            display_name: display_name.into(),
            description: description.into(),
            health: 100,
            max_health: 100,
            stamina: 100,
            max_stamina: 100,
            mood: "calm".to_string(),
            alignment: CreatureAlignment::Neutral,
            behavior: BehaviorPattern {
                activity_cycle: ActivityCycle::Diurnal,
                social_structure: SocialStructure::Solitary,
                diet: Diet::Omnivore,
                territory_size: 1.0,
                migration_pattern: None,
                fears: vec![],
                attractions: vec![],
            },
            abilities: vec![],
            niche: EcologicalNiche {
                preferred_terrains: vec![],
                avoided_terrains: vec![],
                preferred_climate: super::terrain::ClimateType::Temperate,
                required_resources: vec![],
                predators: vec![],
                prey: vec![],
            },
            current_location_id: String::new(),
            current_space_id: None,
            relationships: HashMap::new(),
            memories: vec![],
            domestication: None,
        }
    }

    pub fn with_health(mut self, health: i32, max: i32) -> Self {
        self.health = health;
        self.max_health = max;
        self
    }

    pub fn with_stamina(mut self, stamina: i32, max: i32) -> Self {
        self.stamina = stamina;
        self.max_stamina = max;
        self
    }

    pub fn with_alignment(mut self, alignment: CreatureAlignment) -> Self {
        self.alignment = alignment;
        self
    }

    pub fn with_behavior(mut self, behavior: BehaviorPattern) -> Self {
        self.behavior = behavior;
        self
    }

    pub fn with_abilities(mut self, abilities: Vec<CreatureAbility>) -> Self {
        self.abilities = abilities;
        self
    }

    pub fn with_niche(mut self, niche: EcologicalNiche) -> Self {
        self.niche = niche;
        self
    }

    pub fn is_hostile_to(&self, other: &Creature) -> bool {
        match self.alignment {
            CreatureAlignment::Hostile => true,
            CreatureAlignment::Predatory => {
                // 掠食者攻击猎物、动物，以及人形生物（把人类视为潜在猎物）
                self.niche.prey.contains(&other.creature_type)
                    || other.category == CreatureCategory::Animal
                    || other.category == CreatureCategory::Humanoid
            }
            CreatureAlignment::Territorial => {
                self.current_location_id == other.current_location_id
            }
            _ => false,
        }
    }

    pub fn can_be_domesticated(&self) -> bool {
        // 动物类生物，只要不是 Hostile，理论上都可被驯化
        // （包括 Neutral、Cautious、Friendly，以及 Predatory 如狼、熊等）
        !matches!(self.alignment, CreatureAlignment::Hostile | CreatureAlignment::Territorial)
            && self.category == CreatureCategory::Animal
    }

    pub fn add_memory(&mut self, memory: impl Into<String>) {
        self.memories.push(memory.into());
        if self.memories.len() > 50 {
            self.memories.remove(0);
        }
    }

    pub fn update_relationship(&mut self, target_id: impl Into<String>, delta: f32, event: impl Into<String>) {
        let target_id = target_id.into();
        let rel = self.relationships.entry(target_id.clone()).or_insert(CreatureRelationship {
            target_id: target_id.clone(),
            disposition: 0.0,
            history: vec![],
        });
        rel.disposition = (rel.disposition + delta).clamp(-100.0, 100.0);
        rel.history.push(event.into());
        if rel.history.len() > 20 {
            rel.history.remove(0);
        }
    }
}

pub struct CreatureManager {
    creatures: HashMap<String, Creature>,
    location_creatures: HashMap<String, Vec<String>>,
    space_creatures: HashMap<String, Vec<String>>,
}

impl Default for CreatureManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CreatureManager {
    pub fn new() -> Self {
        let mut manager = Self {
            creatures: HashMap::new(),
            location_creatures: HashMap::new(),
            space_creatures: HashMap::new(),
        };
        manager.register_defaults();
        manager
    }

    pub fn register(&mut self, creature: Creature) {
        let loc_id = creature.current_location_id.clone();
        let space_id = creature.current_space_id.clone();
        let id = creature.id.clone();

        self.creatures.insert(id.clone(), creature);
        
        if !loc_id.is_empty() {
            self.location_creatures.entry(loc_id).or_default().push(id.clone());
        }
        
        if let Some(sid) = space_id {
            self.space_creatures.entry(sid).or_default().push(id);
        }
    }

    pub fn get(&self, creature_id: &str) -> Option<&Creature> {
        self.creatures.get(creature_id)
    }

    pub fn get_mut(&mut self, creature_id: &str) -> Option<&mut Creature> {
        self.creatures.get_mut(creature_id)
    }

    pub fn get_in_location(&self, location_id: &str) -> Vec<&Creature> {
        self.location_creatures
            .get(location_id)
            .map(|ids| ids.iter().filter_map(|id| self.creatures.get(id)).collect())
            .unwrap_or_default()
    }

    pub fn get_in_space(&self, space_id: &str) -> Vec<&Creature> {
        self.space_creatures
            .get(space_id)
            .map(|ids| ids.iter().filter_map(|id| self.creatures.get(id)).collect())
            .unwrap_or_default()
    }

    pub fn move_creature(&mut self, creature_id: &str, new_location: impl Into<String>, new_space: Option<impl Into<String>>) -> bool {
        let new_loc = new_location.into();
        let new_sp = new_space.map(|s| s.into());

        if let Some(creature) = self.creatures.get_mut(creature_id) {
            // Remove from old location
            if let Some(ids) = self.location_creatures.get_mut(&creature.current_location_id) {
                ids.retain(|id| id != creature_id);
            }
            if let Some(old_space) = &creature.current_space_id {
                if let Some(ids) = self.space_creatures.get_mut(old_space) {
                    ids.retain(|id| id != creature_id);
                }
            }

            // Update creature
            creature.current_location_id = new_loc.clone();
            creature.current_space_id = new_sp.clone();

            // Add to new location
            self.location_creatures.entry(new_loc).or_default().push(creature_id.to_string());
            if let Some(sid) = new_sp {
                self.space_creatures.entry(sid).or_default().push(creature_id.to_string());
            }

            true
        } else {
            false
        }
    }

    pub fn get_hostile_in_location(&self, location_id: &str) -> Vec<&Creature> {
        self.get_in_location(location_id)
            .into_iter()
            .filter(|c| matches!(c.alignment, CreatureAlignment::Hostile | CreatureAlignment::Predatory | CreatureAlignment::Territorial))
            .collect()
    }

    pub fn domesticate(&mut self, creature_id: &str, owner_id: impl Into<String>) -> bool {
        if let Some(creature) = self.creatures.get_mut(creature_id) {
            if creature.can_be_domesticated() {
                creature.domestication = Some(Domestication {
                    owner_id: owner_id.into(),
                    loyalty: 50.0,
                    trained_commands: vec!["跟随".to_string(), "停留".to_string()],
                });
                creature.alignment = CreatureAlignment::Domesticated;
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn generate_ecology_report(&self, location_id: &str) -> EcologyReport {
        let creatures = self.get_in_location(location_id);
        let predators: Vec<_> = creatures.iter().filter(|c| c.behavior.diet == Diet::Carnivore).collect();
        let prey: Vec<_> = creatures.iter().filter(|c| c.behavior.diet == Diet::Herbivore).collect();
        let hostile = creatures.iter().filter(|c| c.is_hostile_to(&Creature::new("", "", CreatureCategory::Humanoid, CreatureType::Human, "", ""))).count();

        EcologyReport {
            location_id: location_id.to_string(),
            total_creatures: creatures.len(),
            predators: predators.len(),
            prey: prey.len(),
            hostile_count: hostile,
            creatures: creatures.iter().map(|c| c.display_name.clone()).collect(),
        }
    }

    fn register_defaults(&mut self) {
        use super::terrain::{ClimateType, ResourceType, TerrainType};
        use ActivityCycle::*;
        use CreatureAlignment::*;
        use CreatureCategory::*;
        use CreatureType::*;
        use SocialStructure::*;
        let none_migration: Option<String> = None;

        let wolf = Creature::new(
            "creature_wolf",
            "灰狼",
            Animal,
            Wolf,
            "灰狼",
            "一只毛色灰白的野狼，眼神警惕而锐利。",
        )
        .with_health(40, 40)
        .with_stamina(60, 60)
        .with_alignment(Predatory)
        .with_behavior(BehaviorPattern {
            activity_cycle: Nocturnal,
            social_structure: Pack,
            diet: Diet::Carnivore,
            territory_size: 5.0,
            migration_pattern: none_migration.clone(),
            fears: vec!["火".to_string(), "巨大声响".to_string()],
            attractions: vec!["血腥味".to_string(), "肉类".to_string()],
        })
        .with_abilities(vec![
            CreatureAbility {
                id: "ability_pack_howl".to_string(),
                name: "狼嚎".to_string(),
                description: "召唤附近的狼群成员".to_string(),
                ability_type: "social".to_string(),
                trigger: "发现猎物或威胁".to_string(),
                effect: "吸引同区域其他狼".to_string(),
                cooldown: 3,
            },
            CreatureAbility {
                id: "ability_sprint".to_string(),
                name: "疾奔".to_string(),
                description: "短距离高速冲刺".to_string(),
                ability_type: "physical".to_string(),
                trigger: "追逐猎物".to_string(),
                effect: "移动速度翻倍".to_string(),
                cooldown: 5,
            },
        ])
        .with_niche(EcologicalNiche {
            preferred_terrains: vec![TerrainType::Forest, TerrainType::Hill, TerrainType::Plains],
            avoided_terrains: vec![TerrainType::Desert, TerrainType::Swamp],
            preferred_climate: ClimateType::Temperate,
            required_resources: vec![ResourceType::Food, ResourceType::Water],
            predators: vec![Bear, Troll],
            prey: vec![Deer, Rabbit],
        });

        let goblin = Creature::new(
            "creature_goblin_raider",
            "哥布林掠夺者",
            Monster,
            GoblinRaider,
            "哥布林",
            "一个瘦小的绿色生物，手持生锈的匕首，眼中闪烁着贪婪。",
        )
        .with_health(25, 25)
        .with_stamina(40, 40)
        .with_alignment(Hostile)
        .with_behavior(BehaviorPattern {
            activity_cycle: Nocturnal,
            social_structure: Pack,
            diet: Diet::Omnivore,
            territory_size: 3.0,
            migration_pattern: Some("random".to_string()),
            fears: vec!["高大的人类".to_string(), "魔法火焰".to_string()],
            attractions: vec!["闪亮物品".to_string(), "食物".to_string()],
        })
        .with_abilities(vec![
            CreatureAbility {
                id: "ability_swarm".to_string(),
                name: "swarm战术".to_string(),
                description: "多个哥布林同时攻击".to_string(),
                ability_type: "social".to_string(),
                trigger: "数量优势".to_string(),
                effect: "攻击获得加成".to_string(),
                cooldown: 0,
            },
            CreatureAbility {
                id: "ability_sneak".to_string(),
                name: "潜行".to_string(),
                description: "在阴影中隐藏".to_string(),
                ability_type: "physical".to_string(),
                trigger: "夜间或阴影处".to_string(),
                effect: "难以被发现".to_string(),
                cooldown: 2,
            },
        ])
        .with_niche(EcologicalNiche {
            preferred_terrains: vec![TerrainType::Cave, TerrainType::Ruins, TerrainType::Forest],
            avoided_terrains: vec![TerrainType::Mountain, TerrainType::Desert],
            preferred_climate: ClimateType::Temperate,
            required_resources: vec![ResourceType::Food],
            predators: vec![Human, Orc],
            prey: vec![Rabbit, Human],
        });

        let bear = Creature::new(
            "creature_bear",
            "棕熊",
            Animal,
            Bear,
            "棕熊",
            "一只体型庞大的棕熊，力量惊人。",
        )
        .with_health(80, 80)
        .with_stamina(50, 50)
        .with_alignment(Territorial)
        .with_behavior(BehaviorPattern {
            activity_cycle: Diurnal,
            social_structure: Solitary,
            diet: Diet::Omnivore,
            territory_size: 8.0,
            migration_pattern: Some("seasonal".to_string()),
            fears: vec!["火".to_string()],
            attractions: vec!["蜂蜜".to_string(), "鱼类".to_string()],
        })
        .with_abilities(vec![
            CreatureAbility {
                id: "ability_maul".to_string(),
                name: "猛击".to_string(),
                description: "用巨爪猛击".to_string(),
                ability_type: "physical".to_string(),
                trigger: "战斗".to_string(),
                effect: "造成大量伤害".to_string(),
                cooldown: 3,
            },
        ])
        .with_niche(EcologicalNiche {
            preferred_terrains: vec![TerrainType::Forest, TerrainType::Mountain],
            avoided_terrains: vec![TerrainType::Desert],
            preferred_climate: ClimateType::Temperate,
            required_resources: vec![ResourceType::Food, ResourceType::Water],
            predators: vec![],
            prey: vec![Deer, Rabbit],
        });

        self.register(wolf);
        self.register(goblin);
        self.register(bear);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcologyReport {
    pub location_id: String,
    pub total_creatures: usize,
    pub predators: usize,
    pub prey: usize,
    pub hostile_count: usize,
    pub creatures: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_creature_creation() {
        let creature = Creature::new("test", "测试", CreatureCategory::Animal, CreatureType::Wolf, "测试狼", "描述");
        assert_eq!(creature.name, "测试");
        assert_eq!(creature.health, 100);
    }

    #[test]
    fn test_creature_manager() {
        let manager = CreatureManager::new();
        let wolf = manager.get("creature_wolf").unwrap();
        assert_eq!(wolf.creature_type, CreatureType::Wolf);
    }

    #[test]
    fn test_hostile_detection() {
        let manager = CreatureManager::new();
        let wolf = manager.get("creature_wolf").unwrap();
        let goblin = manager.get("creature_goblin_raider").unwrap();
        
        assert!(wolf.is_hostile_to(&Creature::new("", "", CreatureCategory::Humanoid, CreatureType::Human, "", "")));
        assert!(goblin.is_hostile_to(&Creature::new("", "", CreatureCategory::Humanoid, CreatureType::Human, "", "")));
    }

    #[test]
    fn test_domestication() {
        let mut manager = CreatureManager::new();
        assert!(manager.domesticate("creature_wolf", "player_1"));
        
        let wolf = manager.get("creature_wolf").unwrap();
        assert!(wolf.domestication.is_some());
        assert_eq!(wolf.alignment, CreatureAlignment::Domesticated);
    }
}
