const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Let's see if we have 7-Zip or powershell zip listing we can run
const command = 'powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.IO.Compression.FileSystem\') | Out-Null; $zip = [System.IO.Compression.ZipFile]::OpenRead(\'Bhavya-2.zip\'); $zip.Entries.FullName"';
exec(command, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  console.log('Total entries:', lines.length);
  console.log('Sample entries:', lines.slice(0, 100));
  // Let's filter entries containing 'registry' or 'document' or 'pdf'
  const filterKeywords = ['registry', 'survey', 'insurance', 'pdf', 'cert'];
  filterKeywords.forEach(kw => {
    const matches = lines.filter(l => l.toLowerCase().includes(kw));
    console.log(`Matches for "${kw}":`, matches.length);
    if (matches.length > 0) {
      console.log(`  Sample ${kw}:`, matches.slice(0, 20));
    }
  });
});
