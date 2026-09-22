import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { getAisStatus } from "../common/account-interventions-service-client.js";

const mockAxios = new MockAdapter(axios);

describe("account-interventions-service-client", () => {
  const baseUrl = "https://ais.example.com";
  const userId = "test-user-id-123";

  beforeEach(() => {
    mockAxios.reset();
    process.env.ACCOUNT_INTERVENTIONS_SERVICE_API_URL = baseUrl;
  });

  afterEach(() => {
    delete process.env.ACCOUNT_INTERVENTIONS_SERVICE_API_URL;
    vi.clearAllMocks();
  });

  it("should return the intervention status for a valid user", async () => {
    const mockResponse = {
      state: {
        blocked: false,
        suspended: false,
        reproveIdentity: false,
        resetPassword: false,
      },
    };

    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(200, mockResponse);

    const result = await getAisStatus(userId);

    expect(result).toEqual(mockResponse);
    expect(mockAxios.history.get.length).toBe(1);
    expect(mockAxios.history.get[0]?.url).toBe(`${baseUrl}/ais/${userId}`);
    expect(mockAxios.history.get[0]?.headers?.["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("should return the intervention status when user is blocked", async () => {
    const mockResponse = {
      state: {
        blocked: true,
        suspended: false,
        reproveIdentity: false,
        resetPassword: false,
      },
    };

    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(200, mockResponse);

    const result = await getAisStatus(userId);

    expect(result.state.blocked).toBe(true);
    expect(result.state.suspended).toBe(false);
  });

  it("should return the intervention status when user is suspended", async () => {
    const mockResponse = {
      state: {
        blocked: false,
        suspended: true,
        reproveIdentity: true,
        resetPassword: true,
      },
    };

    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(200, mockResponse);

    const result = await getAisStatus(userId);

    expect(result.state.suspended).toBe(true);
    expect(result.state.reproveIdentity).toBe(true);
    expect(result.state.resetPassword).toBe(true);
  });

  it("should throw an error when the response is invalid", async () => {
    const invalidResponse = {
      state: {
        blocked: "not-a-boolean",
      },
    };

    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(200, invalidResponse);

    await expect(getAisStatus(userId)).rejects.toThrow(
      "Invalid response from Account Interventions Service API"
    );
  });

  it("should throw an error when the response is missing required fields", async () => {
    const incompleteResponse = {
      someOtherField: "value",
    };

    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(200, incompleteResponse);

    await expect(getAisStatus(userId)).rejects.toThrow(
      "Invalid response from Account Interventions Service API"
    );
  });

  it("should throw an error when the API returns a non-2xx status", async () => {
    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(500);

    await expect(getAisStatus(userId)).rejects.toThrow();
  });

  it("should throw an error when the API returns 404", async () => {
    mockAxios.onGet(`${baseUrl}/ais/${userId}`).reply(404);

    await expect(getAisStatus(userId)).rejects.toThrow();
  });

  it("should throw an error when ACCOUNT_INTERVENTIONS_SERVICE_API_URL is not set", async () => {
    delete process.env.ACCOUNT_INTERVENTIONS_SERVICE_API_URL;

    await expect(getAisStatus(userId)).rejects.toThrow(
      'Environment variable "ACCOUNT_INTERVENTIONS_SERVICE_API_URL" is not set.'
    );
  });
});
