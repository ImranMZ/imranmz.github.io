// Pushes the repo to GitHub over the REST API instead of the git protocol.
//
// Use this when github.com itself is unreachable (blocked/firewalled) but
// api.github.com still responds — which is the case on some networks.
//
//   $env:GITHUB_TOKEN = "ghp_..."
//   node scripts\push-via-api.mjs
//
// The token needs `repo` scope. It is read from the environment so it never
// appears in the repo, in git history, or in this conversation.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const token = process.env.GITHUB_TOKEN
const owner = process.env.GH_OWNER || 'ImranMZ'
const repo = process.env.GH_REPO || 'imranmz.github.io'

if (!token) {
  console.error('GITHUB_TOKEN is not set.')
  console.error('PowerShell:  $env:GITHUB_TOKEN = "ghp_..."')
  process.exit(1)
}

const api = 'https://api.github.com'
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'portfolio-deploy',
}

async function call(method, path, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const detail = data?.message || text || res.status
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`)
  }
  return data
}

const git = (args) => execSync(`git ${args}`, { cwd: root }).toString().trim()

function walk(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.astro')
      continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, base))
    else out.push(relative(base, full).split(sep).join(posix.sep))
  }
  return out
}

async function uploadBranch({ branch, files, base = root }) {
  const entries = []
  for (const path of files) {
    const absolute = join(base, path)
    if (!existsSync(absolute)) {
      console.warn(`\n  ! skipped missing file: ${path}`)
      continue
    }
    const blob = await call('POST', `/repos/${owner}/${repo}/git/blobs`, {
      content: readFileSync(absolute).toString('base64'),
      encoding: 'base64',
    })
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
    process.stdout.write('.')
  }

  if (entries.length === 0) {
    throw new Error(`No files to upload for ${branch} — refusing to send an empty tree.`)
  }

  const tree = await call('POST', `/repos/${owner}/${repo}/git/trees`, { tree: entries })

  // Reuse the branch's existing commit as a parent so history continues.
  let parents = []
  try {
    const ref = await call('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    const sha = await call('GET', `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`)
    parents = [sha.sha]
  } catch {
    /* branch does not exist yet — start a fresh root commit */
  }

  const commit = await call('POST', `/repos/${owner}/${repo}/git/commits`, {
    message: branch === 'main' ? 'Portfolio site source' : 'deploy: update site',
    tree: tree.sha,
    parents,
  })

  try {
    await call('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: true,
    })
  } catch {
    await call('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    })
  }
  console.log(`\n  ${branch} -> ${commit.sha.slice(0, 7)} (${files.length} files)`)
  return commit.sha
}

console.log(`Target: ${owner}/${repo}`)

// The Git Data API refuses to write blobs into a repository with zero commits
// (409 "Git Repository is empty"), so seed the branch with one file first.
async function ensureRepoHasCommits(branch) {
  try {
    await call('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    return false
  } catch {
    // fall through to seeding
  }
  console.log('  repository is empty — seeding an initial commit…')
  await call('PUT', `/repos/${owner}/${repo}/contents/.github-seed`, {
    message: 'chore: initialise repository',
    content: Buffer.from('Replaced by the first deploy commit.\n').toString('base64'),
  })
  return true
}

console.log('1/3 pushing source (main)…')
await ensureRepoHasCommits('main')
const sourceFiles = git('ls-files').split('\n').filter(Boolean)
await uploadBranch({ branch: 'main', files: sourceFiles })

// 2/3 built site branch
if (!existsSync(join(root, 'dist'))) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}
const distDir = join(root, 'dist')
if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}
// `.nojekyll` stops GitHub Pages from ignoring _astro/ (leading-underscore dirs).
// It is generated rather than built, so write it into dist before uploading.
writeFileSync(join(distDir, '.nojekyll'), '')
const siteFiles = walk(distDir)
console.log('2/3 pushing site (gh-pages)…')
await ensureRepoHasCommits('gh-pages')
await uploadBranch({ branch: 'gh-pages', files: siteFiles, base: distDir })

// 3/3 enable Pages
console.log('3/3 enabling GitHub Pages…')
const source = { branch: 'gh-pages', path: '/' }
try {
  const pages = await call('POST', `/repos/${owner}/${repo}/pages`, { source })
  console.log(`  Pages created: ${pages.html_url}`)
} catch (err) {
  // 409 means Pages is already switched on for this repo; just re-point it.
  if (/already (exists|enabled)/i.test(err.message)) {
    await call('PUT', `/repos/${owner}/${repo}/pages`, { source })
    console.log('  Pages already enabled — source set to gh-pages')
  } else {
    throw err
  }
}

const site = await call('GET', `/repos/${owner}/${repo}/pages`)
console.log(
  `  source: ${site.source?.branch ?? site.build_type} / ${site.source?.path ?? '-'}  status: ${site.status}`
)

// A user site repo (<login>.github.io) serves from the domain root; anything
// else is served from /<repo>/.
const siteUrl = repo.toLowerCase().endsWith('.github.io')
  ? `https://${repo.toLowerCase()}/`
  : `https://${owner.toLowerCase()}.github.io/${repo}/`

console.log(`\nDone: ${siteUrl}`)