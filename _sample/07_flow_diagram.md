# 전체 처리 흐름 — Email 예매확인서

---

## 1. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    participant Client as 외부 클라이언트
    participant Controller as EmailController
    participant Producer as KafkaProducerService
    participant Kafka as Kafka Topic
    participant Consumer as KafkaConsumerService
    participant Processing as MessageProcessingService
    participant Factory as MessageHandlerFactory
    participant Handler as BookingConfirmEmail<br/>MessageHandler
    participant DigitalAPI as Navitaire Digital API
    participant Template as Thymeleaf HTML Engine
    participant SenderFactory as MessageSenderFactory
    participant Sender as EmailSender
    participant SMTP as SMTP Server
    participant ES as ElasticSearch

    Client->>Controller: POST /v1/email/bookingConfirmation<br/>{clientName, recordLocator,<br/>emailAddress, cultureCode: "EN"}

    Note over Controller: @Valid 검증<br/>cultureCode: CultureCode enum

    Controller->>Controller: request.toCommand()<br/>→ EmailBookingMessageDTO

    Controller->>Producer: produce(QueueRequestModel)<br/>messageCode=EMAIL_00100
    Producer->>Kafka: JSON 직렬화
    Controller-->>Client: 200 OK (Fire-and-Forget)

    Kafka->>Consumer: @KafkaListener 수신
    Consumer->>Processing: process(queueRequestModel)

    Processing->>Factory: getMessageHandler(EMAIL_00100)
    Factory-->>Processing: BookingConfirmEmailMessageHandler

    Processing->>Handler: buildMessage(data)

    Handler->>Handler: ① ObjectMapperUtil →<br/>EmailBookingMessageDTO

    Handler->>DigitalAPI: ② getBooking(recordLocator)
    DigitalAPI-->>Handler: Booking

    Handler->>Handler: ③ EmailTemplateType.예매확인서

    Handler->>Handler: ④ resolveLanguage(EN) → EN
    Handler->>Template: buildTemplateContent(예매확인서)
    Note over Template: BookingConfirmEmailModel.of(<br/>booking, CultureCode.EN)<br/>→ Gimpo, Mon 23 Mar...<br/>→ /email/HP_RSV_CNF_EN.html

    Template-->>Handler: 렌더링된 HTML

    Processing->>SenderFactory: getSender(EMAIL)
    SenderFactory-->>Processing: EMAIL_SENDER

    Processing->>Sender: send(handler)
    Sender->>Sender: MimeMessage 구성<br/>From: Eastar Jet<br/>Subject: [Eastar Jet] Booking Confirmation
    Sender->>SMTP: javaMailSender.send()
    Sender->>ES: 성공 로깅

    Consumer->>Consumer: ACK
```

---

## 2. 다국어 + 폴백 흐름

```mermaid
flowchart TD
    REQ["API 요청<br/>cultureCode: JP"] --> DTO["EmailBookingMessageDTO<br/>cultureCode: JP"]
    DTO --> HANDLER["BookingConfirmEmailMessageHandler"]

    HANDLER --> RESOLVE["EmailTemplateType<br/>.resolveLanguage(JP)"]

    RESOLVE --> CHECK{"subjects에 JP 존재?"}
    CHECK -->|No| FALLBACK["CultureCode.KR 폴백"]
    CHECK -->|Yes| USE["JP 그대로 사용"]

    FALLBACK --> MODEL["BookingConfirmEmailModel.of(<br/>booking, KR)"]
    USE --> MODEL_JP["BookingConfirmEmailModel.of(<br/>booking, JP)"]

    MODEL --> STATION_KR["getStationName(GMP, KR)<br/>→ 김포"]
    MODEL --> DATE_KR["formatDate(KR)<br/>→ 2026년03월23일(월) 14:30"]

    MODEL_JP --> STATION_JP["getStationName(GMP, JP)<br/>→ 金浦"]
    MODEL_JP --> DATE_JP["formatDate(JP)<br/>→ 2026年03月23日(月) 14:30"]

    STATION_KR --> TPL_KR["/email/HP_RSV_CNF_KR.html"]
    DATE_KR --> TPL_KR
    STATION_JP --> TPL_JP["/email/HP_RSV_CNF_JP.html"]
    DATE_JP --> TPL_JP

    TPL_KR --> SUBJECT_KR["[이스타항공] 항공권 예매 확인서"]
    TPL_JP --> SUBJECT_JP["[イースター航空] 航空券予約確認書"]

    style FALLBACK fill:#f39c12,color:#fff
    style CHECK fill:#4a90d9,color:#fff
    style TPL_KR fill:#27ae60,color:#fff
    style TPL_JP fill:#27ae60,color:#fff
```

---

## 3. 파이프라인 비교

```mermaid
flowchart LR
    subgraph KAKAO["KakaoTalk"]
        direction TB
        K1["POST /v1/kakao/*<br/>clientName, recordLocator"]
        K2["KakaoBookingMessageDTO"]
        K3["KAKAO_001xx"]
        K4["KakaoMessageHandler<br/>한국어 고정"]
        K5["TEXT /kakao/*.txt"]
        K6["KAKAO_SENDER<br/>Ustra Cloud API"]
        K1 --> K2 --> K3 --> K4 --> K5 --> K6
    end

    subgraph EMAIL["Email"]
        direction TB
        E1["POST /v1/email/*<br/>+ emailAddress<br/>+ cultureCode"]
        E2["EmailBookingMessageDTO"]
        E3["EMAIL_001xx"]
        E4["EmailMessageHandler<br/>CultureCode 기반 다국어"]
        E5["HTML /email/*_{lang}.html"]
        E6["EMAIL_SENDER<br/>SMTP"]
        E1 --> E2 --> E3 --> E4 --> E5 --> E6
    end

    subgraph SHARED["공유"]
        KAFKA["Kafka"]
        MPS["MessageProcessingService"]
        API["APIService<br/>Booking 조회"]
        ES["ElasticSearch"]
    end

    K2 -.-> KAFKA
    E2 -.-> KAFKA
    KAFKA -.-> MPS
    MPS -.-> K4
    MPS -.-> E4
    K4 -.-> API
    E4 -.-> API
    K6 -.-> ES
    E6 -.-> ES

    style KAKAO fill:#fff3e0
    style EMAIL fill:#e3f2fd
    style SHARED fill:#f1f8e9
```

---

## 4. 에러 시나리오

```mermaid
flowchart TD
    START[메시지 처리] --> PARSE{DTO 역직렬화}
    PARSE -->|실패| SKIP1["SKIP & COMMIT"]

    PARSE -->|성공| NULL_CHECK{cultureCode null?}
    NULL_CHECK -->|Yes| DEFAULT["KR 기본값 설정"]
    NULL_CHECK -->|No| BOOKING

    DEFAULT --> BOOKING{Booking 조회}
    BOOKING -->|API 실패| RETRY["재시도 3회 → DLT"]

    BOOKING -->|성공| RESOLVE{resolveLanguage}
    RESOLVE --> TEMPLATE{HTML 렌더링}
    TEMPLATE -->|템플릿 없음| SKIP2["SKIP & COMMIT<br/>TemplateInputException"]

    TEMPLATE -->|성공| SEND{SMTP 발송}
    SEND -->|실패| RETRY2["재시도 3회 → DLT"]
    SEND -->|성공| ACK["ACK + ES 로깅"]

    style SKIP1 fill:#f39c12,color:#fff
    style SKIP2 fill:#f39c12,color:#fff
    style RETRY fill:#e74c3c,color:#fff
    style RETRY2 fill:#e74c3c,color:#fff
    style ACK fill:#27ae60,color:#fff
    style DEFAULT fill:#3498db,color:#fff
```

---

## 5. 구현 체크리스트

```mermaid
flowchart TD
    P1["Phase 1: 기반 코드"]
    P1A["✏️ EmailBookingMessageDTO<br/>common/.../dto/email/<br/>cultureCode: CultureCode"]
    P1B["✏️ EmailTemplateType enum<br/>message/.../enums/<br/>subjects: Map CultureCode, String"]
    P1C["✏️ BookingConfirmEmailModel<br/>message/.../model/email/<br/>formatDate + CultureCode"]

    P2["Phase 2: 핸들러"]
    P2A["🔧 EmailMessageHandler<br/>htmlTemplateEngine + cultureCode"]
    P2B["🔧 BookingConfirmEmailMsgHandler<br/>buildMessage() + throw e"]
    P2C["🔧 MessageCode enum<br/>EmailBookingMessageDTO.class"]

    P3["Phase 3: 발송"]
    P3A["🔧 build.gradle<br/>spring-boot-starter-mail"]
    P3B["🔧 application.properties<br/>SMTP 설정"]
    P3C["🔧 EmailSender<br/>EMAIL_SENDER + SMTP"]

    P4["Phase 4: API"]
    P4A["✏️ EmailBookingRequest<br/>cultureCode: CultureCode"]
    P4B["✏️ EmailController"]

    P5["Phase 5: 템플릿"]
    P5A["✏️ HP_RSV_CNF_KR.html"]
    P5B["✏️ HP_RSV_CNF_EN.html"]

    P1 --> P1A --> P1B --> P1C
    P1C --> P2
    P2 --> P2A --> P2B --> P2C
    P2C --> P3
    P3 --> P3A --> P3B --> P3C
    P3C --> P4
    P4 --> P4A --> P4B
    P4B --> P5
    P5 --> P5A --> P5B

    style P1 fill:#4a90d9,color:#fff
    style P2 fill:#e74c3c,color:#fff
    style P3 fill:#f39c12,color:#fff
    style P4 fill:#27ae60,color:#fff
    style P5 fill:#8e44ad,color:#fff
```

**범례**: ✏️ 신규 생성, 🔧 기존 수정
**총 파일**: 신규 8개 + 수정 5개 + 설정 3개 = 16개
