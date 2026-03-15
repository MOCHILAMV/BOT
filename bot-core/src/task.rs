use napi::bindgen_prelude::*;
use napi_derive::napi;
use rusqlite::{params, Connection, OptionalExtension};

#[napi(object)]
pub struct TaskEntry {
    pub id: i64,
    pub command: String,
    pub interval_ms: i64,
    pub next_run_ms: i64,
    pub mode: String,
    pub enabled: bool,
}

#[napi]
pub struct TaskManager {
    db_path: String,
}

const MODE_ONCE: &str = "once";
const MODE_LOOP: &str = "loop";

#[napi]
impl TaskManager {
    #[napi(constructor)]
    pub fn new(path: Option<String>) -> Result<Self> {
        let db_path = path.unwrap_or_else(|| "tasks.db".to_string());
        let conn = Self::open_connection(&db_path)?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command TEXT NOT NULL,
                interval_ms INTEGER NOT NULL,
                next_run_ms INTEGER NOT NULL,
                mode TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS scheduler_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER NOT NULL
            );

            INSERT OR IGNORE INTO scheduler_state (id, enabled)
            VALUES (1, 1);
            ",
        )
        .map_err(Self::to_napi_error)?;

        Ok(Self { db_path })
    }

    #[napi]
    pub fn create_once_task(&self, command: String, interval_ms: i64) -> Result<TaskEntry> {
        self.create_task(command, interval_ms, MODE_ONCE)
    }

    #[napi]
    pub fn create_loop_task(&self, command: String, interval_ms: i64) -> Result<TaskEntry> {
        self.create_task(command, interval_ms, MODE_LOOP)
    }

    #[napi]
    pub fn list_tasks(&self) -> Result<Vec<TaskEntry>> {
        let conn = self.open_db()?;

        let mut stmt = conn
            .prepare(
                "
                SELECT id, command, interval_ms, next_run_ms, mode, enabled
                FROM tasks
                ORDER BY next_run_ms ASC, id ASC
                ",
            )
            .map_err(Self::to_napi_error)?;

        let rows = stmt
            .query_map([], Self::row_to_task)
            .map_err(Self::to_napi_error)?;

        let mut tasks = Vec::new();

        for row in rows {
            tasks.push(row.map_err(Self::to_napi_error)?);
        }

        Ok(tasks)
    }

    #[napi]
    pub fn remove_task(&self, id: i64) -> Result<bool> {
        let conn = self.open_db()?;

        let changed = conn
            .execute("DELETE FROM tasks WHERE id = ?1", params![id])
            .map_err(Self::to_napi_error)?;

        Ok(changed > 0)
    }

    #[napi]
    pub fn clear_tasks(&self) -> Result<bool> {
        let conn = self.open_db()?;

        conn.execute("DELETE FROM tasks", [])
            .map_err(Self::to_napi_error)?;

        Ok(true)
    }

    #[napi]
    pub fn set_task_enabled(&self, id: i64, enabled: bool) -> Result<Option<TaskEntry>> {
        let conn = self.open_db()?;
        let enabled_value = Self::bool_to_int(enabled);

        let changed = conn
            .execute(
                "UPDATE tasks SET enabled = ?1 WHERE id = ?2",
                params![enabled_value, id],
            )
            .map_err(Self::to_napi_error)?;

        if changed == 0 {
            return Ok(None);
        }

        if enabled {
            conn.execute(
                "UPDATE tasks SET next_run_ms = ?1 WHERE id = ?2",
                params![Self::now_ms(), id],
            )
            .map_err(Self::to_napi_error)?;
        }

        self.get_task_by_id_with_conn(&conn, id)
    }

    #[napi]
    pub fn toggle_scheduler(&self) -> Result<bool> {
        let conn = self.open_db()?;
        let current = self.read_scheduler_enabled_with_conn(&conn)?;
        let next = !current;

        conn.execute(
            "UPDATE scheduler_state SET enabled = ?1 WHERE id = 1",
            params![Self::bool_to_int(next)],
        )
        .map_err(Self::to_napi_error)?;

        Ok(next)
    }

    #[napi]
    pub fn is_scheduler_enabled(&self) -> Result<bool> {
        let conn = self.open_db()?;
        self.read_scheduler_enabled_with_conn(&conn)
    }

    #[napi]
    pub fn advance_task(&self, id: i64) -> Result<Option<TaskEntry>> {
        let conn = self.open_db()?;
        let task = self.get_task_by_id_with_conn(&conn, id)?;

        let Some(task) = task else {
            return Ok(None);
        };

        if task.mode != MODE_LOOP {
            return Ok(None);
        }

        if !task.enabled {
            return Ok(Some(task));
        }

        let next_run_ms = Self::now_ms() + task.interval_ms;

        conn.execute(
            "UPDATE tasks SET next_run_ms = ?1 WHERE id = ?2",
            params![next_run_ms, id],
        )
        .map_err(Self::to_napi_error)?;

        self.get_task_by_id_with_conn(&conn, id)
    }
}

impl TaskManager {
    fn to_napi_error<E: std::fmt::Display>(err: E) -> Error {
        Error::from_reason(err.to_string())
    }

    fn open_connection(db_path: &str) -> Result<Connection> {
        Connection::open(db_path).map_err(Self::to_napi_error)
    }

    fn open_db(&self) -> Result<Connection> {
        Self::open_connection(&self.db_path)
    }

    fn now_ms() -> i64 {
        use std::time::{SystemTime, UNIX_EPOCH};

        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(duration) => duration.as_millis() as i64,
            Err(_) => 0,
        }
    }

    fn bool_to_int(value: bool) -> i64 {
        if value { 1 } else { 0 }
    }

    fn normalize_mode(mode: &str) -> Result<&'static str> {
        match mode {
            MODE_ONCE => Ok(MODE_ONCE),
            MODE_LOOP => Ok(MODE_LOOP),
            _ => Err(Error::from_reason("invalid task mode".to_string())),
        }
    }

    fn validate_task_input(command: &str, interval_ms: i64) -> Result<()> {
        if command.trim().is_empty() {
            return Err(Error::from_reason("task command cannot be empty".to_string()));
        }

        if interval_ms <= 0 {
            return Err(Error::from_reason("task interval_ms must be > 0".to_string()));
        }

        Ok(())
    }

    fn create_task(&self, command: String, interval_ms: i64, mode: &str) -> Result<TaskEntry> {
        Self::validate_task_input(&command, interval_ms)?;
        let mode = Self::normalize_mode(mode)?;

        let conn = self.open_db()?;
        let next_run_ms = Self::now_ms() + interval_ms;

        conn.execute(
            "
            INSERT INTO tasks (command, interval_ms, next_run_ms, mode, enabled)
            VALUES (?1, ?2, ?3, ?4, 1)
            ",
            params![&command, interval_ms, next_run_ms, mode],
        )
        .map_err(Self::to_napi_error)?;

        let id = conn.last_insert_rowid();

        Ok(TaskEntry {
            id,
            command,
            interval_ms,
            next_run_ms,
            mode: mode.to_string(),
            enabled: true,
        })
    }

    fn read_scheduler_enabled_with_conn(&self, conn: &Connection) -> Result<bool> {
        let enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM scheduler_state WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .map_err(Self::to_napi_error)?;

        Ok(enabled != 0)
    }

    fn get_task_by_id_with_conn(&self, conn: &Connection, id: i64) -> Result<Option<TaskEntry>> {
        conn.query_row(
            "
            SELECT id, command, interval_ms, next_run_ms, mode, enabled
            FROM tasks
            WHERE id = ?1
            ",
            params![id],
            Self::row_to_task,
        )
        .optional()
        .map_err(Self::to_napi_error)
    }

    fn row_to_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskEntry> {
        let enabled: i64 = row.get(5)?;

        Ok(TaskEntry {
            id: row.get(0)?,
            command: row.get(1)?,
            interval_ms: row.get(2)?,
            next_run_ms: row.get(3)?,
            mode: row.get(4)?,
            enabled: enabled != 0,
        })
    }
}
