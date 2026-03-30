# MD Viewer

Markdown 파일을 보기 위한 데스크톱 앱입니다. Electron 기반이며, Mermaid 다이어그램과 코드 구문 강조를 지원합니다.

## 기능

- Markdown 렌더링 (GitHub 스타일)
- 코드 블록 구문 강조 (highlight.js)
- Mermaid 다이어그램 렌더링
- 폴더 내 .md 파일 탐색 (사이드바)
- PDF / HTML 내보내기
- 인쇄 기능
- 문서 내 검색 (Ctrl+F)
- 창 크기/위치, 사이드바 너비 기억
- 커맨드라인에서 파일 직접 열기

## 필수 조건

- [Node.js](https://nodejs.org/) 18 이상

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 렌더러 빌드 (CSS, JS 번들 생성)
npm run build:renderer

# 3. 앱 실행
npm start
```

또는 `viewer.bat`을 더블클릭하면 빌드 없이 바로 실행됩니다 (의존성 설치 후).

## 커맨드라인에서 파일 열기

```bash
npm start -- path/to/file.md
```

## 프로젝트 구조

```
├── main.js              # Electron 메인 프로세스
├── preload.js           # IPC 브릿지 (contextBridge)
├── renderer.js          # 렌더러 소스 (marked + highlight.js)
├── index.html           # 메인 UI
├── scripts/
│   └── build.js         # dist/ 빌드 스크립트
├── dist/                # (빌드 산출물, git 미포함)
│   ├── renderer.bundle.js
│   ├── github-markdown.css
│   ├── hljs-github.css
│   └── mermaid.min.js
├── _sample/             # 테스트용 샘플 .md 파일
├── viewer.bat           # 간편 실행 (Windows)
└── install.bat          # 우클릭 메뉴 등록 (EXE 빌드 후)
```

## 포터블 EXE 빌드

설치 파일 없이 독립 실행 가능한 폴더를 생성합니다.

```bash
npm run build
```

`release/MD Viewer-win32-x64/` 폴더에 실행 파일이 생성됩니다.

## 라이선스

ISC
