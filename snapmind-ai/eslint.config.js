import js from "@eslint/js";
export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                setTimeout: "readonly",
                clearInterval: "readonly",
                setInterval: "readonly",
                Buffer: "readonly",
                URL: "readonly"
            }
        },
        rules: {
            "no-undef": "error"
        }
    }
];
