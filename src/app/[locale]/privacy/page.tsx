import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { getLocale } from "next-intl/server";
import { getSettings, PRIVACY_VERSION } from "@/lib/settings";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default async function PrivacyPage() {
  const locale = await getLocale();
  const [md, settings] = await Promise.all([
    readFile(path.join(process.cwd(), "content", `privacy.${locale === "en" ? "en" : "it"}.md`), "utf8"),
    getSettings(),
  ]);
  const filled = md
    .replaceAll("{{version}}", PRIVACY_VERSION)
    .replaceAll("{{ownerName}}", escapeHtml(settings.ownerName || "—"))
    .replaceAll("{{ownerContact}}", escapeHtml(settings.ownerContact || "—"));
  const html = await marked.parse(filled);

  return (
    <article
      className="card prose-sm mx-auto max-w-3xl space-y-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_blockquote]:rounded [&_blockquote]:bg-amber-50 [&_blockquote]:p-3 [&_blockquote]:text-sm [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
