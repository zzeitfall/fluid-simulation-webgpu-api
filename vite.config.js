import { defineConfig } from 'vite';

// Prepares public path from GitHub environment variable.
// If such variable does not exist, returns default path.
function preparePublicPath() {
    const repository = process.env.GITHUB_REPOSITORY;

    if (!repository) {
        return '/';
    }

    const repositoryName = repository.split('/').at(1);

    return `/${repositoryName}/`;
}

export default defineConfig({
    base: preparePublicPath(),
    esbuild: {
        supported: {
            'top-level-await': true,
        },
    },
});
