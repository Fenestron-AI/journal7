from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    # --- Database ---
    database_url: str = "postgresql://journal7:journal7_dev@localhost:5432/journal7"

    # --- Yandex Cloud ---
    yandex_folder_id: str = ""
    yandex_api_key: str = ""
    yandex_iam_token: str = ""
    yandex_embedding_model: str = "text-search-doc"     # для индексации
    yandex_embedding_query_model: str = "text-search-query"  # для поиска
    yandex_llm_model: str = "yandexgpt/latest"
    yandex_sync_model: str = "yandexgpt/lite"
    yandex_llm_temperature: float = 0.1
    yandex_llm_max_tokens: int = 2000

    # --- Ingestion ---
    chunk_size: int = 1500      # символов на чанк
    chunk_overlap: int = 150
    watch_dir: str = "/home/fenestron/Developer/journal7/data/legal-docs"

    # --- Vector search ---
    top_k: int = 6
    similarity_threshold: float = 0.35


settings = Settings()
