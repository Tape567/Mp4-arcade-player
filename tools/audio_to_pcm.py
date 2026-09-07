#!/usr/bin/env python3
"""Convert any audio or video file into PCM data for the pcm-audio-player extension.

Requires ffmpeg on the PATH. ffmpeg decodes the input (mp4, mp3, wav, ogg, ...)
into 8-bit unsigned mono PCM, which this script prints as TypeScript you can
paste into a MakeCode Arcade project.

    python3 tools/audio_to_pcm.py clip.mp4 --seconds 2
    python3 tools/audio_to_pcm.py clip.wav --rate 11025 --format array
"""

import argparse
import shutil
import subprocess
import sys

DEFAULT_RATE = 8000


def decode(path: str, rate: int, start: float, seconds: float) -> bytes:
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg is required: https://ffmpeg.org/download.html")
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start)]
    if seconds > 0:
        cmd += ["-t", str(seconds)]
    cmd += ["-i", path, "-f", "u8", "-acodec", "pcm_u8", "-ac", "1", "-ar", str(rate), "-"]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        sys.exit(result.stderr.decode(errors="replace").strip() or "ffmpeg failed")
    return result.stdout


def normalize(pcm: bytes) -> bytes:
    """Scale the clip so that its loudest sample reaches full deflection."""
    peak = max((abs(v - 128) for v in pcm), default=0)
    if peak == 0 or peak >= 127:
        return pcm
    gain = 127 / peak
    return bytes(min(255, max(0, round(128 + (v - 128) * gain))) for v in pcm)


def as_hex(pcm: bytes, name: str, rate: int, width: int) -> str:
    body = pcm.hex()
    lines = [body[i:i + width] for i in range(0, len(body), width)] or [""]
    joined = "\n    ".join(lines)
    return (
        f"const {name}: Buffer = hex`\n    {joined}\n`\n\n"
        f"pcmaudio.playBuffer({name}, {rate})\n"
    )


def as_array(pcm: bytes, name: str, rate: int, per_line: int) -> str:
    values = [str(v) for v in pcm]
    lines = [
        "    " + ", ".join(values[i:i + per_line])
        for i in range(0, len(values), per_line)
    ]
    joined = ",\n".join(lines)
    return (
        f"const {name}: number[] = [\n{joined}\n]\n\n"
        f"pcmaudio.playSample({name}, {rate})\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", help="audio or video file to convert")
    parser.add_argument("-o", "--output", help="write the snippet to a file instead of stdout")
    parser.add_argument("-r", "--rate", type=int, default=DEFAULT_RATE, help="sample rate in Hz (default: 8000)")
    parser.add_argument("-s", "--start", type=float, default=0, help="start offset in seconds")
    parser.add_argument("-t", "--seconds", type=float, default=3, help="length in seconds, 0 for the whole file")
    parser.add_argument("-n", "--name", default="clip", help="name of the generated constant")
    parser.add_argument("-f", "--format", choices=["hex", "array"], default="hex", help="output format")
    parser.add_argument("--no-normalize", action="store_true", help="keep the original amplitude")
    args = parser.parse_args()

    pcm = decode(args.input, args.rate, args.start, args.seconds)
    if not pcm:
        sys.exit("no audio was decoded from the input")
    if not args.no_normalize:
        pcm = normalize(pcm)

    if args.format == "hex":
        snippet = as_hex(pcm, args.name, args.rate, 96)
    else:
        snippet = as_array(pcm, args.name, args.rate, 24)

    if args.output:
        with open(args.output, "w") as f:
            f.write(snippet)
    else:
        sys.stdout.write(snippet)

    seconds = len(pcm) / args.rate
    print(f"# {len(pcm)} samples, {seconds:.2f}s at {args.rate}Hz", file=sys.stderr)
    if len(pcm) > 60000:
        print("# warning: clips this long may not fit on hardware, try --seconds", file=sys.stderr)


if __name__ == "__main__":
    main()
