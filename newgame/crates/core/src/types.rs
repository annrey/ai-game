//! 类型安全的游戏数据结构
//!
//! 提供强类型替代方案，减少 serde_json::Value 的使用

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 游戏变量容器 - 类型安全的替代方案
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GameVariables {
    /// 字符串变量
    #[serde(default)]
    pub strings: HashMap<String, String>,
    /// 整数变量
    #[serde(default)]
    pub integers: HashMap<String, i64>,
    /// 浮点数变量
    #[serde(default)]
    pub floats: HashMap<String, f64>,
    /// 布尔变量
    #[serde(default)]
    pub booleans: HashMap<String, bool>,
    /// 字符串列表
    #[serde(default)]
    pub string_lists: HashMap<String, Vec<String>>,
}

impl GameVariables {
    /// 创建空变量容器
    pub fn new() -> Self {
        Self::default()
    }

    /// 设置字符串变量
    pub fn set_string(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.strings.insert(key.into(), value.into());
    }

    /// 获取字符串变量
    pub fn get_string(&self, key: &str) -> Option<&String> {
        self.strings.get(key)
    }

    /// 设置整数变量
    pub fn set_int(&mut self, key: impl Into<String>, value: i64) {
        self.integers.insert(key.into(), value);
    }

    /// 获取整数变量
    pub fn get_int(&self, key: &str) -> Option<i64> {
        self.integers.get(key).copied()
    }

    /// 设置浮点数变量
    pub fn set_float(&mut self, key: impl Into<String>, value: f64) {
        self.floats.insert(key.into(), value);
    }

    /// 获取浮点数变量
    pub fn get_float(&self, key: &str) -> Option<f64> {
        self.floats.get(key).copied()
    }

    /// 设置布尔变量
    pub fn set_bool(&mut self, key: impl Into<String>, value: bool) {
        self.booleans.insert(key.into(), value);
    }

    /// 获取布尔变量
    pub fn get_bool(&self, key: &str) -> Option<bool> {
        self.booleans.get(key).copied()
    }

    /// 设置字符串列表
    pub fn set_string_list(&mut self, key: impl Into<String>, value: Vec<String>) {
        self.string_lists.insert(key.into(), value);
    }

    /// 获取字符串列表
    pub fn get_string_list(&self, key: &str) -> Option<&Vec<String>> {
        self.string_lists.get(key)
    }

    /// 检查变量是否存在
    pub fn contains(&self, key: &str) -> bool {
        self.strings.contains_key(key)
            || self.integers.contains_key(key)
            || self.floats.contains_key(key)
            || self.booleans.contains_key(key)
            || self.string_lists.contains_key(key)
    }

    /// 删除变量（所有类型）
    pub fn remove(&mut self, key: &str) {
        self.strings.remove(key);
        self.integers.remove(key);
        self.floats.remove(key);
        self.booleans.remove(key);
        self.string_lists.remove(key);
    }

    /// 获取所有变量键
    pub fn keys(&self) -> Vec<String> {
        let mut keys = Vec::new();
        keys.extend(self.strings.keys().cloned());
        keys.extend(self.integers.keys().cloned());
        keys.extend(self.floats.keys().cloned());
        keys.extend(self.booleans.keys().cloned());
        keys.extend(self.string_lists.keys().cloned());
        keys
    }

    /// 从旧版 serde_json::Value 迁移
    pub fn from_json(value: &serde_json::Value) -> Self {
        let mut vars = Self::new();

        if let Some(obj) = value.as_object() {
            for (key, val) in obj {
                match val {
                    serde_json::Value::String(s) => {
                        vars.set_string(key.clone(), s.clone());
                    }
                    serde_json::Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            vars.set_int(key.clone(), i);
                        } else if let Some(f) = n.as_f64() {
                            vars.set_float(key.clone(), f);
                        }
                    }
                    serde_json::Value::Bool(b) => {
                        vars.set_bool(key.clone(), *b);
                    }
                    serde_json::Value::Array(arr) => {
                        let strings: Vec<String> = arr
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect();
                        if !strings.is_empty() {
                            vars.set_string_list(key.clone(), strings);
                        }
                    }
                    _ => {}
                }
            }
        }

        vars
    }

    /// 转换为 serde_json::Value（用于兼容旧代码）
    pub fn to_json(&self) -> serde_json::Value {
        let mut map = serde_json::Map::new();

        for (k, v) in &self.strings {
            map.insert(k.clone(), serde_json::json!(v));
        }
        for (k, v) in &self.integers {
            map.insert(k.clone(), serde_json::json!(v));
        }
        for (k, v) in &self.floats {
            map.insert(k.clone(), serde_json::json!(v));
        }
        for (k, v) in &self.booleans {
            map.insert(k.clone(), serde_json::json!(v));
        }
        for (k, v) in &self.string_lists {
            map.insert(k.clone(), serde_json::json!(v));
        }

        serde_json::Value::Object(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_variables_basic() {
        let mut vars = GameVariables::new();

        vars.set_string("player_name", "Alice");
        vars.set_int("health", 100);
        vars.set_float("mana", 50.5);
        vars.set_bool("is_alive", true);

        assert_eq!(vars.get_string("player_name"), Some(&"Alice".to_string()));
        assert_eq!(vars.get_int("health"), Some(100));
        assert_eq!(vars.get_float("mana"), Some(50.5));
        assert_eq!(vars.get_bool("is_alive"), Some(true));
    }

    #[test]
    fn test_game_variables_json_roundtrip() {
        let mut vars = GameVariables::new();
        vars.set_string("genre", "fantasy");
        vars.set_int("turn", 5);

        let json = vars.to_json();
        let restored = GameVariables::from_json(&json);

        assert_eq!(restored.get_string("genre"), Some(&"fantasy".to_string()));
        assert_eq!(restored.get_int("turn"), Some(5));
    }
}
