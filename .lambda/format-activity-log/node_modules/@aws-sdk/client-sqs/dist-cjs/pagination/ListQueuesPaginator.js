"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginateListQueues = void 0;
const ListQueuesCommand_1 = require("../commands/ListQueuesCommand");
const SQSClient_1 = require("../SQSClient");
const makePagedClientRequest = async (client, input, ...args) => {
    return await client.send(new ListQueuesCommand_1.ListQueuesCommand(input), ...args);
};
async function* paginateListQueues(config, input, ...additionalArguments) {
    let token = config.startingToken || undefined;
    let hasNext = true;
    let page;
    while (hasNext) {
        input.NextToken = token;
        input["MaxResults"] = config.pageSize;
        if (config.client instanceof SQSClient_1.SQSClient) {
            page = await makePagedClientRequest(config.client, input, ...additionalArguments);
        }
        else {
            throw new Error("Invalid client, expected SQS | SQSClient");
        }
        yield page;
        const prevToken = token;
        token = page.NextToken;
        hasNext = !!(token && (!config.stopOnSameToken || token !== prevToken));
    }
    return undefined;
}
exports.paginateListQueues = paginateListQueues;
