use std::collections::HashMap;
use rusqlite::Connection;

pub fn load(conn:&Connection)->HashMap<String,String>{
    let mut map=HashMap::new();
    let mut stmt=conn.prepare("SELECT name,command FROM macros").unwrap();
    let rows=stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).unwrap();
    for row in rows{
        let (k,v)=row.unwrap();
        map.insert(k,v);
    }
    map
}
