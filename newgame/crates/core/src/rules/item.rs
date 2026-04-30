use super::Rule;
use crate::events::GameEvent;
use crate::models::{Item, InventorySlot};
use crate::state_store::StateStore;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;

#[derive(Deserialize)]
struct ItemAddPayload {
    pub item: Item,
    pub quantity: i32,
}

pub struct ItemRule;

#[async_trait]
impl Rule for ItemRule {
    fn event_type(&self) -> &str {
        "item_event"
    }

    fn validate(&self, event: &GameEvent) -> Result<()> {
        if event.payload.get("action").is_none() {
            return Err(anyhow!("Item event missing 'action' field"));
        }
        Ok(())
    }

    async fn apply(&self, event: &GameEvent, state: &StateStore) -> Result<Vec<GameEvent>> {
        let action = event.payload["action"].as_str().unwrap_or("");
        
        state.mutate(|world| {
            let mut inventory = world.variables["inventory"].clone();
            if !inventory.is_array() {
                inventory = serde_json::json!([]);
            }

            let inv_array = inventory.as_array_mut().expect("just ensured inventory is an array");

            match action {
                "add" => {
                    if let Ok(payload) = serde_json::from_value::<ItemAddPayload>(event.payload.clone()) {
                        let mut found = false;
                        if payload.item.is_stackable {
                            for slot in inv_array.iter_mut() {
                                if slot["item"]["id"] == payload.item.id {
                                    let current_qty = slot["quantity"].as_i64().unwrap_or(0);
                                    slot["quantity"] = serde_json::json!(current_qty + payload.quantity as i64);
                                    found = true;
                                    break;
                                }
                            }
                        }

                        if !found {
                            inv_array.push(serde_json::to_value(InventorySlot {
                                item: payload.item.clone(),
                                quantity: payload.quantity,
                            }).expect("InventorySlot serialization is infallible"));
                        }
                        println!("Item added: {}x {}", payload.quantity, payload.item.name);
                    }
                }
                "remove" => {
                    // Logic for removing items
                    if let Some(item_id) = event.payload.get("item_id").and_then(|v| v.as_str()) {
                        let qty_to_remove = event.payload.get("quantity").and_then(|v| v.as_i64()).unwrap_or(1);
                        
                        inv_array.retain_mut(|slot| {
                            if slot["item"]["id"] == item_id {
                                let current_qty = slot["quantity"].as_i64().unwrap_or(0);
                                if current_qty > qty_to_remove {
                                    slot["quantity"] = serde_json::json!(current_qty - qty_to_remove);
                                    true
                                } else {
                                    false // Remove the item entirely
                                }
                            } else {
                                true
                            }
                        });
                        println!("Item removed: {}", item_id);
                    }
                }
                _ => {
                    println!("Unknown item action: {}", action);
                }
            }

            world.variables["inventory"] = serde_json::Value::Array(inv_array.clone());
        }).await;

        Ok(vec![])
    }
}
