# Phase 3: Sender 계층 — EmailSender + SMTP 설정 + build.gradle

---

## 1. build.gradle 의존성 추가

### 파일 위치
```
message/build.gradle
```

### 추가할 의존성

```groovy
// Email 발송
implementation 'org.springframework.boot:spring-boot-starter-mail'
```

---

## 2. application.properties SMTP 설정

### 기본 설정 (application.properties)

```properties
# === Email (SMTP) ===
spring.mail.host=smtp.example.com
spring.mail.port=587
spring.mail.username=noreply@eastarjet.com
spring.mail.password=change-me
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
spring.mail.properties.mail.smtp.timeout=5000
spring.mail.properties.mail.smtp.connectiontimeout=5000
spring.mail.properties.mail.smtp.writetimeout=5000

# 발신자 정보
email.sender.address=noreply@eastarjet.com
email.sender.name=이스타항공
email.sender.name.en=Eastar Jet
```

### 개발 환경 (application-dev.properties)

```properties
spring.mail.host=localhost
spring.mail.port=1025
spring.mail.username=
spring.mail.password=
spring.mail.properties.mail.smtp.auth=false
spring.mail.properties.mail.smtp.starttls.enable=false

email.sender.address=noreply-dev@eastarjet.com
```

### 운영 환경 (application-prod.properties)

```properties
spring.mail.host=smtp.eastarjet.com
spring.mail.port=587
spring.mail.username=noreply@eastarjet.com
spring.mail.password=${EMAIL_SMTP_PASSWORD}

email.sender.address=noreply@eastarjet.com
```

---

## 3. EmailSender 수정 (기존 파일)

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/sender/EmailSender.java
```

### 수정 후 코드 스펙

```java
package com.eastarjet.symphony.message.sender;

import com.eastarjet.symphony.common.model.enums.CultureCode;
import com.eastarjet.symphony.message.handler.MessageHandler;
import com.eastarjet.symphony.message.handler.email.EmailMessageHandler;
import com.eastarjet.symphony.message.logging.ElasticLogger;
import com.eastarjet.symphony.message.logging.EventAction;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component("EMAIL_SENDER")                      // ← BUG #1 수정
@RequiredArgsConstructor
@Slf4j
public class EmailSender implements MessageSender {

    private final JavaMailSender javaMailSender;
    private final ElasticLogger elasticLogger;

    @Value("${email.sender.address}")
    private String senderAddress;

    @Value("${email.sender.name}")
    private String senderNameKr;

    @Value("${email.sender.name.en}")
    private String senderNameEn;

    @Override
    public void send(MessageHandler handler) {
        long startTime = System.nanoTime();
        EmailMessageHandler emailHandler = (EmailMessageHandler) handler;

        try {
            MimeMessage mimeMessage = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            // 발신자명: CultureCode에 따라 분기
            String senderName = emailHandler.getCultureCode() == CultureCode.EN
                    ? senderNameEn : senderNameKr;
            helper.setFrom(senderAddress, senderName);

            helper.setTo(emailHandler.getEmailAddress());
            helper.setSubject(emailHandler.getSubject());
            helper.setText(emailHandler.getMessage(), true);  // HTML

            javaMailSender.send(mimeMessage);

            long elapsed = (System.nanoTime() - startTime) / 1_000_000;
            log.info("Email sent: {} → {} ({}ms, lang={})",
                    emailHandler.getRecordLocator(),
                    emailHandler.getEmailAddress(),
                    elapsed,
                    emailHandler.getCultureCode());

            elasticLogSuccessMessage(null, emailHandler);

        } catch (MessagingException e) {
            long elapsed = (System.nanoTime() - startTime) / 1_000_000;
            log.error("Email failed: {} → {} ({}ms) - {}",
                    emailHandler.getRecordLocator(),
                    emailHandler.getEmailAddress(),
                    elapsed, e.getMessage());
            elasticLogErrorMessage(e, emailHandler);
            throw new RuntimeException("Email send failed", e);

        } catch (Exception e) {
            elasticLogErrorMessage(e, emailHandler);
            throw e;
        }
    }

    @Override
    public void elasticLogSuccessMessage(JsonNode response, MessageHandler handler) {
        EmailMessageHandler emailHandler = (EmailMessageHandler) handler;
        Map<String, Object> label = new LinkedHashMap<>();
        label.put("emailAddress", emailHandler.getEmailAddress());
        label.put("subject", emailHandler.getSubject());
        label.put("recordLocator", emailHandler.getRecordLocator());
        label.put("cultureCode", emailHandler.getCultureCode());
        elasticLogger.success(EventAction.SENDER, label);
    }

    @Override
    public void elasticLogErrorMessage(Exception e, MessageHandler handler) {
        EmailMessageHandler emailHandler = (EmailMessageHandler) handler;
        Map<String, Object> label = new LinkedHashMap<>();
        label.put("emailAddress", emailHandler.getEmailAddress());
        label.put("recordLocator", emailHandler.getRecordLocator());
        elasticLogger.error(EventAction.SENDER, label, e);
    }
}
```

### 발신자명 다국어 확장

현재는 KR/EN 2개만 분기하지만, 추후 언어가 늘어나면 Map으로 확장:

```java
// 현재 (2개)
String senderName = emailHandler.getCultureCode() == CultureCode.EN
        ? senderNameEn : senderNameKr;

// 추후 (다수) — application.properties에 Map 형태로 추가 가능
// email.sender.names.KR=이스타항공
// email.sender.names.EN=Eastar Jet
// email.sender.names.JP=イースター航空
```
