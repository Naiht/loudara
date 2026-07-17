export type StreamingCredentials = {
  cookie: string;
  visitorData: string;
  poToken: string;
};

export interface StreamingCredentialsPort {
  get(): Promise<StreamingCredentials | null>;
  set(credentials: StreamingCredentials): Promise<void>;
  remove(): Promise<void>;
}
