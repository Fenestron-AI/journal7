"""Download/bake pix2text models into the image at build time.

Best effort with retries: if HuggingFace is unreachable during `docker build`,
models are downloaded lazily on first startup instead (pipeline tolerates it).
Kept as a standalone script because heredocs and multi-line RUN strings do not
work with the legacy Docker builder.
"""

import sys


def main() -> int:
    from pix2text import Pix2Text
    for attempt in range(3):
        try:
            Pix2Text(device="cpu", enable_formula=True, enable_table=False, languages="en")
            print("p2t models baked OK")
            return 0
        except Exception as e:  # noqa: BLE001 - build step must not fail the image
            print("bake attempt %d failed: %s" % (attempt + 1, e), file=sys.stderr)
    print("WARNING: p2t model bake failed - will download at runtime", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
