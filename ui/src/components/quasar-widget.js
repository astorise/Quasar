import { gsap } from "gsap";

export class QuasarWidget extends HTMLElement {
  connectedCallback() {
    this.widgetId = this.getAttribute("widget-id") ?? this.id;
    this.metric = this.getAttribute("metric") ?? this.widgetId;
    this.kind = this.getAttribute("kind") ?? "timeseries";
    this.provider?.registerWidget(this);
    this.renderLoading();
  }

  disconnectedCallback() {
    this.provider?.unregisterWidget(this);
  }

  get provider() {
    return this.closest("quasar-provider");
  }

  set data(value) {
    this._data = value;
    this.render(value);
    this.fadeIn();
  }

  get data() {
    return this._data;
  }

  fadeIn() {
    gsap.fromTo(this.firstElementChild, { opacity: 0.55, y: 6 }, { opacity: 1, y: 0, duration: 0.3 });
  }

  renderLoading() {
    this.innerHTML = `
      <section class="widget-panel widget-panel--loading">
        <span class="loading-spinner"></span>
      </section>
    `;
    this.fadeIn();
  }

  renderDenied(status = 403) {
    this.innerHTML = `
      <section class="widget-panel widget-panel--blocked">
        <div class="widget-toolbar">
          <h2>${this.metric}</h2>
          <span>${status === 401 ? "Sign in required" : "Access denied"}</span>
        </div>
        <p class="widget-error">${status === 401 ? "Authentication is required for this dashboard." : "Your account cannot access this dashboard."}</p>
      </section>
    `;
    this.fadeIn();
  }

  render() {}
}
