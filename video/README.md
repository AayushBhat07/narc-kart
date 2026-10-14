# Demo video

Remotion project that produces `docs/media/narc-kart-demo.mp4`.

```bash
# 1. Serve the built app
cd frontend && npm run build && npx vite preview --port 4173

# 2. Record a walkthrough (in another shell)
cd video && npm install
npm run record
ffmpeg -i recording/*.webm -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 public/rec.mp4

# 3. Preview or render
npm run studio
npm run render
```

If you re-record, check the scene start times in `CLIPS` at the top of `src/Demo.tsx`.
Share Tech Mono (`public/stm.ttf`) is under the SIL Open Font License.
