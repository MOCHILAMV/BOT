use rusqlite::{Connection,Result};

pub fn open()->Result<Connection>{
    Connection::open("macros.db")
}

pub fn init(conn:&Connection){
    conn.execute(
        "CREATE TABLE IF NOT EXISTS macros(name TEXT PRIMARY KEY,command TEXT)",
        []
    ).unwrap();
}
