import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const root = process.cwd();
  const parts = await Promise.all([
    readFile(path.join(root, "photo-parts/part00.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part01.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part02.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part03.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part04.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part05.txt"), "utf8"),
    readFile(path.join(root, "photo-parts/part06.txt"), "utf8"),
  ]);

  const image = Buffer.from(parts.join(""), "base64");

  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
