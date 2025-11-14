//% color=#0fbc11 icon="\uf028" block="PCM Audio Player"
namespace pcmaudio {

    /**
     * Play a short PCM audio sample (8-bit unsigned, 8kHz, mono).
     * The sample must be an array of numbers between 0-255, representing
     * 8-bit unsigned PCM data at 8kHz sample rate.
     */
    //% block="play PCM sample $sample"
    //% sample.shadow="lists_create_with"
    //% sample.defl="[128,128,255,128,0,128,128,128]"
    export function playSample(sample: number[]): void {
        // Clamp all values between 0 and 255
        const clamped = sample.map(v => Math.max(0, Math.min(255, v|0)));
        // Convert 8-bit array to Arcade sound buffer
        music.playSoundBuffer(music.createSoundBuffer(clamped, 8000));
    }
}
