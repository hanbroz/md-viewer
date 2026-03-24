# Phase 4: API 계층 — EmailBookingRequest + EmailController

---

## 1. EmailBookingRequest (신규 생성)

### 파일 위치
```
api/src/main/java/com/eastarjet/symphony/api/request/email/EmailBookingRequest.java
```

### 기존 KakaoBookingRequest와의 비교

```
KakaoBookingRequest                  EmailBookingRequest
├─ @NotNull clientName               ├─ @NotNull clientName
├─ @NotNull @Size(6,6)               ├─ @NotNull @Size(6,6)
│  recordLocator                     │  recordLocator
│                                    ├─ @NotNull @Email
│                                    │  emailAddress              ← 신규
│                                    └─ @NotNull
│                                       cultureCode: CultureCode  ← CultureCode 직접 사용
└─ toCommand() → KakaoBookingMsgDTO  └─ toCommand() → EmailBookingMsgDTO
```

### 코드 스펙

```java
package com.eastarjet.symphony.api.request.email;

import com.eastarjet.symphony.common.dto.email.EmailBookingMessageDTO;
import com.eastarjet.symphony.common.model.enums.CultureCode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class EmailBookingRequest {

    @Schema(description = "클라이언트명", example = "WEB")
    @NotNull(message = "clientName is required")
    private String clientName;

    @Schema(description = "예약번호 (PNR)", example = "G66DKZ")
    @NotNull(message = "recordLocator is required")
    @Size(min = 6, max = 6, message = "recordLocator must be exactly 6 characters")
    private String recordLocator;

    @Schema(description = "수신자 이메일 주소", example = "user@example.com")
    @NotNull(message = "emailAddress is required")
    @Email(message = "invalid email format")
    private String emailAddress;

    @Schema(description = "이메일 언어 (KR, EN, JP, CN, TW, VN, TH)", example = "KR")
    @NotNull(message = "cultureCode is required")
    private CultureCode cultureCode;

    public EmailBookingMessageDTO toCommand() {
        return EmailBookingMessageDTO.builder()
                .clientName(this.clientName)
                .recordLocator(this.recordLocator)
                .emailAddress(this.emailAddress)
                .cultureCode(this.cultureCode)
                .build();
    }
}
```

### Validation

| 필드 | 검증 | 실패 시 |
|------|------|--------|
| `clientName` | `@NotNull` | 400 |
| `recordLocator` | `@NotNull` + `@Size(6,6)` | 400 |
| `emailAddress` | `@NotNull` + `@Email` | 400 |
| `cultureCode` | `@NotNull` + Jackson enum 검증 | 400 |

**cultureCode 검증**: CultureCode enum이므로 유효하지 않은 값(예: `"XX"`)이 오면
Jackson `HttpMessageNotReadableException` → 400.
유효하지만 템플릿이 없는 값(예: `"JP"`)은 정상 수신 후 KR 폴백.

---

## 2. EmailController (신규 생성)

### 파일 위치
```
api/src/main/java/com/eastarjet/symphony/api/controller/EmailController.java
```

### 코드 스펙

```java
package com.eastarjet.symphony.api.controller;

import com.eastarjet.symphony.api.request.email.EmailBookingRequest;
import com.eastarjet.symphony.api.response.APIResult;
import com.eastarjet.symphony.message.QueueRequestModel;
import com.eastarjet.symphony.message.enums.MessageCode;
import com.eastarjet.symphony.message.service.KafkaProducerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Null;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@Tag(name = "email")
@RequiredArgsConstructor
public class EmailController {

    private final KafkaProducerService kafkaProducerService;

    @Operation(summary = "예매 확인서 이메일 발송 | 예매 내역을 이메일로 발송합니다.")
    @PostMapping(value = "/v1/email/bookingConfirmation")
    @ApiResponse(responseCode = "200", description = "OK",
                 content = @Content(schema = @Schema(implementation = Null.class)))
    public ResponseEntity<APIResult<String>> sendEmailBookingConfirmation(
            @Valid @RequestBody EmailBookingRequest request) {

        kafkaProducerService.produce(QueueRequestModel.builder()
                .messageCode(MessageCode.EMAIL_00100)
                .data(request.toCommand())
                .build());

        return ResponseEntity.ok(APIResult.<String>builder()
                .data(null)
                .build());
    }
}
```

### API 호출 예시

```http
POST /v1/email/bookingConfirmation
Content-Type: application/json

{
  "clientName": "WEB",
  "recordLocator": "I7R6KG",
  "emailAddress": "hong@example.com",
  "cultureCode": "EN"
}
```

**Response:** `200 OK` `{"data": null}`

**Kafka 메시지 (내부):**
```json
{
  "messageCode": "EMAIL_00100",
  "data": {
    "clientName": "WEB",
    "recordLocator": "I7R6KG",
    "emailAddress": "hong@example.com",
    "cultureCode": "EN"
  }
}
```
