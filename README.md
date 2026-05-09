# Lyrics AI

음악 파일에서 가사를 자동으로 추출하고, 싱크를 맞추고, 편집하고, Apple Music 스타일 플레이어로 재생하고, **SRT 자막** 또는 **mp4/webm 영상**으로 내보내는 웹 앱.

브라우저 한 페이지에서 모든 작업이 끝납니다. 서버는 정적 호스팅만, 모든 STT/렌더/인코딩은 클라이언트에서 — **API 키는 본인 것 (BYO)**.

## 기능

| 단계 | 기능 |
|---|---|
| 🎵 **업로드** | mp3 / wav / flac / m4a / aac / ogg 드래그&드롭, ID3 태그 자동 추출 (제목·아티스트·앨범커버) |
| ✨ **자동 가사** | OpenAI Whisper API 로 word + segment 단위 정확한 timing |
| 📥 **가사 import** | 외부 SRT 파일 업로드 |
| ✏️ **편집** | 텍스트 / 시간(시작·끝 ms 단위) 직접 수정 · 줄 분할/합치기/추가/삭제 · Cmd+Z undo/redo · 한국어 IME 가드 |
| ▶️ **재생** | Apple Music 스타일 풀스크린 — 블러 앨범커버 배경, 활성 라인 강조 + 부드러운 fade in/out, 라인 클릭 시킹 |
| 📤 **SRT 내보내기** | 표준 `HH:MM:SS,mmm` 형식 SRT 다운로드 |
| 🎬 **영상 내보내기** | Canvas + MediaRecorder 로 webm (Safari 는 native mp4). 1080×1920 / 720×1280 / 가로 옵션 |

## 시작하기

### 필요 조건
- Node.js 18+
- npm
- (선택) OpenAI API 키 — 자동 가사 사용 시

### 설치

```bash
git clone https://github.com/hsu3046/lyrics-ai.git
cd lyrics-ai
npm install
```

### 환경 변수 (선택)

```bash
cp .env.example .env.local
```

`.env.local` 에 본인 API 키를 채우면 dev 환경에서 자동으로 사용. 비워두면 브라우저 prompt → localStorage 저장 (BYO 흐름).

```env
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
```

> ⚠ `NEXT_PUBLIC_*` 는 빌드 시 클라이언트 번들에 인라인됩니다. **production 배포 시에는 비워두고** localStorage BYO 흐름을 권장합니다.

### 개발 서버

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

### 빌드

```bash
npm run build
npm run start
```

## 사용 흐름

1. **음악 업로드** — 메인 페이지에서 파일 드래그
2. **자동 가사** — 헤더의 *가사 생성* 클릭 (Whisper API, ~25원/3분 곡)
3. **가사 편집** — 헤더의 *가사 편집* 토글 → 라인별 텍스트·시간 수정, ▶ 버튼으로 라인별 미리듣기
4. **재생 검증** — *편집 완료* → 동기 재생으로 timing 확인
5. **내보내기**
   - *가사 다운로드* — `.srt` (외부 자막 / 영상 편집 툴 호환)
   - *영상 다운로드* — webm 또는 mp4 (앨범커버 + 가사 애니메이션 + 음악)

## 기술 스택

- **Next.js 16** (App Router) + **React 19** + **TypeScript strict**
- **Tailwind v4** + **shadcn/ui** (Radix UI)
- **OpenAI SDK** — Whisper STT (브라우저 직접 호출, Vercel timeout 무관)
- **`@remotion/captions`** — SRT parse/serialize
- **Zustand + zundo** — 가사 편집 store + undo/redo
- **IndexedDB** (`idb-keyval`) — 프로젝트 영속화
- **Canvas API + MediaRecorder API** — 영상 캡처
- **AudioContext** — 정확한 audio sync (rAF + currentTime 폴링)
- **`music-metadata-browser`** — ID3 태그 추출

## 핵심 설계

- **클라이언트 only** — 서버 API 라우트 0개. STT/영상 모두 브라우저에서. 프라이버시 ↑, 비용 ↓
- **BYO API 키** — 사용자 본인 OpenAI 키, localStorage 저장. 개발자 비용 0
- **Apple Music UX** — 블러 커버 배경 + 활성 라인 자동 center scroll + 부드러운 fade in/out
- **편집기 = single source of truth** — Zustand store, 500ms debounce auto-save, 100단계 undo/redo

## 알려진 제한

- Whisper API 25MB 파일 제한 (자동 압축은 향후 추가 예정)
- 곡 길이만큼 영상 export 시간 소요 (3분 곡 ≈ 3분, real-time 캡처)
- Safari 14.1+ 권장 (MediaRecorder)
- iOS Safari 자동재생 제약 — 첫 사용자 클릭 후 재생 가능

## 라이선스

[GNU GPL v3](LICENSE) — Copyright © 2026 [KnowAI](https://knowai.space)

이 프로그램은 자유 소프트웨어이며 GPL v3 라이선스 하에 배포됩니다.
