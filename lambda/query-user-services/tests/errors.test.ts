import { getErrorMessage } from "../errors";

describe("getErrorMessage", () => {
  test("extracts the error message when passed an Error", () => {
    const testMessage = "An error message";
    expect(getErrorMessage(new Error(testMessage))).toEqual(testMessage);
  });

  test("converts to a string when not passed an Error", () => {
    const testMessage = "An error message";
    expect(getErrorMessage(testMessage)).toEqual(String(testMessage));
    expect(getErrorMessage(undefined)).toEqual(String(undefined));
  });
});
