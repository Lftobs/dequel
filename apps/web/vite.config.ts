import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const versionPath = [path.resolve(__dirname, "VERSION"), path.resolve(__dirname, "../../VERSION")].find(fs.existsSync);
const version = process.env.DEQUEL_VERSION || (versionPath ? fs.readFileSync(versionPath, "utf-8").trim() : "0.0.0");

export default defineConfig({
	plugins: [react()],
	define: {
		__DEQUEL_VERSION__: JSON.stringify(version),
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://ec2-16-171-18-209.eu-north-1.compute.amazonaws.com",
				changeOrigin: true,
			},
			"/metrics": {
				target: "http://ec2-16-171-18-209.eu-north-1.compute.amazonaws.com",
				changeOrigin: true,
			},
		},
	},
});
