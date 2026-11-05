"""One-shot CPU Kokoro generation. Invoked only by the authenticated AAC+ teacher API.
Model runs in a child process so its ONNX memory is released after each clip.
"""
import argparse
import sys
import wave
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True)
    p.add_argument("--voices", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--voice", choices=["af_heart", "am_michael"], required=True)
    p.add_argument("--text", required=True)
    a = p.parse_args()
    from kokoro_onnx import Kokoro
    import soundfile as sf
    if not Path(a.model).is_file() or not Path(a.voices).is_file():
        raise RuntimeError("Kokoro model files are unavailable")
    engine = Kokoro(a.model, a.voices)
    samples, sample_rate = engine.create(
        a.text, voice=a.voice, speed=1.0, lang="en-us"
    )
    try:
        engine.voices.close()
    except Exception:
        pass
    if len(samples) / sample_rate > 30:
        raise RuntimeError("Generated clip exceeds the 30-second AAC+ limit")
    sf.write(a.output, samples, sample_rate, format="WAV", subtype="PCM_16")
    with wave.open(a.output, "rb") as wav:
        if wav.getnframes() <= 0:
            raise RuntimeError("Kokoro returned no audio")
    print("Kokoro WAV ready", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Kokoro generation failed: {exc}", file=sys.stderr)
        sys.exit(1)
