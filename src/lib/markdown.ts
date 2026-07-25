/**
 * Minimal Markdown -> HTML renderer for published skill.md documents.
 *
 * Public pages render model-generated text, so the safety property matters more
 * than feature coverage: the input is HTML-escaped FIRST, and every tag in the
 * output is one this file emits. No user or model content can ever become
 * markup, which is why this exists instead of a general Markdown library plus a
 * sanitizer (the escape-first order is the whole guarantee).
 *
 * Covers what skill.md actually uses: headings, lists, bold/italic, inline code,
 * fenced code, blockquotes, horizontal rules, paragraphs.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline formatting, applied to already-escaped text. */
function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.9em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

/** Stable anchor id for a heading, used for the on-page table of contents. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-0 mb-4 text-3xl font-bold tracking-tight text-gray-900",
  2: "mt-10 mb-3 border-b border-gray-200 pb-2 text-2xl font-bold tracking-tight text-gray-900",
  3: "mt-8 mb-2 text-xl font-semibold text-gray-900",
  4: "mt-6 mb-2 text-base font-semibold text-gray-800",
  5: "mt-4 mb-1 text-sm font-semibold text-gray-800",
  6: "mt-4 mb-1 text-sm font-semibold text-gray-700",
};

export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const headings: Heading[] = [];

  let listType: "ul" | "ol" | null = null;
  let inFence = false;
  let fenceBuffer: string[] = [];
  let paragraph: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p class="my-3 leading-relaxed text-gray-700">${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const openList = (type: "ul" | "ol") => {
    if (listType !== type) {
      closeList();
      out.push(
        type === "ul"
          ? '<ul class="my-3 list-disc space-y-1 pl-6 text-gray-700">'
          : '<ol class="my-3 list-decimal space-y-1 pl-6 text-gray-700">'
      );
      listType = type;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (/^\s*```/.test(line)) {
      if (inFence) {
        out.push(
          `<pre class="my-4 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100"><code>${fenceBuffer
            .map(escapeHtml)
            .join("\n")}</code></pre>`
        );
        fenceBuffer = [];
        inFence = false;
      } else {
        flushParagraph();
        closeList();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceBuffer.push(raw);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = headingId(text);
      headings.push({ level, text, id });
      out.push(
        `<h${level} id="${escapeHtml(id)}" class="${HEADING_CLASSES[level]}">${inline(
          escapeHtml(text)
        )}</h${level}>`
      );
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      flushParagraph();
      closeList();
      out.push('<hr class="my-8 border-gray-200" />');
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      openList("ul");
      out.push(`<li>${inline(escapeHtml(bullet[1]))}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      openList("ol");
      out.push(`<li>${inline(escapeHtml(numbered[1]))}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(
        `<blockquote class="my-4 border-l-4 border-blue-200 bg-blue-50/50 px-4 py-2 text-gray-700">${inline(
          escapeHtml(quote[1])
        )}</blockquote>`
      );
      continue;
    }

    paragraph.push(escapeHtml(line.trim()));
  }

  if (inFence && fenceBuffer.length) {
    out.push(
      `<pre class="my-4 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100"><code>${fenceBuffer
        .map(escapeHtml)
        .join("\n")}</code></pre>`
    );
  }
  flushParagraph();
  closeList();

  return { html: out.join("\n"), headings };
}

/** First meaningful paragraph, for meta descriptions and card summaries. */
export function firstParagraph(md: string, maxChars = 300): string {
  for (const block of md.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || text.startsWith("#") || text.startsWith("```") || /^[-*+>]/.test(text)) continue;
    const flat = text.replace(/\s+/g, " ").replace(/[*`_]/g, "");
    return flat.length > maxChars ? `${flat.slice(0, maxChars - 1)}…` : flat;
  }
  return "";
}
