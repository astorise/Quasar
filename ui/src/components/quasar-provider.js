export class QuasarProvider extends HTMLElement {
  connectedCallback() {
    this.endpoint = this.getAttribute("endpoint") ?? "/api/query";
    this.clientId = this.getAttribute("client_id") ?? this.getAttribute("client-id");
    this.authority = this.getAttribute("authority");
    this.tokenKey = `quasar:${this.clientId ?? "anonymous"}:token`;
    this.refreshTimer = null;
    this.scheduleSilentRefresh();
  }

  disconnectedCallback() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  get token() {
    return sessionStorage.getItem(this.tokenKey);
  }

  set token(value) {
    if (value) {
      sessionStorage.setItem(this.tokenKey, value);
      this.scheduleSilentRefresh();
    } else {
      sessionStorage.removeItem(this.tokenKey);
    }
  }

  async refreshToken() {
    if (!this.authority || !this.clientId) {
      return this.token;
    }

    const response = await fetch(`${this.authority.replace(/\/$/, "")}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        grant_type: "refresh_token",
      }),
    });

    if (response.ok) {
      const body = await response.json();
      this.token = body.access_token;
    }

    return this.token;
  }

  scheduleSilentRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch(() => {});
    }, 14 * 60 * 1000);
  }

  async query(metric) {
    const headers = { "content-type": "application/json" };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ metric }),
    });

    if (!response.ok) {
      const error = new Error(`Query failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }
}

customElements.define("quasar-provider", QuasarProvider);
