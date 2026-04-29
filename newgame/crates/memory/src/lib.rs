pub mod error;
pub mod models;
pub mod store;
pub mod sqlite;
pub mod in_memory;

pub use error::MemoryError;
pub use models::MemoryEntry;
pub use store::MemoryStore;
pub use sqlite::SqliteMemoryStore;
pub use in_memory::InMemoryStore;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
