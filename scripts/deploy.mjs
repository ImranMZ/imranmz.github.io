// Deploys the built site to the gh-pages branch of the same repo.
//
//   node scripts/deploy.mjs
//
// Requires: git on PATH, an `origin` remote pointing at GitHub, and an initial
// `git push` so Git Credential Manager can complete the browser login.
import { execSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const worktree = join(root, '.deploy-gh-pages')

if (!existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const git = (args, cwd = root) =>
  execSync(`git ${args}`, { cwd, stdio: 'inherit' })

const branch = 'gh-pages'
const remote = process.env.DEPLOY_REMOTE || 'origin'

// Fails loudly instead of publishing to the wrong branch.
function assertOnDeployBranch() {
  const current = execSync('git rev-parse --abbrev-ref HEAD', { cwd: worktree })
    .toString()
    .trim()
  if (current !== branch) {
    console.error(`Refusing to commit: worktree is on "${current}", expected "${branch}".`)
    process.exit(1)
  }
}

console.log('1/5 switching to an empty gh-pages worktree…')
rmSync(worktree, { recursive: true, force: true })
git(`worktree prune`)
git(`worktree add -B ${branch} ${worktree}`)
assertOnDeployBranch()

console.log('2/5 copying dist into the worktree…')
// Wipe the worktree first: it is checked out from the source branch, so without
// this the repo's own files (src/, package.json, public/) would be published
// alongside the built site.
//
// `.git` must survive — that file is what makes this directory a worktree.
// Deleting it turns the folder into a plain subdirectory of the main checkout,
// and the commit in step 3 would then land on `main` instead of `gh-pages`.
for (const entry of readdirSync(worktree)) {
  if (entry === '.git') continue
  rmSync(join(worktree, entry), { recursive: true, force: true })
}
cpSync(dist, worktree, { recursive: true })

// Keep the CNAME file across deploys if a custom domain is configured.
if (existsSync(join(root, 'public', 'CNAME'))) {
  cpSync(join(root, 'public', 'CNAME'), join(worktree, 'CNAME'))
}

// .nojekyll stops GitHub Pages from ignoring _astro/ (leading-underscore dirs).
if (!existsSync(join(worktree, '.nojekyll'))) {
  writeFileSync(join(worktree, '.nojekyll'), '')
}

console.log('3/5 committing…')
git('add -A', worktree)
git('commit -m "deploy: update site" --allow-empty', worktree)

console.log(`4/5 pushing to ${remote}/${branch}…`)
git(`push ${remote} ${branch}:${branch} --force`, worktree)

console.log('5/5 cleaning up…')
git(`worktree remove ${worktree} --force`)
git(`worktree prune`)

console.log(`\nDone. If GitHub Pages is not already on, enable it once at:\n  https://github.com/ImranMZ/imranmz.github.io/settings/pages\n  Source: Deploy from a branch -> gh-pages / (root)`)