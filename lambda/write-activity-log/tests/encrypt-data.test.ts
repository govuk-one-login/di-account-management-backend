import { checkEnvironmentVariableExists } from "../encrypt-data"

describe("checkEnvironmentVariableExists", () => {
  
  test("exists", () => {
    checkEnvironmentVariableExists("hello", "goodbye");
  });

  test("does not exist", () => {
    checkEnvironmentVariableExists("hello", undefined);
  });

});