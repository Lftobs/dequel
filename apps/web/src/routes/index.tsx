import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { Layout } from '../components/Layout';
import { Dashboard } from './Dashboard';
import { Login } from './Login';
import { Settings } from './Settings';
import { ProjectDetail } from './ProjectDetail';

const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
});

const ProjectPage = () => {
  const { projectId } = projectRoute.useParams();
  return <ProjectDetail projectId={projectId} />;
};

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/project/$projectId',
  component: ProjectPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || 'deployments',
  }),
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, settingsRoute, projectRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
