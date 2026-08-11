import { join } from "node:path";
import { readdir } from "node:fs/promises";

export const rewriteLocalhostBinding = async (
	dir: string,
	onLog: (line: string) => Promise<void>,
): Promise<void> => {
	const ignoreDirs = new Set([
		"node_modules",
		"target",
		".git",
		".cargo",
		"dist",
		"build",
		".next",
		".svelte-kit",
		"vendor",
	]);
	const allowedExts = new Set([
		"rs",
		"go",
		"js",
		"ts",
		"py",
		"java",
		"json",
		"yaml",
		"yml",
		"toml",
	]);

	try {
		const entries = await readdir(dir, {
			withFileTypes: true,
		});
		for (const entry of entries) {
			const fullPath = join(
				dir,
				entry.name,
			);
			if (entry.isDirectory()) {
				if (ignoreDirs.has(entry.name)) {
					continue;
				}
				await rewriteLocalhostBinding(
					fullPath,
					onLog,
				);
			} else if (entry.isFile()) {
				const ext = entry.name
					.split(".")
					.pop();
				if (ext && allowedExts.has(ext)) {
					try {
						let content =
							await Bun.file(
								fullPath,
							).text();
						if (
							content.includes(
								"127.0.0.1",
							)
						) {
							content =
								content.replaceAll(
									"127.0.0.1",
									"0.0.0.0",
								);
							await Bun.write(
								fullPath,
								content,
							);
							await onLog(
								`Auto-rewrote 127.0.0.1 to 0.0.0.0 in ${entry.name} for container compatibility.`,
							);
						}
					} catch {
						// Ignore read errors
					}
				}
			}
		}
	} catch {
		// Ignore readdir/directory access errors
	}
};

const fixPnpmWorkspaceIfNeeded = async (workspacePath: string, onLog: (line: string) => Promise<void>) => {
	try {
		const workspaceFilePath = join(workspacePath, "pnpm-workspace.yaml");
		const file = Bun.file(workspaceFilePath);
		if (await file.exists()) {
			const content = await file.text();
			if (!content.includes("packages:")) {
				await onLog("Auto-repairing invalid pnpm-workspace.yaml (missing packages entry)...");
				const updated = `${content.trim()}\n\npackages:\n  - '.'\n`;
				await Bun.write(workspaceFilePath, updated);
			}
		}
	} catch {
		// Ignore workspace repair errors
	}
};

export const generateDynamicRailpackJson = async (
	workspace: string,
	sourceDir: string | null,
	projectType: string | null,
	buildCommandOverride: string | null,
	startCommandOverride: string | null,
	onLog: (line: string) => Promise<void>,
	installCommandOverride?: string | null,
	outputDirOverride?: string | null,
): Promise<void> => {
	const cleanSourceDir = sourceDir
		? sourceDir.replace(/^\//, "")
		: "";
	const cleanOutputDir = outputDirOverride
		? outputDirOverride.replace(/^\//, "")
		: "";
	const buildDir = cleanSourceDir
		? join(workspace, cleanSourceDir)
		: workspace;
	await rewriteLocalhostBinding(
		buildDir,
		onLog,
	);
	await fixPnpmWorkspaceIfNeeded(workspace, onLog);
	const configPath = join(
		workspace,
		"railpack.json",
	);

	// Default configuration template
	const config: Record<string, any> = {
		caches: {},
		steps: {},
		deploy: {},
	};

	let configured = false;

	if (cleanSourceDir && !(await Bun.file(join(workspace, "package.json")).exists())) {
		const sourcePkgExists = await Bun.file(join(workspace, cleanSourceDir, "package.json")).exists();
		if (sourcePkgExists) {
			await Bun.write(join(workspace, "package.json"), JSON.stringify({
				name: "dequel-monorepo-root",
				private: true,
				workspaces: [cleanSourceDir]
			}, null, 2));
		}
	}

	const hasPackageJson = await Bun.file(
		join(buildDir, "package.json"),
	).exists();
	if (hasPackageJson) {
		try {
			const packageJson = await Bun.file(
				join(buildDir, "package.json"),
			).json();
			const scripts =
				packageJson.scripts || {};

			let pm = "npm";
			if (
				await Bun.file(
					join(
						workspace,
						"pnpm-lock.yaml",
					),
				).exists()
			) {
				pm = "pnpm";
			} else if (
				await Bun.file(
					join(workspace, "yarn.lock"),
				).exists()
			) {
				pm = "yarn";
			} else if (
				await Bun.file(
					join(workspace, "bun.lockb"),
				).exists()
			) {
				pm = "bun";
			}

			await onLog(
				`Configuring Node.js project using ${pm}`,
			);

			const hasNext = (packageJson.dependencies && packageJson.dependencies.next) ||
				(packageJson.devDependencies && packageJson.devDependencies.next);

			if (pm === "pnpm") {
				config.caches.pnpm_store = {
					directory: "/root/.local/share/pnpm/store",
					type: "shared",
				};
			} else if (pm === "yarn") {
				config.caches.yarn_cache = {
					directory: "/root/.cache/yarn",
					type: "shared",
				};
			} else if (pm === "bun") {
				config.caches.bun_cache = {
					directory: "/root/.bun/install/cache",
					type: "shared",
				};
			} else {
				config.caches.npm_cache = {
					directory: "/root/.npm",
					type: "shared",
				};
			}



			if (scripts.build) {
				const buildCmds = [
					cleanSourceDir
						? `[ -d "${cleanSourceDir}" ] && cd ${cleanSourceDir}; ${pm} run build`
						: `${pm} run build`,
				];
				if (hasNext) {
					const nextCacheDir = cleanSourceDir
						? `${cleanSourceDir}/.next/cache`
						: ".next/cache";
					config.caches.next_cache = {
						directory: nextCacheDir,
						type: "shared",
					};
					config.steps.build = {
						commands: buildCmds,
						caches: ["next_cache"],
					};
				} else {
					config.steps.build = {
						commands: buildCmds,
					};
				}
			}

			if (scripts.start) {
				config.deploy.startCommand =
					cleanSourceDir
						? `cd ${cleanSourceDir} && ${pm} run start`
						: `${pm} run start`;
			} else if (scripts.server) {
				config.deploy.startCommand =
					cleanSourceDir
						? `cd ${cleanSourceDir} && ${pm} run server`
						: `${pm} run server`;
			} else {
				config.deploy.startCommand =
					cleanSourceDir
						? `cd ${cleanSourceDir} && node dist/index.js`
						: "node dist/index.js";
			}

			configured = true;
		} catch (err) {
			await onLog(
				`Error parsing package.json: ${err}`,
			);
		}
	}



	const hasCargoToml = await Bun.file(
		join(buildDir, "Cargo.toml"),
	).exists();
	if (hasCargoToml && !configured) {
		try {
			let cargoContent = await Bun.file(
				join(buildDir, "Cargo.toml"),
			).text();

			let hasWorkspaceRoot = false;
			let currentDir = buildDir;
			while (
				currentDir.startsWith(workspace)
			) {
				const parentCargo = join(
					currentDir,
					"Cargo.toml",
				);
				if (
					currentDir !== buildDir &&
					(await Bun.file(
						parentCargo,
					).exists())
				) {
					const content =
						await Bun.file(
							parentCargo,
						).text();
					if (
						content.includes(
							"[workspace]",
						)
					) {
						hasWorkspaceRoot = true;
						break;
					}
				}
				const nextDir = join(
					currentDir,
					"..",
				);
				if (
					nextDir === currentDir ||
					!nextDir.startsWith(workspace)
				)
					break;
				currentDir = nextDir;
			}

			if (
				!hasWorkspaceRoot &&
				(cargoContent.includes(
					".workspace = true",
				) ||
					cargoContent.includes(
						"workspace = true",
					))
			) {
				await onLog(
					`Detected workspace inheritance in Cargo.toml without workspace root. Resolving workspace variables...`,
				);
				const commonDeps: Record<
					string,
					string
				> = {
					"actix-web": '"4"',
					"actix-files": '"0.6"',
					"actix-rt": '"2.9"',
					serde: '{"version": "1", "features": ["derive"]}',
					serde_json: '"1"',
					tokio: '{"version": "1", "features": ["full"]}',
					futures: '"0.3"',
					log: '"0.4"',
					env_logger: '"0.11"',
					uuid: '{"version": "1", "features": ["v4"]}',
					chrono: '"0.4"',
					reqwest:
						'{"version": "0.12", "features": ["json"]}',
					anyhow: '"1"',
					thiserror: '"1"',
				};

				cargoContent =
					cargoContent.replace(
						/edition\.workspace\s*=\s*true/g,
						'edition = "2021"',
					);
				cargoContent =
					cargoContent.replace(
						/rust-version\.workspace\s*=\s*true/g,
						'rust-version = "1.89"',
					);
				cargoContent =
					cargoContent.replace(
						/version\.workspace\s*=\s*true/g,
						'version = "0.1.0"',
					);

				const lines =
					cargoContent.split("\n");
				for (
					let i = 0;
					i < lines.length;
					i++
				) {
					const line = lines[i];
					const matchSimple =
						line.match(
							/^(\s*)([a-zA-Z0-9_-]+)\.workspace\s*=\s*true/,
						);
					if (matchSimple) {
						const indent =
							matchSimple[1];
						const name =
							matchSimple[2];
						const ver =
							commonDeps[name] ||
							'"*"';
						lines[i] =
							`${indent}${name} = ${ver}`;
						continue;
					}
					const matchComplex =
						line.match(
							/^(\s*)([a-zA-Z0-9_-]+)\s*=\s*\{\s*workspace\s*=\s*true\s*,?\s*(.*)\}/,
						);
					if (matchComplex) {
						const indent =
							matchComplex[1];
						const name =
							matchComplex[2];
						const rest =
							matchComplex[3].trim();
						const restComma = rest
							? `, ${rest}`
							: "";
						lines[i] =
							`${indent}${name} = { version = "*"${restComma} }`;
						continue;
					}
				}
				cargoContent = lines.join("\n");
				await Bun.write(
					join(buildDir, "Cargo.toml"),
					cargoContent,
				);
				await onLog(
					`Wrote standalone Cargo.toml to resolve workspace inheritance.`,
				);
			}

			const match = cargoContent.match(
				/\[package\][^]*?name\s*=\s*"([^"]+)"/,
			);
			const pkgName = match
				? match[1]
				: null;

			if (pkgName) {
				await onLog(
					`Configuring Rust project: ${pkgName}`,
				);
				config.caches = {
					cargo_registry: {
						directory:
							"/root/.cargo/registry",
						type: "shared",
					},
					cargo_git: {
						directory:
							"/root/.cargo/git",
						type: "shared",
					},
					cargo_target: {
						directory: "target",
						type: "shared",
					},
				};
				config.steps.build = {
					commands: [
						`cargo build --release -p ${pkgName}`,
						"mkdir -p bin",
						`cp target/release/${pkgName} bin/`,
					],
					caches: [
						"cargo_registry",
						"cargo_git",
						"cargo_target",
					],
				};
				config.deploy.startCommand = `./bin/${pkgName}`;
				configured = true;
			}
		} catch (err) {
			await onLog(
				`Error parsing Cargo.toml: ${err}`,
			);
		}
	}

	let hasGoMod = false;
	let currentDir = buildDir;
	while (currentDir.startsWith(workspace)) {
		if (
			await Bun.file(
				join(currentDir, "go.mod"),
			).exists()
		) {
			hasGoMod = true;
			break;
		}
		const nextDir = join(currentDir, "..");
		if (
			nextDir === currentDir ||
			!nextDir.startsWith(workspace)
		)
			break;
		currentDir = nextDir;
	}
	if (hasGoMod && !configured) {
		await onLog(`Configuring Go project`);
		config.caches = {
			go_build: {
				directory:
					"/root/.cache/go-build",
				type: "shared",
			},
			go_mod: {
				directory: "/go/pkg/mod",
				type: "shared",
			},
		};
		config.steps.build = {
			commands: [
				cleanSourceDir
					? `cd ${cleanSourceDir} && go build -o bin/app .`
					: "go build -o bin/app .",
			],
			caches: ["go_build", "go_mod"],
		};
		config.deploy.startCommand =
			cleanSourceDir
				? `cd ${cleanSourceDir} && ./bin/app`
				: "./bin/app";
		configured = true;
	}

	if (!configured && (projectType === "static" || (await Bun.file(join(buildDir, "index.html")).exists()) || (await Bun.file(join(workspace, "index.html")).exists()))) {
		const serveScript = `
const fs = require("fs");
const path = require("path");
const PORT = Number(process.env.PORT || 3000);
const cleanSourceDir = "${cleanSourceDir}";
const cleanOutputDir = "${cleanOutputDir}";
let staticDir = ".";
const candidates = [
  ...(cleanOutputDir ? [path.join(cleanSourceDir, cleanOutputDir), cleanOutputDir] : []),
  path.join(cleanSourceDir, "dist"),
  path.join(cleanSourceDir, "build"),
  path.join(cleanSourceDir, "out"),
  path.join(cleanSourceDir, ".next/server/app"),
  path.join(cleanSourceDir, ".next/server/pages"),
  path.join(cleanSourceDir, "public"),
  cleanSourceDir || ".",
  "dist",
  "build",
  "out",
  "public",
  "."
];
for (const dir of candidates) {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    if (fs.existsSync(path.join(fullPath, "index.html"))) {
      staticDir = dir;
      break;
    }
  }
}
console.log("Serving static directory:", staticDir, "on port", PORT);
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let decodedPathname = "/";
    try {
      decodedPathname = decodeURIComponent(url.pathname);
    } catch {
      decodedPathname = url.pathname;
    }
    let filePath = path.join(staticDir, decodedPathname);
    if (decodedPathname.endsWith("/")) {
      filePath = path.join(filePath, "index.html");
    }
    let file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "content-type": file.type || "application/octet-stream"
        }
      });
    }
    const fallbackPath = path.join(staticDir, "index.html");
    const fallbackFile = Bun.file(fallbackPath);
    if (await fallbackFile.exists()) {
      return new Response(fallbackFile, {
        headers: {
          "content-type": fallbackFile.type || "text/html"
        }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
});
`;
		await Bun.write(join(workspace, "dequel-serve.js"), serveScript);
		const rootPkgPath = join(workspace, "package.json");
		if (!(await Bun.file(rootPkgPath).exists())) {
			await Bun.write(rootPkgPath, JSON.stringify({
				name: "dequel-static-app",
				private: true,
				scripts: {
					start: "bun dequel-serve.js"
				}
			}, null, 2));
		}
		config.steps.build = config.steps.build || { commands: [] };
		config.deploy.startCommand = "bun dequel-serve.js";
		configured = true;
	}

	if (!configured) {
		await onLog(
			`Relying on default Railpack language auto-detection`,
		);
	}

	if (buildCommandOverride || startCommandOverride || installCommandOverride) {
		await onLog("Applying custom build/start/install settings");
		if (installCommandOverride) {
			const hasCustomInstall = installCommandOverride !== "npm install" && installCommandOverride !== "npm ci" && installCommandOverride !== "pnpm install" && installCommandOverride !== "yarn install" && installCommandOverride !== "bun install";
			if (hasCustomInstall) {
				config.steps.install = config.steps.install || {};
				config.steps.install.commands = [installCommandOverride];
			}
		}
		if (buildCommandOverride) {
			config.steps.build = config.steps.build || {};
			config.steps.build.commands = [
				cleanSourceDir
					? `cd ${cleanSourceDir} && ${buildCommandOverride}`
					: buildCommandOverride,
			];
		}
		if (startCommandOverride) {
			config.deploy.startCommand = cleanSourceDir
				? `cd ${cleanSourceDir} && ${startCommandOverride}`
				: startCommandOverride;
		}
	}

	await Bun.write(
		configPath,
		JSON.stringify(config, null, 2),
	);
	await onLog(
		`Wrote dynamic railpack.json for caching and monorepo resolution`,
	);
};
