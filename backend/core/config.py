from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    environment: str = "production"
    secret_key: str

    database_url: str
    redis_url: str = ""   # declared for future use; not required at runtime

    llm_provider: Literal["ollama", "azure", "bedrock", "mock", "anthropic"] = "ollama"

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

    # Anthropic (direct)
    anthropic_api_key: str = ""

    # Auth — leave blank to disable (useful for local dev)
    api_key: str = ""
    # Preferred: store SHA-256 hash of the key instead of plaintext
    # Generate: python -c "import hashlib; print(hashlib.sha256(b'your-key').hexdigest())"
    api_key_hash: str = ""

    # CORS — comma-separated allowed origins; defaults to localhost dev
    cors_origins: str = "http://localhost:3000"

    # Admin / platform
    app_base_url: str = "http://localhost:3000"          # builds invite links
    internal_api_secret: str = "dev-internal-secret-change-me"  # gates admin/auth endpoints
    admin_email: str = ""                                 # seeded platform super-admin
    admin_password: str = ""

    # Email (invites). If resend_api_key is unset, invites are stubbed (link logged).
    resend_api_key: str = ""
    email_from: str = "EIGG <noreply@eigg.io>"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
