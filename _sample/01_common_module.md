# Phase 1: Common 모듈 — EmailBookingMessageDTO

> **설계 결정**: `LanguageType` 별도 생성하지 않고 기존 `CultureCode` enum 직접 사용
> 템플릿이 없는 언어 요청 시 KR로 폴백

---

## 1. CultureCode (기존, 변경 없음)

### 파일 위치
```
common/src/main/java/com/eastarjet/symphony/common/model/enums/CultureCode.java
```

### 현재 코드 (그대로 사용)

```java
@RequiredArgsConstructor
@Getter
public enum CultureCode {
    KR("ko-KR"),
    EN("en-US"),
    JP("ja-JP"),
    CN("zh-CN"),
    TW("zh-TW"),
    VN("vi-VN"),
    TH("th-TH");

    private final String code;

    public static CultureCode getCultureCode(String code) {
        for (CultureCode cultureCode : values()) {
            if (cultureCode.getCode().equals(code)) {
                return cultureCode;
            }
        }
        return KR;  // ← 기본값 KR 폴백 (이미 구현되어 있음)
    }
}
```

### 왜 CultureCode를 직접 사용하는가

| 항목 | LanguageType 별도 생성 | CultureCode 직접 사용 |
|------|----------------------|---------------------|
| 파일 수 | +1 (LanguageType.java) | **0** (기존 활용) |
| 변환 코드 | `languageType.toCultureCode()` | **불필요** |
| MessageService 연동 | 변환 후 전달 | **그대로 전달** |
| 확장성 | enum 2개 동기화 필요 | **CultureCode에만 추가** |
| 미지원 언어 처리 | 컴파일 에러 | **KR 폴백 (런타임 안전)** |

### 다국어 확장 시나리오

```
현재: KR, EN 템플릿만 존재
  → JP 요청이 오면? → EmailTemplateType에서 KR로 폴백 → 한국어 이메일 발송

추후: JP 템플릿 추가 시
  1. HP_RSV_CNF_JP.html 파일 생성
  2. EmailTemplateType의 subjects Map에 JP 추가
  → 끝. 다른 코드 변경 없음
```

---

## 2. EmailBookingMessageDTO (신규 생성)

### 파일 위치
```
common/src/main/java/com/eastarjet/symphony/common/dto/email/EmailBookingMessageDTO.java
```

### 기존 KakaoBookingMessageDTO와 비교

```
KakaoBookingMessageDTO               EmailBookingMessageDTO
├─ clientName: String                 ├─ clientName: String
├─ recordLocator: String              ├─ recordLocator: String
                                      ├─ emailAddress: String     ← 신규
                                      └─ cultureCode: CultureCode ← 신규 (기존 enum 재사용)
```

### 코드 스펙

```java
package com.eastarjet.symphony.common.dto.email;

import com.eastarjet.symphony.common.model.enums.CultureCode;
import lombok.Builder;
import lombok.Getter;

/**
 * Email 메시지 DTO
 * - Kafka 큐를 통해 전달되는 데이터 모델
 * - Controller의 Request 모델에서 toCommand()로 변환됨
 */
@Getter
@Builder
public class EmailBookingMessageDTO {

    /** 요청 클라이언트 식별자 */
    private String clientName;

    /** 예약번호 (PNR, 6자리) */
    private String recordLocator;

    /** 수신자 이메일 주소 */
    private String emailAddress;

    /** 이메일 언어 — 기존 CultureCode 직접 사용 */
    private CultureCode cultureCode;
}
```

### Kafka 직렬화 예시

```json
{
  "messageCode": "EMAIL_00100",
  "data": {
    "clientName": "WEB",
    "recordLocator": "I7R6KG",
    "emailAddress": "user@example.com",
    "cultureCode": "KR"
  }
}
```

Jackson은 CultureCode enum을 `name()`으로 직렬화하므로 `"KR"`, `"EN"` 등으로 전달됩니다.

### MessageCode Enum 변경 연계

```java
// 변경 전
EMAIL_00100(MessageType.EMAIL, BookingConfirmEmailMessageHandler.class,
            KakaoBookingMessageDTO.class, "예매확인서"),

// 변경 후
EMAIL_00100(MessageType.EMAIL, BookingConfirmEmailMessageHandler.class,
            EmailBookingMessageDTO.class, "예매확인서"),
```

### Handler에서 역직렬화

Kafka를 통해 전달된 `data`는 `LinkedHashMap`으로 역직렬화됩니다.
Handler에서 타입 안전하게 변환:

```java
// Map 캐스팅 대신 ObjectMapperUtil 사용 (기존 Kakao 핸들러의 패턴 개선)
EmailBookingMessageDTO dto = objectMapperUtil.getObjectByJsonNode(
        objectMapperUtil.getJsonNodeByObject(request),
        EmailBookingMessageDTO.class
);
```
