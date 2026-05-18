import { gsap } from "gsap";

export class QuasarTimeseriesChart extends HTMLElement {
  connectedCallback() {
    this.metric = this.getAttribute("metric") ?? "events";
    this.render();
    this.load();
  }

  get provider() {
    return this.closest("quasar-provider");
  }

  async load() {
    if (!this.provider) {
      return;
    }

    try {
      const result = await this.provider.query(this.metric);
      const values = result.values ?? result.data ?? [12, 18, 16, 24, 31, 28, 36];
      this.render(values);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        this.renderError(error.status);
      } else {
        throw error;
      }
    }
  }

  render(values = [12, 18, 16, 24, 31, 28, 36]) {
    const max = Math.max(...values);
    const points = values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 100 - (value / max) * 82 - 9;
        return `${x},${y}`;
      })
      .join(" ");

    this.innerHTML = `
      <section class="chart-panel">
        <div class="chart-toolbar">
          <h2>${this.metric}</h2>
          <span>${values.at(-1)} events</span>
        </div>
        <svg viewBox="0 0 100 100" role="img" aria-label="${this.metric} timeseries">
          <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
        </svg>
      </section>
    `;
  }

  renderError(status) {
    this.innerHTML = `
      <section class="chart-panel chart-panel--blocked">
        <div class="chart-toolbar">
          <h2>${this.metric}</h2>
          <span>${status === 401 ? "Sign in required" : "Access denied"}</span>
        </div>
        <p class="chart-error">${status === 401 ? "Authentication is required for this dashboard." : "Your account cannot access this dashboard."}</p>
      </section>
    `;
    gsap.fromTo(
      this.querySelector(".chart-panel"),
      { opacity: 0.35, y: 8 },
      { opacity: 1, y: 0, duration: 0.25 },
    );
  }
}

customElements.define("quasar-timeseries-chart", QuasarTimeseriesChart);
