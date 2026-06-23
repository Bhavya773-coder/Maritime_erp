const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\66682944-3e92-4dd6-a000-d943dfe4ca62\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    index++;
    try {
      const step = JSON.parse(line);
      if (index === 1681 && step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (tc.name === 'replace_file_content') {
            let content = tc.args.ReplacementContent;
            // Explicitly replace escaped characters
            content = content
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            fs.writeFileSync('recovered_loop.ts', content);
            console.log(`Successfully saved Step 1681 ReplacementContent to recovered_loop.ts!`);
            return;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

main();
