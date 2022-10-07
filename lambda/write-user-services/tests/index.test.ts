import { writeEvent } from "../index";
import { UserServices } from "../models";

const TEST_USER_SERVICES: UserServices = {
  user_id: "user-id",
  services: [
    {
      client_id: "client_id",
      last_accessed: new Date(),
      count_successful_logins: 1,
    },
  ],
};

test("it logs to the console", () => {
  const consoleLogMock = jest.spyOn(console, "log").mockImplementation();
  writeEvent(TEST_USER_SERVICES);
  expect(consoleLogMock).toHaveBeenCalledTimes(1);
  consoleLogMock.mockRestore();
});
