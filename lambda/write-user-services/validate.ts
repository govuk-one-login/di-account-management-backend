import { ValidationError } from "./errors";
import { Service, UserServices } from "./models";

export const validateUserServices = (userServices: UserServices): void => {
  if (userServices.user_id != undefined && userServices.services != undefined) {
    validateServices(userServices.services);
  } else {
    throw new ValidationError(
      `Could not validate UserServices ${userServices}`
    );
  }
};

export const validateServices = (services: Service[]): void => {
  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    if (
      service.client_id != undefined &&
      service.count_successful_logins &&
      service.count_successful_logins >= 0 &&
      service.last_accessed != undefined
    ) {
    } else {
      throw new ValidationError(`Could not validate Service ${service}`);
    }
  }
};
