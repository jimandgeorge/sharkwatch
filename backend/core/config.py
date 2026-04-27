from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    environment: str = "production"
    secret_key: str

    database_url: str
    redis_url: str

    llm_provider: Literal["ollama", "azure", "bedrock", "mock"] = "ollama"

    # Ollama
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.1:70b"
    ollama_embed_model: str = "nomic-embed-text"   # 768-dim, pull separately

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_key: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_embed_deployment: str = "text-embedding-3-small"

    # AWS Bedrock
    aws_bedrock_region: str = "eu-west-2"
    aws_bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    # Auth — leave blank to disable (useful for local dev)
    api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
