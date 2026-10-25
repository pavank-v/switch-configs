# Stage 1: compile the application
FROM maven:3-eclipse-temurin-21-alpine AS build

WORKDIR /workspace

# Copy this first so Maven dependencies can be cached
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Now copy and compile the source
COPY src ./src
COPY sonar-project.properties .
RUN mvn -Pprod -DskipTests package

# Stage 2: Run only the compiled application
FROM eclipse-temurin:21-jre AS runtime

WORKDIR /app

RUN useradd --system --uid 10001 --create-home appuser

COPY --from=build /workspace/target/*.jar app.jar

USER 10001

EXPOSE 8080

ENTRYPOINT [ "java", "-jar", "/app/app.jar"]
