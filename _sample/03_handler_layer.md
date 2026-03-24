# Phase 2: Handler 계층 — EmailMessageHandler + BookingConfirmEmailMessageHandler

---

## 1. EmailMessageHandler 수정 (기존 파일)

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/handler/email/EmailMessageHandler.java
```

### 현재 코드 (문제점)

```java
@Component
@Scope("prototype")
public class EmailMessageHandler extends MessageHandler {
    @Override
    protected String getTemplateFilePath() {
        return "email/"+ "test";  // ← 하드코딩
    }
    @Override
    public void buildMessage(Object request) { }  // ← 비어있음
}
```

### 수정 후 코드 스펙

```java
package com.eastarjet.symphony.message.handler.email;

import com.eastarjet.symphony.common.model.enums.CultureCode;
import com.eastarjet.symphony.message.enums.EmailTemplateType;
import com.eastarjet.symphony.message.handler.MessageHandler;
import com.eastarjet.symphony.message.logging.ElasticLogger;
import com.eastarjet.symphony.message.logging.EventAction;
import com.eastarjet.symphony.message.model.email.BookingConfirmEmailModel;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@Getter
@Slf4j
@Scope("prototype")
public abstract class EmailMessageHandler extends MessageHandler {

    @Autowired
    protected ElasticLogger elasticLogger;

    @Autowired
    @Qualifier("htmlTemplateEngine")            // ← TEXT가 아닌 HTML 엔진
    protected SpringTemplateEngine templateEngine;

    /** 수신자 이메일 주소 */
    protected String emailAddress;

    /** 이메일 제목 */
    protected String subject;

    /** 요청 언어 (CultureCode 직접 사용) */
    protected CultureCode cultureCode;

    @Override
    protected String getTemplateFilePath() {
        return null; // 하위 클래스에서 EmailTemplateType으로 결정
    }

    /**
     * HTML 템플릿 렌더링
     *
     * KakaoMessageHandler.buildTemplateContent()와 동일한 패턴이지만:
     * - HTML 엔진 사용
     * - 다국어 CultureCode를 컨텍스트에 전달
     * - 미지원 언어는 EmailTemplateType.resolveLanguage()에서 KR 폴백
     */
    protected void buildTemplateContent(EmailTemplateType emailTemplateType) {
        // 1. 실제 적용할 언어 결정 (미지원 시 KR 폴백)
        CultureCode resolvedLang = emailTemplateType.resolveLanguage(this.cultureCode);

        // 2. 이메일 제목 설정
        this.subject = emailTemplateType.getSubject(this.cultureCode);

        // 3. Thymeleaf 컨텍스트 구성
        Context context = new Context();
        context.setVariable("ENV", systemEnv.getProfile().name());
        context.setVariable("booking", BookingConfirmEmailModel.of(
                this.booking,
                resolvedLang      // ← 다국어 핵심: CultureCode 직접 전달
        ));
        context.setVariable("lang", resolvedLang.name());

        // 4. 언어별 템플릿 파일 경로 결정
        String templatePath = emailTemplateType.getTemplatePath(this.cultureCode);
        log.info("EMAIL template : {} >> {} (lang={}, requested={})",
                emailTemplateType.getTemplateName(), templatePath,
                resolvedLang, this.cultureCode);

        // 5. HTML 렌더링
        this.message = templateEngine.process(templatePath, context);
        log.info("Email message built for : {} (lang={})", this.recordLocator, resolvedLang);
    }

    /**
     * ElasticSearch 성공 로깅
     */
    protected final void elasticLogSuccessMessage(Object request, EmailTemplateType emailTemplateType) {
        Map<String, Object> label = new LinkedHashMap<>();
        label.put("request", request);
        label.put("emailAddress", this.emailAddress);
        label.put("cultureCode", this.cultureCode);
        label.put("subject", this.subject);

        Map<String, Object> templateInfo = new LinkedHashMap<>();
        templateInfo.put("code", emailTemplateType.getTemplateCode());
        templateInfo.put("templateName", emailTemplateType.getTemplateName());
        label.put("template", templateInfo);

        elasticLogger.success(EventAction.BUILDER, label);
    }

    /**
     * ElasticSearch 에러 로깅
     */
    protected final void elasticLogErrorMessage(Object request, Exception e) {
        Map<String, Object> label = new LinkedHashMap<>();
        label.put("request", request);
        label.put("emailAddress", this.emailAddress);
        elasticLogger.error(EventAction.BUILDER, label, e);
    }
}
```

### KakaoMessageHandler와의 대응 관계

| KakaoMessageHandler | EmailMessageHandler | 비고 |
|---------------------|---------------------|------|
| `@Qualifier("textTemplateEngine")` | `@Qualifier("htmlTemplateEngine")` | 엔진 다름 |
| `phoneNumbers: List<String>` | `emailAddress: String` | 단일 수신자 |
| `buttons: List<TalkButton>` | `subject: String` | 제목 |
| — | `cultureCode: CultureCode` | **기존 enum 직접 사용** |
| `buildTemplateContent()` | `buildTemplateContent(EmailTemplateType)` | 폴백 로직 포함 |
| `findPhonNumbers()` | — | 이메일은 요청에서 직접 수신 |
| `normalizePhoneNumbers()` | — | `@Email` validation으로 대체 |

---

## 2. BookingConfirmEmailMessageHandler 수정 (기존 파일)

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/handler/email/BookingConfirmEmailMessageHandler.java
```

### 현재 코드 (스텁)

```java
public class BookingConfirmEmailMessageHandler extends EmailMessageHandler {
    @Override
    public void buildMessage(Object request) {
        Map<String, String> map = (Map<String, String>) request;
        this.recordLocator = map.get("recordLocator");
        this.message = "예매확인 메시지를 생성합니다.";
    }
}
```

### 수정 후 코드 스펙

```java
package com.eastarjet.symphony.message.handler.email;

import com.eastarjet.symphony.common.dto.email.EmailBookingMessageDTO;
import com.eastarjet.symphony.common.model.enums.CultureCode;
import com.eastarjet.symphony.core.utils.ObjectMapperUtil;
import com.eastarjet.symphony.message.enums.EmailTemplateType;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Scope("prototype")
@Getter
public class BookingConfirmEmailMessageHandler extends EmailMessageHandler {

    @Autowired
    private ObjectMapperUtil objectMapperUtil;

    @Override
    public void buildMessage(Object request) {

        try {
            // ① 요청 데이터 역직렬화 (Map 캐스팅 대신 타입 안전한 변환)
            EmailBookingMessageDTO dto = objectMapperUtil.getObjectByJsonNode(
                    objectMapperUtil.getJsonNodeByObject(request),
                    EmailBookingMessageDTO.class
            );

            this.recordLocator = dto.getRecordLocator();
            this.emailAddress = dto.getEmailAddress();
            this.cultureCode = dto.getCultureCode();

            // cultureCode가 null이면 KR 폴백
            if (this.cultureCode == null) {
                this.cultureCode = CultureCode.KR;
            }

            log.info("예매확인 메일 빌드 시작 : {} → {} (lang={})",
                    this.recordLocator, this.emailAddress, this.cultureCode);

            // ② Booking 정보 조회 (Digital API)
            this.booking = apiService.getBooking(this.recordLocator);

            // ③ 템플릿 선택 (예매확인서는 단일 — 언어만 다름)
            //    국내/국제/편도/왕복 분기는 HTML th:if로 처리
            EmailTemplateType emailTemplateType = EmailTemplateType.예매확인서;

            // ④ HTML 템플릿 렌더링 (다국어, 미지원 시 KR 폴백)
            buildTemplateContent(emailTemplateType);

            // ⑤ 성공 로깅
            elasticLogSuccessMessage(request, emailTemplateType);

        } catch (Exception e) {
            elasticLogErrorMessage(request, e);
            throw e;  // ← 반드시 throw (기존 Kakao BUG #3 수정)
        }
    }
}
```

### BookingConfirmKakaoMessageHandler와의 단계별 대응

| 단계 | KakaoHandler | EmailHandler |
|------|-------------|-------------|
| ① 요청 파싱 | `Map<String,String>` 캐스팅 | `ObjectMapperUtil` 타입 안전 변환 |
| ② Booking 조회 | `apiService.getBooking()` | **동일** |
| ③ 전화번호 추출 | `findPhonNumbers()` | — (요청에서 직접 수신) |
| ④ 템플릿 선택 | 국제/국내 × 편도/왕복 4분기 | 단일 (HTML 내 th:if) |
| ⑤ 내용 렌더링 | `buildTemplateContent()` | `buildTemplateContent(type)` + CultureCode 폴백 |
| ⑥ 버튼 생성 | `buildKakaoTemplateButtons()` | — |
| ⑦ 예외 처리 | **삼킴 (BUG)** | `throw e` (수정됨) |
