import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken! } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

const includeDirs = ['client/src', 'server', 'shared', 'scripts'];
const includeFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.ts', 
  'postcss.config.js', 'drizzle.config.ts', 'components.json', 'replit.md', 'index.html',
  'client/index.html', 'client/tsconfig.json'];

function getAllFiles(baseDir: string): string[] {
  const files: string[] = [];
  
  for (const file of includeFiles) {
    const fullPath = path.join(baseDir, file);
    if (fs.existsSync(fullPath)) files.push(fullPath);
  }
  
  for (const dir of includeDirs) {
    const dirPath = path.join(baseDir, dir);
    if (fs.existsSync(dirPath)) {
      const walkDir = (d: string) => {
        for (const f of fs.readdirSync(d)) {
          const fp = path.join(d, f);
          if (fs.statSync(fp).isDirectory()) walkDir(fp);
          else files.push(fp);
        }
      };
      walkDir(dirPath);
    }
  }
  return files;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = 'investorhub';
  
  console.log(`Uploading source to ${owner}/${repo}...`);
  
  const baseDir = '/home/runner/workspace';
  const files = getAllFiles(baseDir);
  console.log(`Found ${files.length} source files`);
  
  let uploaded = 0;
  for (const file of files) {
    const relativePath = file.replace(baseDir + '/', '');
    const content = fs.readFileSync(file, 'base64');
    
    try {
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: relativePath,
        message: `Add ${relativePath}`,
        content,
      });
      uploaded++;
      console.log(`[${uploaded}/${files.length}] ${relativePath}`);
      await new Promise(r => setTimeout(r, 100));
    } catch (e: any) {
      console.error(`Failed: ${relativePath} - ${e.message}`);
    }
  }
  
  console.log(`\nDone! https://github.com/${owner}/${repo}`);
}

main().catch(console.error);
