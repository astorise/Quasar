import { gsap } from "gsap";
import { QuasarWidget } from "./quasar-widget.js";

export class QuasarMetricCard extends QuasarWidget {
  connectedCallback() {
    this.currentValue = 0;
    super.connectedCallback();
  }

  render(data = {}) {
    const nextValue = Number(data.value ?? data.total ?? 0);
    this.innerHTML = `
      <section class="widget-panel metric-card">
        <div class="widget-toolbar">
          <h2>${this.getAttribute("label") ?? this.metric}</h2>
          <span>${this.getAttribute("unit") ?? "live"}</span>
        </div>
        <strong class="metric-value">${Math.round(this.currentValue).toLocaleString()}</strong>
      </section>
    `;

    const valueNode = this.querySelector(".metric-value");
    const state = { value: this.currentValue };
    gsap.to(state, {
      value: nextValue,
      duration: 0.3,
      ease: "power2.out",
      onUpdate: () => {
        valueNode.textContent = Math.round(state.value).toLocaleString();
      },
    });
    this.currentValue = nextValue;
  }
}

customElements.define("quasar-metric-card", QuasarMetricCard);
