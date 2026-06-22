import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useProjects } from "../hooks/useProjects";
import { useQuery } from "@tanstack/react-query";
import * as api from "../api/client";
import { parseMetrics } from "../lib/metrics";
import { Sidebar } from "./layout/Sidebar";
import { Header } from "./layout/Header";
import { NotificationBanner } from "./layout/NotificationBanner";

export function Layout({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const navigate = useNavigate();

	const { data: me, isLoading: authLoading } = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.getMe(),
		retry: false,
	});

	useEffect(() => {
		if (authLoading) return;
		if (location.pathname === "/login") {
			if (me?.authenticated) {
				navigate({ to: "/" });
			}
			return;
		}
		if (!me?.authenticated) {
			navigate({ to: "/login" });
		}
	}, [me, authLoading, location.pathname, navigate]);

	const { data: projects = [] } = useProjects();
	const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

	const { data: metricsText } = useQuery({
		queryKey: ["metrics"],
		queryFn: () => api.getMetrics(),
		refetchInterval: 15000,
	});

	const metrics = metricsText ? parseMetrics(metricsText) : null;

	const [notification, setNotification] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const ghConnected = params.get("github");
		if (ghConnected === "connected") {
			setNotification({
				type: "success",
				message: "GitHub account connected successfully",
			});
		} else if (ghConnected?.startsWith("error=")) {
			setNotification({
				type: "error",
				message: decodeURIComponent(ghConnected.replace("error=", "")),
			});
		}
		if (ghConnected) {
			const newParams = new URLSearchParams(location.search);
			newParams.delete("github");
			const qs = newParams.toString();
			navigate({
				to: location.pathname,
				search: qs ? Object.fromEntries(newParams) : {},
			} as any);
		}

		const onNotification = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			setNotification({
				type: detail.type,
				message: detail.message,
			});
		};
		window.addEventListener("opencode:notification", onNotification);
		return () =>
			window.removeEventListener("opencode:notification", onNotification);
	}, [location.search, location.pathname, navigate]);

	useEffect(() => {
		if (!notification) return;
		const t = setTimeout(() => setNotification(null), 6000);
		return () => clearTimeout(t);
	}, [notification]);

	const isLoginPage = location.pathname === "/login";

	const match = location.pathname.match(/\/project\/([^/]+)/);
	const currentProjectId = match ? match[1] : null;
	const currentProject = projects.find((p) => p.id === currentProjectId);

	if (isLoginPage) {
		return <div className="min-h-screen bg-[#070708]">{children}</div>;
	}

	return (
		<div className="flex min-h-screen bg-[#070708] text-zinc-100 font-sans antialiased">
			<Sidebar
				projects={projects}
				currentProject={currentProject}
				currentProjectId={currentProjectId}
				projectSelectorOpen={projectSelectorOpen}
				setProjectSelectorOpen={setProjectSelectorOpen}
				metrics={metrics}
				location={location}
				navigate={navigate}
			/>

			<div className="flex-1 flex flex-col min-w-0">
				<Header
					currentProject={currentProject}
					currentProjectId={currentProjectId}
					location={location}
				/>

				<NotificationBanner
					notification={notification}
					onClose={() => setNotification(null)}
				/>

				<main className="flex-1 p-8 overflow-auto">{children}</main>
			</div>
		</div>
	);
}
