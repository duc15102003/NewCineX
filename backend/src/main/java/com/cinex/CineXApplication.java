package com.cinex;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableAsync đã chuyển sang AsyncConfig (kèm executor + exception handler riêng)
@SpringBootApplication
@EnableScheduling
public class CineXApplication {

    public static void main(String[] args) {
        SpringApplication.run(CineXApplication.class, args);
    }
}
