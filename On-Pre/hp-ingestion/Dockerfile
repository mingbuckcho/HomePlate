FROM python:3.11-slim

WORKDIR /app

# requirements.txt를 먼저 복사하고 pip install을 실행한다
# 이렇게 하면 Docker 레이어 캐시가 효율적으로 작동한다
# 코드만 바뀌었을 때(COPY app/ ./app/) requirements.txt가 바뀌지 않으면
# pip install 레이어를 캐시로 재사용해서 빌드가 훨씬 빠르다
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드를 복사한다
COPY app/ ./app/

# 보안을 위해 루트 권한으로 실행하지 않도록 별도 사용자를 만든다
# 컨테이너 내부에서 루트로 실행하면 취약점이 있을 때 위험하다
RUN useradd -m appuser
USER appuser

# 기본 명령어: worker 실행
# k8s Deployment/CronJob에서 command를 오버라이드해서 다른 모듈을 실행한다
CMD ["python", "-m", "app.worker"]