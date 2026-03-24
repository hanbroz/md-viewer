# Phase 1: Message 모듈 Enum — EmailTemplateType + MessageCode 수정

---

## 1. EmailTemplateType Enum (신규 생성)

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/enums/EmailTemplateType.java
```

### 설계 의도

이메일 **템플릿 파일명**, **다국어 제목(subject)**, **지원 언어 목록**을 관리합니다.
지원하지 않는 언어 요청 시 KR로 폴백하는 로직이 여기에 집중됩니다.

### 코드 스펙

```java
package com.eastarjet.symphony.message.enums;

import com.eastarjet.symphony.common.model.enums.CultureCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Map;
import java.util.Set;

/**
 * 이메일 템플릿 타입
 * - 템플릿 파일명과 다국어 제목을 관리
 * - 지원하지 않는 CultureCode 요청 시 KR 폴백
 * - 언어별 템플릿 파일: email/{templateCode}_{cultureCode}.html
 */
@Getter
@RequiredArgsConstructor
public enum EmailTemplateType {

    예매확인서(
        "예매확인서",
        "HP_RSV_CNF",
        Map.of(
            CultureCode.KR, "[이스타항공] 항공권 예매 확인서",
            CultureCode.EN, "[Eastar Jet] Booking Confirmation"
        )
    );

    // 추후 추가 예정:
    // 예매변경("예매변경", "HP_RSV_CHG", Map.of(...)),
    // 예매취소("예매취소", "HP_RSV_CNL", Map.of(...));

    /** 템플릿 한국어 이름 */
    private final String templateName;

    /** 템플릿 파일 코드 (파일명 prefix) */
    private final String templateCode;

    /** 언어별 이메일 제목 */
    private final Map<CultureCode, String> subjects;

    /**
     * 지원 언어 목록
     */
    public Set<CultureCode> getSupportedLanguages() {
        return subjects.keySet();
    }

    /**
     * 해당 언어를 지원하는지 확인
     */
    public boolean isSupported(CultureCode cultureCode) {
        return subjects.containsKey(cultureCode);
    }

    /**
     * 실제 적용할 CultureCode 반환 (미지원 시 KR 폴백)
     *
     * @param requested 요청된 CultureCode
     * @return 지원하면 그대로, 미지원이면 KR
     */
    public CultureCode resolveLanguage(CultureCode requested) {
        return subjects.containsKey(requested) ? requested : CultureCode.KR;
    }

    /**
     * 언어에 맞는 이메일 제목 반환 (미지원 시 KR 폴백)
     */
    public String getSubject(CultureCode cultureCode) {
        CultureCode resolved = resolveLanguage(cultureCode);
        return subjects.get(resolved);
    }

    /**
     * 언어별 Thymeleaf 템플릿 파일 경로 (미지원 시 KR 폴백)
     * 예: /email/HP_RSV_CNF_KR  (확장자는 Thymeleaf가 자동 추가)
     */
    public String getTemplatePath(CultureCode cultureCode) {
        CultureCode resolved = resolveLanguage(cultureCode);
        return String.format("/email/%s_%s", this.templateCode, resolved.name());
    }
}
```

### 폴백 동작 예시

| 요청 CultureCode | subjects에 존재? | 실제 적용 | 제목 | 템플릿 |
|------------------|-----------------|----------|------|--------|
| KR | O | KR | [이스타항공] 항공권 예매 확인서 | HP_RSV_CNF_KR.html |
| EN | O | EN | [Eastar Jet] Booking Confirmation | HP_RSV_CNF_EN.html |
| JP | X | **KR** (폴백) | [이스타항공] 항공권 예매 확인서 | HP_RSV_CNF_KR.html |
| CN | X | **KR** (폴백) | [이스타항공] 항공권 예매 확인서 | HP_RSV_CNF_KR.html |

### 언어 추가 시 (예: JP)

```java
// subjects Map에 항목 추가만 하면 됨
예매확인서(
    "예매확인서",
    "HP_RSV_CNF",
    Map.of(
        CultureCode.KR, "[이스타항공] 항공권 예매 확인서",
        CultureCode.EN, "[Eastar Jet] Booking Confirmation",
        CultureCode.JP, "[イースター航空] 航空券予約確認書"    // ← 추가
    )
);

// + template/email/HP_RSV_CNF_JP.html 파일 생성
// → 다른 코드 변경 없음 (resolveLanguage가 자동 처리)
```

---

## 2. MessageCode Enum 수정

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/enums/MessageCode.java
```

### 변경 내용

```java
// 변경 전
import com.eastarjet.symphony.common.dto.kakao.KakaoBookingMessageDTO;

EMAIL_00100(MessageType.EMAIL, BookingConfirmEmailMessageHandler.class,
            KakaoBookingMessageDTO.class, "예매확인서"),

// 변경 후
import com.eastarjet.symphony.common.dto.email.EmailBookingMessageDTO;

EMAIL_00100(MessageType.EMAIL, BookingConfirmEmailMessageHandler.class,
            EmailBookingMessageDTO.class, "예매확인서"),
```

### 변경 범위
- import 문 추가: `com.eastarjet.symphony.common.dto.email.EmailBookingMessageDTO`
- `EMAIL_00100` 항목의 3번째 파라미터만 변경
- 나머지 KAKAO_* 항목은 변경 없음
