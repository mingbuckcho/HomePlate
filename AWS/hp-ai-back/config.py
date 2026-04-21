"""App config from environment."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_port: int = 8000
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "aiops"
    db_user: str = "aiops"
    db_password: str = ""

    aws_region: str = "ap-northeast-2"
    bedrock_model_id: str | None = None

    # RAG embedding (Titan). ai_summaries.embedding 저장용.
    enable_rag_embedding: bool = False
    embed_model_id: str = "amazon.titan-embed-text-v1"

    prom_url: str = "http://localhost:19090"
    loki_url: str = "http://localhost:13100"
    tempo_url: str = "http://localhost:13200"
    # Loki multi-tenant: 설정 시 모든 Loki 요청에 X-Scope-OrgID 헤더 추가 (예: EKS gateway용 homeplate)
    loki_tenant_id: str = ""

    # application layer 메트릭 수집 시 사용할 namespace (예: hp-core)
    app_layer_namespace: str = "hp-core"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
