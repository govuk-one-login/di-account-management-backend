import { validateActivityLogEntry
    } from "../write-activity-log"
import { ACTIVITY_LOG_ENTRY_NO_TIMESTAMP,
    ACTIVITY_LOG_ENTRY_NO_USER_ID,
    TEST_ACTIVITY_LOG_ENTRY,
    ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY
} from "./test-helpers";

describe("ValidateActivityLogEntries", () => {

    test("doens't throw error with valid data", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("doens't throw error when activities in array", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("doens't throw error when activities array is absent", () => {
        expect(validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY))
    });

    test("throws an error when user_id is missing", () => {
        expect(() => {
            validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_USER_ID)
        })
            .toThrowError(
            new Error(`Could not validate activity log entry ${JSON.stringify(ACTIVITY_LOG_ENTRY_NO_USER_ID)}`)
        )
    });

    test("throws an error when timestamp is missing", () => {
        expect(() => {
            validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP)
        })
            .toThrowError(
            new Error(`Could not validate activity log entry ${JSON.stringify(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP)}`)
        )
    });

})