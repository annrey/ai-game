use crate::types::{AgentRole, ChainOfThought, CotStep, CotStepType};

const MARKERS: &[(CotStepType, &[&str], &str)] = &[
    (CotStepType::Observation, &["【观察】", "[Observation]", "## Observation", "观察："], "观察"),
    (CotStepType::Analysis, &["【分析】", "[Analysis]", "## Analysis", "分析："], "分析"),
    (CotStepType::Reasoning, &["【推理】", "[Reasoning]", "## Reasoning", "推理："], "推理"),
    (CotStepType::Decision, &["【决策】", "[Decision]", "## Decision", "决策："], "决策"),
    (CotStepType::Action, &["【行动】", "[Action]", "## Action", "行动："], "行动"),
];

pub fn extract_chain_of_thought(content: &str, role: AgentRole, start_ms: u64, end_ms: u64) -> ChainOfThought {
    let total = end_ms.saturating_sub(start_ms);
    let all_markers: Vec<&str> = MARKERS.iter().flat_map(|(_, ms, _)| ms.iter().copied()).collect();
    let mut steps = Vec::new();
    for (kind, markers, title) in MARKERS {
        let mut found = None;
        for marker in *markers {
            if let Some(idx) = content.find(marker) {
                let start = idx + marker.len();
                let mut end = content.len();
                for next in &all_markers {
                    if let Some(nidx) = content[start..].find(next) {
                        end = end.min(start + nidx);
                    }
                }
                found = Some(content[start..end].trim().to_string());
                break;
            }
        }
        if let Some(text) = found {
            if !text.is_empty() {
                steps.push(CotStep {
                    step: *kind,
                    title: (*title).into(),
                    content: text,
                    duration: Some(total / MARKERS.len() as u64),
                });
            }
        }
    }
    let summary = if steps.is_empty() {
        "无结构化思维标记".into()
    } else {
        steps
            .iter()
            .map(|s| format!("{}: {}", s.title, s.content.chars().take(40).collect::<String>()))
            .collect::<Vec<_>>()
            .join(" / ")
    };
    ChainOfThought {
        id: uuid::Uuid::new_v4().to_string(),
        agent_role: role,
        timestamp: end_ms,
        steps,
        summary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_markers_means_empty_steps() {
        let cot = extract_chain_of_thought("普通回复", AgentRole::Narrator, 0, 10);
        assert!(cot.steps.is_empty());
        assert!(cot.summary.contains("无结构化"));
    }

    #[test]
    fn extracts_marked_steps() {
        let text = "【观察】看到路口\n【分析】玩家想探索\n【推理】北面有路\n【决策】描写环境\n【行动】你向北走去";
        let cot = extract_chain_of_thought(text, AgentRole::Narrator, 0, 50);
        assert_eq!(cot.steps.len(), 5);
    }
}
