// import axios from 'axios';
// import {
//   handler,
//   validateSNSMessage,
//   sendRequest,
// } from "../delete-account-auth";
//
// import { TEST_SNS_MESSAGE_CONTENT, TEST_SNS_EVENT } from "./test-helpers";
//
// jest.mock("axios");
// const mockedAxios = axios as jest.Mocked<typeof axios>;
//
//
// describe("handler", () => {
//   afterEach(() => {
//     jest.clearAllMocks();
//   });
//
//   test("it iterates over each record in the batch", async () => {
//     jest.spyOn(validateSNSMessage)
//     await handler(TEST_SNS_EVENT);
//     expect(validateSNSMessage).toHaveBeenCalledTimes(2);
//   });
// });

//   describe("error handling", () => {
//     let consoleErrorMock: jest.SpyInstance;
//
//     beforeEach(() => {
//       consoleErrorMock = jest
//         .spyOn(global.console, "error")
//         .mockImplementation();
//       dynamoMock.rejectsOnce("mock error");
//     });
//
//     afterEach(() => {
//       consoleErrorMock.mockRestore();
//     });
//
//     test("logs the error message", async () => {
//       await handler(TEST_SNS_EVENT);
//       expect(consoleErrorMock).toHaveBeenCalledTimes(1);
//     });
//
//     test("sends the event to the dead letter queue", async () => {
//       await handler(TEST_SNS_EVENT);
//       expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
//     });
//   });
// });
//
// describe("validateUserData", () => {
//   test("doesn't throw an error with valid data", () => {
//     expect(validateUserData(TEST_USER_DATA)).toBe(TEST_USER_DATA);
//   });
//
//   describe("throws an error", () => {
//     test("when user_id is missing", () => {
//       const userData = JSON.parse(
//         JSON.stringify({
//           foo: "bar",
//         })
//       );
//       expect(() => {
//         validateUserData(userData);
//       }).toThrowError();
//     });
//   });
// });