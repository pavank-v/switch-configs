package com.pavan.todo.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Properties specific to Todo App.
 * <p>
 * Properties are configured in the {@code application.yml} file.
 * See {@link tech.jhipster.config.JHipsterProperties} for a good example.
 */
@ConfigurationProperties(prefix = "application", ignoreUnknownFields = false)
public class ApplicationProperties {

    private final Liquibase liquibase = new Liquibase();

    private final Registration registration = new Registration();

    // jhipster-needle-application-properties-property

    public Liquibase getLiquibase() {
        return liquibase;
    }

    public Registration getRegistration() {
        return registration;
    }

    // jhipster-needle-application-properties-property-getter

    public static class Liquibase {

        private Boolean asyncStart = true;

        public Boolean getAsyncStart() {
            return asyncStart;
        }

        public void setAsyncStart(Boolean asyncStart) {
            this.asyncStart = asyncStart;
        }
    }

    public static class Registration {

        /**
         * When {@code true}, users created through {@code POST /api/register} are activated immediately
         * and no activation email is sent. Enable this when no SMTP server is available, otherwise
         * registered users can never sign in because the activation link is never delivered.
         */
        private boolean autoActivate = false;

        public boolean isAutoActivate() {
            return autoActivate;
        }

        public void setAutoActivate(boolean autoActivate) {
            this.autoActivate = autoActivate;
        }
    }

    // jhipster-needle-application-properties-property-class
}
