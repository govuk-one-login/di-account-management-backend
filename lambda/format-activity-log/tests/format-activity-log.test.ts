import { formatIntoActivitLogEntry } from "../format-activity-log"
import { ActivityLogEntry } from "../models";
import { TEST_ACTIVITY_LOG_ENTRY,
    TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES,
    TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY,
    TEST_USER_ACTIVITY_SECOND_TXMA_EVENT,
    secondEventType } from "./test-helper"

describe("formatIntoActivitLogEntry", () => {

    test("txma event with no existing ActivityLogEntry", () => {
        expect(formatIntoActivitLogEntry(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY))
        .toEqual(TEST_ACTIVITY_LOG_ENTRY)
    });

    test("new txma event and existing activity log entry", () => {
        const activityLogEntry: ActivityLogEntry = formatIntoActivitLogEntry(TEST_USER_ACTIVITY_SECOND_TXMA_EVENT);
        expect(activityLogEntry)
        .toEqual(TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES)
        expect(activityLogEntry.activities[1].type).toEqual(secondEventType)
    });

});

// should we order Activities by order recieved or chronologically earliest time recieved ?
// should we update top level timestamp to match earlieast timestamp? (not just set as first event)