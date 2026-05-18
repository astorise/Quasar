export class QuasarProvider extends HTMLElement {
  connectedCallback() {
    this.endpoint = this.getAttribute("endpoint") ?? "/api/query";
    this.viewEndpoint = this.getAttribute("view-endpoint") ?? "/api/views";
    this.manifestUrl = this.getAttribute("manifest");
    this.clientId = this.getAttribute("client_id") ?? this.getAttribute("client-id");
    this.authority = this.getAttribute("authority");
    this.tokenKey = `quasar:${this.clientId ?? "anonymous"}:token`;
    this.widgets = new Map();
    this.dashboard = null;
    this.refreshTimer = null;
    this.pollTimer = null;
    this.scheduleSilentRefresh();
    this.loadDashboard().catch((error) => this.renderProviderError(error));
  }

  disconnectedCallback() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
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

  registerWidget(widget) {
    this.widgets.set(widget.widgetId, widget);
  }

  unregisterWidget(widget) {
    this.widgets.delete(widget.widgetId);
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

  async loadDashboard() {
    if (!this.manifestUrl) {
      return;
    }

    const response = await fetch(this.manifestUrl);
    if (!response.ok) {
      throw new Error(`Dashboard manifest failed with ${response.status}`);
    }

    this.dashboard = await response.json();
    this.renderDashboard(this.dashboard);
    await this.refreshViews();
    this.pollTimer = setInterval(
      () => this.refreshViews().catch(() => {}),
      (this.dashboard.refreshSeconds ?? 30) * 1000,
    );
  }

  renderDashboard(dashboard) {
    const shell = this.querySelector(".shell") ?? document.createElement("main");
    shell.className = "shell";
    shell.innerHTML = `
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">Edge analytics</p>
          <h1>${dashboard.title}</h1>
        </div>
        <span class="status">${dashboard.security?.visibility ?? "authenticated"}</span>
      </section>
      <section class="dashboard-grid"></section>
    `;
    if (!shell.parentElement) {
      this.append(shell);
    }

    const grid = shell.querySelector(".dashboard-grid");
    for (const widget of dashboard.widgets) {
      grid.append(this.createWidget(widget, dashboard.security));
    }
  }

  createWidget(widget, dashboardSecurity = {}) {
    const restricted = dashboardSecurity.visibility === "restricted" && !this.token;
    const element = document.createElement(this.tagForKind(widget.kind));
    element.id = widget.id;
    element.setAttribute("widget-id", widget.id);
    element.setAttribute("kind", widget.kind);
    element.setAttribute("metric", widget.query.metric);
    element.setAttribute("label", widget.title ?? widget.query.metric);
    if (widget.query.type) {
      element.setAttribute("type", widget.query.type);
    }
    if (widget.layout) {
      element.style.gridColumn = `span ${widget.layout.columns ?? 1}`;
      element.style.gridRow = `span ${widget.layout.rows ?? 1}`;
    }
    if (restricted) {
      queueMicrotask(() => element.renderDenied?.(401));
    }
    return element;
  }

  tagForKind(kind) {
    return kind === "metric" ? "quasar-metric-card" : "quasar-timeseries-chart";
  }

  async refreshViews() {
    if (!this.dashboard) {
      return;
    }

    for (const widget of this.dashboard.widgets) {
      const element = this.widgets.get(widget.id);
      if (!element) {
        continue;
      }
      if (this.dashboard.security?.visibility === "restricted" && !this.token) {
        element.renderDenied(401);
        continue;
      }

      try {
        element.data = await this.query(widget.query.metric, widget.query);
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          element.renderDenied(error.status);
        } else {
          this.renderProviderError(error);
        }
      }
    }
  }

  async query(metric, query = {}) {
    const headers = { "content-type": "application/json" };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await fetch(`${this.viewEndpoint}/${encodeURIComponent(metric)}`, { headers });
    } catch {
      return this.demoData(metric);
    }

    if (response.status === 404) {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ metric, ...query }),
      });
    }

    if (!response.ok) {
      const error = new Error(`Query failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  demoData(metric) {
    if (metric === "active_users") {
      return { value: 1200 };
    }
    return { values: [12, 18, 16, 24, 31, 28, 36] };
  }

  renderProviderError(error) {
    this.innerHTML = `
      <main class="shell">
        <section class="widget-panel widget-panel--blocked">
          <div class="widget-toolbar">
            <h2>Dashboard unavailable</h2>
            <span>Error</span>
          </div>
          <p class="widget-error">${error.message}</p>
        </section>
      </main>
    `;
  }
}

customElements.define("quasar-provider", QuasarProvider);
