/**
 * Markdown to HTML Converter with Rich-Text Inline Styles
 * Designed for perfect copy-paste into desktop applications (Word, Google Docs, Outlook)
 */

export function convertMarkdownToStyledHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. Normalize line endings and cleanup Plotly blocks
  let text = markdown.replace(/\r\n/g, '\n');

  // Replace plotly codeblocks with a beautifully styled inline visual banner
  text = text.replace(/```plotly[\s\S]*?```/g, () => {
    return `\n\n> 📊 **[Graphique Interactif Plotly]** Séquence de graphique dynamique générée par Mira. *(Disponible pour l'interaction visuelle directement dans l'interface de l’application)*\n\n`;
  });

  // Split into block paragraphs by double-newlines
  const blocks = text.split(/\n{2,}/);
  const htmlBlocks: string[] = [];

  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listBuffer: string[] = [];

  const flushList = () => {
    if (inList && listType && listBuffer.length > 0) {
      const tag = listType;
      const listStyle = tag === 'ul' 
        ? 'margin-top: 0px; margin-bottom: 12px; padding-left: 24px; list-style-type: disc;'
        : 'margin-top: 0px; margin-bottom: 12px; padding-left: 24px; list-style-type: decimal;';
      
      const listHtml = `<${tag} style="${listStyle}">\n` + 
        listBuffer.map(item => `<li style="margin-bottom: 6px; line-height: 1.6; color: #334155;">${item}</li>`).join('\n') + 
        `\n</${tag}>`;
      
      htmlBlocks.push(listHtml);
      inList = false;
      listType = null;
      listBuffer = [];
    }
  };

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // --- 1. Headers ---
    if (block.startsWith('#')) {
      flushList();
      const match = block.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const titleText = inlineParse(match[2]);
        if (level === 1) {
          htmlBlocks.push(`<h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #4f46e5; font-size: 18pt; font-weight: 800; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${titleText}</h1>`);
        } else if (level === 2) {
          htmlBlocks.push(`<h2 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1e1b4b; font-size: 14pt; font-weight: 700; margin-top: 20px; margin-bottom: 10px;">${titleText}</h2>`);
        } else {
          htmlBlocks.push(`<h3 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #312e81; font-size: 12pt; font-weight: 700; margin-top: 16px; margin-bottom: 8px;">${titleText}</h3>`);
        }
        continue;
      }
    }

    // --- 2. Code Block ---
    if (block.startsWith('```')) {
      flushList();
      const lines = block.split('\n');
      const startLine = lines[0];
      const endLineIndex = lines.findIndex((l, index) => index > 0 && l.trim() === '```');
      
      const codeLines = endLineIndex > 1 
        ? lines.slice(1, endLineIndex) 
        : lines.slice(1);
      
      const rawCode = codeLines.join('\n');
      // Escape HTML entities inside code block
      const escapedCode = escapeHtml(rawCode);

      htmlBlocks.push(
        `<pre style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-family: Consolas, 'Fira Code', 'Courier New', monospace; font-size: 9.5pt; color: #334155; margin-top: 0px; margin-bottom: 16px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;"><code>${escapedCode}</code></pre>`
      );
      continue;
    }

    // --- 3. Horizontal Rule ---
    if (block === '---' || block === '***' || block === '___') {
      flushList();
      htmlBlocks.push(`<hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 24px; margin-bottom: 24px;"/>`);
      continue;
    }

    // --- 4. Blockquotes ---
    if (block.startsWith('>')) {
      flushList();
      const cleanQuoteLines = block.split('\n').map(line => {
        return line.replace(/^>\s?/, '');
      });
      const quoteText = inlineParse(cleanQuoteLines.join('<br />'));
      htmlBlocks.push(
        `<blockquote style="border-left: 4px solid #818cf8; padding-left: 16px; margin: 0px 0px 16px 0px; color: #475569; font-style: italic; background-color: #f8fafc; padding-top: 8px; padding-bottom: 8px; border-radius: 0px 8px 8px 0px;">${quoteText}</blockquote>`
      );
      continue;
    }

    // --- 5. Tables ---
    if (block.includes('|') && block.split('\n').some(line => line.includes('-|-') || line.includes('---'))) {
      flushList();
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Parse table headers
      const headers = lines[0].split('|').map(s => s.trim()).filter((_, index, arr) => index > 0 && index < arr.length - 1);
      
      // Determine columns styling and alignments based on separator line
      // e.g. |:---| or |:---:|
      const separatorLine = lines[1] || '';
      const cellAlignments = separatorLine.split('|')
        .map(s => s.trim())
        .filter((_, index, arr) => index > 0 && index < arr.length - 1)
        .map(s => {
          const leftCol = s.startsWith(':');
          const rightCol = s.endsWith(':');
          if (leftCol && rightCol) return 'center';
          if (rightCol) return 'right';
          return 'left';
        });

      let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 18px; font-size: 10pt; text-align: left; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden;">\n`;
      
      // Table Header Row
      tableHtml += `  <thead>\n    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">\n`;
      headers.forEach((header, colIdx) => {
        const align = cellAlignments[colIdx] || 'left';
        tableHtml += `      <th style="color: #1e293b; font-weight: 600; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: ${align};">${inlineParse(header)}</th>\n`;
      });
      tableHtml += `    </tr>\n  </thead>\n  <tbody>\n`;

      // Table Body Rows
      const bodyLines = lines.slice(2);
      bodyLines.forEach((rowLine, rowIdx) => {
        const rowCells = rowLine.split('|').map(s => s.trim()).filter((_, index, arr) => index > 0 && index < arr.length - 1);
        if (rowCells.length === 0) return;

        const bg = rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
        tableHtml += `    <tr style="background-color: ${bg};">\n`;
        
        // Populate and style columns
        for (let thIdx = 0; thIdx < headers.length; thIdx++) {
          const cellText = rowCells[thIdx] !== undefined ? rowCells[thIdx] : '';
          const align = cellAlignments[thIdx] || 'left';
          tableHtml += `      <td style="padding: 10px 12px; border: 1px solid #cbd5e1; color: #334155; line-height: 1.5; text-align: ${align};">${inlineParse(cellText)}</td>\n`;
        }
        tableHtml += `    </tr>\n`;
      });

      tableHtml += `  </tbody>\n</table>`;
      htmlBlocks.push(tableHtml);
      continue;
    }

    // --- 6. Lists ---
    const listMatch = block.match(/^(\*|-|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const bulletSymbol = listMatch[1];
      const isNum = /^\d+/.test(bulletSymbol);
      const currentBlockListType = isNum ? 'ol' : 'ul';

      if (inList && listType !== currentBlockListType) {
        flushList();
      }

      inList = true;
      listType = currentBlockListType;

      // Split bullet points inside the list block
      const items = block.split(/\n[\*\-\d+\.]+\s+/);
      // Clean first list point which already had original prefix removed
      const firstItemClean = block.replace(/^(\*|-|\d+\.)\s+/, '');
      const firstItemLines = firstItemClean.split('\n');
      const firstItemMain = firstItemLines[0];
      const firstItemRemaining = firstItemLines.slice(1).join('\n');

      listBuffer.push(inlineParse(firstItemMain));
      
      // If there are other multi-line components or subsequent bullets inside the block
      const otherItems = items.slice(1);
      otherItems.forEach(item => {
        const lines = item.split('\n');
        listBuffer.push(inlineParse(lines[0]));
      });

      continue;
    }

    // --- 7. Standard Paragraphs ---
    flushList();
    const parsedParagraph = inlineParse(block);
    htmlBlocks.push(`<p style="margin-top: 0px; margin-bottom: 12px; line-height: 1.6; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">${parsedParagraph}</p>`);
  }

  flushList();

  // Return full styled body wrapper
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; max-width: 100%; background-color: #ffffff; padding: 4px;">\n` + 
         htmlBlocks.join('\n\n') + 
         `\n</div>`;
}

/**
 * Escapes characters to prevent HTML rendering issues in code blocks
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parsers inline markdown syntaxes like **bold**, *italics*, `code`, equations/math
 */
function inlineParse(text: string): string {
  let res = text;

  // Escape HTML tags to protect the inline structures but maintain paragraph styles
  res = res
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore linebreaks represented by standard trailing double spaces or br
  res = res.replace(/  \n/g, '<br />');

  // Multi-line block math representation ($$...$$)
  res = res.replace(/\$\$(.*?)\$\$/g, (_, eq) => {
    return `<div style="text-align: center; margin: 12px 0; font-family: 'Cambria Math', 'Times New Roman', serif; font-size: 12pt; background-color: #f8fafc; padding: 8px; border-radius: 6px; border: 1px border-dashed #e2e8f0; color: #4f46e5;">[Équation : ${eq.trim()}]</div>`;
  });

  // Inline math representation ($...$)
  res = res.replace(/\$(.*?)\$/g, (_, eq) => {
    return `<code style="font-family: 'Cambria Math', 'Times New Roman', serif; font-style: italic; background-color: #f1f5f9; padding: 1px 4px; border-radius: 4px; color: #4f46e5; border: 1px solid #cbd5e1;">${eq.trim()}</code>`;
  });

  // Inline code block (`code`)
  res = res.replace(/`(.*?)`/g, (_, code) => {
    return `<code style="font-family: Consolas, 'Courier New', monospace; background-color: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-size: 9.5pt; color: #b02a37; border: 1px solid #e2e8f0;">${code}</code>`;
  });

  // Strong Bold (**bold** or __bold__)
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');

  // Emphasis Italics (*italic* or _italic_)
  res = res.replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: #334155;">$1</em>');
  res = res.replace(/_(.*?)_/g, '<em style="font-style: italic; color: #334155;">$1</em>');

  // Markdown links ([text](url))
  res = res.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #4f46e5; text-decoration: underline; font-weight: 500;">$1</a>');

  return res;
}
