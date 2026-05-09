# 🎵 Lyrics AI

## Tagline-en

Combine your favorite music, lyrics, and images to create expressive videos for YouTube, Shorts, Reels, and TikTok with ease.

## Tagline-ko

좋아하는 음악과 가사, 그리고 이미지를 조합해 YouTube, Shorts, Reels, TikTok용 감성 영상을 쉽고 빠르게 만들어보세요.

## Tagline-ja

好きな音楽や歌詞、お気に入りの画像を組み合わせて、YouTubeやTikTok向けの映像を手軽に作れます。

---

## Summary-en

When you find a song you love, sometimes simply listening to it doesn’t feel like enough.
There are moments when you want to turn the lyrics, your favorite images, and the music itself into something that feels like a scene from a memory.

But creating those videos can be surprisingly time-consuming.
Complicated editing software, subtitles that never sync quite right, and too many steps just to make a short 3-minute video.

Lyrics AI was built to make that process feel lighter and more natural.
Just upload a song, and the lyrics are automatically transcribed for you.
You can fine-tune each line yourself, then turn everything into a beautifully animated video using an album cover or any image you like.

From widescreen videos for YouTube
to vertical formats for Shorts, Reels, and TikTok.

A simple way to turn the music you love into something a little more personal, expressive, and easy to share.

## Summary-ko

좋아하는 노래가 생기면, 가끔은 그냥 듣는 것만으로 부족할 때가 있죠.
가사와 좋아하는 이미지, 그리고 음악을 하나의 장면처럼 남기고 싶을 때.

하지만 이런 작업은 생각보다 꽤 번거롭습니다.
복잡한 편집툴, 어색하게 어긋나는 자막, 3분짜리 영상 하나를 만들기 위해 배워야 하는 많은 과정들.

Lyrics AI는 그 과정을 조금 더 가볍고 자연스럽게 만들어주는 툴입니다.
노래를 넣으면 가사를 자동으로 추출하고, 원하는 부분은 한 줄씩 직접 수정할 수 있습니다.
완성된 가사는 앨범 커버 혹은 원하는 이미지와 함께 하나의 영상으로 완성되죠.

YouTube용 가로 영상부터 Shorts, Reels, TikTok용 세로 영상까지.

좋아하는 음악을, 쉽고 빠르게, 조금 더 감각적인 형태로 남길 수 있도록.

## Summary-ja

好きな曲に出会うと、ただ聴いているだけでは物足りなくなる瞬間があります。
歌詞とお気に入りの画像、そして音楽を、ひとつのシーンのように残したくなることってありますよね。

でも実際に作ろうとすると、意外と大変です。
複雑な編集ソフト、微妙にズレる字幕、たった数分の動画を作るために覚えなければいけないたくさんの作業。

Lyrics AI は、そんな制作の流れをもっと軽やかで自然なものにするためのツールです。
曲を入れるだけで歌詞を自動で抽出し、気になる部分は1行ずつ自分で調整できます。
完成した歌詞は、アルバムカバーや好きな画像と組み合わせて、ひとつの映像として仕上がります。

YouTube向けの横動画から、Shorts、Reels、TikTok向けの縦動画まで対応。

好きな音楽を、もっと手軽に、もっと自分らしい形で残せるように。

---

## ✨ What It Does

- **Auto-transcribes lyrics with timing** — OpenAI Whisper transcribes your audio with word + segment-level timestamps, so karaoke-grade sync comes for free.
- **Lets you fix every millisecond** — Inline editor for text, start/end times, line splits, merges, inserts, deletes — with Cmd+Z undo/redo and IME-safe Enter handling for Korean/Japanese typing.
- **Plays it back Apple Music–style** — Full-screen player with a blurred album cover, smoothly fading active lines, and click-to-seek on any line.
- **Exports to SRT** — Standard `HH:MM:SS,mmm` subtitle file that drops cleanly into Premiere, DaVinci, VLC, or YouTube.
- **Exports to mp4 video** — Canvas renderer paints a circular cover, 360-bar EQ visualizer, and animated lyrics, then WebCodecs muxes it to mp4 5–10× faster than realtime (with a MediaRecorder fallback for browsers that lack it).
- **Imports existing SRTs** — Already have a subtitle file? Drop it in to skip transcription and jump straight to editing.
- **Edits song metadata in place** — Drag-and-drop a new album cover, tweak title and artist, all autosaved.
- **Stays 100% in your browser** — No server-side API routes. Audio, lyrics, projects all live in IndexedDB on your machine.
- **Uses your own API key** — BYO OpenAI key stored in localStorage. Zero developer-side cost, zero account system.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui (Radix UI) |
| State | Zustand 5 + zundo (temporal undo/redo) |
| STT | OpenAI Whisper API (`whisper-1`, browser-direct via official SDK) |
| Subtitles | `@remotion/captions` (SRT parse/serialize) |
| Audio metadata | `music-metadata-browser` (ID3) |
| Video render | Canvas 2D + WebCodecs (mp4) / MediaRecorder (webm fallback) |
| FFT / EQ | `fft.js` (offline per-frame frequency analysis) |
| Persistence | IndexedDB via `idb-keyval` |
| Icons / Toast | lucide-react · sonner |
| Deploy | Vercel (static — no API routes) |

---

## 📦 Installation

```bash
git clone https://github.com/hsu3046/lyrics-ai.git
cd lyrics-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional — pre-fill your OpenAI key in dev

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
```

> ⚠ `NEXT_PUBLIC_*` is inlined into the client bundle at build time. For production, leave this empty and let users enter their key into the localStorage prompt (BYO flow).

### Production build

```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── page.tsx                  # Project list + audio drop zone
│   │   ├── layout.tsx                # Root layout, fonts, theming
│   │   └── globals.css               # Tailwind v4 + shadcn tokens
│   ├── components/
│   │   ├── player/ApplePlayer.tsx    # Full-screen player + sync engine
│   │   ├── player/LyricsView.tsx     # Active-line scroll + fade
│   │   ├── editor/                   # Editable lyrics, line rows, IME guards
│   │   ├── transcribe/               # Whisper trigger button
│   │   ├── upload/SrtImportButton.tsx
│   │   ├── export/                   # SRT + video export buttons
│   │   ├── song/EditSongMetaDialog.tsx
│   │   └── ui/                       # shadcn primitives
│   ├── hooks/                        # useAudioPlayback, useActiveLineIndex
│   └── lib/
│       ├── editor/                   # Zustand store + pure ops + autosave
│       ├── stt/                      # Whisper adapter + normalize
│       ├── srt/                      # parse / serialize / align
│       ├── audio/                    # ID3 metadata extract
│       ├── export/                   # canvasRenderer + pipeline + pipelineFast (WebCodecs)
│       ├── persistence/              # IndexedDB projects + localStorage API keys
│       ├── player/                   # Audio sync helpers
│       ├── utils/                    # Time formatting, IME helpers
│       └── types.ts                  # Domain types (Caption-compatible)
├── public/                           # Static assets
├── AGENTS.md                         # Project conventions for AI coding agents
└── next.config.ts                    # Next.js + COOP/COEP headers
```

---

## 🗺 Roadmap

- [ ] Auto-compress audio over 25 MB before sending to Whisper
- [ ] Multi-model STT picker (ElevenLabs Scribe, Gemini)
- [ ] Word-level karaoke highlight in video export
- [ ] Speaker diarization for duets / interviews
- [ ] Custom themes for player and exported video
- [ ] IndexedDB quota dashboard + bulk project cleanup
- [ ] Long-file chunked transcription with stitching

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat(scope): add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

---

*Built by [KnowAI](https://knowai.space) · © 2026 KnowAI*
