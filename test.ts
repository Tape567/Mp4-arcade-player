// Tests go here; this will not be compiled when this package is used as an
// extension.

// A short 440Hz burst built at runtime, as an array of 8-bit unsigned samples.
const beep: number[] = [];
for (let i = 0; i < 2000; i++) {
    beep.push(Math.round(128 + 100 * Math.sin(2 * Math.PI * 440 * i / 8000)));
}

game.onUpdateInterval(2000, function () {
    pcmaudio.playSample(beep, 8000);
});

// Samples produced by tools/audio_to_pcm.py can be stored as a hex buffer,
// which uses far less memory than a number array.
const clip = hex`80a0c8a08060388060`;

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    pcmaudio.setWaveform(pcmaudio.Waveform.Square);
    pcmaudio.playBuffer(clip, 8000, 255, pcmaudio.PlaybackMode.InBackground);
});
