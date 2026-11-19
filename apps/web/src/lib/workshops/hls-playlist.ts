import { HLS_FILE_PATTERN } from "@stariva/storage";

const MAP_URI = /(#EXT-X-MAP:.*URI=")([^"]+)(")/;

/**
 * Подменяет в плейлисте качества адреса init.mp4 и кусков на прямые
 * подписанные ссылки в бакет. Нужно приложению: его запрос идёт с чужого
 * origin, и после перенаправления сайт → бакет браузер шлёт `Origin: null`,
 * который бакет не пропускает. С прямой ссылкой запрос уходит в бакет сразу
 * с origin приложения.
 *
 * `dir` — папка плейлиста относительно пропуска: "" или "v1/".
 */
export async function signPlaylistSegments(
  playlist: string,
  dir: string,
  sign: (file: string) => Promise<string>,
): Promise<string> {
  const resolve = async (uri: string) => {
    const file = `${dir}${uri}`;
    return HLS_FILE_PATTERN.test(file) && !file.endsWith(".m3u8")
      ? sign(file)
      : uri;
  };
  const lines = await Promise.all(
    playlist.split("\n").map(async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        const map = MAP_URI.exec(line);
        if (!map) return line;
        return line.replace(MAP_URI, `$1${await resolve(map[2] ?? "")}$3`);
      }
      return resolve(trimmed);
    }),
  );
  return lines.join("\n");
}
