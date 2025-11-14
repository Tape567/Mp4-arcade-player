# PCM Audio Player for MakeCode Arcade

This extension lets you play short audio samples in the form of 8-bit unsigned PCM arrays (8kHz mono).

## Usage

- Add this extension to your project via the GitHub repo link.
- Use the block `play PCM sample` (or `pcmaudio.playSample` in JS) with a short array of numbers (0-255).
- You can convert WAV files to 8kHz unsigned PCM byte arrays using online converters or audio tools, then paste the array.

**Warning:**  
- Audio support is limited and works best with very short samples (a few hundred bytes).
- Compressed audio formats like MP3 or MP4 are NOT supported.

Example in JavaScript:
```typescript
pcmaudio.playSample([128,128,255,128,0,128,128,128])
```

## License

MIT
