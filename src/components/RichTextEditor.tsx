"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EditorContent, mergeAttributes, Node, useEditor, type Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Image } from "@tiptap/extension-image";
import { MediaGallery } from "@/components/MediaPicker";

/*
 * Editor visuale per la descrizione completa dei pacchetti. Produce HTML che il server ripulisce
 * (src/lib/rich-text.ts): se si aggiunge un tag o un attributo qui va permesso anche lì.
 * Lo stesso CSS (.rich in globals.css) impagina l'editor e la pagina del corso.
 */

const AlignedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") ?? "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },
});

// Due colonne affiancate (una sola su schermi stretti)
const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: "div[data-column]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-column": "" }), 0],
});

const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2}",
  defining: true,
  parseHTML: () => [{ tag: "div[data-columns]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-columns": "" }), 0],
});

const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: { openOnClick: false, autolink: true, protocols: ["mailto"] },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  AlignedImage,
  Column,
  Columns,
];

/** Toglie le colonne che contengono il cursore, mettendo il loro contenuto uno sotto l'altro. */
function unwrapColumns(editor: Editor) {
  editor
    .chain()
    .focus()
    .command(({ state, tr }) => {
      const $from = state.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name !== "columns") continue;
        const blocks: PMNode[] = [];
        node.forEach((col) => col.forEach((b) => blocks.push(b)));
        tr.replaceWith($from.before(d), $from.after(d), blocks);
        return true;
      }
      return false;
    })
    .run();
}

const ICONS: Record<string, string> = {
  left: "M3 6h18M3 10h12M3 14h18M3 18h12",
  center: "M3 6h18M6 10h12M3 14h18M6 18h12",
  right: "M3 6h18M9 10h12M3 14h18M9 18h12",
  justify: "M3 6h18M3 10h18M3 14h18M3 18h18",
  bullet: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  ordered: "M10 6h11M10 12h11M10 18h11M4 4v4M3 18h3l-3-3.5a1.5 1.5 0 1 1 3 0",
  quote: "M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6",
  hr: "M3 12h18",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  columns: "M4 5h7v14H4zM13 5h7v14h-7z",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
};

const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
);

function Btn({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // mousedown: il clic non deve togliere il fuoco (e la selezione) all'editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm transition disabled:opacity-40 ${active ? "bg-brand-100 text-brand-800" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-slate-200" />;

export function RichTextEditor({ name, initial, label }: { name: string; initial: string; label: string }) {
  const t = useTranslations("admin.packages.editor");
  const [html, setHtml] = useState(initial);
  const [gallery, setGallery] = useState(false);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "rich rich-editor min-h-48 px-4 py-3 focus:outline-none", "aria-label": label } },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });


  const c = () => editor!.chain().focus();
  const imageSelected = editor?.isActive("image") ?? false;
  const inColumns = editor?.isActive("columns") ?? false;

  function setLink() {
    const prev = (editor?.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt(t("linkPrompt"), prev || "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function setAlt() {
    const url = window.prompt(t("altPrompt"), (editor?.getAttributes("image").alt as string | undefined) ?? "");
    if (url !== null) c().updateAttributes("image", { alt: url.trim() }).run();
  }

  return (
    <div>
      <input type="hidden" name={name} value={html} />
      <div className="overflow-hidden rounded-[var(--input-radius)] border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
          <Btn title={t("paragraph")} active={editor?.isActive("paragraph")} onClick={() => c().setParagraph().run()}>¶</Btn>
          <Btn title={t("h2")} active={editor?.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
            <span className="font-semibold">H2</span>
          </Btn>
          <Btn title={t("h3")} active={editor?.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
            <span className="text-xs font-semibold">H3</span>
          </Btn>
          <Sep />
          <Btn title={t("bold")} active={editor?.isActive("bold")} onClick={() => c().toggleBold().run()}>
            <strong>B</strong>
          </Btn>
          <Btn title={t("italic")} active={editor?.isActive("italic")} onClick={() => c().toggleItalic().run()}>
            <em className="font-serif">I</em>
          </Btn>
          <Btn title={t("underline")} active={editor?.isActive("underline")} onClick={() => c().toggleUnderline().run()}>
            <span className="underline">U</span>
          </Btn>
          <Btn title={t("strike")} active={editor?.isActive("strike")} onClick={() => c().toggleStrike().run()}>
            <span className="line-through">S</span>
          </Btn>
          <Btn title={t("link")} active={editor?.isActive("link")} onClick={setLink}>
            <Icon name="link" />
          </Btn>
          <Sep />
          {(["left", "center", "right", "justify"] as const).map((a) => (
            <Btn key={a} title={t(`align.${a}`)} active={editor?.isActive({ textAlign: a })} onClick={() => c().setTextAlign(a).run()}>
              <Icon name={a} />
            </Btn>
          ))}
          <Sep />
          <Btn title={t("bulletList")} active={editor?.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
            <Icon name="bullet" />
          </Btn>
          <Btn title={t("orderedList")} active={editor?.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
            <Icon name="ordered" />
          </Btn>
          <Btn title={t("quote")} active={editor?.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}>
            <Icon name="quote" />
          </Btn>
          <Btn title={t("hr")} onClick={() => c().setHorizontalRule().run()}>
            <Icon name="hr" />
          </Btn>
          <Sep />
          <Btn title={t("image")} active={gallery} onClick={() => setGallery((g) => !g)}>
            <Icon name="image" />
          </Btn>
          {inColumns ? (
            <Btn title={t("removeColumns")} active onClick={() => editor && unwrapColumns(editor)}>
              <Icon name="columns" />
            </Btn>
          ) : (
            <Btn
              title={t("columns")}
              onClick={() =>
                c()
                  .insertContent({
                    type: "columns",
                    content: [
                      { type: "column", content: [{ type: "paragraph" }] },
                      { type: "column", content: [{ type: "paragraph" }] },
                    ],
                  })
                  .command(({ tr }) => {
                    // il cursore va nella colonna di sinistra (dopo l'inserimento sarebbe in quella di destra)
                    const $from = tr.selection.$from;
                    for (let d = $from.depth; d > 0; d--) {
                      if ($from.node(d).type.name !== "columns") continue;
                      tr.setSelection(TextSelection.create(tr.doc, $from.before(d) + 3));
                      return true;
                    }
                    return true;
                  })
                  .run()
              }
            >
              <Icon name="columns" />
            </Btn>
          )}
          <Sep />
          <Btn title={t("undo")} disabled={!editor?.can().undo()} onClick={() => c().undo().run()}>
            <Icon name="undo" />
          </Btn>
          <Btn title={t("redo")} disabled={!editor?.can().redo()} onClick={() => c().redo().run()}>
            <Icon name="redo" />
          </Btn>
        </div>

        {imageSelected && (
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-brand-50 px-2 py-1 text-xs">
            <span className="mr-1 text-slate-600">{t("imagePosition")}</span>
            {(["left", "center", "right", "wide"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => c().updateAttributes("image", { align: a }).run()}
                className={`rounded px-2 py-1 ${editor?.getAttributes("image").align === a ? "bg-brand-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
              >
                {t(`imageAlign.${a}`)}
              </button>
            ))}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setAlt} className="ml-2 rounded bg-white px-2 py-1 text-slate-700 hover:bg-slate-100">
              {t("altText")}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => c().deleteSelection().run()}
              className="rounded bg-white px-2 py-1 text-red-600 hover:bg-red-50"
            >
              {t("removeImage")}
            </button>
          </div>
        )}

        {gallery && (
          <div className="border-b border-slate-200 px-3 pb-3">
            <MediaGallery
              kind="content"
              onPick={(url) => {
                c().setImage({ src: url, alt: "" }).run();
                setGallery(false);
              }}
            />
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{t("hint")}</p>
    </div>
  );
}
