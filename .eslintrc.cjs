module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  extends: ["plugin:vue/essential", "@vue/prettier", "@vue/typescript"],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    // Required to access v-data-table scoped slots, see https://vuetifyjs.com/en/components/data-tables/#slots
    "vue/valid-v-slot": "off",
  },
  parserOptions: {
    parser: "@typescript-eslint/parser",
  },
};
