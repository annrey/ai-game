use std::sync::Arc;
use tokio::sync::broadcast;
use crate::events::GameEvent;

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<GameEvent>,
}

impl EventBus {
    /// Creates a new EventBus with the specified channel capacity.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Subscribes to the EventBus, returning a Receiver.
    /// 
    /// Receivers will receive all events broadcasted *after* they subscribe.
    pub fn subscribe(&self) -> broadcast::Receiver<GameEvent> {
        self.sender.subscribe()
    }

    /// Broadcasts an event to all active subscribers.
    ///
    /// Returns the number of receivers the message was sent to.
    /// If there are no receivers, it returns an error, which is often safe to ignore
    /// if the system expects times with zero listeners.
    pub fn publish(&self, event: GameEvent) -> Result<usize, broadcast::error::SendError<GameEvent>> {
        self.sender.send(event)
    }
}
