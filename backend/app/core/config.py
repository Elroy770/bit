from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite+pysqlite:///./bit.sqlite3"
    receipts_dir: str = "./data/receipts"
    cors_origins: str = "http://localhost:8081,http://localhost:8082"
    auth_mode: str = "proxy"
    max_receipt_bytes: int = 5 * 1024 * 1024
    cashier_username: str = "cashier"
    cashier_password: str = ""
    admin_username: str = "admin"
    admin_password: str = ""
    session_cookie_name: str = "bit_session"
    session_hours: int = 8
    remembered_session_days: int = 30
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_list(self):
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

settings = Settings()
