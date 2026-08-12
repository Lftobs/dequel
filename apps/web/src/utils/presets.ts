export interface FrameworkPreset {
  id: string;
  name: string;
  icon: string;
  projectType: 'web' | 'static';
  buildCommand: string;
  installCommand: string;
  startCommand: string;
  outputDir: string;
  defaultPort?: string;
  description: string;
  category?: 'popular' | 'frontend' | 'fullstack' | 'backend';
}

export const FRAMEWORK_PRESETS: FrameworkPreset[] = [
  {
    id: 'nextjs-web',
    name: 'Next.js',
    icon: 'nextjs',
    projectType: 'web',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'npm run start',
    outputDir: '.next',
    defaultPort: '3000',
    description: 'Full-stack Next.js application with SSR, API routes, and Server Actions.',
    category: 'popular'
  },
  {
    id: 'vite-react',
    name: 'Vite / React',
    icon: 'react',
    projectType: 'static',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: '',
    outputDir: 'dist',
    defaultPort: '5173',
    description: 'Fast React Single Page Application compiled to static assets.',
    category: 'popular'
  },
  {
    id: 'vite-vue',
    name: 'Vite / Vue',
    icon: 'vue',
    projectType: 'static',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: '',
    outputDir: 'dist',
    defaultPort: '5173',
    description: 'Vue 3 Single Page Application bundled with Vite.',
    category: 'frontend'
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    icon: 'nuxt',
    projectType: 'web',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'node .output/server/index.mjs',
    outputDir: '.output',
    defaultPort: '3000',
    description: 'Intuitive Vue Framework with Nitro server engine.',
    category: 'fullstack'
  },
  {
    id: 'astro',
    name: 'Astro',
    icon: 'astro',
    projectType: 'static',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: '',
    outputDir: 'dist',
    defaultPort: '4321',
    description: 'Content-driven website framework optimized for speed.',
    category: 'popular'
  },
  {
    id: 'angular',
    name: 'Angular',
    icon: 'angular',
    projectType: 'static',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: '',
    outputDir: 'dist',
    defaultPort: '4200',
    description: 'Enterprise TypeScript web application framework.',
    category: 'frontend'
  },
  {
    id: 'remix',
    name: 'Remix',
    icon: 'remix',
    projectType: 'web',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'npm run start',
    outputDir: 'build',
    defaultPort: '3000',
    description: 'Full stack web framework focused on web standards.',
    category: 'fullstack'
  },
  {
    id: 'sveltekit',
    name: 'Svelte / SvelteKit',
    icon: 'svelte',
    projectType: 'web',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'node build',
    outputDir: 'build',
    defaultPort: '3000',
    description: 'Cybernetically enhanced web application framework.',
    category: 'frontend'
  },
  {
    id: 'express-node',
    name: 'Express / Node.js API',
    icon: 'node',
    projectType: 'web',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
    startCommand: 'node dist/index.js',
    outputDir: 'dist',
    defaultPort: '3000',
    description: 'Node.js backend service running compiled server bundle.',
    category: 'backend'
  },
  {
    id: 'python-service',
    name: 'Python (FastAPI / Flask)',
    icon: 'python',
    projectType: 'web',
    buildCommand: 'pip install -r requirements.txt',
    installCommand: '',
    startCommand: 'uvicorn main:app --host 0.0.0.0 --port 8000',
    outputDir: '.',
    defaultPort: '8000',
    description: 'Python web service or API backend.',
    category: 'backend'
  },
  {
    id: 'go-service',
    name: 'Go Web Server',
    icon: 'go',
    projectType: 'web',
    buildCommand: 'go build -o server .',
    installCommand: '',
    startCommand: './server',
    outputDir: '.',
    defaultPort: '8080',
    description: 'High-performance Go web service.',
    category: 'backend'
  },
  {
    id: 'docker',
    name: 'Container / Dockerfile',
    icon: 'container',
    projectType: 'web',
    buildCommand: '',
    installCommand: '',
    startCommand: '',
    outputDir: '',
    description: 'Build and run using custom root Dockerfile.',
    category: 'popular'
  },
  {
    id: 'other',
    name: 'Other / Custom',
    icon: 'other',
    projectType: 'web',
    buildCommand: '',
    installCommand: '',
    startCommand: '',
    outputDir: '',
    description: 'Custom configuration for any project or build script.',
    category: 'popular'
  }
];
