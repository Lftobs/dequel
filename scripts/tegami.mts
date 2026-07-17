import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";
import type { Draft, TegamiPlugin } from "tegami";

const REPO = "Lftobs/dequel";

function getPreviousTag(): string {
  try {
    const output = execSync(
      "git tag -l 'v*' --sort=-v:refname",
      { encoding: "utf-8" }
    );
    const tags = output.trim().split("\n").filter(Boolean);
    return tags[0] ?? "";
  } catch {
    return "";
  }
}

function getCommitMap(fromTag: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fromTag) return map;
  try {
    const output = execSync(
      `git log --oneline --format="%H %s" ${fromTag}..HEAD --no-merges`,
      { encoding: "utf-8" }
    );
    for (const line of output.trim().split("\n")) {
      if (!line) continue;
      const sha = line.slice(0, 40);
      const msg = line.slice(41);
      map.set(msg.toLowerCase(), sha);
    }
  } catch {}
  return map;
}

function formatChangelogBody(raw: string, commitMap: Map<string, string>): string {
  const lines = raw.replace(/^---[\s\S]*?---\n*/g, "").split("\n");
  const sectionTitles = new Map([
    ["New Features", "Features"],
    ["Improvements", "Improvements"],
    ["Bug Fixes", "Bug Fixes"],
  ]);

  const result: string[] = [];
  let sectionOpen = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    const sectionMatch = trimmed.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      if (sectionOpen) result.push("");
      const title = sectionTitles.get(sectionMatch[1]) ?? sectionMatch[1];
      result.push(`### ${title}`);
      sectionOpen = true;
      continue;
    }

    const bulletMatch = trimmed.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      const rawMsg = bulletMatch[1];
      const msg = rawMsg.replace(/^(feat|fix|refactor|chore|docs|style|perf|test|build|ci|revert)(\([^)]+\))?:\s*/, "");
      const display = msg.charAt(0).toUpperCase() + msg.slice(1);
      const sha = commitMap.get(rawMsg) || commitMap.get(rawMsg.toLowerCase());
      if (sha) {
        const shortSha = sha.slice(0, 7);
        result.push(`- ${display} ([${shortSha}](https://github.com/${REPO}/commit/${sha}))`);
      } else {
        result.push(`- ${display}`);
      }
      continue;
    }

    if (trimmed) result.push(trimmed);
  }

  return result.join("\n") + "\n";
}

function docsChangelogPlugin(): TegamiPlugin {
  return {
    name: "docs-changelog",
    enforce: "pre",
    async applyDraft(this: any, draft: Draft) {
      const logsDir = join(this.cwd, "apps/docs/src/content/changelogs");
      await mkdir(logsDir, { recursive: true });

      const seen = new Set<string>();
      const commitMap = getCommitMap(getPreviousTag());

      for (const [pkgId, packageDraft] of draft.getPackageDrafts()) {
        if (!packageDraft.changelogs?.length) continue;
        if (pkgId === "npm:dequel") continue;
        const pkg = this.graph.get(pkgId);
        if (!pkg) continue;

        for (const entry of packageDraft.changelogs) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);

          const pkgJson = JSON.parse(await readFile(join(pkg.path, "package.json"), "utf8"));
          const currentVersion = pkgJson.version;
          if (!currentVersion || !packageDraft.type) continue;
          const { inc, parse } = await import("semver");
          const parsed = parse(currentVersion);
          if (!parsed) continue;
          const newVersion = inc(parsed, packageDraft.type);
          if (!newVersion) continue;

          const raw = entry.getRawContent();
          const body = formatChangelogBody(raw, commitMap);
          const today = new Date().toISOString().slice(0, 10);
          const dest = join(logsDir, `v${newVersion}.md`);

          const content = `---
version: ${newVersion}
date: "${today}"
---

${body}
`;

          await writeFile(dest, content);
        }
      }

      for (const [pkgId, packageDraft] of draft.getPackageDrafts()) {
        if (pkgId === "npm:dequel") continue;
        packageDraft.changelogs = [];
      }
    },
  };
}

function tagReleasePlugin(): TegamiPlugin {
  return {
    name: "tag-release",
    async afterPublish(this: any) {
      const pkg = this.graph.get("npm:dequel-api");
      if (!pkg) return;
      const pkgJson = JSON.parse(await readFile(join(pkg.path, "package.json"), "utf8"));
      const tag = `v${pkgJson.version}`;
      try {
        execSync(`git tag ${tag}`, { cwd: this.cwd });
        execSync(`git push origin ${tag}`, { cwd: this.cwd });
        console.log(`[Tegami] Pushed tag ${tag} — release workflow will trigger`);
      } catch (e) {
        console.warn(`[Tegami] Failed to push tag ${tag}:`, e);
      }
    },
  };
}

const paper = tegami({
  npm: {
    client: "bun",
  },
  plugins: [
    docsChangelogPlugin(),
    tagReleasePlugin(),
    github({
      repo: REPO,
      release: false,
      versionPr: {
        base: "main",
      },
    }),
  ],
  groups: {
    dequel: {
      syncBump: true,
      syncGitTag: true,
    },
  },
  packages: {
    "npm:dequel": { publish: false },
    "npm:dequel-api": { group: "dequel", publish: false },
    "npm:dequel-web": { group: "dequel", publish: false },
    "npm:dequel-docs": { group: "dequel", publish: false },
  },
});

await runCli(paper);
