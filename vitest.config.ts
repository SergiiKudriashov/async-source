import { defineConfig } from "vitest/config";

export default () => {
    return defineConfig({
        test: {
            globals: true,
            include: ['**/*.test.ts'],
            cache: false,
            coverage: {
                include: ['src/*.ts']
            },
            environment: 'jsdom', 
        }
    })
}