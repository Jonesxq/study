export function MarkdownView({ html }: { html: string }) {
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:tracking-normal prose-p:leading-8 prose-li:leading-8"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
