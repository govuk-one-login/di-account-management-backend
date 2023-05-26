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
