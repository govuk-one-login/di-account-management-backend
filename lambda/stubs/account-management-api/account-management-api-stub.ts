export interface Response {
  statusCode: number;
}

export const handler = async () => {
  return {
    statusCode: 204,
  };
};
