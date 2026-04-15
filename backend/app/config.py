from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    reddit_client_id: str
    reddit_client_secret: str
    reddit_user_agent: str = "r3-backend/0.1"
    license_mode: str = "stub"
    extensionpay_secret_key: str = ""
    cache_ttl_risk: int = 300
    cache_ttl_post_status: int = 120
    cache_ttl_subreddit_meta: int = 3600
    cors_origins: str = "*"  # Override in production with chrome-extension:// origin


settings = Settings()
