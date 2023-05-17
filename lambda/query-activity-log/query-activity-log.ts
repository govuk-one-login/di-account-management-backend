import { Activity } from "./models"

export const queryActivityLog 
    = async (userID: string, page: string): Promise<Activity[]> => {
        return [emptySignInActivity, singleServiceVisitedSignInActivity, 
            multipleServicesVisitedSignInActivity, truncatedSignInActivity];
};

const emptySignInActivity: Activity = {
    "timestamp": 1684144736,
    "services_visited_client_ids": [],
    "truncated": false
};

const singleServiceVisitedSignInActivity: Activity = {
    "timestamp": 1684144736,
    "services_visited_client_ids": [
        "socialWorkEngland"
    ],
    "truncated": false
};


const multipleServicesVisitedSignInActivity: Activity = {
    "timestamp": 1684144736,
    "services_visited_client_ids": [
        "gov-uk",
        "modernSlavery",
        "vehicleOperatorLicense"
    ],
    "truncated": false
};

const truncatedSignInActivity: Activity = {
    "timestamp": 1684144736,
    "services_visited_client_ids": [
        "gov-uk",
        "modernSlavery",
        "vehicleOperatorLicense",
        "local",
        "lite",
        "ofqual"
    ],
    "truncated": true
};