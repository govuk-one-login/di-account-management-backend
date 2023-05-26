import {
  formatIntoActivitLogEntry,
  validateTxmaEventBody,
  validateUser,
  validateUserActivityLog,
} from "../format-activity-log";
import { ActivityLogEntry } from "../models";
import {
  TEST_ACTIVITY_LOG_ENTRY,
  TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES,
  TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY,
  TEST_USER_ACTIVITY_SECOND_TXMA_EVENT,
  secondEventType,
  sessionId,
  userId,
} from "./test-helper";

describe("formatIntoActivitLogEntry", () => {
  test("txma event with no existing ActivityLogEntry", () => {
    expect(
      formatIntoActivitLogEntry(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY)
    ).toEqual(TEST_ACTIVITY_LOG_ENTRY);
  });

  test("new txma event and existing activity log entry", () => {
    const activityLogEntry: ActivityLogEntry = formatIntoActivitLogEntry(
      TEST_USER_ACTIVITY_SECOND_TXMA_EVENT
    );
    expect(activityLogEntry).toEqual(
      TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES
    );
    expect(activityLogEntry.activities[1].type).toEqual(secondEventType);
  });
});

describe("validatUserActivityLog", () => {
  test("throws error when txmaEvent is missing", () => {
    const userActivityLog = JSON.parse(JSON.stringify(JSON.stringify({})));
    expect(() => {
      validateUserActivityLog(userActivityLog);
    }).toThrowError();
  });
});

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(
      validateTxmaEventBody(
        TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent
      )
    ).toBe(undefined);
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test(" throws error when user is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when user_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: { session_id: sessionId },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when session_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: { user_id: userId },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
});

describe("validateUser", () => {
  test("throws error when user is is missing", () => {
    const inValidUser = JSON.parse(JSON.stringify({}));
    expect(() => {
      validateUser(inValidUser);
    }).toThrowError();
  });
});
// should we order Activities by order recieved or chronologically earliest time recieved ?
// should we update top level timestamp to match earlieast timestamp? (not just set as first event)
