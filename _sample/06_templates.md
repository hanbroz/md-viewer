# Phase 5: HTML 템플릿 — 다국어 예매확인서

---

## 1. BookingConfirmEmailModel (신규 생성)

### 파일 위치
```
message/src/main/java/com/eastarjet/symphony/message/model/email/BookingConfirmEmailModel.java
```

### 기존 BookingConfirmKakaoMessageModel과의 비교

| 항목 | KakaoModel | EmailModel |
|------|-----------|-----------|
| `of()` 파라미터 | `Booking` | `Booking, CultureCode` |
| 공항명 번역 | `getStationName(code, KR)` 고정 | `getStationName(code, cultureCode)` |
| 날짜 형식 | `getKoreanDateTimeString()` 고정 | `formatDate(dt, cultureCode)` 분기 |
| 국제/다구간 | Handler에서 판단 | **Model 필드로 노출** (th:if용) |

### 코드 스펙

```java
package com.eastarjet.symphony.message.model.email;

import com.eastarjet.digital_api.model.Booking;
import com.eastarjet.digital_api.model.Journey;
import com.eastarjet.digital_api.model.Segment;
import com.eastarjet.symphony.common.model.enums.CultureCode;
import com.eastarjet.symphony.core.utils.DateTimeUtils;
import com.eastarjet.symphony.message.i18n.MessageService;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Data
@Slf4j
public class BookingConfirmEmailModel {

    private String recordLocator;
    private int passengerCount;
    private Set<JourneyTemplate> journeys = new LinkedHashSet<>();
    private CultureCode cultureCode;
    private boolean international;
    private boolean multiCity;

    private BookingConfirmEmailModel(Booking booking, CultureCode cultureCode) {
        this.recordLocator = booking.getRecordLocator();
        this.cultureCode = cultureCode;

        // 승객 수
        this.passengerCount = booking.getPassengers().size();

        // 국제선 여부
        this.international = false;
        for (Journey journey : booking.getJourneys()) {
            for (Segment segment : journey.getSegments()) {
                if (segment.getInternational()) {
                    this.international = true;
                    break;
                }
            }
        }

        // 다구간 여부
        this.multiCity = booking.getJourneys().size() > 1;

        // 구간 정보 (다국어)
        for (Journey journey : booking.getJourneys()) {
            JourneyTemplate jt = new JourneyTemplate();

            String origin = journey.getDesignator().getOrigin();
            jt.setOriginCode(origin);
            jt.setOrigin(MessageService.getStationName(origin, cultureCode));

            String destination = journey.getDesignator().getDestination();
            jt.setDestinationCode(destination);
            jt.setDestination(MessageService.getStationName(destination, cultureCode));

            LocalDateTime departure = journey.getDesignator().getDeparture();
            jt.setDepartureDateString(formatDate(departure, cultureCode));

            jt.setCarrierFlightCode(String.format("%s%s",
                    journey.getSegments().getFirst().getIdentifier().getCarrierCode(),
                    journey.getSegments().getFirst().getIdentifier().getIdentifier()));

            journeys.add(jt);
        }
    }

    public static BookingConfirmEmailModel of(Booking booking, CultureCode cultureCode) {
        return new BookingConfirmEmailModel(booking, cultureCode);
    }

    /**
     * 언어별 날짜 형식
     *
     * KR: 2026년03월23일(월) 14:30
     * EN: Mon, 23 Mar 2026 14:30
     * JP: 2026年03月23日(月) 14:30
     * CN: 2026年03月23日(周一) 14:30
     * 기타: EN 형식 사용
     */
    private static String formatDate(LocalDateTime dateTime, CultureCode cultureCode) {
        return switch (cultureCode) {
            case KR -> DateTimeUtils.getKoreanDateTimeString(dateTime);
            case JP -> dateTime.format(DateTimeFormatter.ofPattern(
                    "yyyy年MM月dd日(E) HH:mm", Locale.JAPANESE));
            case CN, TW -> dateTime.format(DateTimeFormatter.ofPattern(
                    "yyyy年MM月dd日(E) HH:mm", Locale.CHINESE));
            default -> dateTime.format(DateTimeFormatter.ofPattern(
                    "EEE, dd MMM yyyy HH:mm", Locale.ENGLISH));
        };
    }

    @Data
    static class JourneyTemplate {
        private String origin;
        private String originCode;
        private String destination;
        private String destinationCode;
        private String departureDateString;
        private String carrierFlightCode;
    }
}
```

---

## 2. 템플릿 변수 바인딩

| 변수 | 타입 | KR 예시 | EN 예시 |
|------|------|---------|---------|
| `${ENV}` | String | "PROD" | "PROD" |
| `${booking.recordLocator}` | String | "I7R6KG" | "I7R6KG" |
| `${booking.passengerCount}` | int | 2 | 2 |
| `${booking.international}` | boolean | false | false |
| `${booking.multiCity}` | boolean | false | false |
| `${booking.journeys}` | Set | — | — |
| `${journey.origin}` | String | "김포" | "Gimpo" |
| `${journey.originCode}` | String | "GMP" | "GMP" |
| `${journey.destination}` | String | "제주" | "Jeju" |
| `${journey.departureDateString}` | String | "2026년03월23일(월) 14:30" | "Mon, 23 Mar 2026 14:30" |
| `${journey.carrierFlightCode}` | String | "ZE123" | "ZE123" |
| `${lang}` | String | "KR" | "EN" |

---

## 3. HTML 템플릿 구조 가이드

### 한국어 (HP_RSV_CNF_KR.html)

```
파일: message/src/main/resources/template/email/HP_RSV_CNF_KR.html
```

**핵심 구조:**

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[이스타항공] 항공권 예매 확인서</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5;">
    <!-- 이메일 클라이언트 호환: table 레이아웃, width=600 -->
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
            <table width="600" style="background:#fff; font-family:'맑은 고딕',sans-serif;">

                <!-- 1. 헤더 -->
                <!-- 2. 예매번호 + 승객 수 -->
                <!--    ENV != PROD 이면 환경명 prefix 표시 -->
                <!-- 3. 구간 정보 (th:each 반복) -->
                <!-- 4. 국내/국제 조건부 안내 (th:if) -->
                <!-- 5. 수하물 안내 -->
                <!-- 6. CTA 버튼 (나의 예매 확인) -->
                <!-- 7. 푸터 -->

            </table>
        </td></tr>
    </table>
</body>
</html>
```

### 영어 (HP_RSV_CNF_EN.html)

한국어와 **동일 구조**, 다음만 다름:

| 항목 | KR | EN |
|------|----|----|
| `<html lang>` | `ko` | `en` |
| 제목 | "이스타항공 예매 확인서" | "Eastar Jet Booking Confirmation" |
| 라벨 | "예매번호", "구간", "노선" | "Booking No.", "Segment", "Route" |
| 수하물 중량 | "15kg 이하" | "Up to 15kg" |
| 탑승수속 안내 | 한국어 | 영어 |
| 버튼 | "나의 예매 확인" | "Check My Booking" |
| 푸터 | "본 메일은 발신 전용입니다" | "This is a no-reply email" |
| 폰트 | '맑은 고딕' | Arial, sans-serif |
| 국내선 안내 | 한국 신분증 관련 | Valid ID required |

### 이메일 HTML 작성 시 주의사항

1. **인라인 CSS만** — `<style>` 태그는 Gmail, Outlook에서 제거됨
2. **Table 레이아웃** — Flexbox, Grid 미지원
3. **폭 600px** — 이메일 클라이언트 표준
4. **이미지** — 외부 URL, alt 필수
5. **조건부 렌더링** — `th:if="${booking.international}"` 활용

---

## 4. 언어 추가 시 필요 작업

| # | 작업 | 파일 |
|---|------|------|
| 1 | HTML 템플릿 파일 생성 | `template/email/HP_RSV_CNF_{CODE}.html` |
| 2 | EmailTemplateType subjects Map에 제목 추가 | `EmailTemplateType.java` |
| 3 | BookingConfirmEmailModel.formatDate()에 형식 추가 (필요시) | `BookingConfirmEmailModel.java` |

다른 코드 변경 없음 — `resolveLanguage()` 폴백이 자동 처리.
