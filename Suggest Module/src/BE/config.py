import os

# Database
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "DB.db3")
TABLE_NAME = os.environ.get("TABLE_NAME", "product")


# Server
PORT = int(os.environ.get("PORT", 5000))
DEBUG = True
