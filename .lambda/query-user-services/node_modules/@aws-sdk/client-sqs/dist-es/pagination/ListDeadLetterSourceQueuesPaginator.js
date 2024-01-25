import { ListDeadLetterSourceQueuesCommand, } from "../commands/ListDeadLetterSourceQueuesCommand";
import { SQSClient } from "../SQSClient";
const makePagedClientRequest = async (client, input, ...args) => {
    return await client.send(new ListDeadLetterSourceQueuesCommand(input), ...args);
};
export async function* paginateListDeadLetterSourceQueues(config, input, ...additionalArguments) {
    let token = config.startingToken || undefined;
    let hasNext = true;
    let page;
    while (hasNext) {
        input.NextToken = token;
        input["MaxResults"] = config.pageSize;
        if (config.client instanceof SQSClient) {
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
