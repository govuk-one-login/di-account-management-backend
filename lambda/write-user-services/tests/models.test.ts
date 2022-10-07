import { isService, Service, UserServices } from "../models";

const TEST_INVALID_SERVICE = {
  client_id: "client-id",
  count_successful_logins: 1,
  last_accessed: new Date(),
};

describe("isService", () => {
  test("is true for a valid Service", () => {
    expect(
      isService({
        client_id: "client-id",
        count_successful_logins: 1,
        last_accessed: new Date(),
      })
    ).toBe(true);
  });

  test("is true for a valid Service with a unix timestamp", () => {
    expect(
      isService({
        client_id: "client-id",
        count_successful_logins: 1,
        last_accessed: "1665137847",
      })
    ).toBe(true);
  });
});
