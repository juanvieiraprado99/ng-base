import { inject, Injectable } from "@angular/core";
import { ApiClient } from "{{API_CLIENT_IMPORT}}";

@Injectable({ providedIn: "root" })
export class {{SERVICE_CLASS_NAME}} {
  private readonly api = inject(ApiClient);
  private readonly endpoint = "/{{ENDPOINT}}";

  list<T = unknown>() {
    return this.api.get<T[]>(this.endpoint);
  }

  getById<T = unknown>(id: string | number) {
    return this.api.get<T>(`${this.endpoint}/${id}`);
  }
}
