const fs = require('fs');
const content = fs.readFileSync('c:/Users/Lenovo/OneDrive/Desktop/ERP/backend/src/modules/bot/llm.service.ts', 'utf8');

let braceCount = 0;
let inString = false;
let stringChar = '';
let inComment = false;
let commentType = ''; // 'single' or 'multi'
let lineNum = 1;
let lastLineWithBrace = 0;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const nextChar = content[i + 1];

  if (char === '\n') {
    lineNum++;
    if (inComment && commentType === 'single') {
      inComment = false;
    }
  }

  if (inComment) {
    if (commentType === 'multi' && char === '*' && nextChar === '/') {
      inComment = false;
      i++; // skip /
    }
    continue;
  }

  if (inString) {
    if (char === '\\') {
      i++; // skip next char
      continue;
    }
    if (char === stringChar) {
      inString = false;
    }
    continue;
  }

  if (char === '/' && nextChar === '/') {
    inComment = true;
    commentType = 'single';
    i++;
    continue;
  }

  if (char === '/' && nextChar === '*') {
    inComment = true;
    commentType = 'multi';
    i++;
    continue;
  }

  if (char === "'" || char === '"' || char === '`') {
    inString = true;
    stringChar = char;
    continue;
  }

  if (char === '{') {
    braceCount++;
    if (lineNum >= 800 && lineNum <= 1080) {
      console.log(`Line ${lineNum}: { opened (level: ${braceCount})`);
    }
  } else if (char === '}') {
    braceCount--;
    if (lineNum >= 800 && lineNum <= 1080) {
      console.log(`Line ${lineNum}: } closed (level: ${braceCount})`);
    }
  }
}
console.log(`Final brace count: ${braceCount}`);
