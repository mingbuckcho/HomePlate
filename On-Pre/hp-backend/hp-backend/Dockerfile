# 1. Base Image
FROM amazoncorretto:17

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. JAR 파일 복사
COPY opentelemetry-javaagent.jar /opentelemetry-javaagent.jar
COPY api/build/libs/*-SNAPSHOT.jar app.jar

# 4. 사용할 포트
EXPOSE 8080

# 5. 실행 명령어 (VM Options 포함)
ENTRYPOINT ["java", "-javaagent:/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]