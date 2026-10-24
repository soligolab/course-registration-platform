import "server-only";
import { prisma } from "@/lib/db";
import { parseTheme, type Theme } from "@/lib/theme";

const KEY = "theme";

export async function getTheme(): Promise<Theme> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return parseTheme({});
  try {
    return parseTheme(JSON.parse(row.value));
  } catch {
    return parseTheme({});
  }
}

export async function saveTheme(theme: Theme) {
  const value = JSON.stringify(theme);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Immagini (/media/…) usate dal tema o dai pacchetti: non si possono eliminare. */
export async function mediaInUse(url: string): Promise<boolean> {
  const theme = await getTheme();
  if (Object.values(theme).includes(url)) return true;
  return (await prisma.package.count({ where: { imageUrl: url } })) > 0;
}
