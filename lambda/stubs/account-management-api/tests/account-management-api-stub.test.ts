import { handler, Response } from "../account-management-api-stub";

describe("handler", () => {
  test("returns status code 204", async () => {
    const result: Response = await handler();
    expect(result.statusCode).toEqual(204);
  });
});
