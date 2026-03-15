use napi::bindgen_prelude::*;
use napi_derive::napi;
use rusqlite::{params, Connection};
use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard};

#[napi]
pub struct MacroEngine {
    db_path: String,
    macros: Mutex<BTreeMap<String, String>>,
}

#[napi]
impl MacroEngine {
    #[napi(constructor)]
    pub fn new(path: Option<String>) -> Result<Self> {
        let db_path = path.unwrap_or_else(|| "data/macros.db".to_string());
        let conn = Self::open_connection(&db_path)?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS macros (
                name TEXT PRIMARY KEY,
                command TEXT NOT NULL
            );
            ",
        )
        .map_err(Self::to_napi_error)?;

        let macros = Self::load_macros(&conn)?;

        Ok(Self {
            db_path,
            macros: Mutex::new(macros),
        })
    }

    #[napi]
    pub fn resolve(&self, key: String) -> Option<String> {
        let guard = self.lock_macros().ok()?;
        guard.get(&key).cloned()
    }

    #[napi]
    pub fn add(&self, key: String, command: String) -> Result<bool> {
        let conn = self.open_db()?;

        conn.execute(
            "INSERT OR REPLACE INTO macros(name, command) VALUES(?1, ?2)",
            params![&key, &command],
        )
        .map_err(Self::to_napi_error)?;

        let mut guard = self.lock_macros()?;
        guard.insert(key, command);

        Ok(true)
    }

    #[napi]
    pub fn del(&self, key: String) -> Result<bool> {
        let conn = self.open_db()?;

        let changed = conn
            .execute("DELETE FROM macros WHERE name = ?1", params![&key])
            .map_err(Self::to_napi_error)?;

        let mut guard = self.lock_macros()?;
        let existed = guard.remove(&key).is_some();

        Ok(changed > 0 || existed)
    }

    #[napi]
    pub fn list(&self) -> Vec<Vec<String>> {
        let guard = match self.lock_macros() {
            Ok(guard) => guard,
            Err(_) => return Vec::new(),
        };

        let mut out = Vec::with_capacity(guard.len());

        for (key, value) in guard.iter() {
            out.push(vec![key.clone(), value.clone()]);
        }

        out
    }
}

impl MacroEngine {
    fn to_napi_error<E: std::fmt::Display>(err: E) -> Error {
        Error::from_reason(err.to_string())
    }

    fn open_connection(db_path: &str) -> Result<Connection> {
        Connection::open(db_path).map_err(Self::to_napi_error)
    }

    fn open_db(&self) -> Result<Connection> {
        Self::open_connection(&self.db_path)
    }

    fn lock_macros(&self) -> Result<MutexGuard<'_, BTreeMap<String, String>>> {
        self.macros
            .lock()
            .map_err(|_| Error::from_reason("failed to lock macros store".to_string()))
    }

    fn load_macros(conn: &Connection) -> Result<BTreeMap<String, String>> {
        let mut stmt = conn
            .prepare("SELECT name, command FROM macros ORDER BY name ASC")
            .map_err(Self::to_napi_error)?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(Self::to_napi_error)?;

        let mut macros = BTreeMap::new();

        for row in rows {
            let (key, value) = row.map_err(Self::to_napi_error)?;
            macros.insert(key, value);
        }

        Ok(macros)
    }
}
