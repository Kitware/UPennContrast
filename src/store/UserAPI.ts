import { RestClientInstance } from "@/girder";
import type { AxiosError } from "axios";

interface IUser {
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  admin: boolean;
}

export default class UserAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  async signUp(user: IUser): Promise<void> {
    const formData = new FormData();
    formData.append("login", user.login);
    formData.append("email", user.email);
    formData.append("firstName", user.firstName);
    formData.append("lastName", user.lastName);
    formData.append("password", user.password);
    formData.append("admin", `${user.admin}`);

    try {
      await this.client.post("user", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          accept: "application/json",
        },
      });
    } catch (unknownError: unknown) {
      // Assume this is an object that looks like an AxiosError
      const error = unknownError as Partial<AxiosError>;
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        throw new Error(error.response.data.message || "An error occurred");
      }
      if (error.request) {
        // The request was made but no response was received
        throw new Error(
          "No response received from server. Please try again later.",
        );
      }
      // Something happened in setting up the request that triggered an Error
      throw new Error("An unexpected error occurred. Please try again later.");
    }
  }
}
