# PCM Audio Player for MakeCode Arcade

Play recorded audio (a voice line, a drum hit, a jingle) in MakeCode Arcade from
raw 8-bit unsigned PCM data.

## How it works

Arcade has no sample playback engine. Its only low level audio API is
[`music.playInstructions`](https://arcade.makecode.com/developer/sound), which
plays tones described by waveform, frequency, duration and a volume ramp.

This extension analyses the PCM data in 10ms frames, estimates the pitch of each
frame from its zero crossing rate and its loudness from its peak amplitude, and
re-synthesises the clip as a stream of tone instructions that follow the
original. Speech and single instrument recordings come through recognisably;
music with several instruments at once, or heavy percussion, will not.

## Usage

Add this repository as an extension (**Extensions** &rarr; paste the repo URL).

```typescript
// samples are 8-bit unsigned (0-255), mono
pcmaudio.playSample([128, 168, 207, 231, 247, 215, 136, 57, 1, 9, 72, 160], 8000)

// larger clips are cheaper to store in a hex buffer
const clip = hex`88a8cfefffefd7b088583119010111295078`
pcmaudio.playBuffer(clip, 8000, 255, pcmaudio.PlaybackMode.InBackground)

pcmaudio.setWaveform(pcmaudio.Waveform.Square)
pcmaudio.stop()
```

`playSample` and `playBuffer` take the sample rate of the recording (8000 by
default), a volume of 0-255, and either `UntilDone` (the default) or
`InBackground`.

## Converting an audio or video file

`tools/audio_to_pcm.py` shells out to [ffmpeg](https://ffmpeg.org), so it accepts
mp4, mp3, wav, ogg and anything else ffmpeg can decode, and prints TypeScript you
can paste into your project.

```bash
python3 tools/audio_to_pcm.py clip.mp4 --seconds 2 > clip.ts
python3 tools/audio_to_pcm.py clip.wav --format array --start 1.5 --seconds 0.5
```

Useful options: `--rate` (sample rate, default 8000), `--start`/`--seconds` to
trim, `--format hex|array`, `--name` for the generated constant, and
`--no-normalize` to keep the original amplitude.

## Limits

- Keep clips short. A second of audio at 8kHz is 8000 bytes of sample data, and
  the hardware has limited memory.
- Compressed formats (MP3, MP4, AAC) cannot be decoded on the device. The
  converter script decodes them on your computer instead.
- Playback is a monophonic re-synthesis, not a faithful reproduction of the
  recording.
- `playBuffer` takes a `Buffer`, which has no block representation, so it is
  available in JavaScript only.
- `stop()` cancels PCM playback, but the mixer has no handle for an individual
  sound, so silencing what is already queued also stops other game audio.

## License

MIT
