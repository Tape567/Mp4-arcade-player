/**
 * Play raw PCM audio (8-bit unsigned, mono) in MakeCode Arcade.
 *
 * Arcade has no sample playback engine: the only low level audio API is
 * music.playInstructions, which plays tones described by
 * (waveform, frequency, duration, volume ramp). PCM data is therefore analysed
 * frame by frame and re-synthesised as a stream of short tone instructions
 * that follow the pitch and loudness of the original recording.
 */
//% color=#0fbc11 icon="\uf028" block="PCM Audio"
namespace pcmaudio {
    // Sound instruction layout: https://arcade.makecode.com/developer/sound
    const INSTRUCTION_SIZE = 12;
    const MAX_VOLUME = 1024;

    // Analysis frame length in milliseconds.
    const FRAME_MS = 10;
    // Number of instructions queued at once.
    const CHUNK_FRAMES = 8;
    // Never queue more than this many milliseconds of audio ahead of time.
    const MAX_QUEUE_MS = 200;
    // Amplitude (0-127) below which a frame is treated as silence.
    const SILENCE_LEVEL = 3;

    const MIN_HZ = 20;
    const MAX_HZ = 8000;

    export enum Waveform {
        //% block="triangle"
        Triangle = 1,
        //% block="sawtooth"
        Sawtooth = 2,
        //% block="sine"
        Sine = 3,
        //% block="square"
        Square = 15
    }

    export enum PlaybackMode {
        //% block="until done"
        UntilDone,
        //% block="in background"
        InBackground
    }

    class Frame {
        ms: number;
        hz: number;
        endHz: number;
        volume: number;
        endVolume: number;

        constructor(ms: number, hz: number, volume: number) {
            this.ms = ms;
            this.hz = hz;
            this.endHz = hz;
            this.volume = volume;
            this.endVolume = volume;
        }
    }

    let waveform = Waveform.Triangle;

    /**
     * Set the waveform used to re-synthesise PCM samples.
     * @param wave the waveform to synthesise with
     */
    //% blockId=pcmaudio_set_waveform block="set PCM waveform to $wave"
    //% weight=60
    export function setWaveform(wave: Waveform): void {
        waveform = wave;
    }

    /**
     * Play a PCM sample stored as an array of 8-bit unsigned values (0-255).
     * @param sample the audio samples, eg: [128, 200, 128, 56]
     * @param sampleRate samples per second of the recording, eg: 8000
     * @param volume playback volume 0-255, eg: 255
     */
    //% blockId=pcmaudio_play_sample
    //% block="play PCM sample $sample || at $sampleRate Hz at volume $volume $mode"
    //% sample.shadow="lists_create_with"
    //% sampleRate.defl=8000 sampleRate.min=1000 sampleRate.max=44100
    //% volume.defl=255 volume.min=0 volume.max=255
    //% expandableArgumentMode="toggle"
    //% weight=100
    export function playSample(sample: number[], sampleRate = 8000, volume = 255, mode = PlaybackMode.UntilDone): void {
        if (!sample || sample.length == 0) return;
        const buf = control.createBuffer(sample.length);
        for (let i = 0; i < sample.length; i++) {
            buf.setUint8(i, Math.clamp(0, 255, sample[i] | 0));
        }
        playBuffer(buf, sampleRate, volume, mode);
    }

    /**
     * Play a PCM sample stored in a buffer of 8-bit unsigned values, for
     * example a hex`...` literal produced by the converter script.
     * @param sample the audio samples
     * @param sampleRate samples per second of the recording, eg: 8000
     * @param volume playback volume 0-255, eg: 255
     */
    //% blockId=pcmaudio_play_buffer
    //% block="play PCM buffer $sample || at $sampleRate Hz at volume $volume $mode"
    //% sampleRate.defl=8000 sampleRate.min=1000 sampleRate.max=44100
    //% volume.defl=255 volume.min=0 volume.max=255
    //% expandableArgumentMode="toggle"
    //% weight=90
    export function playBuffer(sample: Buffer, sampleRate = 8000, volume = 255, mode = PlaybackMode.UntilDone): void {
        if (!sample || sample.length == 0) return;
        const frames = analyze(sample, Math.max(1000, sampleRate | 0));
        if (mode == PlaybackMode.InBackground) {
            control.runInParallel(() => playFrames(frames, volume));
        } else {
            playFrames(frames, volume);
        }
    }

    /**
     * Stop any sound that is currently playing.
     */
    //% blockId=pcmaudio_stop block="stop PCM playback"
    //% weight=50
    export function stop(): void {
        music.stopAllSounds();
    }

    /**
     * Split the samples into short frames and estimate the pitch and loudness
     * of each one. Pitch is estimated from the zero crossing rate, which is
     * accurate enough for speech and single instrument recordings.
     */
    function analyze(sample: Buffer, sampleRate: number): Frame[] {
        const frameSamples = Math.max(8, Math.idiv(sampleRate * FRAME_MS, 1000));
        const frameMs = Math.max(1, Math.idiv(frameSamples * 1000, sampleRate));
        const maxHz = Math.min(MAX_HZ, Math.idiv(sampleRate, 2));
        const frames: Frame[] = [];

        for (let start = 0; start < sample.length; start += frameSamples) {
            const end = Math.min(start + frameSamples, sample.length);
            let low = 255;
            let high = 0;
            for (let i = start; i < end; i++) {
                const v = sample.getUint8(i);
                if (v < low) low = v;
                if (v > high) high = v;
            }
            const middle = (low + high) >> 1;
            const peak = (high - low) >> 1;

            let hz = 0;
            if (peak >= SILENCE_LEVEL) {
                // hysteresis keeps noise around the centre line from being
                // counted as pitch
                const guard = Math.max(1, peak >> 2);
                let crossings = 0;
                let above = false;
                let known = false;
                for (let i = start; i < end; i++) {
                    const v = sample.getUint8(i) - middle;
                    if (v > guard) {
                        if (known && !above) crossings++;
                        above = true;
                        known = true;
                    } else if (v < -guard) {
                        if (known && above) crossings++;
                        above = false;
                        known = true;
                    }
                }
                hz = Math.idiv(crossings * sampleRate, 2 * (end - start));
                hz = Math.clamp(MIN_HZ, maxHz, hz);
            }

            const previous = frames.length ? frames[frames.length - 1] : null;
            // hold the previous pitch through silence so that the frequency
            // ramps do not sweep down to 20Hz between words
            if (hz == 0) hz = previous ? previous.hz : MIN_HZ;
            const volume = peak >= SILENCE_LEVEL ? Math.min(MAX_VOLUME, peak * 8) : 0;
            frames.push(new Frame(frameMs, hz, volume));
        }

        // ramp each frame towards the next one to avoid clicks at frame edges
        for (let i = 0; i < frames.length - 1; i++) {
            frames[i].endHz = frames[i + 1].hz;
            frames[i].endVolume = frames[i + 1].volume;
        }
        if (frames.length) frames[frames.length - 1].endVolume = 0;

        return frames;
    }

    function playFrames(frames: Frame[], volume: number): void {
        const scale = Math.idiv(Math.clamp(0, 255, volume | 0) * music.volume(), 255);
        const startTime = control.millis();
        let timePos = 0;
        let index = 0;

        while (index < frames.length) {
            const count = Math.min(CHUNK_FRAMES, frames.length - index);
            // the trailing zero byte terminates the instruction stream
            const buf = control.createBuffer(count * INSTRUCTION_SIZE + 1);
            let chunkMs = 0;
            for (let i = 0; i < count; i++) {
                const frame = frames[index + i];
                writeInstruction(buf, i * INSTRUCTION_SIZE, frame, scale);
                chunkMs += frame.ms;
            }

            music.playInstructions(timePos - (control.millis() - startTime), buf);
            timePos += chunkMs;
            index += count;

            const queued = timePos - (control.millis() - startTime);
            if (queued > MAX_QUEUE_MS) pause(queued - MAX_QUEUE_MS);
        }

        const remaining = timePos - (control.millis() - startTime);
        if (remaining > 0) pause(remaining);
    }

    function writeInstruction(buf: Buffer, offset: number, frame: Frame, scale: number): void {
        buf.setUint8(offset, waveform);
        buf.setUint8(offset + 1, 0);
        buf.setNumber(NumberFormat.UInt16LE, offset + 2, frame.hz);
        buf.setNumber(NumberFormat.UInt16LE, offset + 4, frame.ms);
        buf.setNumber(NumberFormat.UInt16LE, offset + 6, Math.idiv(frame.volume * scale, 255));
        buf.setNumber(NumberFormat.UInt16LE, offset + 8, Math.idiv(frame.endVolume * scale, 255));
        buf.setNumber(NumberFormat.UInt16LE, offset + 10, frame.endHz);
    }
}
