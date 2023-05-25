import { formatIntoActivitLogEntry } from "../format-activity-log"
import { TEST_ACTIVITY_LOG_ENTRY, TEST_USER_ACTIVITY_LOG_NO_LOG_ENTRY } from "./test-helper"

describe("formatIntoActivitLogEntry", () => {

    test("txma event with no existing ActivityLogEntry", () => {
        expect(formatIntoActivitLogEntry(TEST_USER_ACTIVITY_LOG_NO_LOG_ENTRY))
        .toEqual(TEST_ACTIVITY_LOG_ENTRY)
    });

});