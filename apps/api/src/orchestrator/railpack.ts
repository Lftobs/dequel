import { spawn } from "node:child_process";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { dockerBin } from "../utils/docker-bin";

export interface RailpackBuildResult {
	imageTag: string;
}

const buildTimeoutMs = Number(
	process.env.RAILPACK_BUILD_TIMEOUT_MS ??
		"600000",
);

const cleanBuildkitLine = (
	raw: string,
): string => {
	const line = raw.trim();
	if (!line) return "";

	// Drop Docker layer download/upload/extract progress lines (sha256 digests with byte counts)
	if (
		/^(sha256:)?[0-9a-f]{40,}\s+[\d.]+\s*(B|KB|MB|GB)\s*\/\s*[\d.]+\s*(B|KB|MB|GB)/i.test(
			line,
		)
	)
		return "";

	// Drop resolver/registry metadata lines
	if (
		/^(resolve|resolving)\s+(docker|image)/i.test(
			line,
		)
	)
		return "";
	if (
		/^(sha256:)?[0-9a-f]{40,}\s*(done|already exists|pulling|download|extract|waiting|verifying|comparing|preparing)?$/i.test(
			line,
		)
	)
		return "";

	// Drop generic transfer/extract progress lines (e.g. "extracting sha256:...")
	if (
		/^(extracting|downloading|pushing|waiting|pulling fs layer|verifying checksum|download complete|pull complete|already exists)/i.test(
			line,
		)
	)
		return "";

	// Drop lines that are purely byte progress like "14.68MB / 48.50MB"
	if (
		/^[\d.]+\s*(B|KB|MB|GB)\s*\/\s*[\d.]+\s*(B|KB|MB|GB)\s*$/i.test(
			line,
		)
	)
		return "";

	// Strip trailing timestamps like "5.4s done" from DONE lines
	const noTime = line.replace(
		/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i,
		"",
	);
	if (!noTime) return "";

	// Strip all #N prefixes and whitespace
	const stripped = noTime
		.replace(/^#\d+\s*/i, "")
		.trim();
	if (!stripped) return "";

	// Strip trailing time from DONE lines that are still there
	const clean = stripped
		.replace(
			/\s+[\d.]+s?\s*(done|error|failed|canceled|DONE|ERROR|FAILED|CANCELED)?\s*$/i,
			"",
		)
		.trim();
	if (!clean) return "";

	// Drop pure step-header lines like "#N" alone
	if (/^#\d+$/i.test(clean)) return "";

	// Drop sha256 lines that survived earlier filters (after #N stripping)
	if (/^(sha256:)?[0-9a-f]{40,}/i.test(clean))
		return "";

	return clean;
};

export class CancelledError extends Error {
	constructor() {
		super("Deployment cancelled");
		this.name = "CancelledError";
	}
}

const spawnAsync = (
	cmd: string,
	args: string[],
	opts?: {
		env?: Record<string, string>;
		cwd?: string;
		timeoutMs?: number;
		onTimeout?: () => void;
		onLine?: (line: string) => void;
		signal?: AbortSignal;
	},
): Promise<{
	stdout: string;
	stderr: string;
	code: number;
}> => {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: opts?.env ?? process.env,
			cwd: opts?.cwd,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;

		const onAbort = () => {
			if (settled) return;
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!settled) {
					child.kill("SIGKILL");
				}
			}, 5000);
			finish(
				undefined,
				new CancelledError(),
			);
		};

		if (opts?.signal) {
			if (opts.signal.aborted) {
				onAbort();
				return;
			}
			opts.signal.addEventListener(
				"abort",
				onAbort,
				{ once: true },
			);
		}

		const timeout =
			opts?.timeoutMs && opts.timeoutMs > 0
				? setTimeout(() => {
						if (settled) return;
						opts.onTimeout?.();
						child.kill("SIGTERM");
						setTimeout(() => {
							if (!settled) {
								child.kill(
									"SIGKILL",
								);
							}
						}, 5000);
						finish(
							undefined,
							new Error(
								`${cmd} timed out after ${opts.timeoutMs}ms`,
							),
						);
					}, opts.timeoutMs)
				: null;

		const finish = (
			result?: {
				stdout: string;
				stderr: string;
				code: number;
			},
			error?: Error,
		) => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			if (opts?.signal) {
				opts.signal.removeEventListener(
					"abort",
					onAbort,
				);
			}
			if (error) {
				reject(error);
				return;
			}
			resolve(result!);
		};

		child.stdout.on("data", (chunk) => {
			const str = String(chunk);
			stdout += str;
			if (opts?.onLine) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					opts.onLine(line);
				}
			}
		});
		child.stderr.on("data", (chunk) => {
			const str = String(chunk);
			stderr += str;
			if (opts?.onLine) {
				for (const line of str
					.split("\n")
					.map((l) => l.trim())
					.filter(Boolean)) {
					opts.onLine(line);
				}
			}
		});
		child.on("error", (error) =>
			finish(undefined, error),
		);
		child.on("close", (code) => {
			if (
				opts?.timeoutMs &&
				opts.timeoutMs > 0 &&
				code === 143
			) {
				finish(
					undefined,
					new Error(
						`${cmd} timed out after ${opts.timeoutMs}ms`,
					),
				);
				return;
			}
			finish({
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				code: code ?? 1,
			});
		});
	});
};

const ensureBuilder = async (): Promise<void> => {
	const ls = await spawnAsync(dockerBin, [
		"buildx",
		"ls",
	]);
	const hasBuilder = ls.stdout.includes(
		"railpack-builder",
	);

	if (!hasBuilder) {
		await spawnAsync(dockerBin, [
			"buildx",
			"create",
			"--name",
			"railpack-builder",
			"--driver",
			"docker-container",
			"--bootstrap",
		]);
		await spawnAsync(dockerBin, [
			"buildx",
			"use",
			"railpack-builder",
		]);
	}
};

const rewriteLocalhostBinding = async (
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

const generateDynamicRailpackJson = async (
	workspace: string,
	sourceDir: string | null,
	onLog: (line: string) => Promise<void>,
): Promise<void> => {
	const cleanSourceDir = sourceDir
		? sourceDir.replace(/^\//, "")
		: "";
	const buildDir = cleanSourceDir
		? join(workspace, cleanSourceDir)
		: workspace;
	await rewriteLocalhostBinding(
		buildDir,
		onLog,
	);
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

			if (scripts.build) {
				config.steps.build = {
					commands: [
						cleanSourceDir
							? `cd ${cleanSourceDir} && ${pm} run build`
							: `${pm} run build`,
					],
				};
			}

			if (scripts.start) {
				config.deploy.startCommand =
					cleanSourceDir
						? `cd ${cleanSourceDir} && ${pm} run start`
						: `${pm} run start`;
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

	if (!configured) {
		await onLog(
			`Relying on default Railpack language auto-detection`,
		);
	}

	await Bun.write(
		configPath,
		JSON.stringify(config, null, 2),
	);
	await onLog(
		`Wrote dynamic railpack.json for caching and monorepo resolution`,
	);
};

export const buildWithRailpack = async (
	workspace: string,
	imageTag: string,
	onLog: (line: string) => Promise<void>,
	opts?: {
		cacheKey?: string;
		sourceDir?: string | null;
		signal?: AbortSignal;
	},
): Promise<RailpackBuildResult> => {
	await onLog(
		`Starting Railpack CLI build for image: ${imageTag}`,
	);

	// Ensure builder exists (persists across builds)
	await ensureBuilder();

	const cacheKey =
		opts?.cacheKey ??
		imageTag
			.split(":")[0]
			.replace(/-[0-9a-f]{8}$/i, "") // Strip unique deployment short ID suffix
			.replace(/[^a-zA-Z0-9_-]/g, "-");

	const cleanSourceDir = opts?.sourceDir
		? opts.sourceDir.replace(/^\//, "")
		: null;
	await onLog(
		`Generating dynamic railpack.json for caching and monorepo resolution...`,
	);
	await generateDynamicRailpackJson(
		workspace,
		cleanSourceDir,
		onLog,
	);

	const args = [
		"build",
		"--name",
		imageTag,
		"--progress",
		"plain",
		"--cache-key",
		cacheKey,
		"--env",
		"CARGO_HTTP_MULTIPLEXING=false",
		"--env",
		"CARGO_HTTP_TIMEOUT=120",
		"--env",
		"CARGO_NET_GIT_FETCH_WITH_CLI=true",
		"--env",
		"RUSTUP_AUTO_SELF_UPDATE=off",
		"--env",
		"NPM_CONFIG_TIMEOUT=120000",
		workspace,
	];

	const build = await spawnAsync(
		"railpack",
		args,
		{
			env: {
				...process.env,
				BUILDKIT_HOST:
					process.env.BUILDKIT_HOST,
			},
			timeoutMs:
				buildTimeoutMs > 0
					? buildTimeoutMs
					: undefined,
			onTimeout: () => {
				void onLog(
					`Railpack build timed out after ${Math.floor(buildTimeoutMs / 1000)}s`,
				);
			},
			onLine: (line) => {
				const cleaned =
					cleanBuildkitLine(line);
				if (cleaned) {
					void onLog(cleaned);
				}
			},
			signal: opts?.signal,
		},
	);

	if (build.code !== 0) {
		throw new Error(
			`railpack build failed: ${build.stderr || build.stdout}`,
		);
	}

	if (
		build.stdout.includes(
			"No start command detected",
		) ||
		build.stderr.includes(
			"No start command detected",
		)
	) {
		throw new Error(
			"Railpack build failed: No start command detected. Specify a start script in your package.json, a main field, or an index.ts/js file.",
		);
	}

	await onLog(
		`Railpack build completed: ${imageTag}`,
	);
	return { imageTag };
};
