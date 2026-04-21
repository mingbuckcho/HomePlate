# 1. Base Image (AWS 환경에 최적화된 Corretto 사용)
FROM amazoncorretto:17-alpine

# ⭐ 보안: OS에 관계없이 1000번 유저를 강제 생성 (EKS 보안 정책(PodSecurity) 준수)
RUN echo "springgroup:x:1000:" >> /etc/group && \
    echo "springuser:x:1000:1000::/home/springuser:/bin/sh" >> /etc/passwd && \
    mkdir -p /home/springuser && \
    chown -R 1000:1000 /home/springuser

# 2. 작업 디렉토리 설정 및 권한 부여
WORKDIR /app
RUN chown 1000:1000 /app

# 3. JAR 파일 및 OTEL 에이전트 복사
# (CI/CD 파이프라인의 빌드 단계에서 생성된 jar 파일을 복사합니다)
COPY --chown=1000:1000 opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
COPY --chown=1000:1000 api/build/libs/*-SNAPSHOT.jar app.jar

# 4. 사용할 포트
EXPOSE 8080

# ⭐ 핵심: 이후의 모든 명령어(ENTRYPOINT 포함)를 root가 아닌 1000번 유저로 실행
USER 1000:1000

# 5. 실행 명령어 (환경변수를 통해 Profile과 OTEL 설정을 동적으로 주입받음)
ENTRYPOINT ["java", "-javaagent:/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]