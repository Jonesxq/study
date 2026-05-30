export function summarizeMarkdown(markdown: string, maxLength = 80) {
  const plain = stripMarkdownImagesAndLinks(markdown)
    .replace(/(^|\n)[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/^[ \t]*(?:[-+*]|\d+[.)])\s+/gm, '')
    .replace(/^[ \t]*>\s?/gm, '')
    .replace(/[*_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${Array.from(plain).slice(0, maxLength).join('')}...`;
}

function stripMarkdownImagesAndLinks(markdown: string) {
  let result = '';
  let index = 0;

  while (index < markdown.length) {
    const isImage = markdown.startsWith('![', index);
    const isLink = markdown[index] === '[';

    if (isImage || isLink) {
      const labelStart = index + (isImage ? 2 : 1);
      const labelEnd = markdown.indexOf(']', labelStart);

      if (labelEnd !== -1 && markdown[labelEnd + 1] === '(') {
        const urlEnd = findClosingParen(markdown, labelEnd + 1);

        if (urlEnd !== -1) {
          result += isImage ? ' ' : markdown.slice(labelStart, labelEnd);
          index = urlEnd + 1;
          continue;
        }
      }
    }

    result += markdown[index];
    index += 1;
  }

  return result;
}

function findClosingParen(value: string, openIndex: number) {
  let depth = 0;

  for (let index = openIndex; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}
