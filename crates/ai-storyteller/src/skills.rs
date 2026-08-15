use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;

use crate::types::AgentRole;

static CACHE: OnceLock<HashMap<AgentRole, String>> = OnceLock::new();

const DIRS: &[(AgentRole, &str)] = &[
    (AgentRole::Narrator, "narrator"),
    (AgentRole::WorldKeeper, "world-keeper"),
    (AgentRole::NpcDirector, "npc-director"),
    (AgentRole::RuleArbiter, "rule-arbiter"),
    (AgentRole::DramaCurator, "drama-curator"),
];

pub fn prompt_for(role: AgentRole) -> Option<String> {
    CACHE.get_or_init(load_all).get(&role).cloned()
}

pub fn loaded_roles() -> Vec<AgentRole> {
    CACHE.get_or_init(load_all).keys().copied().collect()
}

fn load_all() -> HashMap<AgentRole, String> {
    let mut map = HashMap::new();
    for root in skill_roots() {
        for (role, dir) in DIRS {
            if map.contains_key(role) {
                continue;
            }
            let path = root.join(dir).join("SKILL.md");
            if let Ok(raw) = std::fs::read_to_string(&path) {
                let body = strip_frontmatter(&raw);
                if !body.is_empty() {
                    map.insert(*role, body);
                }
            }
        }
    }
    map
}

fn skill_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join("skills"));
        roots.push(cwd.join("../skills"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            roots.push(dir.join("skills"));
            roots.push(dir.join("../skills"));
        }
    }
    roots.into_iter().filter(|p| p.is_dir()).collect()
}

pub fn strip_frontmatter(raw: &str) -> String {
    let trimmed = raw.trim_start_matches('\u{feff}').trim_start();
    if let Some(rest) = trimmed.strip_prefix("---") {
        let rest = rest.strip_prefix('\r').unwrap_or(rest);
        let rest = rest.strip_prefix('\n').unwrap_or(rest);
        if let Some(idx) = rest.find("\n---") {
            return rest[idx + 4..].trim().to_string();
        }
    }
    trimmed.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_yaml_frontmatter() {
        let raw = "---\nname: narrator\n---\n\n# Hello\nbody";
        assert_eq!(strip_frontmatter(raw), "# Hello\nbody");
    }

    #[test]
    fn leaves_plain_markdown() {
        assert_eq!(strip_frontmatter("just text"), "just text");
    }

    #[test]
    fn finds_repo_skill_files() {
        let roots = skill_roots();
        if roots.iter().any(|p| p.join("narrator/SKILL.md").is_file()) {
            assert!(prompt_for(AgentRole::Narrator).unwrap().contains("主叙述"));
        }
    }
}
