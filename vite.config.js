import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        {
            name: 'activa360-validacion-controlada',
            transformIndexHtml(html) {
                return html.replace(
                    '<form id="financingForm"',
                    '<form id="financingForm" novalidate'
                );
            },
        },
    ],
});
