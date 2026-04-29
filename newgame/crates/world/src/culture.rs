use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CultureDimensions {
    pub individualism: f32,
    pub power_distance: f32,
    pub uncertainty_avoidance: f32,
    pub masculinity: f32,
    pub long_term_orientation: f32,
    pub indulgence: f32,
}

impl Default for CultureDimensions {
    fn default() -> Self {
        Self {
            individualism: 0.0,
            power_distance: 0.0,
            uncertainty_avoidance: 0.0,
            masculinity: 0.0,
            long_term_orientation: 0.0,
            indulgence: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Language {
    pub id: String,
    pub name: String,
    pub family: String,
    pub greetings: Vec<String>,
    pub profanity: Vec<String>,
    pub honorifics: bool,
    pub dialects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deity {
    pub id: String,
    pub name: String,
    pub domain: Vec<String>,
    pub alignment: String,
    pub symbol: String,
    pub favored_offerings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ritual {
    pub id: String,
    pub name: String,
    pub purpose: String,
    pub required_items: Vec<String>,
    pub steps: Vec<String>,
    pub participant_roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HolyDay {
    pub name: String,
    pub month: u32,
    pub day: u32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Religion {
    pub id: String,
    pub name: String,
    pub deities: Vec<Deity>,
    pub doctrines: Vec<String>,
    pub rituals: Vec<Ritual>,
    pub sacred_items: Vec<String>,
    pub holy_days: Vec<HolyDay>,
    pub fervor: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtiquetteRule {
    pub id: String,
    pub situation: String,
    pub expected_behavior: String,
    pub violation_consequence: String,
    pub importance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CultureCore {
    pub language: Language,
    pub religion: Religion,
    pub values: Vec<String>,
    pub taboos: Vec<String>,
    pub etiquette: Vec<EtiquetteRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtForm {
    pub id: String,
    pub art_type: String,
    pub name: String,
    pub description: String,
    pub notable_works: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cuisine {
    pub staple_foods: Vec<String>,
    pub preferred_flavors: Vec<String>,
    pub taboo_ingredients: Vec<String>,
    pub traditional_drinks: Vec<String>,
    pub dining_etiquette: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Culture {
    pub id: String,
    pub name: String,
    pub description: String,
    pub dimensions: CultureDimensions,
    pub core: CultureCore,
    pub arts: Vec<ArtForm>,
    pub traditional_attire: String,
    pub cuisine: Cuisine,
    pub architecture_style: String,
    pub influence: f32,
    pub vitality: f32,
    pub homeland_region_id: String,
    pub spread_regions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CulturalConflict {
    pub culture_a: String,
    pub culture_b: String,
    pub conflict_points: Vec<String>,
    pub severity: f32,
}

pub struct CultureManager {
    cultures: HashMap<String, Culture>,
    region_culture_map: HashMap<String, String>,
}

impl Default for CultureManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CultureManager {
    pub fn new() -> Self {
        let mut manager = Self {
            cultures: HashMap::new(),
            region_culture_map: HashMap::new(),
        };
        manager.register_defaults();
        manager
    }

    pub fn register(&mut self, culture: Culture) {
        self.cultures.insert(culture.id.clone(), culture);
    }

    pub fn assign_to_region(&mut self, region_id: impl Into<String>, culture_id: impl Into<String>) {
        self.region_culture_map.insert(region_id.into(), culture_id.into());
    }

    pub fn get(&self, culture_id: &str) -> Option<&Culture> {
        self.cultures.get(culture_id)
    }

    pub fn get_for_region(&self, region_id: &str) -> Option<&Culture> {
        self.region_culture_map
            .get(region_id)
            .and_then(|cid| self.cultures.get(cid))
    }

    pub fn get_social_rules(&self, culture_id: &str, situation: &str) -> Vec<&EtiquetteRule> {
        self.get(culture_id)
            .map(|c| {
                c.core.etiquette
                    .iter()
                    .filter(|e| e.situation.contains(situation))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn check_taboo(&self, culture_id: &str, action: &str) -> Option<&String> {
        self.get(culture_id)
            .and_then(|c| c.core.taboos.iter().find(|t| action.contains(t.as_str())))
    }

    pub fn get_dialogue_style(&self, culture_id: &str) -> Option<(Vec<String>, bool)> {
        self.get(culture_id)
            .map(|c| (c.core.language.greetings.clone(), c.core.language.honorifics))
    }

    pub fn detect_conflict(&self, culture_a_id: &str, culture_b_id: &str) -> Option<CulturalConflict> {
        let a = self.get(culture_a_id)?;
        let b = self.get(culture_b_id)?;

        let mut points = vec![];
        let mut severity = 0.0;

        // 价值观冲突
        for value_a in &a.core.values {
            if b.core.taboos.iter().any(|t| t.contains(value_a)) {
                points.push(format!("{}重视'{}'，但{}视其为禁忌", a.name, value_a, b.name));
                severity += 0.3;
            }
        }

        // 宗教冲突
        if a.core.religion.id != b.core.religion.id {
            points.push(format!("{}信仰{}，{}信仰{}", 
                a.name, a.core.religion.name, b.name, b.core.religion.name));
            severity += 0.2;
        }

        // 个人主义 vs 集体主义
        let indiv_diff = (a.dimensions.individualism - b.dimensions.individualism).abs();
        if indiv_diff > 0.5 {
            points.push(format!("个人主义倾向差异显著: {:.1} vs {:.1}", 
                a.dimensions.individualism, b.dimensions.individualism));
            severity += indiv_diff * 0.2;
        }

        if points.is_empty() {
            return None;
        }

        Some(CulturalConflict {
            culture_a: culture_a_id.to_string(),
            culture_b: culture_b_id.to_string(),
            conflict_points: points,
            severity: severity.min(1.0),
        })
    }

    pub fn spread_culture(&mut self, from_region: &str, to_region: &str, amount: f32) {
        if let Some(culture_id) = self.region_culture_map.get(from_region).cloned() {
            if let Some(culture) = self.cultures.get_mut(&culture_id) {
                culture.influence = (culture.influence + amount).min(1.0);
                if !culture.spread_regions.contains(&to_region.to_string()) {
                    culture.spread_regions.push(to_region.to_string());
                }
            }
            self.region_culture_map.insert(to_region.to_string(), culture_id);
        }
    }

    fn register_defaults(&mut self) {
        let northern = Culture {
            id: "culture_northern_tribe".to_string(),
            name: "北地部落文化".to_string(),
            description: "崇尚力量与荣誉的游牧部落文化，重视血缘与忠诚。".to_string(),
            dimensions: CultureDimensions {
                individualism: -0.6,
                power_distance: 0.4,
                uncertainty_avoidance: -0.3,
                masculinity: 0.7,
                long_term_orientation: 0.2,
                indulgence: 0.5,
            },
            core: CultureCore {
                language: Language {
                    id: "lang_northern".to_string(),
                    name: "北地语".to_string(),
                    family: "古北语系".to_string(),
                    greetings: vec!["愿风指引你".to_string(), "荣耀归于氏族".to_string()],
                    profanity: vec!["懦夫".to_string(), "背叛者".to_string()],
                    honorifics: true,
                    dialects: vec!["草原方言".to_string(), "山地方言".to_string()],
                },
                religion: Religion {
                    id: "religion_storm_gods".to_string(),
                    name: "风暴神信仰".to_string(),
                    deities: vec![
                        Deity {
                            id: "deity_thunder".to_string(),
                            name: "雷神托尔格".to_string(),
                            domain: vec!["战争".to_string(), "风暴".to_string()],
                            alignment: "benevolent".to_string(),
                            symbol: "⚡".to_string(),
                            favored_offerings: vec!["武器".to_string(), "烈酒".to_string()],
                        },
                        Deity {
                            id: "deity_hunt".to_string(),
                            name: "猎神维尔娜".to_string(),
                            domain: vec!["狩猎".to_string(), "丰收".to_string()],
                            alignment: "neutral".to_string(),
                            symbol: "🏹".to_string(),
                            favored_offerings: vec!["猎物".to_string(), "草药".to_string()],
                        },
                    ],
                    doctrines: vec![
                        "力量即正义".to_string(),
                        "保护弱者".to_string(),
                        "荣誉高于生命".to_string(),
                    ],
                    rituals: vec![
                        Ritual {
                            id: "ritual_battle_blessing".to_string(),
                            name: "战前祝福".to_string(),
                            purpose: "祈求战斗胜利".to_string(),
                            required_items: vec!["武器".to_string(), "烈酒".to_string()],
                            steps: vec!["献上武器".to_string(), "饮下烈酒".to_string(), "念诵祷词".to_string()],
                            participant_roles: vec!["战士".to_string(), "萨满".to_string()],
                        },
                    ],
                    sacred_items: vec!["先祖战斧".to_string(), "雷霆之石".to_string()],
                    holy_days: vec![
                        HolyDay { name: "风暴节".to_string(), month: 3, day: 15, description: "纪念雷神的降临".to_string() },
                    ],
                    fervor: 0.8,
                },
                values: vec!["荣誉".to_string(), "忠诚".to_string(), "勇气".to_string(), "家族".to_string(), "力量".to_string()],
                taboos: vec!["背叛氏族".to_string(), "拒绝帮助求助者".to_string(), "在神圣场所争斗".to_string()],
                etiquette: vec![
                    EtiquetteRule {
                        id: "etq_guest_right".to_string(),
                        situation: "接待客人".to_string(),
                        expected_behavior: "提供食物和庇护".to_string(),
                        violation_consequence: "被视为耻辱".to_string(),
                        importance: "critical".to_string(),
                    },
                    EtiquetteRule {
                        id: "etq_elder_respect".to_string(),
                        situation: "面对长者".to_string(),
                        expected_behavior: "低头致意，先听后说".to_string(),
                        violation_consequence: "被斥为无礼".to_string(),
                        importance: "important".to_string(),
                    },
                ],
            },
            arts: vec![
                ArtForm {
                    id: "art_throat_singing".to_string(),
                    art_type: "music".to_string(),
                    name: "喉音唱法".to_string(),
                    description: "模仿自然声音的古老唱法".to_string(),
                    notable_works: vec!["风之歌".to_string(), "战吼".to_string()],
                },
                ArtForm {
                    id: "art_rune_carving".to_string(),
                    art_type: "craft".to_string(),
                    name: "符文雕刻".to_string(),
                    description: "在骨头和石头上雕刻神秘符文".to_string(),
                    notable_works: vec!["先祖骨牌".to_string(), "守护石".to_string()],
                },
            ],
            traditional_attire: "毛皮与皮革制成的保暖服装，佩戴氏族图腾饰品".to_string(),
            cuisine: Cuisine {
                staple_foods: vec!["烤肉".to_string(), "奶酪".to_string(), "黑麦面包".to_string()],
                preferred_flavors: vec!["咸".to_string(), "烟熏".to_string(), "辛辣".to_string()],
                taboo_ingredients: vec!["蛇肉".to_string(), "腐肉".to_string()],
                traditional_drinks: vec!["蜂蜜酒".to_string(), "烈性麦酒".to_string()],
                dining_etiquette: vec!["主人先饮".to_string(), "分享食物".to_string(), "不浪费肉食".to_string()],
            },
            architecture_style: "帐篷与木质结构，可移动，装饰以图腾柱".to_string(),
            influence: 0.6,
            vitality: 0.75,
            homeland_region_id: "region_northern_plains".to_string(),
            spread_regions: vec!["region_eastern_hills".to_string()],
        };

        let southern = Culture {
            id: "culture_southern_city".to_string(),
            name: "南方城邦文化".to_string(),
            description: "注重贸易与知识的城邦文明，讲究礼仪与法律。".to_string(),
            dimensions: CultureDimensions {
                individualism: 0.4,
                power_distance: 0.2,
                uncertainty_avoidance: 0.6,
                masculinity: -0.2,
                long_term_orientation: 0.7,
                indulgence: 0.3,
            },
            core: CultureCore {
                language: Language {
                    id: "lang_southern".to_string(),
                    name: "南方通用语".to_string(),
                    family: "古商语系".to_string(),
                    greetings: vec!["愿知识照亮你".to_string(), "贸易顺利".to_string()],
                    profanity: vec!["骗子".to_string(), "强盗".to_string()],
                    honorifics: true,
                    dialects: vec!["港口方言".to_string(), "学者方言".to_string()],
                },
                religion: Religion {
                    id: "religion_sun_moon".to_string(),
                    name: "日月教".to_string(),
                    deities: vec![
                        Deity {
                            id: "deity_sun".to_string(),
                            name: "太阳神索拉瑞斯".to_string(),
                            domain: vec!["光明".to_string(), "正义".to_string()],
                            alignment: "benevolent".to_string(),
                            symbol: "☀️".to_string(),
                            favored_offerings: vec!["黄金".to_string(), "镜子".to_string()],
                        },
                        Deity {
                            id: "deity_moon".to_string(),
                            name: "月神露娜".to_string(),
                            domain: vec!["智慧".to_string(), "秘密".to_string()],
                            alignment: "neutral".to_string(),
                            symbol: "🌙".to_string(),
                            favored_offerings: vec!["银器".to_string(), "书籍".to_string()],
                        },
                    ],
                    doctrines: vec![
                        "知识即力量".to_string(),
                        "公平交易".to_string(),
                        "光明驱散黑暗".to_string(),
                    ],
                    rituals: vec![
                        Ritual {
                            id: "ritual_market_blessing".to_string(),
                            name: "开市祝福".to_string(),
                            purpose: "祈求贸易繁荣".to_string(),
                            required_items: vec!["金币".to_string(), "香料".to_string()],
                            steps: vec!["献上贡品".to_string(), "诵读商法".to_string(), "敲响开市钟".to_string()],
                            participant_roles: vec!["商人".to_string(), "祭司".to_string()],
                        },
                    ],
                    sacred_items: vec!["太阳圆盘".to_string(), "月之卷轴".to_string()],
                    holy_days: vec![
                        HolyDay { name: "双至节".to_string(), month: 6, day: 21, description: "太阳最高之日".to_string() },
                    ],
                    fervor: 0.5,
                },
                values: vec!["知识".to_string(), "贸易".to_string(), "法律".to_string(), "和平".to_string(), "创新".to_string()],
                taboos: vec!["破坏契约".to_string(), "偷窃".to_string(), "公开暴力".to_string()],
                etiquette: vec![
                    EtiquetteRule {
                        id: "etq_bargain_fair".to_string(),
                        situation: "商业谈判".to_string(),
                        expected_behavior: "明码标价，不欺不瞒".to_string(),
                        violation_consequence: "被商会除名".to_string(),
                        importance: "critical".to_string(),
                    },
                    EtiquetteRule {
                        id: "etq_dress_code".to_string(),
                        situation: "正式场合".to_string(),
                        expected_behavior: "穿着得体，佩戴身份标识".to_string(),
                        violation_consequence: "被视为粗俗".to_string(),
                        importance: "important".to_string(),
                    },
                ],
            },
            arts: vec![
                ArtForm {
                    id: "art_opera".to_string(),
                    art_type: "theater".to_string(),
                    name: "城邦歌剧".to_string(),
                    description: "讲述历史与神话的音乐剧".to_string(),
                    notable_works: vec!["太阳王的崛起".to_string(), "月之低语".to_string()],
                },
                ArtForm {
                    id: "art_mosaic".to_string(),
                    art_type: "painting".to_string(),
                    name: "马赛克镶嵌".to_string(),
                    description: "用彩色石片拼贴图案".to_string(),
                    notable_works: vec!["四季图".to_string(), "港口全景".to_string()],
                },
            ],
            traditional_attire: "丝绸与棉麻制成的精致服装，佩戴贸易公会徽章".to_string(),
            cuisine: Cuisine {
                staple_foods: vec!["白面包".to_string(), "橄榄油".to_string(), "海鲜".to_string(), "葡萄酒".to_string()],
                preferred_flavors: vec!["酸".to_string(), "甜".to_string(), "鲜".to_string()],
                taboo_ingredients: vec!["人肉".to_string(), "有毒蘑菇".to_string()],
                traditional_drinks: vec!["葡萄酒".to_string(), "柑橘汁".to_string(), "茶".to_string()],
                dining_etiquette: vec!["等主人邀请".to_string(), "使用正确餐具".to_string(), "不谈论生意".to_string()],
            },
            architecture_style: "石质结构，拱门与圆顶，装饰以马赛克".to_string(),
            influence: 0.8,
            vitality: 0.9,
            homeland_region_id: "region_southern_coast".to_string(),
            spread_regions: vec!["region_western_isles".to_string(), "region_central_plains".to_string()],
        };

        self.register(northern);
        self.register(southern);
        self.assign_to_region("region_northern_plains", "culture_northern_tribe");
        self.assign_to_region("region_southern_coast", "culture_southern_city");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_culture_manager() {
        let manager = CultureManager::new();
        let culture = manager.get_for_region("region_northern_plains").unwrap();
        assert_eq!(culture.name, "北地部落文化");
    }

    #[test]
    fn test_cultural_conflict() {
        let manager = CultureManager::new();
        let conflict = manager.detect_conflict("culture_northern_tribe", "culture_southern_city");
        assert!(conflict.is_some());
        let c = conflict.unwrap();
        assert!(!c.conflict_points.is_empty());
        assert!(c.severity > 0.0);
    }

    #[test]
    fn test_taboo_check() {
        let manager = CultureManager::new();
        let taboo = manager.check_taboo("culture_northern_tribe", "背叛氏族");
        assert!(taboo.is_some());
    }
}
