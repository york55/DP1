FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .

COPY src ./src

RUN mvn clean package -DskipTests


FROM tomcat:10-jdk21

COPY --from=build /app/target/tasfb2b.war /usr/local/tomcat/webapps/

EXPOSE 8080

CMD ["catalina.sh","run"]
