import { describe, expect, test } from "bun:test";
import {
  countUnderPrefixes,
  isMirrorFolderComplete,
  mirrorContentType,
  planMirrorSync,
} from "./mirror";

const object = (key: string, size = 10, ago = 0) => ({
  key,
  size,
  lastModified: new Date(1000 - ago),
});

describe("planMirrorSync", () => {
  test("copies only what the mirror lacks and reports the remainder", () => {
    const source = [object("a.mp4"), object("hls/x/init.mp4"), object("b.pdf")];
    const mirror = [object("hls/x/init.mp4")];

    const plan = planMirrorSync(source, mirror, {
      maxFiles: 10,
      maxBytes: 1000,
    });
    expect(plan.copy.map((file) => file.key)).toEqual(["a.mp4", "b.pdf"]);
    expect(plan.remainingFiles).toBe(2);
    expect(plan.remainingBytes).toBe(20);
  });

  test("re-copies a file whose size differs", () => {
    const source = [object("a.mp4", 100)];
    const mirror = [object("a.mp4", 99)];

    const plan = planMirrorSync(source, mirror, {
      maxFiles: 10,
      maxBytes: 1000,
    });
    expect(plan.copy).toHaveLength(1);
  });

  test("batches are capped by file count and byte volume", () => {
    const source = Array.from({ length: 6 }, (_, i) => object(`f${i}`, 10));

    const byFiles = planMirrorSync(source, [], { maxFiles: 2, maxBytes: 1000 });
    expect(byFiles.copy).toHaveLength(2);
    expect(byFiles.remainingFiles).toBe(6);

    const byBytes = planMirrorSync(source, [], { maxFiles: 10, maxBytes: 25 });
    expect(byBytes.copy).toHaveLength(2);
    expect(byBytes.remainingBytes).toBe(60);
  });

  test("defers oversized files without blocking smaller files or losing them", () => {
    const source = [object("huge.mp4", 4000, 900), object("small.pdf", 10)];
    const plan = planMirrorSync(source, [], { maxFiles: 10, maxBytes: 10 });
    expect(plan.copy).toEqual([{ key: "small.pdf", size: 10 }]);
    expect(plan.remainingFiles).toBe(2);
    expect(plan.remainingBytes).toBe(4010);
    const later = planMirrorSync(source, [object("small.pdf", 10)], {
      maxFiles: 10,
      maxBytes: 4000,
    });
    expect(later.copy).toEqual([{ key: "huge.mp4", size: 4000 }]);
  });

  test("oldest files go first so the mirror catches up on backlog", () => {
    const source = [
      object("new.mp4", 10, 0),
      object("old.mp4", 10, 900),
      object("mid.mp4", 10, 500),
    ];
    const plan = planMirrorSync(source, [], { maxFiles: 2, maxBytes: 1000 });
    expect(plan.copy.map((file) => file.key)).toEqual(["old.mp4", "mid.mp4"]);
  });

  test("nothing to do when the mirror is caught up", () => {
    const source = [object("a.mp4", 7)];
    const plan = planMirrorSync(source, [object("a.mp4", 7)], {
      maxFiles: 10,
      maxBytes: 1000,
    });
    expect(plan.copy).toEqual([]);
    expect(plan.remainingFiles).toBe(0);
    expect(plan.remainingBytes).toBe(0);
  });
});

describe("mirror folder completeness", () => {
  test("complete when the mirror has every file of the folder", () => {
    const folders = ["workshops/a/hls/x/uuid"];
    const source = countUnderPrefixes(
      [
        { key: "workshops/a/hls/x/uuid/index.m3u8" },
        { key: "workshops/a/hls/x/uuid/v0/init.mp4" },
        { key: "workshops/a/hls/x/uuid/v0/seg-00001.m4s" },
      ],
      folders,
    );
    const mirror = countUnderPrefixes(
      [
        { key: "workshops/a/hls/x/uuid/v0/init.mp4" },
        { key: "workshops/a/hls/x/uuid/v0/seg-00001.m4s" },
        { key: "workshops/a/hls/x/uuid/index.m3u8" },
        { key: "workshops/a/hls/x/uuid/leftover.m4s" },
      ],
      folders,
    );
    expect(isMirrorFolderComplete(source, mirror, folders[0] as string)).toBe(
      true,
    );
  });

  test("incomplete while segments are still being copied", () => {
    const folders = ["workshops/a/hls/x/uuid"];
    const source = countUnderPrefixes(
      [
        { key: "workshops/a/hls/x/uuid/index.m3u8" },
        { key: "workshops/a/hls/x/uuid/v0/seg-00001.m4s" },
      ],
      folders,
    );
    const mirror = countUnderPrefixes(
      [{ key: "workshops/a/hls/x/uuid/index.m3u8" }],
      folders,
    );
    expect(isMirrorFolderComplete(source, mirror, folders[0] as string)).toBe(
      false,
    );
  });

  test("an empty source folder is not complete", () => {
    const folders = ["workshops/a/hls/x/uuid"];
    expect(
      isMirrorFolderComplete(
        countUnderPrefixes([], folders),
        countUnderPrefixes([], folders),
        folders[0] as string,
      ),
    ).toBe(false);
  });

  test("neighbour folders do not count towards each other", () => {
    const folders = ["workshops/a/hls/x/one", "workshops/a/hls/x/two"];
    const source = countUnderPrefixes(
      [
        { key: "workshops/a/hls/x/one/index.m3u8" },
        { key: "workshops/a/hls/x/two/index.m3u8" },
      ],
      folders,
    );
    const mirror = countUnderPrefixes(
      [{ key: "workshops/a/hls/x/one/index.m3u8" }],
      folders,
    );
    expect(
      isMirrorFolderComplete(source, mirror, "workshops/a/hls/x/one"),
    ).toBe(true);
    expect(
      isMirrorFolderComplete(source, mirror, "workshops/a/hls/x/two"),
    ).toBe(false);
  });
});

describe("mirrorContentType", () => {
  test("HLS files keep the types the player expects", () => {
    expect(mirrorContentType("w/hls/x/u/master.m3u8")).toBe(
      "application/vnd.apple.mpegurl",
    );
    expect(mirrorContentType("w/hls/x/u/v1/index.m3u8")).toBe(
      "application/vnd.apple.mpegurl",
    );
    expect(mirrorContentType("w/hls/x/u/v0/init.mp4")).toBe("video/mp4");
    expect(mirrorContentType("w/hls/x/u/v0/seg-00001.m4s")).toBe(
      "video/iso.segment",
    );
  });

  test("lesson sources and materials keep their types", () => {
    expect(mirrorContentType("w/lesson-abc.mp4")).toBe("video/mp4");
    expect(mirrorContentType("w/lesson-abc.mov")).toBe("video/quicktime");
    expect(mirrorContentType("w/materials/brief-def.pdf")).toBe(
      "application/pdf",
    );
    expect(mirrorContentType("w/materials/brief-def.PDF")).toBe(
      "application/pdf",
    );
    expect(mirrorContentType("w/scheme-1.png")).toBe("image/png");
    expect(mirrorContentType("w/unknown.bin")).toBe("application/octet-stream");
  });
});
