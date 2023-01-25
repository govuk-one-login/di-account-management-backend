export const TEST_USER_DATA = {
  user_id: "user-id",
  access_token: "access_token",
  email: "email",
  source_ip: "source_ip",
  persistent_session_id: "persistent_session_id",
  session_id: "session_id",
  public_subject_id: "public_subject_id",
  legacy_subject_id: "legacy_subject_id",
};

export const TEST_STEP_FUNCTION_EVENT = {
  SNSMessage: TEST_USER_DATA,
  FunctionName: "delete-one-login-account",
};
