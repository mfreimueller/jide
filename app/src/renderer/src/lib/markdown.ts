import DOMPurify from "dompurify";
import { marked } from "marked";

/** Markdown -> sanitized HTML. Never returns raw, unsanitized HTML. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
