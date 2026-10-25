.PHONY: test

test:
	cd apps/api && bun test --timeout 15000
