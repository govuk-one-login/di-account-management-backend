import { Activity } from "../models"
import { queryActivityLog } from "../query-activity-log"

describe("queryActivityLog", () => {

    test("Query activity log returns bootstrapped results", async () => {
        const activityLog: Activity[] = await queryActivityLog("1234", "1");
        expect(activityLog).toHaveLength(4);
    });

})