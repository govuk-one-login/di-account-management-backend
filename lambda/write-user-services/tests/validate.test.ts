import { parseRecordBody } from "../index";
import { ValidationError } from "../errors";
import { Service, UserServices } from "../models";
import { validateServices, validateUserServices } from "../validate";

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

describe("validateUserServices", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserServices(TEST_USER_SERVICES)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when user_id is missing", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          services: [
            {
              client_id: "client_id",
              last_accessed: new Date(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });

    test("when services is missing", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          user_id: "user-id",
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });

    test("when services is invalid", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          user_id: "user-id",
          services: [
            {
              last_accessed: new Date(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });
  });
});

describe("validateServices", () => {
  const parseServices = (service: any) => {
    return JSON.parse(service) as Service[];
  };

  test("doesn't throw an error with valid data", () => {
    const services = parseServices(
      JSON.stringify([
        {
          client_id: "client_id",
          last_accessed: new Date(),
          count_successful_logins: 1,
        },
      ])
    );
    expect(validateServices(services)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when client_id is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            last_accessed: new Date(),
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when last_accessed is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when count_successful_logins is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date(),
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when count_successful_logins less than 0", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date(),
            count_successful_logins: -1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });
  });
});
