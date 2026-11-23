# syntax=docker/dockerfile:1
# tailpulse collector server + dashboard (one jar)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
# Download Gradle and dependencies first so source changes don't redo it
RUN ./gradlew --no-daemon -q dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon -q bootJar -x test

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin tailpulse \
 && mkdir -p /app/data /app/config && chown -R tailpulse /app
WORKDIR /app
COPY --from=build /src/build/libs/tailpulse.jar /app/tailpulse.jar
USER tailpulse
# Spring Boot also reads /app/config/application.yaml if you mount one
ENV TAILPULSE_DATA_DIR=/app/data
EXPOSE 8080
VOLUME /app/data
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s CMD curl -fsS http://127.0.0.1:${TAILPULSE_PORT:-8080}/healthz || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/tailpulse.jar"]
