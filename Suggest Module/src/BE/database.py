import sqlite3
import os
from typing import List
from config import DB_PATH


# Lấy kết nối với database
def getConnection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(
            f"Database not found at: {DB_PATH}. Please update DB_PATH in code."
        )
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# Danh sách tên các bảng
def listTables(connection) -> List[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    return [r[0] for r in rows]


# Danh sách các cột trong bảng
def listColumns(conn, nameTable: str) -> List[str]:
    nameTable = nameTable.replace('"', '""')
    rows = conn.execute(f'PRAGMA table_info("{nameTable}")').fetchall()
    return [r[1] for r in rows]
