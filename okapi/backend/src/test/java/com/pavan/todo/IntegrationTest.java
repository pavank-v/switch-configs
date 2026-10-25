package com.pavan.todo;

import com.pavan.todo.config.AsyncSyncConfiguration;
import com.pavan.todo.config.EmbeddedSQL;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Base composite annotation for integration tests.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(classes = { TodoApp.class, AsyncSyncConfiguration.class, com.pavan.todo.config.JacksonHibernateConfiguration.class })
@EmbeddedSQL
public @interface IntegrationTest {}
