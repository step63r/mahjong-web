import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // 対象外ファイル
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "**/*.mjs"],
  },
  // JavaScript 推奨ルール
  js.configs.recommended,
  // TypeScript 推奨ルール
  ...tseslint.configs.recommended,
  // Prettier との競合を無効化
  eslintConfigPrettier,
  // プロジェクト固有の設定
  {
    rules: {
      // 使用されていない変数は _ プレフィクスで許容
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
