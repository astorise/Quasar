import { gsap } from "gsap";
import { QuasarWidget } from "./quasar-widget.js";

export class QuasarTimeseriesChart extends QuasarWidget {
  connectedCallback() {
    this.chartType = this.getAttribute("type") ?? "line";
    super.connectedCallback();
  }

  render(data = {}) {
    const values = data.values ?? data.data ?? [12, 18, 16, 24, 31, 28, 36];
    const max = Math.max(...values, 1);
    const points = values
      .map((value, index) => {
        const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
        const y = 100 - (value / max) * 82 - 9;
        return `${x},${y}`;
      })
      .join(" ");
    const areaPoints = `0,100 ${points} 100,100`;

    this.innerHTML = `
      <section class="widget-panel chart-panel">
        <div class="widget-toolbar">
          <h2>${this.getAttribute("label") ?? this.metric}</h2>
          <span>${values.at(-1)} events</span>
        </div>
        <svg viewBox="0 0 100 100" role="img" aria-label="${this.metric} timeseries">
          ${this.chartType === "area" ? `<polygon class="chart-area" points="${areaPoints}"></polygon>` : ""}
          <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
        </svg>
      </section>
    `;
    gsap.fromTo(
      this.querySelector("polyline"),
      { strokeDasharray: 180, strokeDashoffset: 180 },
      { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" },
    );
  }
}

customElements.define("quasar-timeseries-chart", QuasarTimeseriesChart);
