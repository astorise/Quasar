export class QuasarTimeseriesChart extends HTMLElement {
  connectedCallback() {
    this.metric = this.getAttribute("metric") ?? "events";
    this.render();
  }

  render() {
    const values = [12, 18, 16, 24, 31, 28, 36];
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
}

customElements.define("quasar-timeseries-chart", QuasarTimeseriesChart);
