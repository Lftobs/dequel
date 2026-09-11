import type React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
	className?: string;
	size?: number;
}

export function PostgresLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path
				fill="#336791"
				d="M64 4c-32.9 0-59.5 25.8-59.9 58.3.4 31.9 25.7 57.6 57.8 58.3h2.1c32.9 0 59.5-25.8 59.9-58.3-.4-31.9-25.7-57.6-57.8-58.3H64z"
			/>
			<path
				fill="#FFFFFF"
				d="M66.4 22.4c-12.8 0-21.7 8.2-22.5 19.8h-3.4c-6.8 0-11.2 4.4-11.2 10.9 0 5.4 3.1 9.4 8.2 10.5v15.3c0 8 5.7 13.9 14.1 14.2h.5c6.2 0 11.2-3.8 13-9.5 1.8 5.7 6.8 9.5 13 9.5h.5c8.4-.3 14.1-6.2 14.1-14.2V63.6c5.1-1.1 8.2-5.1 8.2-10.5 0-6.5-4.4-10.9-11.2-10.9h-3.4c-.8-11.6-9.7-19.8-22.5-19.8zM47.7 53.1h18.7v18.7H50.8c-1.8 0-3.1-1.3-3.1-3.1V53.1zm32.6 15.6c0 1.8-1.3 3.1-3.1 3.1H61.6V53.1h18.7v15.6z"
			/>
		</svg>
	);
}

export function MySQLLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#00618A" d="M64 4C30.9 4 4 30.9 4 64s26.9 60 60 60 60-26.9 60-60S97.1 4 64 4z" />
			<path
				fill="#F29111"
				d="M87.8 45.4c-4.2 0-7.8 2.2-9.7 5.5-2.6-3.8-6.9-6.3-11.9-6.3-7.9 0-14.3 6.4-14.3 14.3v27.2h8.7V58.9c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6v27.2h8.7V58.9c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6v27.2h8.7V59.7c0-7.9-6.4-14.3-12.6-14.3z"
			/>
			<path fill="#FFFFFF" d="M33 45h8.7v41.1H33z" />
		</svg>
	);
}

export function RedisLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#D82C20" d="M64 4C30.9 4 4 30.9 4 64s26.9 60 60 60 60-26.9 60-60S97.1 4 64 4z" />
			<path fill="#FFFFFF" d="M32 40h64v12H32zm8 20h48v12H40zm8 20h32v12H48z" />
			<circle cx="80" cy="86" r="4" fill="#FFFFFF" />
			<circle cx="48" cy="46" r="4" fill="#D82C20" />
		</svg>
	);
}

export function MongoLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#13AA52" d="M64 4C30.9 4 4 30.9 4 64s26.9 60 60 60 60-26.9 60-60S97.1 4 64 4z" />
			<path
				fill="#FFFFFF"
				d="M64 22c-1.3 0-2.4 1.1-2.4 2.4v10.3c-13.4 3.7-23.2 16-23.2 30.7 0 15 10.3 27.6 24.3 30.8v7.4c0 1.3 1.1 2.4 2.4 2.4s2.4-1.1 2.4-2.4v-7.4c14-3.2 24.3-15.8 24.3-30.8 0-14.7-9.8-27-23.2-30.7V24.4c.1-1.3-1-2.4-2.4-2.4zm-1.1 20.4v40.7c-9.6-2.5-16.7-11.2-16.7-21.5 0-10.4 7.1-19.1 16.7-21.6zm4.7 0c9.6 2.5 16.7 11.2 16.7 21.5 0 10.4-7.1 19.1-16.7 21.5V42.4z"
			/>
		</svg>
	);
}

export function MariaDBLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#003545" d="M64 4C30.9 4 4 30.9 4 64s26.9 60 60 60 60-26.9 60-60S97.1 4 64 4z" />
			<path fill="#C49A45" d="M40 85V43h12l12 25 12-25h12v42h-10V58L64 80 50 58v27H40z" />
		</svg>
	);
}

export function ClickHouseLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#FFCC00" d="M16 20h16v88H16zM40 20h16v88H40zM64 20h16v88H64zM88 20h16v88H88z" />
			<path fill="#FF3333" d="M112 20h16v88h-16z" />
		</svg>
	);
}

export function SQLiteLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 128 128" className={className} width={size} height={size} {...props}>
			<path fill="#003B57" d="M64 4C30.9 4 4 30.9 4 64s26.9 60 60 60 60-26.9 60-60S97.1 4 64 4z" />
			<path fill="#00ADEF" d="M36 44h56v12H36zm0 20h56v12H36zm0 20h40v12H36z" />
		</svg>
	);
}

export function getDatabaseLogo(engine: string, className = "h-4 w-4"): React.ReactNode {
	const engineLower = engine.toLowerCase();
	if (engineLower.includes("postgre") || engineLower.includes("postgres") || engineLower === "pg") {
		return <PostgresLogo className={className} />;
	}
	if (engineLower.includes("mysql")) {
		return <MySQLLogo className={className} />;
	}
	if (engineLower.includes("redis") || engineLower.includes("valkey")) {
		return <RedisLogo className={className} />;
	}
	if (engineLower.includes("mongo")) {
		return <MongoLogo className={className} />;
	}
	if (engineLower.includes("maria")) {
		return <MariaDBLogo className={className} />;
	}
	if (engineLower.includes("clickhouse")) {
		return <ClickHouseLogo className={className} />;
	}
	if (engineLower.includes("sqlite") || engineLower.includes("libsql")) {
		return <SQLiteLogo className={className} />;
	}
	return <PostgresLogo className={className} />;
}
