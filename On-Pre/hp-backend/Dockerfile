# 1. Base Image
FROM amazoncorretto:17

# ⭐ 수정: OS(Alpine 등)에 관계없이 1000번 유저를 강제 생성하는 리눅스 원초적 방식
RUN echo "springgroup:x:1000:" >> /etc/group && \
    echo "springuser:x:1000:1000::/home/springuser:/bin/sh" >> /etc/passwd && \
    mkdir -p /home/springuser && \
    chown -R 1000:1000 /home/springuser

# 2. 작업 디렉토리 설정
WORKDIR /app

# ⭐ 추가: /app 디렉토리의 소유권을 1000번 유저에게 부여 (로그나 임시 파일 쓰기 권한 확보)
RUN chown 1000:1000 /app

# 3. JAR 파일 복사
# ⭐ 수정: 파일을 복사할 때부터 소유자를 1000번 유저로 지정 (--chown 옵션 활용)
COPY --chown=1000:1000 opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
COPY --chown=1000:1000 api/build/libs/*-SNAPSHOT.jar app.jar

# 4. 사용할 포트
EXPOSE 8080

# ⭐ 핵심: 이후의 모든 명령어(ENTRYPOINT 포함)를 root가 아닌 1000번 유저로 실행
USER 1000:1000

# 5. 실행 명령어 (VM Options 포함)
ENTRYPOINT ["java", "-javaagent:/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]