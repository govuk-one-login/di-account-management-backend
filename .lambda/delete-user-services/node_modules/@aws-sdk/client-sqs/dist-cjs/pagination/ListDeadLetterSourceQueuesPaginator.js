"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginateListDeadLetterSourceQueues = void 0;
const ListDeadLetterSourceQueuesCommand_1 = require("../commands/ListDeadLetterSourceQueuesCommand");
const SQSClient_1 = require("../SQSClient");
const makePagedClientRequest = async (client, input, ...args) => {
    return await client.send(new ListDeadLetterSourceQueuesCommand_1.ListDeadLetterSourceQueuesCommand(input), ...args);
};
async function* paginateListDeadLetterSourceQueues(config, input, ...additionalArguments) {
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
exports.paginateListDeadLetterSourceQueues = paginateListDeadLetterSourceQueues;
