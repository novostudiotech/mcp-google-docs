import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true });

export function markdownToHtml(markdown: string): string {
  const cleaned = markdown
    .replace(/<p style="page-break-before: always">&nbsp;<\/p>/g, '%%%PAGE_BREAK%%%')
    .replace(/^---+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  const body = md.render(cleaned);
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: 'Inter', 'Arial', sans-serif; font-size: 11pt; color: #222; line-height: 1.3; }
  h1 { font-size: 18pt; margin: 18px 0 2px 0; }
  h2 { font-size: 15pt; margin: 16px 0 2px 0; }
  h3 { font-size: 13pt; margin: 12px 0 2px 0; }
  h4 { font-size: 11pt; margin: 8px 0 2px 0; }
  p, ul, ol { margin: 2px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 3px 8px; }
  th { background: #f2f2f2; font-weight: bold; }
  blockquote { border-left: 3px solid #ccc; padding-left: 12px; color: #555; }
</style></head>
<body>${body}</body></html>`;
}
