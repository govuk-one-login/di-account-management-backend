import { Paginator } from "@smithy/types";
import { ListDeadLetterSourceQueuesCommandInput, ListDeadLetterSourceQueuesCommandOutput } from "../commands/ListDeadLetterSourceQueuesCommand";
import { SQSPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare function paginateListDeadLetterSourceQueues(config: SQSPaginationConfiguration, input: ListDeadLetterSourceQueuesCommandInput, ...additionalArguments: any): Paginator<ListDeadLetterSourceQueuesCommandOutput>;
