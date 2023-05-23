import { validateActivityLogEntry
    } from "../write-activity-log"
import {  Activity, 
    ActivityLogEntry } from "../../shared/models";
import { TEST_ACTIVITY_LOG_ENTRY } from "./test-helpers";

describe("ValidateActivityLogEntries", () => {

    test("doens't throw error with valid data", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("doens't throw error when activities in array", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    // todo corect absent
    test("doens't throw error when activities array is absent", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("", () => {

    });

    test("throws an error when event-type is missing", () => {
        
    })

    test("throws an error when session_ID is missing", () => {
        
    })


})