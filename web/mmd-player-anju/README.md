# mmd-player-anju

미쿠미쿠 댄스는 춤이 우선, 모델은 나중.

## Principles

1. **Dance first** — App starts with a random song playing immediately. No model required.
2. **Model joins the dance** — Upload a PMX ZIP anytime. The model loads asynchronously and syncs to the music already playing.
3. **Never stop the music** — Swapping models, changing songs, or loading new files never interrupts audio playback.
4. **Autoplay loop** — When a song ends, a random next song starts automatically.

## UI Layout

```
Row 1: [Artist ▾] [Song ▾]  |  [⏯] [🔊━━━]  |  [FX]
Row 2: [Upload ZIP] [PMX ▾] [Loading...]
```

- **Row 1**: Music controls — artist/song selection, play/pause toggle, volume, effects
- **Row 2**: Model controls — ZIP upload, PMX selection, loading status

## Tech Stack

- Three.js r0.172.0 (WebGPU / TSL)
- Vanilla ES modules
- JSZip 3.10.1
- HTML Audio API
