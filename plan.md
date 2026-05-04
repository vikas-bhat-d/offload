# Offload — Local-First AI Sorting App
> React Native (Core) · On-Device · Multimodal · Zero Cloud · **Android-first**

---

## Overview

A mobile app that accepts shared text, images, and links, automatically embeds them into a unified semantic vector space, groups similar items together, names those groups, and lets you ask questions against your saved collection — all running entirely on-device with no API keys or internet dependency.

**Current status:** Vector storing and semantic search logic is built and tested. All remaining phases build on top of that foundation.

---

## Core Principles

- **Local-first** — all models, vectors, and data live on the device
- **One vector space** — text and images embedded by the same model, enabling unified cross-modal search and clustering
- **Incremental** — new items are processed and clustered as they arrive, not in batches
- **Lightweight** — model choices are deliberate to stay within mobile memory budgets
- **No Expo** — bare React Native CLI only; required for `onnxruntime-react-native` and `llama.rn` native module compatibility

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React Native CLI (bare) | Expo breaks `onnxruntime-react-native` and `llama.rn` native modules |
| Embedding + tokenization | `@huggingface/transformers` v3 | Handles tokenization + ONNX inference together — no manual tokenizer |
| ONNX backend | `onnxruntime-react-native` | Engine that transformers.js drives — never called directly |
| LLM for naming + RAG | `Qwen2.5-0.5B-Instruct` (GGUF Q4) | ~400MB, handles both cluster naming and RAG answers |
| On-device LLM runtime | `llama.rn` | Wraps llama.cpp, compatible with bare React Native, Android Vulkan/CPU |
| Local database | `op-sqlite` (`sqliteVec: true`) | SQLite + sqlite-vec compiled in for vector similarity queries |
| Clustering | `ml-hdbscan` / `ml-kmeans` (ml.js) | Pure JS, no native deps |
| Share intent | `react-native-share-menu` | Android `ACTION_SEND` intent handler |
| Link metadata | `react-native-link-preview` + oEmbed | OG tag parsing + structured social metadata |
| Model downloader | `react-native-fs` | Resumable downloads, persistent storage (replaces expo-file-system) |
| Integrity check | `react-native-crypto` | SHA256 verification post-download |

---

## Why `@huggingface/transformers` Over Raw ONNX

ONNX runtime is **only the math graph** — it has no concept of tokenization, vocabulary, or image preprocessing. Using `onnxruntime-react-native` directly would require porting a full tokenizer from `tokenizer.json` by hand. Getting this subtly wrong produces silently bad embeddings with no error thrown.

`@huggingface/transformers` v3 solves this:
- Bundles tokenizer loading and execution with ONNX inference
- Handles image resize + normalization internally
- Built specifically for Xenova's ONNX model exports (the same repo we download from)
- Uses `onnxruntime-react-native` as its backend — still needed, just not called directly
- Inference call becomes simply `pipeline('feature-extraction', model)(input)`

> **Phase 2 must include a spike** to validate local file loading from `documentDirectory` works with transformers.js v3 on bare RN before building on top of it.

---

## Why `nomic-embed-vision`

CLIP and `nomic-embed-text` produce incompatible vector spaces — cross-model cosine similarity is meaningless. `nomic-embed-vision` solves this:

- Text and images embedded into the **same shared vector space**
- Aligned with `nomic-embed-text` by design (Nomic trained them together)
- Supports **longer text** than CLIP's hard 77-token limit
- One model, one index, cross-modal search for free
- ~300MB ONNX — acceptable for a first-launch download

---

## Architecture

```
Share Intent / Direct App Input
          │
          ▼
  Content Ingestion Layer
  ┌─────────────────────────────┐
  │ text  │ image  │ url        │
  │       │        │ → scrape   │
  │       │        │   metadata │
  └─────────────────────────────┘
          │
          ▼
  Preprocessing Pipeline
  - Text: clean, truncate to model max
  - Image: resize 224×224, normalize (handled by transformers.js)
  - Link: OG tags + oEmbed → title + description + thumbnail
          │
          ▼
  @huggingface/transformers (nomic-embed-vision)
  → 768-dim float32 vector per item
          │
          ▼
  op-sqlite + sqlite-vec
  - Store raw content + vector BLOB
  - vec_distance_cosine for search and centroid lookup
          │
          ▼
  Incremental Clustering Engine
  - sqlite-vec nearest centroid query
  - Assign or create cluster, update centroid
          │
          ▼
  Periodic Re-clustering (background thread)
  - Full HDBSCAN pass to fix centroid drift
          │
          ▼
  Cluster Naming (Qwen2.5-0.5B via llama.rn)
  - Triggered on cluster create / update
  - Lazy load → generate → unload
          │
          ▼
  UI: Grouped Cards · Semantic Search · AI Answer
```

---

## Database Schema

```sql
CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  content_type    TEXT NOT NULL,       -- 'text' | 'image' | 'link'
  raw_content     TEXT,                -- original text or URL
  preview_text    TEXT,                -- display snippet / embed_text for links
  thumbnail_path  TEXT,                -- local cached image path
  source_name     TEXT,                -- 'youtube' | 'reddit' | 'github' etc
  embedding       BLOB NOT NULL,       -- Float32Array, 768 dims
  cluster_id      TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE clusters (
  id              TEXT PRIMARY KEY,
  name            TEXT,                -- generated by Qwen
  centroid        BLOB NOT NULL,       -- mean vector of all member embeddings
  item_count      INTEGER DEFAULT 0,
  last_updated    INTEGER NOT NULL
);
```

---

## sqlite-vec in op-sqlite

Enable via build flag — compiles sqlite-vec in at the native layer:

```json
"op-sqlite": {
  "sqliteVec": true
}
```

Core queries used throughout the app:

```sql
-- Semantic search
SELECT id, preview_text, content_type, cluster_id,
       vec_distance_cosine(embedding, ?) AS score
FROM items
WHERE score < 0.28
ORDER BY score ASC
LIMIT 20;

-- Nearest cluster centroid (incremental clustering)
SELECT id, vec_distance_cosine(centroid, ?) AS score
FROM clusters
ORDER BY score ASC
LIMIT 1;

-- Scoped RAG context fetch
SELECT preview_text, vec_distance_cosine(embedding, ?) AS score
FROM items
WHERE cluster_id = ?
ORDER BY score ASC
LIMIT 5;
```

---

## Link & Social URL Metadata Extraction

### General Links
`react-native-link-preview` fetches the URL's HTML and parses Open Graph + Twitter Card meta tags:

```
og:title              → card title
og:description        → card subtitle
og:image              → thumbnail (downloaded and cached locally)
og:site_name          → source label
article:published_time → date
```

### Social URLs (oEmbed)
oEmbed is a standardised JSON endpoint — structured metadata with no API key required:

| Platform | oEmbed Endpoint | Data Returned |
|---|---|---|
| YouTube | `youtube.com/oembed?url=...` | Title, thumbnail, author, duration |
| Reddit | `reddit.com/oembed?url=...` | Post title, subreddit, thumbnail |
| Twitter/X | `publish.twitter.com/oembed?url=...` | Tweet text, author (increasingly restricted) |
| Spotify | `open.spotify.com/oembed?url=...` | Track/playlist title, cover art |
| GitHub | OG tags (reliable) | Repo name, description |
| Instagram | OG tags only if public | Often blank — accept gracefully |

### What Gets Stored Per Link

```
url            → canonical URL
title          → og:title or oembed title
description    → og:description truncated to ~300 chars
thumbnail_path → og:image downloaded and cached locally
site_name      → platform badge shown on card
published_at   → if available
embed_text     → title + description concatenated → fed to nomic for embedding
```

---

## Vector Search Flow

```
User types "attention mechanism"
          │
          ▼
@huggingface/transformers tokenizes + embeds query
→ 768-dim float32 vector
          │
          ▼
sqlite-vec query:
  vec_distance_cosine(embedding, queryVec) < 0.28
  ORDER BY score ASC  LIMIT 20
          │
          ▼
Results ranked by semantic closeness
          │
          ▼
Filter layer: All · Text · Images · Links · by Cluster
          │
          ▼
Cards rendered with subtle similarity score bar

```

> **Threshold note:** 0.28 cosine distance ≈ "meaningfully related". Include a hidden debug slider in dev builds to tune this against real data before hardcoding.

Cross-modal search works for free — a text query can surface saved images, and an image query can surface saved text notes, because both live in the same vector space.

---

## AI Answer — RAG Feature

### Pattern

```
User question
      │
      ▼
Embed question → sqlite-vec top-5 most relevant items
(scoped to cluster or global depending on entry point)
      │
      ▼
Build context string from items' preview_text
      │
      ▼
Qwen2.5-0.5B prompt (via llama.rn):

"You are a helpful assistant. Answer using only the context below.
 Do not make up information not present in the context.
 Context:
 1. {item1_preview}
 2. {item2_preview}
 3. {item3_preview}
 Question: {user_question}
 Answer:"
      │
      ▼
Stream tokens → UI
      │
      ▼
Show source attribution: · arxiv.org/... · Your note, 3d ago
```

### Two Entry Points

- **"Ask this cluster"** — `WHERE cluster_id = ?` on the sqlite-vec query. Focused context, better answers.
- **"Ask everything"** — global search across all items. Wider but noisier.

### Honest Limitations of Qwen 0.5B for RAG

- Reasoning quality is limited at 0.5B — answers will be simple
- Short context window — keep context to 3–5 short snippets, not full articles
- May hallucinate when context is thin — UI copy should say *"Based on what you've saved"* not *"The answer is..."*
- Upgrade path: swap for **Qwen2.5-1.5B or 3B** later — architecture unchanged, just the model file

---

## Model Sources & Registry

```
https://huggingface.co/{repo}/resolve/main/{filename}
```

| Model | HuggingFace Repo | File | Size |
|---|---|---|---|
| nomic-embed-vision | `Xenova/nomic-embed-vision-v1.5` | `onnx/model.onnx` | ~300MB |
| Qwen2.5-0.5B Q4 | `Qwen/Qwen2.5-0.5B-Instruct-GGUF` | `qwen2.5-0.5b-instruct-q4_k_m.gguf` | ~400MB |

Models saved to `RNFS.DocumentDirectoryPath` — persists across app updates, never cleared by the OS.

---

## Model Manager Service

`modelManager.ts` owns all download logic. Every other service calls `modelManager.isReady('nomic')` before attempting inference.

### Download State Machine

```
NOT_DOWNLOADED
      │
      ▼
CHECKING_SPACE ──(< 1.5GB free)──→ ERROR
      │
      ▼
DOWNLOADING ──(killed)──→ INTERRUPTED (snapshot saved to AsyncStorage)
      │  ↑                        │
      │  └────────────────────────┘
      │       (resume on next launch)
      ▼
VERIFYING (SHA256)
      │
      ├──(fail)──→ CORRUPT → delete → NOT_DOWNLOADED
      │
      ▼
READY
```

- **nomic-embed-vision** — required, app non-functional without it
- **Qwen** — optional, skippable on first launch, downloadable later from Settings
- Downloads continue via Android foreground service when app is backgrounded
- Resume on restart via `react-native-fs` download resume tokens persisted to `AsyncStorage`

---

## Model Loading Strategy

```
App Launch
  └── modelManager.isReady('nomic') ?
      ├── YES → load into transformers.js pipeline, warm-up pass, UI unlocks
      └── NO  → show download screen

New Item Arrives
  └── transformers.js pipeline already loaded → embed immediately

Cluster Needs Naming / RAG Question
  └── modelManager.isReady('qwen') ?
      ├── YES → llama.rn.loadLlama() → generate → llama.rn.release()
      └── NO  → prompt user to download Qwen from Settings
```

---

## Memory Budget

| Component | RAM |
|---|---|
| nomic-embed-vision via transformers.js (resident) | ~400MB |
| Qwen2.5-0.5B Q4 via llama.rn (on demand) | ~350MB |
| App + op-sqlite + UI | ~100MB |
| **Peak (naming / RAG active)** | **~850MB** |
| **Steady state** | **~500MB** |

---

## UI Design System

### Palette

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#F5F0E8` | App background — warm off-white, aged paper |
| `bg-surface` | `#EDE8DC` | Cards and sheets |
| `green-primary` | `#7FA688` | Cluster icons, active states, CTAs |
| `green-subtle` | `#C4D4C0` | Tags, badges, progress fills |
| `green-deep` | `#5C8A6A` | Selected states, pressed buttons |
| `text-primary` | `#2C2C2C` | Near-black — softer than pure black |
| `text-secondary` | `#8C8474` | Metadata, timestamps, subtitles |
| `border` | `#D4CCBC` | Low-contrast dividers |

### Typography
- **Headers / cluster names:** `DM Serif Display` or `Playfair Display` — organic, editorial
- **Body / metadata:** `DM Sans` or `Inter` — readable at small sizes
- Slightly loose letter-spacing on uppercase labels

### Texture & Depth
- Subtle SVG noise overlay at 4–6% opacity on `bg-base` — the paper grain effect
- Cards: very slight inner shadow on top edge (paper resting on surface feel)
- No hard drop shadows — soft warm `elevation: 2` only
- Rounded corners: `8px` on cards, `20px` on bottom sheets and modals

---

## Screen-by-Screen UX Flow

### Onboarding / First Launch
```
┌──────────────────────────┐
│   [paper grain bg]       │
│                          │
│      ✦ Sorter            │  serif logotype
│                          │
│  "Your thoughts,         │
│   automatically          │
│   organised."            │
│                          │
│  One-time setup          │
│  ┌────────────────────┐  │
│  │ Embedding model    │  │
│  │ ████████░░  74%    │  │  green fill
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Language model     │  │
│  │ ░░░░░░░░░░  Queued │  │
│  └────────────────────┘  │
│            [Skip Qwen →] │
└──────────────────────────┘
```

### Home — Cluster View (default tab)
```
┌──────────────────────────┐
│  Sorter          [+] [⌕] │
│ ────────────────────────-│
│  ╔════════════════════╗  │
│  ║ 🌿 Machine Learning║  │
│  ║  4 items · 2d ago  ║  │
│  ║ [img][img][+2]     ║  │
│  ╚════════════════════╝  │
│  ╔════════════════════╗  │
│  ║ 📎 Side Projects   ║  │
│  ║  7 items · 5h ago  ║  │
│  ╚════════════════════╝  │
│  ╔════════════════════╗  │
│  ║ 🔖 Reading List    ║  │
│  ║  12 items · 1d ago ║  │
│  ╚════════════════════╝  │
│ ──────────────────────── │
│   [Clusters] [Timeline]  │
└──────────────────────────┘
```

### Cluster Detail
```
┌──────────────────────────┐
│  ← Machine Learning      │
│  ──────────────────────  │
│  [ ✦ Ask this cluster ]  │  green pill CTA → RAG screen
│  ──────────────────────  │
│  ┌──────────────────┐    │
│  │ 🔗 arxiv.org     │    │  link card
│  │ Attention Is All │    │
│  │ You Need  · 2d   │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ 📝 Text note     │    │  text card
│  │ "transformer     │    │
│  │  architecture…"  │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ 🖼 Image         │    │  image card
│  │ [thumbnail]      │    │
│  └──────────────────┘    │
└──────────────────────────┘
```

### Search Screen
```
┌──────────────────────────┐
│ ← [find anything...    ] │  autofocused on open
│  ──────────────────────  │
│  [All ▾] [Text] [Images] │  filter pills
│  [Links] [By cluster ▾]  │
│  ──────────────────────  │
│  ┌──────────────────┐    │
│  │ 🔗 distill.pub   │    │
│  │ ████████░░  0.91 │    │  similarity score bar
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ 📝 Note          │    │
│  │ ██████░░░░  0.74 │    │
│  └──────────────────┘    │
└──────────────────────────┘
```

### AI Answer Screen
```
┌──────────────────────────┐
│  ← Ask your collection   │
│  ──────────────────────  │
│  Scope: [This cluster ▾] │
│  ──────────────────────  │
│  ┌──────────────────┐    │
│  │ What do I know   │    │
│  │ about attention  │    │
│  │ mechanisms?      │    │  multiline input
│  └──────────────────┘    │
│              [ Ask ✦ ]   │
│  ──────────────────────  │
│  ✦ Based on 3 saved items│
│  ──────────────────────  │
│  Attention mechanisms    │
│  allow the model to      │
│  weigh token relevance…  │  streamed response
│                          │
│  Sources                 │
│  · arxiv.org/1706…       │
│  · Your note, 3 days ago │
└──────────────────────────┘
```

---

## Share Intent Architecture

### Android (Current Focus)
- `intent-filter` for `ACTION_SEND` (text) and `ACTION_SEND` with image MIME in `AndroidManifest.xml`
- `react-native-share-menu` bridges to RN layer
- No memory cap — embedding runs immediately or queued in a Headless JS task
- Android foreground service available for background embedding of large queues

### iOS (Deferred — Phase 6)
- Native Share Extension target in Xcode — separate process, ~120MB memory cap
- Extension cannot run inference — queues item to shared `App Group` container
- Main app processes queue on next foreground open
- Architecture already queue-based so this slots in cleanly

---

## Clustering Strategy

### On New Item (Incremental)
1. Compute embedding via transformers.js
2. sqlite-vec nearest centroid query
3. If `score < 0.28` → assign to that cluster, update centroid (running average)
4. If no match → create singleton cluster
5. Trigger Qwen naming if cluster is new or has grown significantly

### Periodic Re-clustering (Background)
- Trigger: every 25 new items or on app open after 24h
- Load all embeddings, run `ml-hdbscan` over full set
- Reconcile new assignments with existing clusters
- Re-trigger naming for significantly changed clusters

### Cluster Naming Prompt
```
"Here are some items a user saved:
- {item1_preview}
- {item2_preview}
- {item3_preview}
Give this group a short label of 2–3 words. Reply with only the label."
```

---

## Phased Build Plan

> **Foundation:** Vector storing and semantic search are already built and tested.
> All phases below build directly on top of that working base.
> **Platform:** Android throughout Phases 1–5. iOS is Phase 6.

### Phase 1 — Ingestion Pipeline (In Progress)
- [ ] Share intent handler — `react-native-share-menu` + `AndroidManifest.xml`
- [x] Text ingestion → clean + store in op-sqlite
- [ ] Image ingestion → resize, store thumbnail, store raw path
- [ ] Link ingestion — `react-native-link-preview` for OG tags
- [ ] oEmbed fetch for YouTube, Reddit, Spotify, GitHub URLs
- [ ] `embed_text` construction per content type (title + desc for links)
- [x] Basic flat list UI showing saved items (no clustering yet)

### Phase 2 — Embedding Pipeline (Completed)
- [x] **Spike:** validate `@huggingface/transformers` v3 loading a local ONNX file from `RNFS.DocumentDirectoryPath` on bare RN — must pass before any other Phase 2 work
- [x] `modelManager.ts` — registry of URLs, paths, SHA256 hashes, `isReady()` checks
- [x] First-launch download screen with per-model progress bars
- [x] Resumable download via `react-native-fs`, snapshot persisted to `AsyncStorage`
- [ ] SHA256 integrity check via `react-native-crypto`
- [ ] Android foreground service to keep download alive when backgrounded
- [x] Plug embedding into ingestion pipeline — every saved item gets a vector
- [x] Semantic search screen wired to existing sqlite-vec query

### Phase 3 — Clustering
- [ ] Incremental clustering on item insert (sqlite-vec centroid query)
- [ ] Cluster centroid storage + running average update
- [ ] Cluster Detail screen — grouped item cards
- [ ] Home screen — cluster card grid
- [ ] Periodic background re-clustering with `ml-hdbscan`
- [ ] Manual cluster merge / split in UI

### Phase 4 — Intelligence Layer (Qwen / llama.rn)
- [ ] `llama.rn` integration — load, generate, release lifecycle
- [ ] Optional Qwen download from Settings screen
- [ ] Auto cluster naming on cluster create / significant update
- [ ] Manual cluster rename (overrides AI name)
- [ ] AI Answer screen — scoped and global RAG
- [ ] Streamed response rendering
- [ ] Source attribution under answer

### Phase 5 — Polish (Android)
- [ ] Paper texture background — SVG noise overlay
- [ ] Full design system: palette, typography (`DM Serif Display` + `DM Sans`), card depth
- [ ] Similarity score bar on search results
- [ ] Cross-modal search (image card → text results, text query → image results)
- [ ] Timeline view (flat chronological, secondary tab)
- [ ] Thumbnail previews for link cards (OG image cached locally)
- [ ] Settings screen — storage usage, re-download models, debug threshold slider

### Phase 6 — iOS Port (Deferred)
- [ ] Native Share Extension target in Xcode
- [ ] App Groups shared container — extension queues, main app embeds
- [ ] Verify `onnxruntime-react-native` + `llama.rn` on iOS Metal
- [ ] iOS memory tuning (jetsam limits, Qwen lazy load critical)

---

## Known Hard Parts & Mitigations

| Challenge | Mitigation |
|---|---|
| transformers.js v3 local file loading on bare RN | Phase 2 starts with a dedicated spike — do not skip this |
| oEmbed failures / missing OG tags | Graceful fallback: use URL hostname as title, no thumbnail, still embed the URL itself |
| Qwen 0.5B RAG quality | Set UI expectations clearly — "based on what you've saved", show sources, offer model upgrade path |
| Corrupted partial model download | SHA256 check post-download, auto-delete and retry on failure |
| Download killed when backgrounded | Android foreground service + `react-native-fs` resume token in `AsyncStorage` |
| Clustering drift over time | Periodic full HDBSCAN re-cluster corrects centroid error |
| sqlite-vec needs dev build | `sqliteVec: true` in `package.json`, rebuild native — incompatible with RN Go / Expo Go |
| Android background embedding queue | Headless JS task processes share queue when app reopens |
| iOS Share Extension 120MB cap (future) | Queue-only in extension, all inference in main app — already designed this way |

---

## Directory Structure

```
android/              ← ACTION_SEND intent filter in AndroidManifest.xml
ios/                  ← untouched until Phase 6
src/
  components/
    ClusterCard.tsx
    ItemCard.tsx
    SearchBar.tsx
    ScoreBar.tsx
    LinkPreviewCard.tsx
  screens/
    HomeScreen.tsx
    ClusterDetailScreen.tsx
    SearchScreen.tsx
    AskScreen.tsx
    SettingsScreen.tsx
    OnboardingScreen.tsx
  services/
    modelManager.ts   ← HuggingFace URLs, download, resume, SHA256, isReady()
    embedding.ts      ← transformers.js pipeline wrapper
    clustering.ts     ← incremental + batch clustering logic
    naming.ts         ← Qwen cluster naming via llama.rn
    rag.ts            ← RAG pipeline: embed query → fetch context → Qwen answer
    storage.ts        ← op-sqlite + sqlite-vec query helpers
    ingestion.ts      ← text / image / link preprocessing + embed_text construction
    linkMeta.ts       ← OG tag parsing + oEmbed fetch per platform
  theme/
    colors.ts         ← design tokens
    typography.ts     ← font config
    texture.ts        ← SVG noise overlay component
  db/
    schema.ts
    migrations/
  models/             ← downloaded at runtime, gitignored
```

---

*Last updated: May 2026*
