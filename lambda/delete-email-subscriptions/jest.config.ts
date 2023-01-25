/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "babel",
  testMatch: ["**/tests/*/*.test.ts", "**/tests/*.test.ts"],
};

process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "TOKEN";
process.env.PUBLISHING_API_URL = "https://test.com";
