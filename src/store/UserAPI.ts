import { RestClientInstance } from "@/girder";
import { AxiosResponse } from "axios";

interface IUser {
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  admin: boolean;
}

interface UserAPIResponse {
  success: boolean;
  message: string;
  field?: string;
  type?: string;
}

function toUserResponse(response: AxiosResponse): UserAPIResponse {
  if (response.status === 200) {
    return {
      success: true,
      message: "User created successfully.",
    };
  } else if (response.status === 400) {
    const data = response.data;
    return {
      success: false,
      message: data.message || "An error occurred",
      field: data.field,
      type: data.type,
    };
  }

  // Fallback for unexpected responses
  return {
    success: false,
    message: "An unexpected error occurred.",
  };
}

export default class UserAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  async signUp(user: IUser): Promise<UserAPIResponse> {
    const formData = new FormData();
    formData.append("login", user.login);
    formData.append("email", user.email);
    formData.append("firstName", user.firstName);
    formData.append("lastName", user.lastName);
    formData.append("password", user.password);
    formData.append("admin", "false");

    try {
      const response = await this.client.post("user", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          accept: "application/json",
        },
      });

      return toUserResponse(response);
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        return toUserResponse(error.response);
      } else if (error.request) {
        // The request was made but no response was received
        return {
          success: false,
          message: "No response received from server. Please try again later.",
          type: "network_error",
        };
      } else {
        // Something happened in setting up the request that triggered an Error
        return {
          success: false,
          message: "An unexpected error occurred. Please try again later.",
          type: "unexpected_error",
        };
      }
    }
  }
}
