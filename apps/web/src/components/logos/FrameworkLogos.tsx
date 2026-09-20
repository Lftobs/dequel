import type React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
	className?: string;
	size?: number;
}

export function NextjsLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 180 180" fill="currentColor" className={className} width={size} height={size} {...props}>
			<mask id="nextjs-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
				<circle cx="90" cy="90" r="90" fill="#fff" />
			</mask>
			<g mask="url(#nextjs-mask)">
				<circle cx="90" cy="90" r="90" fill="#000" />
				<path
					d="M149.508 157.52L69.142 54H54v71.97h12.378V71.722l69.838 90.158c4.61-1.393 9.048-3.195 13.292-5.36z"
					fill="url(#nextjs-grad1)"
				/>
				<rect x="115" y="54" width="12" height="72" fill="url(#nextjs-grad2)" />
			</g>
			<defs>
				<linearGradient id="nextjs-grad1" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
					<stop stopColor="#fff" />
					<stop offset="1" stopColor="#fff" stopOpacity="0" />
				</linearGradient>
				<linearGradient id="nextjs-grad2" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
					<stop stopColor="#fff" />
					<stop offset="1" stopColor="#fff" stopOpacity="0" />
				</linearGradient>
			</defs>
		</svg>
	);
}

export function ReactLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="-11.5 -10.23174 23 20.46348" fill="none" className={className} width={size} height={size} {...props}>
			<circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
			<g stroke="#61DAFB" strokeWidth="1" fill="none">
				<ellipse rx="11" ry="4.2" />
				<ellipse rx="11" ry="4.2" transform="rotate(60)" />
				<ellipse rx="11" ry="4.2" transform="rotate(120)" />
			</g>
		</svg>
	);
}

export function ViteLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 256 257" className={className} width={size} height={size} {...props}>
			<defs>
				<linearGradient id="viteGrad1" x1="-8.5" y1="0" x2="242.9" y2="349.5" gradientUnits="userSpaceOnUse">
					<stop offset="0%" stopColor="#41D1FF" />
					<stop offset="100%" stopColor="#BD34FE" />
				</linearGradient>
				<linearGradient id="viteGrad2" x1="24" y1="0" x2="137.4" y2="283.6" gradientUnits="userSpaceOnUse">
					<stop offset="0%" stopColor="#FFEA83" />
					<stop offset="8%" stopColor="#FFDD35" />
					<stop offset="100%" stopColor="#FFA800" />
				</linearGradient>
			</defs>
			<path
				fill="url(#viteGrad1)"
				d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.744-4.811 1.371-10.646 6.827-9.67l120.385 21.517a6.54 6.54 0 002.322 0l117.867-21.5c5.449-.994 9.582 4.816 6.877 9.633z"
			/>
			<path
				fill="url(#viteGrad2)"
				d="M185.432.106L119.88 124.763a3.27 3.27 0 01-5.834.116L78.694 56.402a3.27 3.27 0 00-4.348-1.579l-49.8 23.368a3.27 3.27 0 00-1.42 4.417l77.7 159.227c1.614 3.308 6.304 3.27 7.862-.068l33.64-71.993 49.034-165.73C192.179 1.139 188.08-.941 185.432.106z"
			/>
		</svg>
	);
}

export function VueLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 261.76 226.69" className={className} width={size} height={size} {...props}>
			<path fill="#41B883" d="M161.096.001l-30.225 52.351L100.647.001H-.005l130.877 226.688L261.749.001z" />
			<path fill="#34495E" d="M161.096.001l-30.225 52.351L100.647.001H52.346l78.526 136.01L209.398.001z" />
		</svg>
	);
}

export function NuxtLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 256 181" className={className} width={size} height={size} {...props}>
			<path
				fill="#00DC82"
				d="M152.6 17.6c-4.3-7.5-15.1-7.5-19.4 0L77.9 113.3c-4.4 7.6 1.1 17.1 9.9 17.1h39.8l-15.1 26.2c-4.3 7.5 1.1 17.1 9.9 17.1h98.8c8.8 0 14.2-9.6 9.8-17.2L152.6 17.6z"
			/>
			<path
				fill="#00C58E"
				d="M89.7 127.1c-4.3-7.5 1.1-17.1 9.8-17.1h86.7c8.8 0 14.2 9.6 9.8 17.1l-25.2 43.7c-4.3 7.5-15.1 7.5-19.4 0L89.7 127.1z"
			/>
			<path
				fill="#00DC82"
				d="M9.8 156.6C1 156.6-4.4 147 0 139.5L80.3 0c4.3-7.5 15.1-7.5 19.4 0l42.3 73.2c4.4 7.6-1.1 17.1-9.9 17.1H53.5L9.8 156.6z"
			/>
		</svg>
	);
}

export function AstroLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 256 366" className={className} width={size} height={size} {...props}>
			<path
				fill="#FF5D01"
				d="M119.5 2.1C123.6-1 129.4-1 133.5 2.1L248 89.2c7.2 5.5 8.7 15.7 3.2 22.9l-8.6 11.3c-5.5 7.2-15.7 8.7-22.9 3.2l-91.2-69.4L37.3 126.6c-7.2 5.5-17.4 4-22.9-3.2L5.8 112.1c-5.5-7.2-4-17.4 3.2-22.9L119.5 2.1z"
			/>
			<path
				fill="#FFFFFF"
				d="M126.5 75.6L36.3 361.4c-2.3 7.3 3.1 14.7 10.8 14.7h46.2c4.9 0 9.2-3.1 10.7-7.8l22.5-72h42.9l22.5 72c1.5 4.7 5.8 7.8 10.7 7.8h46.2c7.7 0 13.1-7.4 10.8-14.7L169.5 75.6c-2.4-7.6-10.6-12.7-18.6-11.4-8.8 1.4-16.7 6.4-24.4 11.4zM137 218h18l-9-33-9 33z"
			/>
		</svg>
	);
}

export function AngularLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 250 250" className={className} width={size} height={size} {...props}>
			<polygon
				fill="#DD0031"
				points="125,30 125,30 125,30 31.9,63.2 46.1,186.3 125,230 125,230 125,230 203.9,186.3 218.1,63.2"
			/>
			<polygon fill="#C3002F" points="125,30 125,52.2 125,52.1 125,153.4 125,153.4 125,230 203.9,186.3 218.1,63.2" />
			<path
				fill="#FFFFFF"
				d="M125,52.1L66.8,182.6h21.7l11.7-29.2h49.4l11.7,29.2h21.7L125,52.1z M125,92l17.7,44.2h-35.4L125,92z"
			/>
		</svg>
	);
}

export function NodeLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 256 288" className={className} width={size} height={size} {...props}>
			<path
				fill="#5FA04E"
				d="M128 0L9 68.7v150.6L128 288l119-68.7V68.7L128 0zm-14.7 186.9c-24 0-36.2-11.7-36.2-34.9V135h20.6v17c0 12.8 5.7 18.7 15.6 18.7 9.1 0 14.7-4.6 14.7-12.8 0-6.8-4-10.5-17.7-14.5l-6.8-2c-19.1-5.4-27.9-14.2-27.9-30.8 0-19.7 15.4-32.5 37.9-32.5 24 0 35.1 11.7 35.1 34.3v14.5H128V112c0-11.7-5.1-17.4-14.8-17.4-8.3 0-13.4 4.8-13.4 11.9 0 6 3.7 9.7 16.2 13.4l6.8 2c19.7 5.7 29.4 14.2 29.4 31.4.1 20.2-14.2 33.6-38.9 33.6z"
			/>
		</svg>
	);
}

export function RemixLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 100 100" className={className} width={size} height={size} {...props}>
			<rect width="100" height="100" rx="20" fill="#121215" />
			<path
				d="M22 30h32a18 18 0 0118 18c0 7.8-5 14.4-12 16.8L72 80H54L42 66H36v14H22V30zm14 14v10h16a5 5 0 100-10H36z"
				fill="#E8F1F5"
			/>
			<circle cx="75" cy="30" r="6" fill="#38BDF8" />
		</svg>
	);
}

export function SvelteLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 500 500" className={className} width={size} height={size} {...props}>
			<path
				fill="#FF3E00"
				d="M407.5 125.8c-27.3-36.8-71.1-53.1-118-43.6l-97.7 20c-26 5.3-48.4 20-61.4 40.5-15.6 24.6-17.3 56.4-4.5 83.2 9.6 20.1 26 35.3 46.9 43.1l-10.7 2.2c-27.3 5.6-50.6 20.8-63.7 41.7-15.6 24.9-17.3 56.7-4.5 83.5 16 33.6 48.7 56.4 87.1 60.9 9.8 1.1 19.8.9 29.8-1.1l97.7-20c26-5.3 48.4-20 61.4-40.5 15.6-24.6 17.3-56.4 4.5-83.2-9.6-20.1-26-35.3-46.9-43.1l10.7-2.2c27.3-5.6 50.6-20.8 63.7-41.7 15.7-25 17.3-56.8 4.6-83.6-3.8-8-8.9-15.4-15-22.1z"
			/>
		</svg>
	);
}

export function PythonLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 110 110" className={className} width={size} height={size} {...props}>
			<path
				fill="#3776AB"
				d="M54.2 1.5c-27 0-25.3 11.7-25.3 11.7l.1 12.1h25.7v3.6H19.2S1 26.3 1 54.3c0 27.9 15.9 26.9 15.9 26.9h9.5v-13.4s-.5-15.9 15.7-15.9h27.1s15.2.2 15.2-14.7V13.2S106.9 1.5 54.2 1.5zm-14 8.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6z"
			/>
			<path
				fill="#FFD43B"
				d="M55.8 108.5c27 0 25.3-11.7 25.3-11.7l-.1-12.1H55.3v-3.6h35.5s18.2 2.6 18.2-25.4c0-27.9-15.9-26.9-15.9-26.9h-9.5v13.4s.5 15.9-15.7 15.9H40.7s-15.2-.2-15.2 14.7v23.9s-2.5 11.7 50.3 11.7zm14-8.2a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6z"
			/>
		</svg>
	);
}

export function GoLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 256 94" className={className} width={size} height={size} {...props}>
			<path
				fill="#00ADD8"
				d="M37.6 37.1c-1.6.4-3.1 1-4.4 1.8-1.5.9-2.9 2-4 3.4-1.2 1.4-2.1 3-2.7 4.8-.6 1.8-.9 3.7-.9 5.8 0 2.2.3 4.2.9 6 .6 1.8 1.5 3.3 2.7 4.7 1.1 1.4 2.5 2.5 4 3.4 1.4.8 2.9 1.4 4.4 1.8v-32zm82.8 0c-1.6.4-3.1 1-4.4 1.8-1.5.9-2.9 2-4 3.4-1.2 1.4-2.1 3-2.7 4.8-.6 1.8-.9 3.7-.9 5.8 0 2.2.3 4.2.9 6 .6 1.8 1.5 3.3 2.7 4.7 1.1 1.4 2.5 2.5 4 3.4 1.4.8 2.9 1.4 4.4 1.8v-32zM80.1 27.5c-4.9 0-9.6.9-14 2.6-4.4 1.7-8.3 4.1-11.6 7.2-3.3 3.1-6 6.8-8 11.1-2 4.3-3 9-3 14.1 0 5.1 1 9.8 3 14.1 2 4.3 4.7 8 8 11.1 3.3 3.1 7.2 5.5 11.6 7.2 4.4 1.7 9.1 2.6 14 2.6 5.8 0 11.1-1.2 16-3.7 4.9-2.5 9-6 12.3-10.4l-11.2-9.4c-2.1 2.7-4.7 4.8-7.7 6.3-3 1.5-6.2 2.3-9.5 2.3-3.1 0-6.1-.6-8.9-1.8-2.8-1.2-5.2-2.8-7.2-4.9-2-2.1-3.6-4.6-4.8-7.5-1.1-2.9-1.7-6-1.7-9.3s.6-6.4 1.7-9.3c1.1-2.9 2.7-5.4 4.8-7.5 2-2.1 4.4-3.7 7.2-4.9 2.8-1.2 5.8-1.8 8.9-1.8 3.3 0 6.5.8 9.5 2.3 3 1.5 5.6 3.6 7.7 6.3l11.2-9.4c-3.3-4.4-7.4-7.9-12.3-10.4-4.9-2.5-10.2-3.7-16-3.7z"
			/>
		</svg>
	);
}

export function DockerLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} width={size} height={size} {...props}>
			<path
				fill="#2496ED"
				d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.954-5.43h2.118a.185.185 0 00.186-.186V3.575a.185.185 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm0 5.43h2.118a.185.185 0 00.186-.185V9.006a.185.185 0 00-.186-.186h-2.118a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.954 0h2.119a.186.186 0 00.185-.185V9.006a.185.185 0 00-.185-.186H8.075a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm0-2.715h2.119a.186.186 0 00.185-.186V6.291a.186.186 0 00-.185-.185H8.075a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.955 2.715h2.119a.186.186 0 00.185-.185V9.006a.186.186 0 00-.185-.186H5.12a.185.185 0 00-.185.186v1.887c0 .102.084.185.185.185zm-2.954 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.166a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm5.909-2.715h2.119a.186.186 0 00.185-.186V6.291a.186.186 0 00-.185-.185H8.075a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.955 0h2.119a.186.186 0 00.185-.186V6.291a.186.186 0 00-.185-.185H5.12a.185.185 0 00-.185.185v1.887c0 .102.084.186.185.186zM23.763 9.89c-.065-.051-.672-.51-1.954-.51-1.748 0-2.85 1.01-3.64 1.776-.554.537-1.127.876-1.597.876-.445 0-.904-.265-1.503-.865l-.366-.366a5.539 5.539 0 00-3.92-1.624h-.103C9.07 9.177 4.954 12.392 4.14 16.59c-.482 2.484.218 4.887 1.918 6.591C7.625 24.75 9.832 25.5 12.28 25.5c7.094 0 11.442-4.108 11.483-4.15a.75.75 0 00.237-.542V10.3c0-.185-.098-.35-.237-.41z"
			/>
		</svg>
	);
}

export function OtherLogo({ className = "h-4 w-4", size, ...props }: LogoProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			width={size}
			height={size}
			{...props}
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	);
}

export function getFrameworkLogo(icon: string, className = "h-4 w-4"): React.ReactNode {
	const iconLower = icon.toLowerCase();
	if (iconLower.includes("next")) return <NextjsLogo className={className} />;
	if (iconLower.includes("react")) return <ReactLogo className={className} />;
	if (iconLower.includes("vite")) return <ViteLogo className={className} />;
	if (iconLower.includes("vue")) return <VueLogo className={className} />;
	if (iconLower.includes("nuxt")) return <NuxtLogo className={className} />;
	if (iconLower.includes("astro")) return <AstroLogo className={className} />;
	if (iconLower.includes("angular")) return <AngularLogo className={className} />;
	if (iconLower.includes("remix")) return <RemixLogo className={className} />;
	if (iconLower.includes("svelte")) return <SvelteLogo className={className} />;
	if (iconLower.includes("node") || iconLower.includes("express")) return <NodeLogo className={className} />;
	if (iconLower.includes("python") || iconLower.includes("django") || iconLower.includes("fastapi"))
		return <PythonLogo className={className} />;
	if (iconLower.includes("go") || iconLower.includes("golang")) return <GoLogo className={className} />;
	if (iconLower.includes("container") || iconLower.includes("docker")) return <DockerLogo className={className} />;
	return <OtherLogo className={className} />;
}
