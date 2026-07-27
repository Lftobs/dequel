const BUILD_SAFE_PREFIXES = [
	"NEXT_PUBLIC_",
	"VITE_",
	"REACT_APP_",
	"NUXT_PUBLIC_",
	"NUXT_ENV_",
	"GATSBY_",
	"PUBLIC_",
	"STORYBOOK_",
];

const BUILD_SAFE_EXACT = new Set([
	"NODE_ENV",
	"NODE_OPTIONS",
	"NPM_CONFIG_PRODUCTION",
	"GENERATE_SOURCEMAP",
	"INLINE_RUNTIME_CHUNK",
	"CI",
	"BUILD_PATH",
	"DISABLE_ESLINT_PLUGIN",
	"TSC_COMPILE_ON_ERROR",
	"IMAGE_INLINE_SIZE_LIMIT",
	"FAST_REFRESH",
	"ESLINT_NO_DEV_ERRORS",
	"TAILWIND_MODE",
	"ANALYZE",
	"SENTRY_DSN",
	"SENTRY_AUTH_TOKEN",
]);

export const isBuildSafeEnv = (key: string): boolean => {
	if (BUILD_SAFE_EXACT.has(key)) return true;
	return BUILD_SAFE_PREFIXES.some((prefix) =>
		key.startsWith(prefix),
	);
};

export const filterBuildEnvVars = (
	vars: { key: string; value: string }[],
): { key: string; value: string }[] => {
	return vars.filter((v) => isBuildSafeEnv(v.key));
};
