use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventNode {
    pub id: String,
    pub event_type: String,
    pub description: String,
    pub timestamp: i64,
    pub actor_id: Option<String>,
    pub target_id: Option<String>,
    pub location_id: Option<String>,
    pub causal_weight: f32,
    pub player_initiated: bool,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CausalType {
    Direct,
    Indirect,
    Enabling,
    Preventing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CausalEdge {
    pub id: String,
    pub cause_event_id: String,
    pub effect_event_id: String,
    pub causal_type: CausalType,
    pub strength: f32,
    pub time_delay: i64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventChain {
    pub id: String,
    pub name: String,
    pub description: String,
    pub events: Vec<String>,
    pub status: ChainStatus,
    pub trigger_condition: String,
    pub expected_outcome: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ChainStatus {
    Active,
    Resolved,
    Dormant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryQuery {
    pub time_range: Option<(i64, i64)>,
    pub location_ids: Option<Vec<String>>,
    pub actor_ids: Option<Vec<String>>,
    pub event_types: Option<Vec<String>>,
    pub causal_depth: Option<usize>,
    pub keywords: Option<Vec<String>>,
}

pub struct EventGraph {
    nodes: HashMap<String, EventNode>,
    edges: HashMap<String, CausalEdge>,
    #[allow(dead_code)]
    chains: HashMap<String, EventChain>,
    cause_index: HashMap<String, Vec<String>>,
    effect_index: HashMap<String, Vec<String>>,
}

impl Default for EventGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl EventGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            chains: HashMap::new(),
            cause_index: HashMap::new(),
            effect_index: HashMap::new(),
        }
    }

    pub fn record_event(&mut self, event: EventNode) -> Option<&EventNode> {
        let id = event.id.clone();
        self.nodes.insert(id.clone(), event);
        self.nodes.get(&id)
    }

    pub fn link_causality(
        &mut self,
        cause_event_id: impl Into<String>,
        effect_event_id: impl Into<String>,
        causal_type: CausalType,
        strength: f32,
        description: impl Into<String>,
    ) -> Option<&CausalEdge> {
        let cause_id = cause_event_id.into();
        let effect_id = effect_event_id.into();
        let edge_id = format!("{}->{}", cause_id, effect_id);

        let edge = CausalEdge {
            id: edge_id.clone(),
            cause_event_id: cause_id.clone(),
            effect_event_id: effect_id.clone(),
            causal_type,
            strength,
            time_delay: 0,
            description: description.into(),
        };

        self.cause_index.entry(cause_id.clone()).or_default().push(edge_id.clone());
        self.effect_index.entry(effect_id.clone()).or_default().push(edge_id.clone());
        self.edges.insert(edge_id.clone(), edge);
        self.edges.get(&edge_id)
    }

    pub fn find_causes(&self, event_id: &str, depth: usize) -> Vec<&EventNode> {
        let mut results = vec![];
        let mut visited = std::collections::HashSet::new();
        self.find_causes_recursive(event_id, depth, &mut visited, &mut results);
        results
    }

    fn find_causes_recursive<'a>(
        &'a self,
        event_id: &str,
        depth: usize,
        visited: &mut std::collections::HashSet<String>,
        results: &mut Vec<&'a EventNode>,
    ) {
        if depth == 0 || !visited.insert(event_id.to_string()) {
            return;
        }

        if let Some(edge_ids) = self.effect_index.get(event_id) {
            for edge_id in edge_ids {
                if let Some(edge) = self.edges.get(edge_id) {
                    if let Some(node) = self.nodes.get(&edge.cause_event_id) {
                        results.push(node);
                        self.find_causes_recursive(&edge.cause_event_id, depth - 1, visited, results);
                    }
                }
            }
        }
    }

    pub fn find_effects(&self, event_id: &str, depth: usize) -> Vec<&EventNode> {
        let mut results = vec![];
        let mut visited = std::collections::HashSet::new();
        self.find_effects_recursive(event_id, depth, &mut visited, &mut results);
        results
    }

    fn find_effects_recursive<'a>(
        &'a self,
        event_id: &str,
        depth: usize,
        visited: &mut std::collections::HashSet<String>,
        results: &mut Vec<&'a EventNode>,
    ) {
        if depth == 0 || !visited.insert(event_id.to_string()) {
            return;
        }

        if let Some(edge_ids) = self.cause_index.get(event_id) {
            for edge_id in edge_ids {
                if let Some(edge) = self.edges.get(edge_id) {
                    if let Some(node) = self.nodes.get(&edge.effect_event_id) {
                        results.push(node);
                        self.find_effects_recursive(&edge.effect_event_id, depth - 1, visited, results);
                    }
                }
            }
        }
    }

    pub fn query_history(&self, query: &HistoryQuery) -> Vec<&EventNode> {
        self.nodes.values().filter(|node| {
            if let Some((start, end)) = query.time_range {
                if node.timestamp < start || node.timestamp > end {
                    return false;
                }
            }

            if let Some(loc_ids) = &query.location_ids {
                if let Some(loc) = &node.location_id {
                    if !loc_ids.contains(loc) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            if let Some(actor_ids) = &query.actor_ids {
                if let Some(actor) = &node.actor_id {
                    if !actor_ids.contains(actor) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            if let Some(types) = &query.event_types {
                if !types.contains(&node.event_type) {
                    return false;
                }
            }

            if let Some(keywords) = &query.keywords {
                let text = format!("{} {} {:?}", node.description, node.event_type, node.payload);
                if !keywords.iter().any(|kw| text.contains(kw)) {
                    return false;
                }
            }

            true
        }).collect()
    }

    pub fn generate_event_summary(&self, event_id: &str) -> Option<String> {
        let node = self.nodes.get(event_id)?;
        let causes = self.find_causes(event_id, 2);
        let effects = self.find_effects(event_id, 2);

        let mut summary = format!("事件: {}\n", node.description);
        summary.push_str(&format!("时间: {}\n", node.timestamp));
        summary.push_str(&format!("类型: {}\n", node.event_type));

        if !causes.is_empty() {
            summary.push_str("\n原因:\n");
            for cause in causes.iter().take(5) {
                summary.push_str(&format!("  - {}\n", cause.description));
            }
        }

        if !effects.is_empty() {
            summary.push_str("\n结果:\n");
            for effect in effects.iter().take(5) {
                summary.push_str(&format!("  - {}\n", effect.description));
            }
        }

        Some(summary)
    }

    pub fn generate_history_narrative(&self, query: &HistoryQuery) -> String {
        let events = self.query_history(query);
        if events.is_empty() {
            return "该时段没有记录任何事件。".to_string();
        }

        let mut narrative = String::from("历史记录:\n\n");
        for event in events.iter().take(20) {
            narrative.push_str(&format!("[{}] {}\n", event.timestamp, event.description));
        }

        narrative
    }

    pub fn infer_causality(&mut self, event_id: &str, time_window_ms: i64) {
        if let Some(node) = self.nodes.get(event_id).cloned() {
            let candidates: Vec<_> = self.nodes.values()
                .filter(|n| {
                    n.id != event_id
                        && (node.timestamp - n.timestamp).abs() < time_window_ms
                        && n.timestamp < node.timestamp
                })
                .cloned()
                .collect();

            for candidate in candidates {
                let mut strength: f32 = 0.0;
                let mut description = String::new();

                if node.location_id.is_some() && node.location_id == candidate.location_id {
                    strength += 0.3;
                    description.push_str("同地点 ");
                }

                if node.actor_id.is_some() && node.actor_id == candidate.actor_id {
                    strength += 0.4;
                    description.push_str("同角色 ");
                }

                if node.event_type == candidate.event_type {
                    strength += 0.2;
                    description.push_str("同类型 ");
                }

                if strength > 0.5 {
                    let clamped_strength: f32 = if strength > 1.0 { 1.0 } else { strength };
                    self.link_causality(
                        candidate.id.clone(),
                        event_id.to_string(),
                        CausalType::Direct,
                        clamped_strength,
                        description,
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_event(id: &str, event_type: &str, desc: &str, timestamp: i64) -> EventNode {
        EventNode {
            id: id.to_string(),
            event_type: event_type.to_string(),
            description: desc.to_string(),
            timestamp,
            actor_id: Some("player".to_string()),
            target_id: None,
            location_id: Some("loc1".to_string()),
            causal_weight: 0.5,
            player_initiated: true,
            payload: HashMap::new(),
        }
    }

    #[test]
    fn test_event_graph() {
        let mut graph = EventGraph::new();
        let event1 = create_test_event("e1", "action", "玩家进入森林", 1000);
        let event2 = create_test_event("e2", "encounter", "遇到狼群", 2000);
        let event3 = create_test_event("e3", "combat", "战斗开始", 3000);

        graph.record_event(event1);
        graph.record_event(event2);
        graph.record_event(event3);

        graph.link_causality("e1", "e2", CausalType::Direct, 0.8, "进入森林导致遭遇");
        graph.link_causality("e2", "e3", CausalType::Direct, 0.9, "遭遇导致战斗");

        let causes = graph.find_causes("e3", 2);
        assert_eq!(causes.len(), 2);

        let effects = graph.find_effects("e1", 2);
        assert_eq!(effects.len(), 2);
    }

    #[test]
    fn test_history_query() {
        let mut graph = EventGraph::new();
        graph.record_event(create_test_event("e1", "action", "测试1", 1000));
        graph.record_event(create_test_event("e2", "combat", "测试2", 2000));

        let query = HistoryQuery {
            time_range: Some((500, 1500)),
            location_ids: None,
            actor_ids: None,
            event_types: None,
            causal_depth: None,
            keywords: None,
        };

        let results = graph.query_history(&query);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_infer_causality() {
        let mut graph = EventGraph::new();
        let mut e1 = create_test_event("e1", "action", "进入森林", 1000);
        e1.location_id = Some("forest".to_string());
        let mut e2 = create_test_event("e2", "encounter", "发现狼", 1500);
        e2.location_id = Some("forest".to_string());

        graph.record_event(e1);
        graph.record_event(e2);
        graph.infer_causality("e2", 10000);

        let causes = graph.find_causes("e2", 1);
        assert!(!causes.is_empty());
    }
}
