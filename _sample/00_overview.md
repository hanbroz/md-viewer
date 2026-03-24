# Email 예매확인서 구현 계획 - Overview

> **작성일**: 2026-03-23
> **목표**: KakaoTalk과 동일한 파이프라인으로 다국어 Email 예매확인서 발송 구현
> **지원 언어**: 한국어(KR), 영어(EN) 우선 구현 — CultureCode 기반으로 전체 언어 확장 가능
> **설계 결정**: LanguageType 별도 생성하지 않고 기존 `CultureCode` enum 직접 사용

---

## 1. KakaoTalk vs Email 차이점

| 항목 | KakaoTalk | Email |
|------|-----------|-------|
| 수신자 식별 | 전화번호 (Booking에서 추출) | 이메일 주소 (요청에서 입력) |
| 언어 | 한국어 고정 | **다국어** (CultureCode 파라미터, KR 폴백) |
| 템플릿 모드 | TEXT (Thymeleaf) | **HTML** (Thymeleaf) |
| 템플릿 엔진 | textTemplateEngine | **htmlTemplateEngine** |
| 외부 API | Ustra Cloud KakaoTalk | **SMTP** (Spring Mail) |
| 버튼 | KakaoTemplateType 기반 | 없음 (HTML 링크) |
| 제목(Subject) | 없음 (알림톡) | **다국어 제목 필요** |
| 발송 방식 | REST API POST | **JavaMailSender.send()** |

## 2. 구현 범위

### 신규 생성 파일 (8개)

| # | 모듈 | 파일 | 설명 |
|---|------|------|------|
| 1 | common | `dto/email/EmailBookingMessageDTO.java` | Email 전용 DTO (recordLocator + emailAddress + cultureCode) |
| 2 | api | `request/email/EmailBookingRequest.java` | API 요청 모델 (validation 포함) |
| 3 | api | `controller/EmailController.java` | Email REST 엔드포인트 |
| 4 | message | `enums/EmailTemplateType.java` | Email 템플릿 타입 Enum (언어별 템플릿 코드 + 제목 매핑) |
| 5 | message | `model/email/BookingConfirmEmailModel.java` | Email 템플릿 데이터 모델 (다국어 지원) |
| 6 | template | `email/HP_RSV_CNF_KR.html` | 한국어 예매확인서 HTML 템플릿 |
| 7 | template | `email/HP_RSV_CNF_EN.html` | 영어 예매확인서 HTML 템플릿 |
| 8 | message | `config/EmailConfig.java` | JavaMailSender Bean 설정 (선택사항) |

> **LanguageType 미생성**: 기존 `CultureCode` enum을 직접 사용. 템플릿이 없는 언어는 KR로 폴백.

### 수정 파일 (5개)

| # | 모듈 | 파일 | 수정 내용 |
|---|------|------|----------|
| 1 | message | `sender/EmailSender.java` | 빈 이름 수정 + JavaMailSender 구현 |
| 2 | message | `handler/email/EmailMessageHandler.java` | htmlTemplateEngine 주입 + 템플릿 경로 동적화 |
| 3 | message | `handler/email/BookingConfirmEmailMessageHandler.java` | buildMessage() 완전 구현 |
| 4 | message | `enums/MessageCode.java` | EMAIL_00100 requestModel 변경 |
| 5 | message | `build.gradle` | spring-boot-starter-mail 의존성 추가 |

### 설정 추가 (3개)

| # | 파일 | 추가 내용 |
|---|------|----------|
| 1 | `api/src/main/resources/application.properties` | SMTP 기본 설정 |
| 2 | `api/src/main/resources/application-dev.properties` | 개발 SMTP 설정 |
| 3 | `api/src/main/resources/application-prod.properties` | 운영 SMTP 설정 |

## 3. 구현 순서

```
Phase 1: 기반 코드 (의존성 없는 것부터)
  ├─ EmailBookingMessageDTO (common) — CultureCode 직접 사용
  ├─ EmailTemplateType enum (message)
  └─ BookingConfirmEmailModel (message)

Phase 2: 핸들러 계층
  ├─ EmailMessageHandler 수정 (message)
  ├─ BookingConfirmEmailMessageHandler 구현 (message)
  └─ MessageCode enum 수정 (message)

Phase 3: 발송 계층
  ├─ build.gradle 의존성 추가 (message)
  ├─ application.properties SMTP 설정
  └─ EmailSender 구현 (message)

Phase 4: API 계층
  ├─ EmailBookingRequest (api)
  └─ EmailController (api)

Phase 5: 템플릿
  ├─ HP_RSV_CNF_KR.html
  └─ HP_RSV_CNF_EN.html
```

## 4. 문서 구성

| 문서 | 내용 |
|------|------|
| `00_overview.md` | 이 문서 (전체 개요) |
| `01_common_module.md` | EmailBookingMessageDTO (CultureCode 직접 사용) |
| `02_message_enums.md` | EmailTemplateType, MessageCode 수정 |
| `03_handler_layer.md` | EmailMessageHandler, BookingConfirmEmailMessageHandler |
| `04_sender_layer.md` | EmailSender, SMTP 설정, build.gradle |
| `05_api_layer.md` | EmailController, EmailBookingRequest |
| `06_templates.md` | HTML 템플릿 구조, 다국어 변수 바인딩 |
| `07_flow_diagram.md` | 전체 처리 흐름 Mermaid 다이어그램 |
