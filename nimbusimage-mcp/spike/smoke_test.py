"""Drive the running spike server over streamable HTTP and report sizes.

    .venv/bin/python spike/smoke_test.py [http://127.0.0.1:8000/mcp]

Exercises every tool on a small dataset, the 465K-annotation dataset, and
the error paths (bad id, out-of-range z). Writes composite PNGs to
spike/out/ so they can be looked at.
"""

import asyncio
import base64
import json
import sys
import time
from pathlib import Path

from mcp import Client

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/mcp"
OUT = Path(__file__).parent / "out"


async def call(client, name, args):
    start = time.perf_counter()
    result = await client.call_tool(name, args)
    elapsed = time.perf_counter() - start
    size = 0
    summary = ""
    for block in result.content:
        if block.type == "text":
            size += len(block.text)
            summary = block.text[:240]
        elif block.type == "image":
            data = base64.b64decode(block.data)
            size += len(block.data)
            OUT.mkdir(exist_ok=True)
            crop = "_crop" if "crop" in args else ""
            path = OUT / f"{args['dataset_id']}_z{args.get('z', 0)}{crop}.jpg"
            path.write_bytes(data)
            summary = f"<image {block.mime_type} {len(data)} bytes -> {path}>"
    flag = "ERROR " if result.is_error else ""
    print(f"{flag}{name}({json.dumps(args)}) {elapsed:.2f}s "
          f"{size} B (~{size // 4} tok)\n    {summary}")
    return result


async def main():
    async with Client(URL) as client:
        tools = await client.list_tools()
        print("tools:", [t.name for t in tools.tools])

        await call(client, "ni_datasets_list", {"limit": 5})
        await call(client, "ni_datasets_list", {"name_contains": "kidney"})
        await call(client, "ni_datasets_list", {"limit": 200})

        for ds in [
            "6a76214b90dec97a5ccd18a3",  # ~8.6K annotations
            "6ab95706635c1c4a679411b4",  # 465K annotations
        ]:
            await call(client, "ni_dataset_info", {"dataset_id": ds})
            await call(client, "ni_annotations_count", {"dataset_id": ds})
            await call(client, "ni_annotations_count",
                       {"dataset_id": ds, "shape": "polygon"})
            await call(client, "ni_annotations_summary", {"dataset_id": ds})
            await call(client, "ni_image_get_composite", {"dataset_id": ds})

        # Tag filter with a space; the summary's tag list must agree.
        await call(client, "ni_annotations_count", {
            "dataset_id": "6a76214b90dec97a5ccd18a3", "tags": ["488 blob"],
        })
        # Xenium ovary: pixel size lives only in the configuration's scales,
        # and the user's view carries a contrast override.
        await call(client, "ni_dataset_info",
                   {"dataset_id": "6ab80e9d423f14002252944d"})
        await call(client, "ni_image_get_composite",
                   {"dataset_id": "6ab80e9d423f14002252944d"})
        # Zoom into the left tissue patch (the first eval could not).
        await call(client, "ni_image_get_composite", {
            "dataset_id": "6ab80e9d423f14002252944d",
            "crop": [1200, 1430, 1760, 2090],
        })

        # Error paths: must come back as tool errors, not stack traces.
        await call(client, "ni_dataset_info",
                   {"dataset_id": "000000000000000000000000"})
        await call(client, "ni_dataset_info", {"dataset_id": "not-an-id"})
        await call(client, "ni_image_get_composite",
                   {"dataset_id": "6a76214b90dec97a5ccd18a3", "z": 999})


asyncio.run(main())
