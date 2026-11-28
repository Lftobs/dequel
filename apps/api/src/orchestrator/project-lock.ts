const locks = new Map<string, Promise<void>>();

export const acquireProjectLock = async (key: string): Promise<() => void> => {
	const previous = locks.get(key) ?? Promise.resolve();
	let release!: () => void;
	const current = new Promise<void>((resolve) => {
		release = resolve;
	});
	const chain = previous.then(() => current);
	locks.set(key, chain);
	await previous;

	let released = false;
	return () => {
		if (released) return;
		released = true;
		release();
		chain.then(() => {
			if (locks.get(key) === chain) locks.delete(key);
		});
	};
};
