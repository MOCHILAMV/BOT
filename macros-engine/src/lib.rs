use napi::bindgen_prelude::*;
use napi_derive::napi;
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::sync::Mutex;

#[napi]
pub struct MacroEngine {
    db_path: String,
    macros: Mutex<HashMap<String, String>>,
}

#[napi]
impl MacroEngine {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let db_path = "macros.db".to_string();
        let conn = Connection::open(&db_path).map_err(|e| Error::from_reason(e.to_string()))?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS macros(name TEXT PRIMARY KEY, command TEXT NOT NULL)",
            [],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;
        let mut m = HashMap::new();
        let mut stmt = conn
            .prepare("SELECT name, command FROM macros")
            .map_err(|e| Error::from_reason(e.to_string()))?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| Error::from_reason(e.to_string()))?;
        for row in rows {
            let (k, v) = row.map_err(|e| Error::from_reason(e.to_string()))?;
            m.insert(k, v);
        }
        Ok(Self {
            db_path,
            macros: Mutex::new(m),
        })
    }

    #[napi]
    pub fn resolve(&self, key: String) -> Option<String> {
        let guard = self.macros.lock().unwrap();
        guard.get(&key).cloned()
    }

    #[napi]
    pub fn add(&self, key: String, command: String) -> Result<bool> {
        let conn = Connection::open(&self.db_path).map_err(|e| Error::from_reason(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO macros(name, command) VALUES(?1, ?2)",
            params![key, command],
        )
        .map_err(|e| Error::from_reason(e.to_string()))?;
        let mut guard = self.macros.lock().unwrap();
        guard.insert(key, command);
        Ok(true)
    }

    #[napi]
    pub fn del(&self, key: String) -> Result<bool> {
        let conn = Connection::open(&self.db_path).map_err(|e| Error::from_reason(e.to_string()))?;
        let changed = conn
            .execute("DELETE FROM macros WHERE name = ?1", params![key])
            .map_err(|e| Error::from_reason(e.to_string()))?;
        let mut guard = self.macros.lock().unwrap();
        let existed = guard.remove(&key).is_some();
        Ok(changed > 0 || existed)
    }

    #[napi]
    pub fn list(&self) -> Vec<Vec<String>> {
        let guard = self.macros.lock().unwrap();
        let mut out = Vec::with_capacity(guard.len());
        for (k, v) in guard.iter() {
            out.push(vec![k.clone(), v.clone()]);
        }
        out
    }
}
