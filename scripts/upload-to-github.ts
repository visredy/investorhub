import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const ignoredPaths = [
  'node_modules', '.git', '.cache', '.config', '.upm', 
  'dist', '.replit', 'replit.nix', '.breakpoints',
  'uploads', 'signed_agreements', 'scripts/upload-to-github.ts',
  'scripts/push-to-github.ts', 'package-lock.json', '.local'
];

function shouldIgnore(filePath: string): boolean {
  return ignoredPaths.some(ignored => filePath.includes(ignored));
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (shouldIgnore(fullPath)) continue;
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  
  return arrayOfFiles;
}

async function main() {
  const octokit = await getUncachableGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = 'investorhub';
  
  console.log(`Uploading to ${owner}/${repo}...`);
  
  const baseDir = '/home/runner/workspace';
  const files = getAllFiles(baseDir);
  
  console.log(`Found ${files.length} files to upload`);
  
  const blobs: { path: string; sha: string; mode: string; type: string }[] = [];
  
  for (const file of files) {
    const relativePath = file.replace(baseDir + '/', '');
    const content = fs.readFileSync(file);
    const base64Content = content.toString('base64');
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: 'base64',
      });
      
      blobs.push({
        path: relativePath,
        sha: blob.sha,
        mode: '100644',
        type: 'blob',
      });
      
      console.log(`Uploaded: ${relativePath}`);
    } catch (e: any) {
      console.error(`Failed to upload ${relativePath}: ${e.message}`);
    }
  }
  
  console.log('\nCreating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: blobs as any,
  });
  
  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Initial commit - InvestorHub investor dashboard',
    tree: tree.sha,
  });
  
  console.log('Updating main branch...');
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: 'heads/main',
      sha: commit.sha,
      force: true,
    });
  } catch {
    await octokit.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });
  }
  
  console.log(`\nSuccess! View your repository at: https://github.com/${owner}/${repo}`);
}

main().catch(console.error);
